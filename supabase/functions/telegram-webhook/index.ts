import { createClient } from "npm:@supabase/supabase-js@2";

const WEB_URL = "https://agungadistore.lovable.app";
const WA_NUMBER = "6285769302532";

function tgApi(token: string, method: string, payload: unknown) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// Send a photo (raw bytes) via multipart upload with a caption.
async function tgSendPhotoBytes(
  token: string,
  chatId: string,
  bytes: Uint8Array,
  caption: string,
  replyMarkup?: unknown,
) {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));
  form.append("photo", new Blob([bytes], { type: "image/png" }), "welcome.png");
  return fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
}

// Fetch the user's Telegram profile photo as base64 data URL (largest size). Null if none.
async function fetchTelegramProfilePhoto(token: string, userId: number | string): Promise<string | null> {
  try {
    const res = await tgApi(token, "getUserProfilePhotos", { user_id: userId, limit: 1 });
    const j = await res.json();
    const sizes = j?.result?.photos?.[0];
    if (!Array.isArray(sizes) || !sizes.length) return null;
    const fileId = sizes[sizes.length - 1].file_id;
    const fRes = await tgApi(token, "getFile", { file_id: fileId });
    const fj = await fRes.json();
    const filePath = fj?.result?.file_path;
    if (!filePath) return null;
    const dl = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!dl.ok) return null;
    const buf = new Uint8Array(await dl.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return `data:image/jpeg;base64,${btoa(bin)}`;
  } catch (_) {
    return null;
  }
}

// Generate an AI welcome card image (uses profile photo when available). Returns PNG bytes or null.
async function generateWelcomeImage(displayName: string, photoDataUrl: string | null): Promise<Uint8Array | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const prompt = `Buat sebuah kartu ucapan "SELAMAT DATANG" yang elegan dan modern untuk toko online "Agung Adi Store". `
      + `Sertakan nama pengguna "${displayName}". `
      + (photoDataUrl
        ? `Gunakan foto profil yang dilampirkan sebagai foto lingkaran di tengah kartu, diberi bingkai bercahaya. `
        : `Tampilkan avatar lingkaran dekoratif di tengah kartu. `)
      + `Gaya: gradien ungu-biru mewah, glassmorphism, bokeh cahaya, teks "SELAMAT DATANG" besar dan jelas, rapi, kualitas tinggi, rasio persegi.`;
    const content: unknown[] = [{ type: "text", text: prompt }];
    if (photoDataUrl) content.push({ type: "image_url", image_url: { url: photoDataUrl } });
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) { console.error("welcome image gen error", resp.status, await resp.text()); return null; }
    const data = await resp.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return null;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch (e) {
    console.error("welcome image gen exception", e);
    return null;
  }
}

// Send an automatic welcome image on /start. Falls back gracefully.
async function sendWelcomeImage(token: string, chatId: string, from: any) {
  try {
    const uid = from?.id;
    if (!uid) return;
    const username = from?.username ? `@${from.username}` : "-";
    const displayName = from?.first_name
      ? `${from.first_name}${from.last_name ? " " + from.last_name : ""}`
      : (from?.username || "Teman");
    const photoDataUrl = await fetchTelegramProfilePhoto(token, uid);
    const caption = `🎉 <b>Selamat Datang, ${esc(displayName)}!</b>\n\n`
      + `🆔 ID Telegram: <code>${uid}</code>\n`
      + `👤 Username: ${esc(username)}\n\n`
      + `Terima kasih sudah bergabung di <b>Agung Adi Store</b> — Murah &amp; Terpercaya. 💜`;
    const img = await generateWelcomeImage(displayName, photoDataUrl);
    if (img) {
      const r = await tgSendPhotoBytes(token, chatId, img, caption);
      if (r.ok) return;
    }
    // fallback: kirim foto profil apa adanya kalau ada
    if (photoDataUrl) {
      const bin = atob(photoDataUrl.split(",")[1]);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const r = await tgSendPhotoBytes(token, chatId, buf, caption);
      if (r.ok) return;
    }
    // fallback terakhir: teks saja
    await tgApi(token, "sendMessage", { chat_id: chatId, text: caption, parse_mode: "HTML" });
  } catch (e) {
    console.error("sendWelcomeImage error", e);
  }
}

// Send a new message, OR edit an existing one (used on button clicks to avoid spam).
// When editMsgId is set the current message is edited in place; otherwise a new
// message is sent. Falls back to sendMessage if the edit fails.
async function sendOrEdit(
  token: string,
  chatId: string,
  editMsgId: number | null,
  payload: Record<string, unknown>,
) {
  if (editMsgId) {
    const res = await tgApi(token, "editMessageText", { chat_id: chatId, message_id: editMsgId, ...payload });
    if (res.ok) return res;
    // e.g. "message is not modified" -> nothing to do; other errors -> send fresh
    try {
      const body = await res.clone().json();
      const desc = String(body?.description || "");
      if (desc.includes("not modified")) return res;
    } catch (_) { /* ignore */ }
  }
  return tgApi(token, "sendMessage", { chat_id: chatId, ...payload });
}

const MENU = {
  inline_keyboard: [
    [{ text: "🛒 Produk", callback_data: "produk" }, { text: "💰 Saldo", callback_data: "saldo" }],
    [{ text: "🎮 Game", callback_data: "game" }, { text: "🎵 Musik", callback_data: "musik" }],
    [{ text: "🎯 Quest", callback_data: "quest" }, { text: "💬 Confess", callback_data: "confess" }],
    [{ text: "🏆 Peringkat", callback_data: "peringkat" }, { text: "🔥 Streak", callback_data: "streak" }],
    [{ text: "🏪 Streak Shop", callback_data: "shop" }, { text: "🎡 Roda Diskon", callback_data: "roda" }],
    [{ text: "📜 Riwayat", callback_data: "riwayat" }, { text: "🎫 Voucher", callback_data: "voucher" }],
    [{ text: "📢 Info Toko", callback_data: "info_toko" }, { text: "🤝 Sponsor", callback_data: "sponsor" }],
    [{ text: "👑 Membership", callback_data: "membership" }, { text: "🌐 Sosmed", callback_data: "sosmed" }],
    [{ text: "👤 Akun", callback_data: "akun" }, { text: "🎧 Live CS", callback_data: "cs" }],
    [{ text: "🔑 Login", callback_data: "login" }, { text: "📝 Daftar", callback_data: "daftar" }],
    [{ text: "🌐 Buka Website", url: WEB_URL }],
  ],
};

// Back-to-menu keyboard. Pass extra rows to prepend action buttons.
function backKb(extraRows: any[] = []) {
  return { inline_keyboard: [...extraRows, [{ text: "🏠 Menu Utama", callback_data: "menu" }]] };
}

const CANCEL_KB = { inline_keyboard: [[{ text: "❌ Batal", callback_data: "batal" }]] };

function wibNow() {
  const now = new Date();
  const hari = now.toLocaleDateString("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" });
  const tanggal = now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });
  return { hari, tanggal, jam, full: `${hari}, ${tanggal} • ${jam} WIB` };
}

