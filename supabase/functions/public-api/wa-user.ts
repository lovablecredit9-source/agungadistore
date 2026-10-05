// WhatsApp Super Bot — user gateway (public-api endpoint `wa_user`).
// Bot hanya meneruskan perintah; semua data dibaca server dengan service role dan
// dibatasi ke visitor_id sesi login bot. Aksi sensitif (klaim/beli) tetap lewat
// function existing (fire-pass) yang memvalidasi sendiri, dengan kunci anti-dobel.

import { handleWaUserExtra } from "./wa-user-extra.ts";
type Sb = any;
const rp = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const clip = (s: string, n: number) => (s || "").length > n ? s.slice(0, n - 1) + "…" : (s || "");

const SECRET_RE = /(sb_(secret|publishable)_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(api[_-]?key|token|password|pin|secret|authorization)\s*[:=]\s*\S+|\b\d{6}\b)/gi;
export const sanitize = (s: unknown) => String(s ?? "").replace(SECRET_RE, "[redacted]").slice(0, 200);

async function hashActor(v: string) {
  if (!v) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("wa-actor:" + v));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function callFn(name: string, body: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, data: j };
}

async function loadFlags(sb: Sb) {
  const { data } = await sb.from("admin_settings").select("setting_key, setting_value").like("setting_key", "wa_%");
  const m: Record<string, string> = Object.fromEntries((data || []).map((r: any) => [r.setting_key, r.setting_value]));
  const on = (k: string) => (m[k] ?? "true") !== "false";
  return { ai: on("wa_feature_ai"), router: on("wa_feature_router"), firepass: on("wa_feature_firepass"), anon: on("wa_feature_anon"), galau: on("wa_feature_galau"), confess: on("wa_feature_confess"), notif: on("wa_feature_notif") };
}

// Rate limit server-side per pengirim (anonim) & kategori, memakai tabel statistik.
async function serverRateLimited(sb: Sb, actor: string | null, category: string, max: number, windowSec: number) {
  if (!actor) return false;
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const { count } = await sb.from("wa_bot_command_stats").select("id", { count: "exact", head: true })
    .eq("actor_hash", actor).eq("category", category).gte("created_at", since);
  return (count || 0) >= max;
}
async function logStat(sb: Sb, row: { command: string; category: string; ok: boolean; latency_ms?: number; error?: string | null; actor_hash: string | null }) {
  await sb.from("wa_bot_command_stats").insert({ ...row, command: clip(row.command, 40), error: row.error ? sanitize(row.error) : null });
}

const bar = (pct: number) => { const f = Math.max(0, Math.min(10, Math.round(pct / 10))); return "█".repeat(f) + "░".repeat(10 - f) + " " + Math.round(pct) + "%"; };
const LOCKS = new Map<string, number>();
function lock(key: string, ms = 15000) { const now = Date.now(); const t = LOCKS.get(key); if (t && now - t < ms) return false; LOCKS.set(key, now); return true; }

// ─────────────── Natural-language router (deterministik, tanpa eksekusi) ───────────────
export function routeText(text: string): { intent: string; command: string; sensitive: boolean } | null {
  const t = text.toLowerCase().trim();
  if (t.length < 3 || t.length > 300) return null;
  const R: [RegExp, string, string, boolean][] = [
    [/\b(saldo|balance)\b.*\b(saya|aku|ku|gue|berapa)\b|\bsaldoku\b|\bberapa saldo/, "saldoku", "!saldoku", false],
    [/\bfire ?pass\b/, "firepass_status", "!firepass", false],
    [/\b(anon|anonim|orang asing|stranger)\b.*\b(ngobrol|chat|cari|carikan|teman)\b|\b(carikan|cari) (orang|teman) (buat|untuk) ngobrol/, "anon_match", "!anonmatch", false],
    [/\b(galau|patah hati|sedih banget|kangen dia|putus|curhat)\b/, "bot_galau", "!galau", false],
    [/\b(pesanan|order)\b.*\b(saya|aku|ku)\b|\bcek (pesanan|order)/, "orders", "!pesanan", false],
    [/\b(tiket)\b.*\b(saya|aku|ku)\b|\bcek tiket/, "tickets", "!tiketku", false],
    [/\bwishlist\b/, "wishlist", "!wishlist", false],
    [/\breferral\b|\bkode ref/, "referral", "!referral", false],
    [/\b(quest|misi)\b.*\b(saya|aku|ku|hari ini)\b/, "quest", "!quest", false],
    [/\bkeranjang\b/, "cart", "!keranjang", false],
    [/\broda diskon\b/, "rodadiskon", "!rodadiskon", false],
    [/\bflash ?sale\b/, "flashsale", "!flashsale", false],
    [/\b(beli|belikan|order|checkout)\b/, "purchase", "!beli", true],
    [/\b(deposit|top ?up|isi saldo)\b/, "deposit", "!deposit", true],
    [/\b(klaim|claim)\b/, "claim", "!klaim", true],
    [/\b(cari|ada|produk|diamond|voucher|murah|termurah|paling laris|di ?bawah|harga)\b/, "product_search", "!ai", false],
  ];
  for (const [re, intent, command, sensitive] of R) if (re.test(t)) return { intent, command, sensitive };
  return null;
}