function uptimeText(activatedAt: string | null): string {
  if (!activatedAt) return "baru saja";
  const ms = Date.now() - new Date(activatedAt).getTime();
  if (ms < 0) return "baru saja";
  const totalMin = Math.floor(ms / 60000);
  const hari = Math.floor(totalMin / 1440);
  const jam = Math.floor((totalMin % 1440) / 60);
  const menit = totalMin % 60;
  const parts: string[] = [];
  if (hari > 0) parts.push(`${hari} hari`);
  if (jam > 0) parts.push(`${jam} jam`);
  parts.push(`${menit} menit`);
  return parts.join(" ");
}

// ===== helpers =====
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normPhone(p: string): string | null {
  const d = String(p || "").replace(/\D/g, "");
  if (!d) return null;
  const n = d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("62") ? d : d.startsWith("8") ? "62" + d : d;
  if (n.length < 9 || n.length > 16) return null;
  return n;
}

function maskPhone(p: string): string {
  if (!p) return "****";
  const local = p.startsWith("62") ? "0" + p.slice(2) : p;
  if (local.length < 6) return local;
  return local.slice(0, 4) + "****" + local.slice(-4);
}

function randomLoginCode(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function uniqueLoginCode(admin: any): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = randomLoginCode();
    const { data } = await admin.from("user_balances").select("id").eq("login_code", code).maybeSingle();
    if (!data) return code;
  }
  return randomLoginCode(9);
}

function fmtRp(n: number): string {
  return "Rp " + (Number(n) || 0).toLocaleString("id-ID");
}

function sectionText(key: string): string {
  switch (key) {
    case "akun":
      return `👤 <b>Akun</b>\n\nKelola profil, foto profil, status akun, PIN, 2FA, dan keamanan akun kamu.\n\nBuka: ${WEB_URL}/ruang-ku`;
    case "cs":
      return `🎧 <b>Live CS</b>\n\nKetik langsung pesan kamu di sini. Pesan akan diteruskan ke admin dan dibalas secepatnya. 💌`;
    case "game":
      return `🎮 <b>Game Center</b>\n\n🤖 <b>Game AI</b> — Tebak Kata, Tebak Gambar, Tebak Lagu, Kuis, Teka-teki & lainnya.\n🎰 <b>Slot 3 Reel</b> — putar & menang jackpot koin.\n🎯 <b>Lucky Draw</b> — tarik hadiah acak dengan tiket.\n💎 <b>Lucky Royale (Nyawa)</b> — spin bertingkat berhadiah gem.\n\nKumpulkan poin, naik level, selesaikan quest harian/mingguan/bulanan.\n\nMain sekarang: ${WEB_URL}/game`;
    default:
      return "";
  }
}

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ===== dynamic info sections =====
async function getActiveVisitorId(admin: any, row: any): Promise<string | null> {
  return row?.tg_visitor_id || null;
}

async function renderSection(admin: any, token: string, chatId: string, key: string, visitorId: string | null, editMsgId: number | null = null): Promise<boolean> {
  const send = (text: string, kb: unknown = backKb()) =>
    sendOrEdit(token, chatId, editMsgId, { text, parse_mode: "HTML", reply_markup: kb, disable_web_page_preview: true });

  if (key === "produk") {
    const { data: rows } = await admin.from("products").select("title, price, stock, category, sold_count").order("created_at", { ascending: false }).limit(12);
    const list = rows || [];
    if (!list.length) { await send("🛒 <b>Produk</b>\n\nBelum ada produk tersedia."); return true; }
    let t = "🛒 <b>Daftar Produk</b>\n\n";
    const buyRows: any[] = [];
    for (const p of list) {
      const stok = (p.stock || 0) > 0 ? `📦 Stok: ${p.stock}` : "❌ Habis";
      t += `• <b>${esc(p.title)}</b>\n  💵 ${fmtRp(p.price)} • ${stok} • 🔥 Terjual: ${p.sold_count || 0}\n`;
      if ((p.stock || 0) > 0) {
        const waText = encodeURIComponent(`Halo Admin, saya mau beli produk *${p.title}* (${fmtRp(p.price)}) dari Agung Adi Store.`);
        buyRows.push([{ text: `🛒 Beli ${p.title.slice(0, 22)}`, url: `https://wa.me/${WA_NUMBER}?text=${waText}` }]);
      }
    }
    t += `\n💬 Klik tombol di bawah untuk beli langsung lewat WhatsApp, atau buka website.`;
    const rowsKb = buyRows.slice(0, 8);
    rowsKb.push([{ text: "🌐 Buka Toko", url: WEB_URL }]);
    await send(t, backKb(rowsKb));
    return true;
  }

  if (key === "musik") {
    const { data: rows } = await admin.from("playlist_songs").select("title, artist, file_url").order("created_at", { ascending: false }).limit(10);
    const list = rows || [];
    if (!list.length) { await send("🎵 <b>Musik</b>\n\nBelum ada lagu."); return true; }
    let t = "🎵 <b>Musik Toko</b> — putar / download 👇\n\n";
    const musicRows: any[] = [];
    for (const s of list) {
      t += `🎧 <b>${esc(s.title)}</b> — ${esc(s.artist || "Unknown")}\n`;
      if (s.file_url) {
        musicRows.push([
          { text: `▶️ ${s.title.slice(0, 18)}`, url: s.file_url },
          { text: "⬇️ Download", url: s.file_url },
        ]);
      }
    }
    t += `\n▶️ = putar • ⬇️ = download. Semua lagu ada di website.`;
    const mkb = musicRows.slice(0, 9);
    mkb.push([{ text: "🌐 Semua Lagu", url: WEB_URL + "/musik" }]);
    await send(t, backKb(mkb));
    return true;
  }

  if (key === "quest") {
    if (!visitorId) {
      await send("🎯 <b>Quest Mingguan</b>\n\n🔒 Login dulu untuk lihat & klaim quest kamu.", backKb([[{ text: "🔑 Login", callback_data: "login" }]]));
      return true;
    }
    try {
      const { data: qd } = await admin.functions.invoke("weekly-quest", { body: { action: "status", visitorId } });
      const quests = (qd as any)?.quests || [];
      const progress = (qd as any)?.progress || [];
      if (!quests.length) { await send("🎯 <b>Quest Mingguan</b>\n\nBelum ada quest aktif minggu ini."); return true; }
      let t = "🎯 <b>Quest Mingguan</b>\n\n";
      const claimRows: any[] = [];
      for (const q of quests) {
        const p = progress.find((x: any) => x.quest_id === q.id);
        const cur = p?.current_value ?? 0;
        const done = p?.is_completed ?? false;
        const claimed = !!p?.claimed_at;
        const status = claimed ? "✅ Diklaim" : done ? "🎁 Siap klaim!" : `⏳ ${cur}/${q.target_value}`;
        t += `${q.icon || "🎯"} <b>${esc(q.title)}</b>\n   ${esc(q.description || "")}\n   ${status} • 🪙${q.reward_coins} ✨${q.reward_xp}xp\n\n`;
        if (done && !claimed) claimRows.push([{ text: `🎁 Klaim: ${q.title.slice(0, 20)}`, callback_data: `qclaim_${q.id}` }]);
      }
      await send(t, backKb(claimRows));
    } catch (_) {
      await send(`🎯 <b>Quest Mingguan</b>\n\nGagal memuat quest. Coba lagi nanti.`);
    }
    return true;
  }


  if (key === "info_toko") {
    const { data: rows } = await admin.from("admin_posts").select("title, content, created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(6);
    const list = rows || [];
    if (!list.length) { await send("📢 <b>Info Toko</b>\n\nBelum ada postingan admin."); return true; }
    let t = "📢 <b>Postingan Admin</b>\n\n";
    for (const p of list) {
      const c = (p.content || "").replace(/<[^>]+>/g, "").slice(0, 200);
      t += `📌 <b>${esc(p.title)}</b>\n${esc(c)}\n\n`;
    }
    t += `Selengkapnya: ${WEB_URL}/`;
    await send(t);
    return true;
  }

  if (key === "sponsor") {
    const { data: rows } = await admin.from("sponsors").select("title, price, seller_name, category, sponsor_number").eq("is_active", true).order("created_at", { ascending: false }).limit(10);
    const list = rows || [];
    if (!list.length) { await send("🤝 <b>Sponsor</b>\n\nBelum ada sponsor aktif."); return true; }
    let t = "🤝 <b>Sponsor / Iklan</b>\n\n";
    for (const s of list) {
      t += `#${s.sponsor_number} • <b>${esc(s.title)}</b>\n  💵 ${fmtRp(s.price)} • 👤 ${esc(s.seller_name || "-")}\n`;
    }
    t += `\n⚠️ Transaksi aman pakai Rekber. Lihat: ${WEB_URL}/`;
    await send(t);
    return true;
  }

  if (key === "sosmed") {
    const { data: rows } = await admin.from("social_links").select("label, url, platform").eq("is_active", true).order("sort_order");
    const list = rows || [];
    let t = "🌐 <b>Sosial Media Admin</b>\n\n";
    if (list.length) {
      for (const s of list) t += `• <b>${esc(s.label)}</b>: ${s.url}\n`;
    } else {
      t += `• YouTube: https://youtube.com/@channelmodagungadi\n• Instagram: https://instagram.com/agungadi57\n• TikTok: https://tiktok.com/@pphitampro9\n• WhatsApp: https://wa.me/6285769302532\n`;
    }
    await send(t);
    return true;
  }

  if (key === "peringkat") {
    const { data: rows } = await admin.from("game_profiles").select("display_name, gems").order("gems", { ascending: false }).limit(10);
    const list = rows || [];
    if (!list.length) { await send("🏆 <b>Peringkat</b>\n\nBelum ada data peringkat."); return true; }
    const medal = ["🥇", "🥈", "🥉"];
    let t = "🏆 <b>Peringkat Pemain (Gem Terbanyak)</b>\n\n";
    list.forEach((p: any, i: number) => {
      t += `${medal[i] || (i + 1) + "."} ${esc(p.display_name || "Anonim")} — ${Number(p.gems || 0).toLocaleString("id-ID")} 💎\n`;
    });
    t += `\nLihat lengkap: ${WEB_URL}/game`;
    await send(t);
    return true;
  }

  if (key === "roda") {
    await send(`🎡 <b>Roda Diskon Harian</b>\n\nPutar roda tiap hari untuk dapat diskon <b>5%–90%</b>! Spin pertama gratis, selanjutnya cukup beli 1 item atau refresh 5 gem.\n\n🎁 Ada juga hadiah samping item Streak & Lucky dengan harga diskon.\n\nPutar sekarang: ${WEB_URL}/`);
    return true;
  }

  if (key === "streak") {
    if (!visitorId) {
      await send(`🔥 <b>Daily Streak</b>\n\nClaim streak harian otomatis reset 00:00 WIB. Makin panjang streak makin besar hadiah koin & gem-nya.\n\nLogin dulu untuk lihat streak kamu.`, backKb([[{ text: "🔑 Login", callback_data: "login" }]]));
      return true;
    }
    const { data: s } = await admin.from("daily_streaks").select("current_streak, longest_streak, total_claims").eq("visitor_id", visitorId).maybeSingle();
    if (!s) { await send(`🔥 <b>Daily Streak</b>\n\nKamu belum punya streak. Mulai claim harian di: ${WEB_URL}/`); return true; }
    await send(`🔥 <b>Streak Kamu</b>\n\n📅 Streak sekarang: <b>${s.current_streak || 0} hari</b>\n🏅 Terpanjang: <b>${s.longest_streak || 0} hari</b>\n✅ Total claim: <b>${s.total_claims || 0}</b>\n\nJangan lupa claim tiap hari: ${WEB_URL}/`);
    return true;
  }

  if (key === "shop") {
    const { data: rows } = await admin.from("streak_shop_items").select("name, description, icon, cost_coins, cost_gems").eq("is_active", true).order("sort_order").limit(12);
    const list = rows || [];
    if (!list.length) { await send("🏪 <b>Streak Shop</b>\n\nBelum ada item."); return true; }
    let t = "🏪 <b>Streak Shop</b>\n\n";
    for (const it of list) {
      const price = it.cost_gems > 0 ? `${it.cost_coins} 🪙 / ${it.cost_gems} 💎` : `${it.cost_coins} 🪙`;
      t += `${it.icon || "🎁"} <b>${esc(it.name)}</b> — ${price}\n   ${esc(it.description || "")}\n`;
    }
    t += `\nTukar sekarang: ${WEB_URL}/`;
    await send(t);
    return true;
  }

  if (key === "membership") {
    const { data: rows } = await admin.from("streak_membership_plans").select("name, price_coins, price_gems, duration_days").eq("is_active", true).order("sort_order").limit(10);
    const list = rows || [];
    let t = "👑 <b>Membership & Event</b>\n\n";
    if (list.length) {
      for (const m of list) t += `• <b>${esc(m.name)}</b> — ${m.duration_days || "?"} hari\n`;
    }
    const { data: ev } = await admin.from("streak_event_calendar").select("event_name, event_icon").eq("is_active", true).order("sort_order").limit(7);
    if (ev && ev.length) {
      t += `\n🎉 <b>Event Mingguan</b>\n`;
      for (const e of ev) t += `${e.event_icon || "🎉"} ${esc(e.event_name)}\n`;
    }
    t += `\nGabung member & event: ${WEB_URL}/`;
    await send(t);
    return true;
  }

  if (key === "voucher") {
    if (!visitorId) {
      await send("🎫 <b>Voucher</b>\n\nLogin dulu untuk lihat voucher diskon kamu.", backKb([[{ text: "🔑 Login", callback_data: "login" }]]));
      return true;
    }
    const { data: rows } = await admin.from("discount_vouchers").select("code, discount_amount, expires_at, used_count, max_uses, is_active").eq("visitor_id", visitorId).eq("is_active", true).order("created_at", { ascending: false }).limit(10);
    const list = (rows || []).filter((v: any) => (v.used_count || 0) < (v.max_uses || 1) && (!v.expires_at || new Date(v.expires_at) > new Date()));
    if (!list.length) { await send("🎫 <b>Voucher</b>\n\nBelum ada voucher aktif. Ikuti toko / event untuk dapat voucher!"); return true; }
    let t = "🎫 <b>Voucher Diskon Kamu</b>\n\n";
    for (const v of list) t += `🏷️ <code>${v.code}</code> — diskon ${fmtRp(v.discount_amount)}\n`;
    t += `\nPakai saat checkout: ${WEB_URL}/`;
    await send(t);
    return true;
  }

  if (key === "riwayat") {
    if (!visitorId) {
      await send("📜 <b>Riwayat</b>\n\nLogin dulu untuk lihat riwayat transaksi.", backKb([[{ text: "🔑 Login", callback_data: "login" }]]));
      return true;
    }
    const { data: rows } = await admin.from("balance_transactions").select("type, amount, description, created_at, trx_id").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(10);
    const list = rows || [];
    const { count: totalTrx } = await admin.from("balance_transactions").select("id", { count: "exact", head: true }).eq("visitor_id", visitorId);
    if (!list.length) { await send("📜 <b>Riwayat</b>\n\nBelum ada transaksi."); return true; }
    let t = `📜 <b>Riwayat Transaksi</b>\n📊 Total transaksi: <b>${totalTrx || list.length}</b>\n\n`;
    for (const tr of list) {
      const d = new Date(tr.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" });
      const sign = tr.type === "topup" || tr.type === "deposit" ? "➕" : "➖";
      t += `${sign} ${fmtRp(tr.amount)} • ${esc(tr.type)}${tr.trx_id ? " #" + tr.trx_id : ""}\n   ${d} — ${esc((tr.description || "").slice(0, 40))}\n`;
    }
    t += `\nLihat semua di website.`;
    await send(t, backKb([[{ text: "💰 Saldo", callback_data: "saldo" }, { text: "🌐 Web", url: WEB_URL + "/history" }]]));
    return true;
  }

  return false;
}


async function ensureChat(admin: any, chat: any) {
  const chatId = String(chat.id);
  const first = chat.first_name || chat.title || "Pengguna";
  const uname = chat.username || "";
  await admin.from("telegram_chats").upsert(
    { chat_id: chatId, first_name: first, username: uname },
    { onConflict: "chat_id" },
  );
  return chatId;
}

async function getChatRow(admin: any, chatId: string) {
  const { data } = await admin
    .from("telegram_chats")
    .select("tg_state, tg_data, tg_visitor_id, unread_count")
    .eq("chat_id", chatId)
    .maybeSingle();
  return data || { tg_state: "", tg_data: {}, tg_visitor_id: null, unread_count: 0 };
}

async function setState(admin: any, chatId: string, state: string, data: Record<string, unknown> = {}) {
  await admin.from("telegram_chats").update({ tg_state: state, tg_data: data }).eq("chat_id", chatId);
}

async function clearState(admin: any, chatId: string) {
  await admin.from("telegram_chats").update({ tg_state: "", tg_data: {} }).eq("chat_id", chatId);
}

// ===== flow starters =====
async function startLogin(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (visitorId) {
    const { data: u } = await admin.from("user_balances").select("username").eq("visitor_id", visitorId).maybeSingle();
    await sendOrEdit(token, chatId, editMsgId, {
      text: `⚠️ <b>Kamu sudah login</b> sebagai <b>${esc(u?.username || "-")}</b>.\n\nUntuk masuk ke akun lain, <b>logout dulu</b> ya.`,
      parse_mode: "HTML",
      reply_markup: backKb([[{ text: "🚪 Logout Sekarang", callback_data: "logout" }], [{ text: "💰 Cek Saldo", callback_data: "saldo" }]]),
    });
    return;
  }
  await setState(admin, chatId, "login_code", {});
  await sendOrEdit(token, chatId, editMsgId, {
    text: `🔑 <b>Login Akun Saldo</b>\n\nMasukkan <b>Kode Login</b> akun kamu (8 karakter).\n\n📍 Cara dapat kode: buka website → halaman <b>Saldo</b> → kartu "Login Cepat Perangkat Lain" → salin kodenya.\n\nKetik kodenya sekarang 👇`,
    parse_mode: "HTML",
    reply_markup: CANCEL_KB,
  });
}

async function startDaftar(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (visitorId) {
    await sendOrEdit(token, chatId, editMsgId, {
      text: `⚠️ <b>Kamu sudah login</b>. Logout dulu untuk daftar akun baru.`,
      parse_mode: "HTML",
      reply_markup: backKb([[{ text: "🚪 Logout Sekarang", callback_data: "logout" }]]),
    });
    return;
  }
  await setState(admin, chatId, "reg_username", {});
  await sendOrEdit(token, chatId, editMsgId, {
    text: `📝 <b>Daftar Akun Saldo Baru</b>\n\nLangkah 1/4 — Ketik <b>username</b> kamu (min. 3 karakter):`,
    parse_mode: "HTML",
    reply_markup: CANCEL_KB,
  });
}

// ===== PIN & profile flows =====
async function startPinChange(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk atur PIN.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
  if (pinRow?.pin_hash) {
    await setState(admin, chatId, "pin_old", {});
    await sendOrEdit(token, chatId, editMsgId, { text: "🔐 <b>Ganti PIN</b>\n\nKetik <b>PIN lama</b> (6 digit):", parse_mode: "HTML", reply_markup: CANCEL_KB });
  } else {
    await setState(admin, chatId, "pin_new", { setup: true });
    await sendOrEdit(token, chatId, editMsgId, { text: "🔐 <b>Buat PIN Baru</b>\n\nKamu belum punya PIN. Ketik <b>PIN baru</b> (6 digit):", parse_mode: "HTML", reply_markup: CANCEL_KB });
  }
}

async function showPinStatus(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk lihat status PIN.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  const { data: pinRow } = await admin.from("user_pins").select("updated_at, created_at").eq("visitor_id", visitorId).maybeSingle();
  if (!pinRow) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔎 <b>Status PIN</b>\n\n❌ Kamu belum mengatur PIN. PIN dibutuhkan untuk transaksi saldo.", parse_mode: "HTML", reply_markup: backKb([[{ text: "🔐 Buat PIN", callback_data: "pin_change" }]]) });
    return;
  }
  const upd = new Date(pinRow.updated_at || pinRow.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  await sendOrEdit(token, chatId, editMsgId, {
    text: `🔎 <b>Status PIN</b>\n\n✅ PIN aktif & terenkripsi.\n🗓️ Terakhir diubah: <b>${upd}</b>\n\n🔒 Demi keamanan, PIN tidak bisa ditampilkan. Jika lupa, ganti PIN atau reset lewat website.`,
    parse_mode: "HTML",
    reply_markup: backKb([[{ text: "🔐 Ganti PIN", callback_data: "pin_change" }], [{ text: "🌐 Reset di Web", url: WEB_URL + "/saldo" }]]),
  });
}

async function startNameChange(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk ganti nama.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  await setState(admin, chatId, "name_new", {});
  await sendOrEdit(token, chatId, editMsgId, { text: "✏️ <b>Ganti Nama / Username</b>\n\nKetik username baru (min. 3 karakter):", parse_mode: "HTML", reply_markup: CANCEL_KB });
}

async function startConfess(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, {
      text: `💬 <b>Kirim Confess</b>\n\n🔒 Kamu wajib <b>login akun saldo</b> dulu untuk kirim confess.\n\nLogin atau daftar dulu ya 👇`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "🔑 Login", callback_data: "login" }], [{ text: "📝 Daftar", callback_data: "daftar" }]] },
    });
    return;
  }
  await setState(admin, chatId, "confess_msg", {});
  await sendOrEdit(token, chatId, editMsgId, {
    text: `💬 <b>Kirim Confess Anonim</b>\n\nTulis isi confess kamu (maks. 800 karakter). Confess akan tampil di <b>Confess Wall</b> secara anonim.\n\nKetik pesannya sekarang 👇`,
    parse_mode: "HTML",
    reply_markup: CANCEL_KB,
  });
}