function fmtProductCards(cards: any[]) {
  const prods = (cards || []).filter((c) => c.kind === "product").slice(0, 6);
  if (!prods.length) return "";
  return "📦 *Produk ditemukan*\n\n" + prods.map((p: any, i: number) => {
    const price = p.promo_price ? `${rp(p.promo_price)} ~${rp(p.price)}~` : rp(p.price);
    return `${i + 1}. ${clip(p.title, 60)}\n   💰 ${price}\n   📦 Stok ${p.stock ?? "-"}\n   🏪 ${p.seller?.name || "-"}${p.seller?.verified ? " ✔️" : ""}\n   🔎 !detailproduk ${p.source === "admin" ? p.id.slice(0, 8) : clip(p.title, 30)}`;
  }).join("\n\n");
}
function fmtOtherCards(cards: any[]) {
  const out: string[] = [];
  for (const c of cards || []) {
    if (c.kind === "voucher") out.push(`🎟️ ${c.code} — potongan ${rp(c.discount)}`);
  }
  return out.length ? "\n\n" + out.slice(0, 6).join("\n") : "";
}

async function anonNick(sb: Sb, vid: string) {
  const { data } = await sb.from("anon_chat_profiles").select("nickname").eq("visitor_id", vid).maybeSingle();
  if (data?.nickname) return data.nickname as string;
  const h = (await hashActor(vid)) || "0000";
  return "Anon-" + h.slice(0, 4).toUpperCase();
}
async function activeAnonSession(sb: Sb, vid: string) {
  const { data } = await sb.from("anon_chat_sessions").select("id, visitor_a, visitor_b, nickname_a, nickname_b, created_at")
    .eq("status", "active").or(`visitor_a.eq.${vid},visitor_b.eq.${vid}`).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

export async function handleWaUser(sb: Sb, body: any) {
  const op = String(body?.op || "");
  const vid = typeof body?.visitor_id === "string" ? body.visitor_id.slice(0, 100) : "";
  const actor = await hashActor(String(body?.actor || body?.phone || vid || ""));
  const flags = await loadFlags(sb);
  const needLogin = () => ({ text: "🔒 Login dulu: !login [user/email/hp] [password]" });
  const off = (f: string) => ({ text: `⛔ Fitur ${f} sedang dinonaktifkan admin.` });

  // ───── analytics (dipanggil bot setelah setiap command) ─────
  if (op === "log") {
    const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 50);
    const clean = await Promise.all(rows.map(async (r: any) => ({
      command: clip(String(r.command || "?").replace(/[^!a-z0-9_]/gi, ""), 40) || "?",
      category: clip(String(r.category || "user"), 20),
      ok: r.ok !== false,
      latency_ms: Math.max(0, Math.min(600000, Number(r.latency_ms) || 0)),
      error: r.error ? sanitize(r.error) : null,
      actor_hash: await hashActor(String(r.actor || "")),
    })));
    if (clean.length) await sb.from("wa_bot_command_stats").insert(clean);
    return { ok: true };
  }

  if (op === "route") {
    if (!flags.router) return { route: null };
    return { route: routeText(String(body.text || "")) };
  }

  // ───── Fire Pass (fire-pass function existing) ─────
  if (op.startsWith("fp_")) {
    if (!flags.firepass) return off("Fire Pass");
    if (!vid) return needLogin();
    if (op === "fp_status" || op === "fp_tiers" || op === "fp_premium") {
      const r = await callFn("fire-pass", { action: "status", visitorId: vid });
      const { season, tiers = [], progress } = r.data || {};
      if (!season) return { text: "🔥 Belum ada season Fire Pass yang aktif." };
      const badges = Number(progress?.badges || 0);
      const reached = tiers.filter((t: any) => badges >= Number(t.badge_required ?? 0));
      const tier = reached.length ? Math.max(...reached.map((t: any) => Number(t.tier_level))) : 0;
      const next = tiers.find((t: any) => Number(t.tier_level) === tier + 1);
      const req = Number(next?.badge_required ?? 0);
      const pct = tiers.length ? (tier / tiers.length) * 100 : 0;
      const prem = !!progress?.is_premium;
      if (op === "fp_status") return { text: [`🔥 *FIRE PASS*`, ``, `Season: *${season.name || season.title || "-"}*`, `Tier: *${tier}* / ${tiers.length}`, `XP (lencana): *${badges}*${next ? ` • tier berikut butuh ${req}` : ""}`, `Premium: *${prem ? "PREMIUM" : "FREE"}*`, `Progress: ${bar(pct)}`, ``, `Menu: !fpmisi • !fptier • !fppremium • !fpriwayat`].join("\n") };
      if (op === "fp_tiers") {
        const cf: number[] = progress?.claimed_free_tiers || []; const cp: number[] = progress?.claimed_premium_tiers || [];
        const rows = tiers.slice(Math.max(0, tier - 2), tier + 6).map((t: any) => {
          const lv = Number(t.tier_level); const open = lv <= tier;
          return `${open ? "🔓" : "🔒"} Tier ${lv}: 🆓 ${t.free_reward_label || "-"}${cf.includes(lv) ? " ✅" : ""} | ⭐ ${t.premium_reward_label || "-"}${cp.includes(lv) ? " ✅" : ""}`;
        });
        return { text: `🏆 *TIER FIRE PASS* (kamu di tier ${tier})\n\n${rows.join("\n") || "-"}\n\nKlaim hadiah tier di website (menu Fire Pass).` };
      }
      const price = season.price_saldo_in ? `Harga: ${rp(season.price_saldo_in)} Saldo IN${season.price_gems ? ` atau ${season.price_gems} 💎` : ""}\n` : "";
      return { text: `⭐ *FIRE PASS PREMIUM*\nStatus: ${prem ? "✅ PREMIUM aktif" : "FREE"}\n${price}\nPremium membuka hadiah jalur ⭐ di setiap tier.\n${prem ? "" : "Pembelian premium dilakukan di website (menu Fire Pass) dengan PIN, agar transaksi tervalidasi."}` };
    }
    if (op === "fp_missions") {
      const r = await callFn("fire-pass", { action: "list_missions", visitorId: vid });
      const ms: any[] = r.data?.missions || [];
      if (!ms.length) return { text: "🎯 Belum ada misi Fire Pass aktif." };
      const groups: [string, string][] = [["daily", "🎯 Daily"], ["weekly", "🎯 Weekly"], ["monthly", "🎯 Monthly"], ["premium", "⭐ Premium"]];
      const out: string[] = ["🎯 *MISI FIRE PASS*"];
      let claimable = 0;
      for (const [k, label] of groups) {
        const list = ms.filter((m) => (k === "premium" ? (m.mission_type === "premium" || m.mission_type === "pro") : m.mission_type === k));
        if (!list.length) continue;
        out.push("", `*${label}*`);
        for (const m of list.slice(0, 10)) {
          const st = m.is_claimed ? "✅ diklaim" : m.is_completed ? "🎁 bisa klaim" : `${m.current_value ?? 0}/${m.target_value ?? m.target ?? "?"}`;
          if (m.is_completed && !m.is_claimed) claimable++;
          out.push(`• ${clip(m.title, 50)} (+${m.badge_reward || 1}) — ${st}\n  ID: ${String(m.id).slice(0, 8)}`);
        }
      }
      out.push("", claimable ? `Klaim: *!fpclaim [ID]* (${claimable} siap)` : "Selesaikan misi lalu klaim dengan !fpclaim [ID]");
      return { text: out.join("\n") };
    }
    if (op === "fp_claim") {
      const short = String(body.mission_id || "").trim().toLowerCase();
      if (short.length < 4) return { text: "⚠️ Format: !fpclaim [ID misi] (lihat !fpmisi)" };
      if (!lock(`fpclaim:${vid}`, 8000)) return { text: "⏳ Klaim sebelumnya masih diproses." };
      const list = await callFn("fire-pass", { action: "list_missions", visitorId: vid });
      const m = (list.data?.missions || []).find((x: any) => String(x.id).toLowerCase().startsWith(short));
      if (!m) return { text: "❌ Misi tidak ditemukan. Cek !fpmisi" };
      const r = await callFn("fire-pass", { action: "claim_mission", visitorId: vid, missionId: m.id });
      if (!r.ok || r.data?.error) return { text: "❌ " + sanitize(r.data?.error || "Gagal klaim") };
      return { text: `✅ Misi *${clip(m.title, 50)}* diklaim! +${r.data.badges_awarded || m.badge_reward || 1} lencana 🔥` };
    }
    if (op === "fp_history") {
      const r = await callFn("fire-pass", { action: "history", visitorId: vid });
      const d = r.data || {};
      const ms = (d.missions || []).slice(0, 8).map((m: any) => `• ${clip(m.title, 40)} +${m.badge_reward}`);
      const ts = (d.tiers || []).slice(0, 8).map((t: any) => `• Tier ${t.tier_level} ${t.track === "premium" ? "⭐" : "🆓"} ${t.label || ""}`);
      return { text: `📜 *RIWAYAT FIRE PASS*\n\n🎯 Misi diklaim:\n${ms.join("\n") || "-"}\n\n🏆 Hadiah tier:\n${ts.join("\n") || "-"}` };
    }
    return { text: "❓ Perintah Fire Pass tidak dikenal." };
  }

  // ───── Anonymous Chat (RPC & tabel existing, identitas anonim) ─────
  if (op.startsWith("anon_")) {
    if (!flags.anon) return off("Anon Chat");
    if (!vid) return needLogin();
    if (op === "anon_match") {
      if (await serverRateLimited(sb, actor, "anon_match", 6, 60)) return { text: "⏳ Terlalu banyak permintaan. Coba lagi beberapa saat." };
      await logStat(sb, { command: "anonmatch", category: "anon_match", ok: true, actor_hash: actor });
      const nick = await anonNick(sb, vid);
      const { data, error } = await sb.rpc("anon_chat_find_or_queue", { p_visitor: vid, p_nickname: nick, p_my_gender: "any", p_pref_gender: "any", p_interest: "any" });
      if (error) return { text: "❌ Gagal mencari pasangan. Coba lagi." };
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.session_id) return { matched: true, session_id: row.session_id, text: `🎉 *MATCH!*\nPartner anonim ditemukan: *${clip(row.partner_nickname || "Anon", 30)}*\n\nKetik pesan biasa untuk mengobrol.\n!anonstop untuk mengakhiri.` };
      return { queued: true, text: "🔎 Mencari pasangan anonim... Kamu akan diberi tahu saat match.\n!anonstop untuk batal." };
    }
    if (op === "anon_stop") {
      const s = await activeAnonSession(sb, vid);
      await sb.rpc("anon_chat_leave_queue", { p_visitor: vid });
      if (s) await sb.rpc("anon_chat_end_session", { p_session: s.id, p_visitor: vid });
      return { text: s ? "👋 Chat anonim diakhiri." : "ℹ️ Pencarian dibatalkan / tidak ada chat aktif." };
    }
    if (op === "anon_status") {
      const s = await activeAnonSession(sb, vid);
      if (s) { const partner = s.visitor_a === vid ? s.nickname_b : s.nickname_a; return { active: true, session_id: s.id, text: `💬 Chat aktif dengan *${clip(partner || "Anon", 30)}*.\nKetik pesan biasa untuk mengirim. !anonstop untuk akhiri.` }; }
      const { data: q } = await sb.from("anon_chat_queue").select("id").eq("visitor_id", vid).maybeSingle();
      return { active: false, queued: !!q, text: q ? "🔎 Sedang dalam antrian mencari pasangan." : "ℹ️ Tidak ada chat anonim aktif. Ketik !anonmatch" };
    }
    if (op === "anon_profile") {
      const { data } = await sb.from("anon_chat_profiles").select("nickname, bio").eq("visitor_id", vid).maybeSingle();
      const newNick = String(body.nickname || "").trim().slice(0, 20);
      if (newNick) {
        if (!/^[\p{L}\p{N} _.-]{3,20}$/u.test(newNick)) return { text: "⚠️ Nickname 3-20 karakter (huruf/angka)." };
        await sb.from("anon_chat_profiles").upsert({ visitor_id: vid, nickname: newNick, updated_at: new Date().toISOString() }, { onConflict: "visitor_id" });
        return { text: `✅ Nickname anon diubah jadi *${newNick}*` };
      }
      return { text: `👤 *PROFIL ANON*\nNickname: *${data?.nickname || await anonNick(sb, vid)}*\nBio: ${clip(data?.bio || "-", 120)}\n\nUbah: !anonprofile [nickname baru]` };
    }
    if (op === "anon_friends") {
      const { data } = await sb.from("anon_chat_friends").select("friend_nickname, created_at").eq("visitor_id", vid).order("created_at", { ascending: false }).limit(20);
      return { text: `👥 *TEMAN ANON*\n${(data || []).map((f: any, i: number) => `${i + 1}. ${clip(f.friend_nickname || "Anon", 30)}`).join("\n") || "Belum ada teman."}\n\nTambah teman & chat teman tersedia di website (Anon Chat).` };
    }
    if (op === "anon_send") {
      const text = String(body.text || "").trim().slice(0, 2000);
      if (!text) return { ok: false };
      if (await serverRateLimited(sb, actor, "anon_msg", 40, 60)) return { ok: false, text: "⏳ Terlalu banyak pesan. Coba lagi beberapa saat." };
      const s = await activeAnonSession(sb, vid);
      if (!s) return { ok: false, text: "ℹ️ Chat anonim sudah berakhir." };
      const { error } = await sb.from("anon_chat_messages").insert({ session_id: s.id, sender_visitor_id: vid, content: text });
      await logStat(sb, { command: "anonmsg", category: "anon_msg", ok: !error, actor_hash: actor });
      return { ok: !error };
    }
    if (op === "anon_poll") {
      // Ambil pesan partner sejak `since` untuk sesi aktif (maks 20). Tidak mengirim identitas apa pun.
      const since = typeof body.since === "string" ? body.since : new Date(Date.now() - 60000).toISOString();
      const s = await activeAnonSession(sb, vid);
      if (!s) return { active: false, messages: [] };
      const partner = s.visitor_a === vid ? s.nickname_b : s.nickname_a;
      const { data } = await sb.from("anon_chat_messages").select("content, media_type, created_at")
        .eq("session_id", s.id).neq("sender_visitor_id", vid).eq("is_deleted", false).gt("created_at", since).order("created_at").limit(20);
      return { active: true, session_id: s.id, partner: clip(partner || "Anon", 30), messages: (data || []).map((m: any) => ({ text: m.content || (m.media_type ? `[${m.media_type} — buka di website]` : ""), at: m.created_at })) };
    }
    return { text: "❓ Perintah Anon tidak dikenal." };
  }

  // ───── Store AI (store-ai-chat existing) ─────
  if (op === "ai") {
    if (!flags.ai) return off("Store AI");
    if (await serverRateLimited(sb, actor, "ai", 8, 60)) return { text: "⏳ Terlalu banyak permintaan. Coba lagi beberapa saat." };
    const history = (Array.isArray(body.history) ? body.history : []).slice(-8).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 1500) }));
    const msg = String(body.text || "").trim().slice(0, 1500);
    if (!msg) return { text: "⚠️ Format: !ai [pertanyaan]" };
    const t0 = Date.now();
    const r = await callFn("store-ai-chat", { visitorId: vid || null, messages: [...history, { role: "user", content: msg }] });
    await logStat(sb, { command: "ai", category: "ai", ok: r.ok, latency_ms: Date.now() - t0, error: r.ok ? null : String(r.data?.error || r.status), actor_hash: actor });
    if (r.status === 429) return { text: "⏳ Store AI sedang sibuk. Coba lagi beberapa saat." };
    if (!r.ok) return { text: "❌ Store AI sedang gangguan. Coba lagi." };
    const reply = String(r.data?.reply || "").slice(0, 2500);
    const cards = r.data?.cards || [];
    const prods = fmtProductCards(cards);
    return { reply, text: `🤖 *Store AI*\n\n${reply}${prods ? "\n\n" + prods : ""}${fmtOtherCards(cards)}${vid ? "" : "\n\n💡 Login (!login) agar AI bisa membaca saldo/pesananmu."}` };
  }

  // ───── Bot Galau (bot-galau-ai existing) ─────
  if (op === "galau") {
    if (!flags.galau) return off("Bot Galau");
    if (await serverRateLimited(sb, actor, "galau", 10, 60)) return { text: "⏳ Terlalu banyak permintaan. Coba lagi beberapa saat." };
    const history = (Array.isArray(body.history) ? body.history : []).slice(-10).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 1500) }));
    const msg = String(body.text || "").trim().slice(0, 1500);
    if (!msg) return { text: "💔 Ceritakan apa yang kamu rasakan. Contoh: !galau aku masih kangen dia" };
    const t0 = Date.now();
    const r = await callFn("bot-galau-ai", { messages: [...history, { role: "user", content: msg }], mood: "butuh teman", aiMode: "biasa", responseStyle: "hangat" });
    await logStat(sb, { command: "galau", category: "galau", ok: r.ok, latency_ms: Date.now() - t0, error: r.ok ? null : String(r.data?.error || r.status), actor_hash: actor });
    if (!r.ok) return { text: "💔 Bot Galau lagi ada gangguan. Coba lagi ya." };
    const reply = String(r.data?.reply || "").slice(0, 3000);
    return { reply, text: `💔 *Bot Galau:*\n\n${reply}` };
  }

  // ───── Pesanan marketplace milik sendiri ─────
  if (op === "orders") {
    if (!vid) return needLogin();
    const { data } = await sb.from("seller_orders").select("order_code, order_number, product_title, store_name, grand_total, total, status, created_at")
      .eq("buyer_visitor_id", vid).order("created_at", { ascending: false }).limit(10);
    const label: Record<string, string> = { pending: "Menunggu diproses", paid: "Dibayar", processing: "Diproses", shipped: "Dikirim", delivered: "Terkirim", completed: "Selesai", cancelled: "Dibatalkan", refunded: "Dikembalikan", disputed: "Dalam laporan" };
    const rows = (data || []).map((o: any) => `#${o.order_code || o.order_number}\n🛍️ ${clip(o.product_title || "-", 40)} • ${clip(o.store_name || "-", 25)}\n💰 ${rp(o.grand_total || o.total)}\n📌 ${label[o.status] || o.status}`);
    return { text: `📦 *PESANAN*\n\n${rows.join("\n\n") || "Belum ada pesanan marketplace."}` };
  }

  // ───── Notifikasi pintar (dari tabel notifications existing) ─────
  if (op === "notif_poll") {
    if (!flags.notif || !vid) return { items: [] };
    const since = typeof body.since === "string" ? body.since : new Date(Date.now() - 120000).toISOString();
    const { data } = await sb.from("notifications").select("title, message, type, created_at").eq("visitor_id", vid).gt("created_at", since).order("created_at").limit(3);
    return { items: (data || []).map((n: any) => ({ text: `🔔 *${clip(n.title, 80)}*\n${clip(n.message || "", 300)}`, at: n.created_at })) };
  }

  if (op === "confess_status") {
    if (!flags.confess) return off("Confess");
    return { text: "💌 Status Confess: " + (flags.confess ? "AKTIF" : "OFF") };
  }

  const EXTRA = ["referral", "wishlist", "rodadiskon", "quest", "lagaquest", "premium", "ruangku", "anonpremium", "cart", "order_action", "review", "dispute", "orderchat", "toko"];
  if (EXTRA.includes(op)) {
    if (await serverRateLimited(sb, actor, "extra", 30, 60)) return { text: "⏳ Terlalu banyak permintaan. Coba lagi beberapa saat." };
    const t0 = Date.now();
    try {
      const res = await handleWaUserExtra(sb, op, body, vid);
      await logStat(sb, { command: op, category: "extra", ok: true, latency_ms: Date.now() - t0, actor_hash: actor });
      if (res) return res;
    } catch (e) {
      await logStat(sb, { command: op, category: "extra", ok: false, latency_ms: Date.now() - t0, error: String((e as Error)?.message || e), actor_hash: actor });
      return { text: "❌ Terjadi kesalahan. Coba lagi." };
    }
  }

  return { text: "❓ Perintah tidak dikenal." };
}