async function showSaldo(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, {
      text: `💰 <b>Saldo</b>\n\nKamu belum login. Login dulu untuk cek saldo langsung di sini.`,
      parse_mode: "HTML",
      reply_markup: backKb([[{ text: "🔑 Login Sekarang", callback_data: "login" }], [{ text: "📝 Daftar Baru", callback_data: "daftar" }]]),
    });
    return;
  }
  const { data: u } = await admin
    .from("user_balances")
    .select("username, balance, bonus_balance, phone")
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (!u) {
    await sendOrEdit(token, chatId, editMsgId, { text: "⚠️ Akun tidak ditemukan. Silakan login ulang.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  const total = (Number(u.balance) || 0) + (Number(u.bonus_balance) || 0);
  // Saldo IN (game_balance) — akun bisa punya beberapa visitor; jumlahkan via login history
  let saldoIn = 0;
  let allVisitorIds = [visitorId];
  try {
    const { data: hist } = await admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
    if (hist?.user_balance_id) {
      const { data: siblings } = await admin.from("balance_login_history").select("visitor_id").eq("user_balance_id", hist.user_balance_id);
      if (siblings?.length) allVisitorIds = Array.from(new Set(siblings.map((s: any) => s.visitor_id)));
    }
    const { data: gb } = await admin.from("game_balance").select("amount").in("visitor_id", allVisitorIds);
    saldoIn = (gb || []).reduce((a: number, r: any) => a + (Number(r.amount) || 0), 0);
  } catch (_) { /* ignore */ }
  // total transaksi
  const { count: totalTrx } = await admin.from("balance_transactions").select("id", { count: "exact", head: true }).eq("visitor_id", visitorId);
  // PIN status
  const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
  const pinStatus = pinRow?.pin_hash ? "✅ Aktif" : "❌ Belum diset";

  const subMenu = backKb([
    [{ text: "🔐 Ganti PIN", callback_data: "pin_change" }, { text: "🔎 Status PIN", callback_data: "pin_status" }],
    [{ text: "📜 History Transaksi", callback_data: "riwayat" }, { text: "🎫 Voucher", callback_data: "voucher" }],
    [{ text: "✏️ Ganti Nama", callback_data: "name_change" }, { text: "👤 Akun", callback_data: "akun" }],
    [{ text: "🔄 Refresh Saldo", callback_data: "saldo" }, { text: "🚪 Logout", callback_data: "logout" }],
  ]);
  await sendOrEdit(token, chatId, editMsgId, {
    text: `💰 <b>Saldo Kamu</b>\n\n👤 User: <b>${esc(u.username)}</b>\n📱 HP: ${maskPhone(u.phone || "")}\n💰 Saldo: <b>${fmtRp(u.balance)}</b>\n🎁 Bonus: <b>${fmtRp(u.bonus_balance)}</b>\n💳 Total: <b>${fmtRp(total)}</b>\n🎯 Saldo IN (game): <b>${saldoIn.toLocaleString("id-ID")}</b>\n📊 Total transaksi: <b>${totalTrx || 0}</b>\n🔐 PIN: ${pinStatus}\n\nPilih opsi di bawah 👇`,
    parse_mode: "HTML",
    reply_markup: subMenu,
  });
}

async function doLoginByCode(admin: any, token: string, chatId: string, rawInput: string) {
  const code = rawInput.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(code)) {
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Format kode tidak valid. Kode terdiri dari 6-12 huruf/angka. Coba lagi:", reply_markup: CANCEL_KB });
    return;
  }
  const { data: user } = await admin
    .from("user_balances")
    .select("visitor_id, username, balance, bonus_balance, phone, totp_enabled")
    .eq("login_code", code)
    .maybeSingle();
  if (!user) {
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Kode login tidak ditemukan atau sudah diganti. Cek lagi di website, lalu ketik kodenya:", reply_markup: CANCEL_KB });
    return;
  }
  if (user.totp_enabled) {
    await clearState(admin, chatId);
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Akun ini memakai 2FA. Untuk keamanan, login lewat website ya.", reply_markup: MENU });
    return;
  }
  await admin.from("telegram_chats").update({ tg_visitor_id: user.visitor_id, tg_state: "", tg_data: {} }).eq("chat_id", chatId);
  const total = (Number(user.balance) || 0) + (Number(user.bonus_balance) || 0);
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: `✅ <b>Login berhasil!</b>\n\nHalo <b>${user.username}</b> 👋\n💳 Total saldo: <b>${fmtRp(total)}</b>\n\nKetik /saldo untuk cek saldo kapan saja.`,
    parse_mode: "HTML",
    reply_markup: MENU,
  });
}

async function handleRegisterStep(admin: any, token: string, chatId: string, state: string, data: any, text: string) {
  const val = text.trim();
  if (state === "reg_username") {
    if (val.length < 3) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Username minimal 3 karakter. Coba lagi:", reply_markup: CANCEL_KB });
      return;
    }
    const { data: exists } = await admin.from("user_balances").select("id").eq("username", val).maybeSingle();
    if (exists) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Username sudah dipakai. Pilih username lain:", reply_markup: CANCEL_KB });
      return;
    }
    await setState(admin, chatId, "reg_phone", { username: val });
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "Langkah 2/4 — Ketik <b>nomor HP</b> (contoh: 0812xxxx):", parse_mode: "HTML", reply_markup: CANCEL_KB });
    return;
  }
  if (state === "reg_phone") {
    const phone = normPhone(val);
    if (!phone) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Nomor HP tidak valid. Ketik ulang (contoh: 0812xxxx):", reply_markup: CANCEL_KB });
      return;
    }
    const { data: exists } = await admin.from("user_balances").select("id").neq("phone", "").eq("phone", phone).maybeSingle();
    if (exists) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Nomor HP sudah terdaftar. Silakan login. Ketik nomor lain atau tekan Batal:", reply_markup: CANCEL_KB });
      return;
    }
    await setState(admin, chatId, "reg_email", { ...data, phone });
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "Langkah 3/4 — Ketik <b>email</b> kamu:", parse_mode: "HTML", reply_markup: CANCEL_KB });
    return;
  }
  if (state === "reg_email") {
    const email = val.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Format email tidak valid. Ketik ulang:", reply_markup: CANCEL_KB });
      return;
    }
    const { data: exists } = await admin.from("user_balances").select("id").neq("email", "").eq("email", email).maybeSingle();
    if (exists) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Email sudah terdaftar. Silakan login. Ketik email lain atau tekan Batal:", reply_markup: CANCEL_KB });
      return;
    }
    await setState(admin, chatId, "reg_password", { ...data, email });
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "Langkah 4/4 — Ketik <b>sandi</b> (min. 6 karakter):", parse_mode: "HTML", reply_markup: CANCEL_KB });
    return;
  }
  if (state === "reg_password") {
    if (val.length < 6) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Sandi minimal 6 karakter. Ketik ulang:", reply_markup: CANCEL_KB });
      return;
    }
    const passwordHash = await sha256Hex(val);
    const visitorId = crypto.randomUUID();
    const loginCode = await uniqueLoginCode(admin);
    const { data: created, error } = await admin
      .from("user_balances")
      .insert({
        visitor_id: visitorId,
        username: data.username,
        phone: data.phone,
        email: data.email,
        password_hash: passwordHash,
        login_code: loginCode,
      })
      .select("visitor_id, username")
      .single();
    if (error || !created) {
      await clearState(admin, chatId);
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Gagal membuat akun: " + (error?.message || "coba lagi"), reply_markup: MENU });
      return;
    }
    await admin.from("telegram_chats").update({ tg_visitor_id: visitorId, tg_state: "", tg_data: {} }).eq("chat_id", chatId);
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: `🎉 <b>Akun berhasil dibuat!</b>\n\n👤 Username: <b>${created.username}</b>\n🔑 Kode Login: <code>${loginCode}</code>\n\nSimpan kode login ini untuk masuk di perangkat lain. Kamu sudah otomatis login di bot ini. Ketik /saldo untuk cek saldo.`,
      parse_mode: "HTML",
      reply_markup: MENU,
    });
    return;
  }
}