// Statistik untuk admin (!botstats / !boterrors / !botstatus)
export async function waUserStats(sb: Sb) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const c = async (q: any) => (await q).count || 0;
  const base = () => sb.from("wa_bot_command_stats").select("id", { count: "exact", head: true }).gte("created_at", since);
  const [total, errors, ai, galau, anonm, anonmsg, actorsRes, confess, activeAnon] = await Promise.all([
    c(base()), c(base().eq("ok", false)), c(base().eq("category", "ai")), c(base().eq("category", "galau")),
    c(base().eq("category", "anon_match")), c(base().eq("category", "anon_msg")),
    sb.from("wa_bot_command_stats").select("actor_hash").gte("created_at", since).limit(5000),
    c(sb.from("confess_thread_messages").select("id", { count: "exact", head: true }).gte("created_at", since)),
    c(sb.from("anon_chat_sessions").select("id", { count: "exact", head: true }).eq("status", "active")),
  ]);
  const actors = new Set((actorsRes.data || []).map((r: any) => r.actor_hash).filter(Boolean)).size;
  const { data: top } = await sb.from("wa_bot_command_stats").select("command").gte("created_at", since).limit(5000);
  const cnt: Record<string, number> = {};
  for (const r of top || []) cnt[r.command] = (cnt[r.command] || 0) + 1;
  const topList = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `• ${k}: ${v}`).join("\n");
  // Abuse: pengirim anonim dengan > 60 command/jam terakhir
  const hr = new Date(Date.now() - 3600 * 1000).toISOString();
  const { data: recent } = await sb.from("wa_bot_command_stats").select("actor_hash").gte("created_at", hr).limit(5000);
  const per: Record<string, number> = {};
  for (const r of recent || []) if (r.actor_hash) per[r.actor_hash] = (per[r.actor_hash] || 0) + 1;
  const abusers = Object.entries(per).filter(([, v]) => v > 60).length;
  return `📊 *BOT STATS (24 jam)*\nPengguna aktif (anonim): ${actors}\nCommand: ${total}\nError: ${errors}\nAI request: ${ai}\nBot Galau: ${galau}\nAnon match: ${anonm} • pesan anon: ${anonmsg}\nSesi anon aktif: ${activeAnon}\nAktivitas Confess: ${confess} pesan\nIndikasi spam (>60 cmd/jam): ${abusers}\n\nTop command:\n${topList || "-"}`;
}
export async function waUserErrors(sb: Sb) {
  const { data } = await sb.from("wa_bot_command_stats").select("command, error, created_at").eq("ok", false).order("created_at", { ascending: false }).limit(10);
  return (data || []).map((r: any) => `• ${r.command} — ${sanitize(r.error || "-")} (${new Date(r.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })})`).join("\n") || "-";
}
export async function serviceStatus(sb: Sb) {
  const t0 = Date.now();
  const db = await sb.from("admin_settings").select("setting_key", { head: true, count: "exact" }).limit(1);
  const dbMs = Date.now() - t0;
  const fp = await sb.from("fire_pass_seasons").select("id", { head: true, count: "exact" }).limit(1);
  const anon = await sb.from("anon_chat_sessions").select("id", { head: true, count: "exact" }).limit(1);
  const flags = await loadFlags(sb);
  const s = (ok: boolean, on = true) => (!on ? "⚪ OFF" : ok ? "🟢 Online" : "🔴 Error");
  return [
    `🟢 API: Online`,
    `${db.error ? "🔴" : "🟢"} Database: ${db.error ? "Error" : `Online (${dbMs} ms)`}`,
    `Store AI: ${s(!!Deno.env.get("LOVABLE_API_KEY"), flags.ai)}`,
    `Bot Galau: ${s(true, flags.galau)}`,
    `Fire Pass: ${s(!fp.error, flags.firepass)}`,
    `Anon Chat: ${s(!anon.error, flags.anon)}`,
    `Confess: ${s(true, flags.confess)} • Notif: ${s(true, flags.notif)}`,
  ].join("\n");
}