async function handleConfessStep(admin: any, token: string, chatId: string, state: string, data: any, text: string, chat: any) {
  const val = text.trim();
  if (state === "confess_msg") {
    if (val.length < 3) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Confess terlalu pendek. Tulis lagi:", reply_markup: CANCEL_KB });
      return;
    }
    await setState(admin, chatId, "confess_name", { message: val.slice(0, 800) });
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: "Mau pakai nama samaran? Ketik namanya, atau ketik <b>-</b> untuk anonim penuh:",
      parse_mode: "HTML",
      reply_markup: CANCEL_KB,
    });
    return;
  }
  if (state === "confess_name") {
    const senderName = val === "-" ? "Anonim" : val.slice(0, 40);
    const { data: chatRow } = await admin.from("telegram_chats").select("tg_visitor_id").eq("chat_id", chatId).maybeSingle();
    const visitorKey = chatRow?.tg_visitor_id || `telegram_${chatId}`;
    const { error } = await admin.from("confess_public_wall").insert({
      visitor_id: visitorKey,
      sender_name: senderName,
      masked_phone: "Telegram",
      message: data.message,
    });
    await clearState(admin, chatId);
    if (error) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Gagal mengirim confess. Coba lagi nanti.", reply_markup: MENU });
      return;
    }
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: `✅ <b>Confess terkirim!</b>\n\nConfess kamu sudah tampil di Confess Wall secara anonim. Lihat di: ${WEB_URL}/confess`,
      parse_mode: "HTML",
      reply_markup: MENU,
    });
    return;
  }
}

async function handleProfileStep(admin: any, token: string, chatId: string, state: string, data: any, text: string, visitorId: string | null) {
  const val = text.trim();
  if (!visitorId) { await clearState(admin, chatId); await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Sesi habis, login dulu.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) }); return; }

  if (state === "pin_old") {
    if (!/^\d{6}$/.test(val)) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ PIN harus 6 digit angka. Ketik ulang PIN lama:", reply_markup: CANCEL_KB }); return; }
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
    const hash = await sha256Hex(val);
    if (!pinRow || hash !== pinRow.pin_hash) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ PIN lama salah. Ketik ulang:", reply_markup: CANCEL_KB }); return; }
    await setState(admin, chatId, "pin_new", {});
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "✅ PIN lama benar.\n\nKetik <b>PIN baru</b> (6 digit):", parse_mode: "HTML", reply_markup: CANCEL_KB });
    return;
  }

  if (state === "pin_new") {
    if (!/^\d{6}$/.test(val)) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ PIN harus 6 digit angka. Ketik ulang PIN baru:", reply_markup: CANCEL_KB }); return; }
    await setState(admin, chatId, "pin_confirm", { pin: val, setup: !!data.setup });
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔁 Ketik ulang <b>PIN baru</b> untuk konfirmasi:", parse_mode: "HTML", reply_markup: CANCEL_KB });
    return;
  }

  if (state === "pin_confirm") {
    if (val !== data.pin) { await setState(admin, chatId, "pin_new", { setup: !!data.setup }); await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ PIN tidak cocok. Ketik <b>PIN baru</b> lagi (6 digit):", parse_mode: "HTML", reply_markup: CANCEL_KB }); return; }
    const hash = await sha256Hex(val);
    const { data: existing } = await admin.from("user_pins").select("id").eq("visitor_id", visitorId).maybeSingle();
    if (existing) {
      await admin.from("user_pins").update({ pin_hash: hash, updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
    } else {
      await admin.from("user_pins").insert({ visitor_id: visitorId, pin_hash: hash });
    }
    await clearState(admin, chatId);
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "✅ <b>PIN berhasil disimpan!</b>\n\nGunakan PIN ini untuk transaksi saldo.", parse_mode: "HTML", reply_markup: backKb([[{ text: "💰 Saldo", callback_data: "saldo" }]]) });
    return;
  }

  if (state === "name_new") {
    if (val.length < 3) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Username minimal 3 karakter. Ketik ulang:", reply_markup: CANCEL_KB }); return; }
    const { data: exists } = await admin.from("user_balances").select("id").eq("username", val).neq("visitor_id", visitorId).maybeSingle();
    if (exists) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Username sudah dipakai. Pilih lain:", reply_markup: CANCEL_KB }); return; }
    const { error } = await admin.from("user_balances").update({ username: val, updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
    await clearState(admin, chatId);
    if (error) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Gagal ganti nama. Coba lagi.", reply_markup: backKb() }); return; }
    await tgApi(token, "sendMessage", { chat_id: chatId, text: `✅ Username berhasil diganti menjadi <b>${esc(val)}</b>.`, parse_mode: "HTML", reply_markup: backKb([[{ text: "💰 Saldo", callback_data: "saldo" }]]) });
    return;
  }
}


Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: cfg } = await admin.from("telegram_bot_config").select("*").limit(1).maybeSingle();
  if (!cfg || !cfg.bot_token) return new Response(JSON.stringify({ ok: true }));

  const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (cfg.webhook_secret && secret !== cfg.webhook_secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = cfg.bot_token as string;
  const update = await req.json().catch(() => ({}));

  try {
    // ===== Callback button press =====
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = await ensureChat(admin, cq.message.chat);
      const key = String(cq.data || "");
      const editMsgId: number | null = cq.message?.message_id ?? null;
      await tgApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
      if (!cfg.enabled) {
        await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔴 Bot sedang tidak aktif. Coba lagi nanti." });
        return new Response(JSON.stringify({ ok: true }));
      }
      const row = await getChatRow(admin, chatId);

      if (key === "batal") {
        await clearState(admin, chatId);
        await sendOrEdit(token, chatId, editMsgId, { text: "🏠 <b>Menu Utama</b>\n\nDibatalkan. Pilih menu di bawah 👇", parse_mode: "HTML", reply_markup: MENU });
        return new Response(JSON.stringify({ ok: true }));
      }
      if (key === "menu" || key === "start") {
        await clearState(admin, chatId);
        await sendOrEdit(token, chatId, editMsgId, { text: "🏠 <b>Menu Utama</b>\n\nPilih menu di bawah 👇", parse_mode: "HTML", reply_markup: MENU });
        return new Response(JSON.stringify({ ok: true }));
      }
      if (key === "logout") {
        await admin.from("telegram_chats").update({ tg_visitor_id: null, tg_state: "", tg_data: {} }).eq("chat_id", chatId);
        await sendOrEdit(token, chatId, editMsgId, { text: "👋 Kamu sudah logout. Silakan login lagi kapan saja.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }], [{ text: "📝 Daftar", callback_data: "daftar" }]]) });
        return new Response(JSON.stringify({ ok: true }));
      }
      if (key === "login") { await startLogin(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "daftar") { await startDaftar(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "confess") { await startConfess(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "saldo") { await showSaldo(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "pin_change") { await startPinChange(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "pin_status") { await showPinStatus(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "name_change") { await startNameChange(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("qclaim_")) {
        const questId = key.slice(7);
        if (!row.tg_visitor_id) {
          await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk klaim quest.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
          return new Response(JSON.stringify({ ok: true }));
        }
        try {
          const { data: cr } = await admin.functions.invoke("weekly-quest", { body: { action: "claim", visitorId: row.tg_visitor_id, questId } });
          if ((cr as any)?.error) {
            await sendOrEdit(token, chatId, editMsgId, { text: `⚠️ ${(cr as any).error}`, reply_markup: backKb([[{ text: "🎯 Quest", callback_data: "quest" }]]) });
          } else {
            const parts = [
              (cr as any)?.coins ? `+${(cr as any).coins} 🪙` : null,
              (cr as any)?.gems ? `+${(cr as any).gems} 💎` : null,
              (cr as any)?.saldo_in ? `+${(cr as any).saldo_in} Saldo IN` : null,
              (cr as any)?.xp ? `+${(cr as any).xp} XP` : null,
            ].filter(Boolean).join(", ");
            await sendOrEdit(token, chatId, editMsgId, { text: `🎉 <b>Quest diklaim!</b>\n\nReward: ${parts || "berhasil"}`, parse_mode: "HTML", reply_markup: backKb([[{ text: "🎯 Quest Lain", callback_data: "quest" }]]) });
          }
        } catch (_) {
          await sendOrEdit(token, chatId, editMsgId, { text: "❌ Gagal klaim quest. Coba lagi.", reply_markup: backKb([[{ text: "🎯 Quest", callback_data: "quest" }]]) });
        }
        return new Response(JSON.stringify({ ok: true }));
      }

      const handled = await renderSection(admin, token, chatId, key, row.tg_visitor_id, editMsgId);
      if (handled) return new Response(JSON.stringify({ ok: true }));

      const txt = sectionText(key);
      if (txt) {
        const kb = key === "cs" ? backKb() : backKb([[{ text: "🌐 Buka Halaman", url: WEB_URL + (key === "game" ? "/game" : key === "akun" ? "/ruang-ku" : "/") }]]);
        await sendOrEdit(token, chatId, editMsgId, { text: txt, parse_mode: "HTML", reply_markup: kb });
      }
      return new Response(JSON.stringify({ ok: true }));
    }

    const message = update.message ?? update.edited_message;
    if (!message?.chat?.id) return new Response(JSON.stringify({ ok: true }));

    const chatId = await ensureChat(admin, message.chat);
    const text: string = message.text || "";

    if (!cfg.enabled) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔴 Bot sedang tidak aktif. Coba lagi nanti." });
      return new Response(JSON.stringify({ ok: true }));
    }

    const cmd = text.trim().toLowerCase().split(/[\s@]/)[0];
    const row = await getChatRow(admin, chatId);

    // ===== global cancel =====
    if (cmd === "/batal" || cmd === "/cancel") {
      await clearState(admin, chatId);
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Dibatalkan. Ketik /start untuk membuka menu.", reply_markup: MENU });
      return new Response(JSON.stringify({ ok: true }));
    }

    // ===== active multi-step flows (only if not a command) =====
    if (row.tg_state && !cmd.startsWith("/")) {
      const st = row.tg_state as string;
      const data = (row.tg_data as any) || {};
      if (st === "login_code") { await doLoginByCode(admin, token, chatId, text); return new Response(JSON.stringify({ ok: true })); }
      if (st.startsWith("reg_")) { await handleRegisterStep(admin, token, chatId, st, data, text); return new Response(JSON.stringify({ ok: true })); }
      if (st.startsWith("confess_")) { await handleConfessStep(admin, token, chatId, st, data, text, message.chat); return new Response(JSON.stringify({ ok: true })); }
      if (st.startsWith("pin_") || st.startsWith("name_")) { await handleProfileStep(admin, token, chatId, st, data, text, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
    }

    if (cmd === "/start" || cmd === "/menu") {
      await clearState(admin, chatId);
      const now = wibNow();
      const uptime = uptimeText((cfg as any).activated_at ?? null);
      const base = (cfg.welcome_message && cfg.welcome_message.trim())
        ? cfg.welcome_message
        : "👋 <b>Selamat datang di Agung Adi Store!</b>\n\nMurah & Terpercaya. Pilih menu di bawah atau ketik pesan untuk chat admin (Live CS).";
      const welcome = `${base}\n\n🟢 Bot aktif selama: <b>${uptime}</b>\n🕒 <b>${now.hari}</b>, ${now.tanggal}\n⏰ ${now.jam} WIB`;
      await tgApi(token, "sendMessage", { chat_id: chatId, text: welcome, parse_mode: "HTML", reply_markup: MENU });
      return new Response(JSON.stringify({ ok: true }));
    }

    if (cmd === "/info" || cmd === "/status") {
      const now = wibNow();
      const uname = cfg.bot_username ? `@${cfg.bot_username}` : "Bot Telegram";
      const uptime = uptimeText((cfg as any).activated_at ?? null);
      await tgApi(token, "sendMessage", {
        chat_id: chatId,
        text: `🤖 <b>Info Bot</b>\n\nStatus: 🟢 <b>AKTIF</b>\nNama: ${uname}\nToko: <b>Agung Adi Store</b>\n⏱️ Aktif selama: <b>${uptime}</b>\n\n📅 Hari: <b>${now.hari}</b>\n🗓️ Tanggal: ${now.tanggal}\n⏰ Jam: <b>${now.jam} WIB</b>\n\nKetik /start untuk membuka menu.`,
        parse_mode: "HTML",
      });
      return new Response(JSON.stringify({ ok: true }));
    }

    if (cmd === "/help" || cmd === "/bantuan") {
      await tgApi(token, "sendMessage", {
        chat_id: chatId,
        text: "ℹ️ <b>Perintah Bot</b>\n\n/start - Menu utama\n/info - Status bot & waktu\n/login - Login akun saldo\n/daftar - Buat akun saldo\n/logout - Keluar akun\n/saldo - Saldo, PIN, history, ganti nama\n/pin - Ganti / buat PIN\n/gantinama - Ganti username\n/produk - Produk (beli via WA)\n/musik - Musik (play/download)\n/game - Game AI, Slot, Lucky Draw, Lucky Royale\n/quest - Quest mingguan (klaim langsung)\n/confess - Kirim confess (wajib login)\n/streak - Daily streak\n/shop - Streak Shop\n/roda - Roda diskon\n/peringkat - Peringkat pemain\n/riwayat - Riwayat transaksi (login)\n/voucher - Voucher kamu (login)\n/membership - Membership & event\n/sponsor - Sponsor / iklan\n/infotoko - Postingan admin\n/sosmed - Sosmed admin\n/batal - Batalkan proses\n\nSetiap menu punya tombol 🏠 Menu Utama untuk kembali. Ketik pesan bebas untuk chat admin (Live CS).",
        parse_mode: "HTML",
      });
      return new Response(JSON.stringify({ ok: true }));
    }

    // ===== owner-only commands =====
    const isOwner = cfg.owner_id && String(cfg.owner_id) === chatId;
    if (cmd === "/owner") {
      if (!isOwner) {
        await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Perintah ini khusus owner." });
        return new Response(JSON.stringify({ ok: true }));
      }
      const [{ count: users }, { count: chats }, { count: products }, { count: confess }] = await Promise.all([
        admin.from("user_balances").select("id", { count: "exact", head: true }),
        admin.from("telegram_chats").select("chat_id", { count: "exact", head: true }),
        admin.from("products").select("id", { count: "exact", head: true }),
        admin.from("confess_public_wall").select("id", { count: "exact", head: true }),
      ]);
      await tgApi(token, "sendMessage", {
        chat_id: chatId,
        text: `👑 <b>Panel Owner</b>\n\n👥 Total user saldo: <b>${users || 0}</b>\n💬 Chat Telegram: <b>${chats || 0}</b>\n🛒 Produk: <b>${products || 0}</b>\n📝 Confess: <b>${confess || 0}</b>\n\nPerintah owner:\n/broadcast &lt;pesan&gt; - kirim ke semua chat`,
        parse_mode: "HTML",
      });
      return new Response(JSON.stringify({ ok: true }));
    }
    if (cmd === "/broadcast") {
      if (!isOwner) {
        await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Perintah ini khusus owner." });
        return new Response(JSON.stringify({ ok: true }));
      }
      const msg = text.replace(/^\/broadcast(@\S+)?\s*/i, "").trim();
      if (!msg) {
        await tgApi(token, "sendMessage", { chat_id: chatId, text: "Ketik: /broadcast pesan kamu" });
        return new Response(JSON.stringify({ ok: true }));
      }
      const { data: allChats } = await admin.from("telegram_chats").select("chat_id");
      let sent = 0;
      for (const c of allChats || []) {
        try {
          await tgApi(token, "sendMessage", { chat_id: c.chat_id, text: `📢 <b>Pengumuman</b>\n\n${esc(msg)}`, parse_mode: "HTML" });
          sent++;
        } catch (_) { /* skip */ }
      }
      await tgApi(token, "sendMessage", { chat_id: chatId, text: `✅ Broadcast terkirim ke ${sent} chat.` });
      return new Response(JSON.stringify({ ok: true }));
    }

    if (cmd === "/logout") {
      await admin.from("telegram_chats").update({ tg_visitor_id: null, tg_state: "", tg_data: {} }).eq("chat_id", chatId);
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "👋 Kamu sudah logout dari bot. Ketik /login untuk masuk lagi.", reply_markup: MENU });
      return new Response(JSON.stringify({ ok: true }));
    }

    // ===== interactive command shortcuts =====
    if (cmd === "/login") { await startLogin(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/daftar") { await startDaftar(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/confess") { await startConfess(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/saldo" || cmd === "/saldoin") { await showSaldo(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/pin") { await startPinChange(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/gantinama") { await startNameChange(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }

    // ===== dynamic info sections via commands =====
    const cmdSectionMap: Record<string, string> = {
      "/produk": "produk", "/musik": "musik", "/infotoko": "info_toko", "/sponsor": "sponsor",
      "/sosmed": "sosmed", "/peringkat": "peringkat", "/roda": "roda", "/streak": "streak",
      "/shop": "shop", "/membership": "membership", "/event": "membership", "/voucher": "voucher",
      "/riwayat": "riwayat", "/game": "game", "/quest": "quest",
    };
    if (cmdSectionMap[cmd]) {
      const handled = await renderSection(admin, token, chatId, cmdSectionMap[cmd], row.tg_visitor_id);
      if (handled) return new Response(JSON.stringify({ ok: true }));
      const stxt = sectionText(cmdSectionMap[cmd]);
      if (stxt) { await tgApi(token, "sendMessage", { chat_id: chatId, text: stxt, parse_mode: "HTML", reply_markup: backKb() }); return new Response(JSON.stringify({ ok: true })); }
    }

    const sectionKeys = ["game", "akun", "cs"];
    if (cmd.startsWith("/") && sectionKeys.includes(cmd.slice(1))) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: sectionText(cmd.slice(1)), parse_mode: "HTML", reply_markup: backKb() });
      return new Response(JSON.stringify({ ok: true }));
    }


    // ===== Free text => Live CS: store + notify owner =====
    await admin.from("telegram_messages").insert({
      chat_id: chatId,
      direction: "in",
      text,
      telegram_message_id: message.message_id,
    });
    await admin.from("telegram_chats").update({
      last_message: text.slice(0, 200),
      last_message_at: new Date().toISOString(),
      status: "open",
    }).eq("chat_id", chatId);
    const { data: c } = await admin.from("telegram_chats").select("unread_count").eq("chat_id", chatId).maybeSingle();
    await admin.from("telegram_chats").update({ unread_count: ((c?.unread_count as number) || 0) + 1 }).eq("chat_id", chatId);

    if (cfg.owner_id) {
      const uname = message.chat.username ? `@${message.chat.username}` : (message.chat.first_name || "User");
      await tgApi(token, "sendMessage", {
        chat_id: cfg.owner_id,
        text: `📩 <b>Pesan Live CS baru</b>\nDari: ${uname} (${chatId})\n\n${text}`,
        parse_mode: "HTML",
      });
    }

    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: "✅ Pesan kamu sudah diterima admin. Mohon tunggu balasan ya. 🙏",
    });

    return new Response(JSON.stringify({ ok: true }));
  } catch (e) {
    console.error("telegram-webhook error:", e);
    return new Response(JSON.stringify({ ok: true }));
  }
});
