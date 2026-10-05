// WhatsApp Admin Center — dijalankan lewat public-api?endpoint=wa_admin.
// Semua otorisasi (identitas nomor admin, role, permission, konfirmasi,
// rate limit, audit log) diputuskan DI SERVER. Bot hanya meneruskan teks.
// Data memakai tabel/RPC yang sama dengan website (satu sumber data).
import { aiChatCompletion } from "../_shared/ai-provider.ts";
import { waUserStats, waUserErrors, serviceStatus, sanitize } from "./wa-user.ts";

type Ctx = { sb: any; actor: Actor; args: string[]; raw: string; page: number };
type Actor = { phone: string; role: string; label: string | null; perms: Set<string> };
type Res = { text: string; needs_confirm?: boolean; token?: string; control?: string; recipients?: string[]; page?: number; pages?: number };
type Action = { perm: string; confirm?: boolean; heavy?: boolean; desc: string; usage?: string; feature?: string; preview?: (c: Ctx) => Promise<string>; run: (c: Ctx) => Promise<Res | string> };

export const ROLE_PERMS: Record<string, string[]> = {
  super_admin: ["*"],
  admin: ["user", "user_write", "ban", "finance_read", "store", "order", "ticket", "notify", "broadcast", "stats", "game_read", "firepass_read", "confess_read", "anon_read", "ai_read", "galau_read", "search", "export"],
  moderator: ["user_basic", "ban", "confess", "confess_read", "anon", "anon_read", "galau_read", "stats_basic", "search"],
  finance: ["user_basic", "finance", "finance_read", "order", "order_read", "stats_basic", "search", "export"],
  support: ["user_basic", "ticket", "order_read", "notify_user", "search"],
  game_admin: ["user_basic", "game", "game_read", "stats_basic"],
  firepass_admin: ["user_basic", "firepass", "firepass_read", "stats_basic"],
};
// Permission turunan: permission tulis otomatis mencakup baca terkait.
const IMPLIES: Record<string, string[]> = {
  user: ["user_basic"], finance: ["finance_read"], order: ["order_read"], game: ["game_read"],
  firepass: ["firepass_read"], confess: ["confess_read"], anon: ["anon_read"], stats: ["stats_basic"], notify: ["notify_user"],
};
function permsFor(role: string) {
  const s = new Set<string>(ROLE_PERMS[role] || []);
  for (const p of [...s]) for (const q of IMPLIES[p] || []) s.add(q);
  return s;
}
const can = (a: Actor, p: string) => a.perms.has("*") || a.perms.has(p);

const PAGE = 10;
const rp = (n: any) => "Rp" + Number(n || 0).toLocaleString("id-ID");
const dt = (s: any) => (s ? new Date(s).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "-");
const digits = (v: any) => String(v || "").replace(/\D/g, "");
const maskPhone = (p: any) => { const d = digits(p); return d.length < 6 ? "***" : d.slice(0, 4) + "****" + d.slice(-3); };
const todayStart = () => { const d = new Date(Date.now() + 7 * 3600e3); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - 7 * 3600e3).toISOString(); };
const since = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const num = (v: any) => { const n = Number(String(v || "").replace(/[^0-9-]/g, "")); return Number.isFinite(n) ? n : NaN; };
const clip = (s: any, n = 80) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
function phoneVariants(v: string) {
  const c = digits(v); const out = new Set<string>(); if (!c) return [];
  out.add(c); out.add("+" + c);
  if (c.startsWith("62")) out.add("0" + c.slice(2));
  if (c.startsWith("0")) { out.add("62" + c.slice(1)); out.add("+62" + c.slice(1)); }
  if (c.startsWith("8")) { out.add("62" + c); out.add("0" + c); }
  return [...out];
}
const canonPhone = (v: string) => { let c = digits(v); if (c.startsWith("0")) c = "62" + c.slice(1); if (c.startsWith("8")) c = "62" + c; return c; };

async function count(q: any) { const { count: c } = await q; return c || 0; }
function head(sb: any, t: string) { return sb.from(t).select("*", { count: "exact", head: true }); }
function paginate<T>(rows: T[], page: number) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)); const p = Math.min(Math.max(1, page), pages);
  return { items: rows.slice((p - 1) * PAGE, p * PAGE), page: p, pages, offset: (p - 1) * PAGE };
}
function pageText(title: string, rows: string[], page: number, cmd: string): Res {
  const pg = paginate(rows, page);
  if (!rows.length) return { text: title + "\n\n(tidak ada data)" };
  return { text: `${title}\nHalaman ${pg.page}/${pg.pages} • total ${rows.length}\n\n` + pg.items.map((r, i) => `${pg.offset + i + 1}. ${r}`).join("\n") + (pg.page < pg.pages ? `\n\n➡️ Ketik *!next* atau *${cmd} hal ${pg.page + 1}*` : ""), page: pg.page, pages: pg.pages };
}

async function resolveUser(sb: any, q: string) {
  const s = String(q || "").trim(); if (!s) return null;
  const cols = "id, visitor_id, username, phone, email, balance, bonus_balance, created_at, last_seen_at, totp_enabled";
  let r = await sb.from("user_balances").select(cols).ilike("username", s).limit(1).maybeSingle();
  if (r.data) return r.data;
  if (digits(s).length >= 9) { r = await sb.from("user_balances").select(cols).in("phone", phoneVariants(s)).limit(1).maybeSingle(); if (r.data) return r.data; }
  if (s.includes("@")) { r = await sb.from("user_balances").select(cols).ilike("email", s).limit(1).maybeSingle(); if (r.data) return r.data; }
  r = await sb.from("user_balances").select(cols).eq("visitor_id", s).limit(1).maybeSingle();
  return r.data || null;
}
async function needUser(c: Ctx, i = 0) { const u = await resolveUser(c.sb, c.args[i]); if (!u) throw new UserErr(`User '${c.args[i] || ""}' tidak ditemukan.`); return u; }
class UserErr extends Error {}
const need = (cond: any, msg: string) => { if (!cond) throw new UserErr(msg); };
async function activeSeason(sb: any) { const { data } = await sb.from("fire_pass_seasons").select("*").eq("is_active", true).order("season_number", { ascending: false }).limit(1).maybeSingle(); return data; }
async function notify(sb: any, visitor_id: string, title: string, message: string, type = "info") { await sb.from("notifications").insert({ visitor_id, title, message, type }); }
async function getSetting(sb: any, key: string, def = "") { const { data } = await sb.from("admin_settings").select("setting_value").eq("setting_key", key).maybeSingle(); return data?.setting_value ?? def; }
async function setSetting(sb: any, key: string, value: string) { await sb.from("admin_settings").upsert({ setting_key: key, setting_value: value, updated_at: new Date().toISOString() }, { onConflict: "setting_key" }); }

// Fitur yang bisa di-ON/OFF dari website (admin_settings, tidak rahasia).
export const FEATURE_KEYS = ["bot_enabled", "wa_maintenance", "wa_feature_ai", "wa_feature_router", "wa_feature_firepass", "wa_feature_anon", "wa_feature_galau", "wa_feature_confess", "wa_feature_notif", "wa_feature_broadcast", "wa_prefix", "wa_rate_limit_per_min", "wa_bot_name"];
async function loadConfig(sb: any) {
  const { data } = await sb.from("admin_settings").select("setting_key, setting_value").in("setting_key", FEATURE_KEYS);
  const m: Record<string, string> = Object.fromEntries((data || []).map((r: any) => [r.setting_key, r.setting_value]));
  const on = (k: string) => (m[k] ?? "true") !== "false";
  return {
    bot_enabled: on("bot_enabled"), maintenance: m.wa_maintenance === "true",
    features: { ai: on("wa_feature_ai"), router: on("wa_feature_router"), firepass: on("wa_feature_firepass"), anon: on("wa_feature_anon"), galau: on("wa_feature_galau"), confess: on("wa_feature_confess"), notif: on("wa_feature_notif"), broadcast: on("wa_feature_broadcast") } as Record<string, boolean>,
    prefix: m.wa_prefix || "!", rate_limit_per_min: Math.max(5, Number(m.wa_rate_limit_per_min || 30)),
    bot_name: (m.wa_bot_name || "Agung Adi Store Super Bot").slice(0, 60),
  };
}

// ─── Saldo: efek identik dengan endpoint lama add/deduct/set/reset_balance ───
async function balanceOp(sb: any, op: string, vid: string, amount: number) {
  const { data: u } = await sb.from("user_balances").select("id, balance").eq("visitor_id", vid).maybeSingle();
  need(u, "Akun saldo tidak ditemukan.");
  const old = Number(u.balance);
  let next = old; let bonus = 0;
  if (op === "add") next = old + amount;
  if (op === "deduct") { need(old >= amount, `Saldo tidak cukup (saldo ${rp(old)}).`); next = old - amount; }
  if (op === "set") next = amount;
  if (op === "reset") next = 0;
  await sb.from("user_balances").update({ balance: next }).eq("id", u.id);
  const diff = next - old;
  if (diff !== 0) await sb.from("balance_transactions").insert({ visitor_id: vid, type: diff > 0 ? "topup" : "debit", amount: Math.abs(diff), description: `${op === "add" ? "Top up" : op === "deduct" ? "Debit" : op === "set" ? "Set saldo" : "Reset saldo"} oleh admin (WA)` });
  if (op === "add" && amount >= 10000) {
    bonus = Math.floor(amount * 0.15);
    await sb.rpc("add_topup_bonus_to_saldo_in", { p_visitor_id: vid, p_amount: bonus });
    await sb.from("balance_transactions").insert({ visitor_id: vid, type: "topup_bonus", amount: bonus, description: "🎁 Bonus 15% top-up admin → Saldo IN" });
  }
  await notify(sb, vid, "Saldo diperbarui admin", `Saldo Anda berubah dari ${rp(old)} menjadi ${rp(next)}.`, diff >= 0 ? "success" : "warning");
  return { old, next, bonus };
}

// ─── Broadcast target ───
async function broadcastTargets(sb: any, args: string[]) {
  const kind = (args[0] || "semua").toLowerCase(); const val = args[1];
  const base = () => sb.from("user_balances").select("visitor_id, username, phone, balance, last_seen_at").limit(5000);
  let rows: any[] = []; let label = kind;
  if (kind === "semua" || kind === "all") rows = (await base()).data || [];
  else if (kind === "useraktif" || kind === "aktif") { rows = (await base().gte("last_seen_at", since(24 * 7))).data || []; label = "user aktif 7 hari"; }
  else if (kind === "user") { const u = await resolveUser(sb, val || ""); need(u, "User tidak ditemukan."); rows = [u]; label = "user " + u.username; }
  else if (kind === "saldo") { const min = num(val); need(Number.isFinite(min), "Format: !broadcast saldo [minimal] | judul | isi"); rows = (await base().gte("balance", min)).data || []; label = "saldo ≥ " + rp(min); }
  else if (kind === "pembeli" || kind === "pembelian") {
    const { data } = await sb.from("balance_transactions").select("visitor_id").eq("type", "purchase").gte("created_at", since(24 * 30)).limit(5000);
    const ids = [...new Set((data || []).map((r: any) => r.visitor_id))];
    rows = ids.length ? ((await base().in("visitor_id", ids.slice(0, 1000))).data || []) : []; label = "pembeli 30 hari";
  } else if (kind === "firepass" || kind === "fppremium") {
    const s = await activeSeason(sb); need(s, "Tidak ada season Fire Pass aktif.");
    let q = sb.from("fire_pass_progress").select("visitor_id").eq("season_id", s.id).limit(5000);
    if (kind === "fppremium") q = q.eq("is_premium", true);
    const ids = [...new Set(((await q).data || []).map((r: any) => r.visitor_id))];
    rows = ids.length ? ((await base().in("visitor_id", ids.slice(0, 1000))).data || []) : []; label = kind === "fppremium" ? "Fire Pass premium" : "pemain Fire Pass";
  } else if (kind === "kategori") {
    need(val, "Format: !broadcast kategori [nama_kategori] | judul | isi");
    const { data: prods } = await sb.from("products").select("id").ilike("category", val);
    const pids = (prods || []).map((p: any) => p.id);
    const { data } = pids.length ? await sb.from("balance_transactions").select("visitor_id").in("product_id", pids).limit(5000) : { data: [] };
    const ids = [...new Set((data || []).map((r: any) => r.visitor_id))];
    rows = ids.length ? ((await base().in("visitor_id", ids.slice(0, 1000))).data || []) : []; label = "pembeli kategori " + val;
  } else if (kind === "status") {
    need(val === "banned" || val === "normal", "Format: !broadcast status [banned/normal] | judul | isi");
    const { data: bans } = await sb.from("account_bans").select("visitor_id").eq("is_active", true);
    const banned = new Set((bans || []).map((b: any) => b.visitor_id));
    rows = ((await base()).data || []).filter((u: any) => (val === "banned") === banned.has(u.visitor_id)); label = "status " + val;
  } else if (kind === "role") {
    const { data } = await sb.from("wa_bot_admins").select("phone, role").eq("is_active", true);
    const list = (data || []).filter((a: any) => !val || a.role === val);
    return { label: "admin WA" + (val ? " role " + val : ""), rows: list.map((a: any) => ({ visitor_id: null, username: a.role, phone: a.phone })) };
  } else throw new UserErr("Target tidak dikenal. Pilihan: semua, useraktif, user [nama], saldo [min], pembeli, kategori [nama], status [banned/normal], firepass, fppremium, role [role]");
  return { label, rows };
}
function splitBroadcast(c: Ctx) {
  const parts = c.raw.split("|").map((s) => s.trim());
  const targetArgs = (parts[0] || "").split(/\s+/).filter(Boolean);
  return { targetArgs, title: parts[1] || "", message: parts[2] || parts[1] || "" };
}

async function dashboardText(sb: any, a: Actor) {
  const t0 = todayStart();
  const s = await activeSeason(sb);
  const [users, active, newU, online, pendingDep, depToday, trxToday, prods, lowStock, orders, fpPlayers, fpPremium, fpDone, anonQ, anonS, aiFb, tOpen, tClosed, cNew, cRep, health] = await Promise.all([
    count(head(sb, "user_balances")), count(head(sb, "user_balances").gte("last_seen_at", since(24))), count(head(sb, "user_balances").gte("created_at", t0)), count(head(sb, "user_balances").gte("last_seen_at", since(0.25))),
    count(head(sb, "deposits").eq("status", "pending")), sb.from("deposits").select("amount").eq("status", "success").gte("created_at", t0), count(head(sb, "balance_transactions").gte("created_at", t0)),
    count(head(sb, "products")), sb.from("products").select("title, stock").lte("stock", 3).order("stock").limit(5), count(head(sb, "seller_orders").gte("created_at", t0)),
    s ? count(head(sb, "fire_pass_progress").eq("season_id", s.id)) : 0, s ? count(head(sb, "fire_pass_progress").eq("season_id", s.id).eq("is_premium", true)) : 0, count(head(sb, "fire_pass_mission_progress").eq("is_completed", true).gte("created_at", t0)),
    count(head(sb, "anon_chat_queue")), count(head(sb, "anon_chat_sessions").eq("status", "active")), count(head(sb, "ai_message_feedback").gte("created_at", since(24))),
    count(head(sb, "support_tickets").eq("status", "open")), count(head(sb, "support_tickets").eq("status", "closed")),
    count(head(sb, "confess_public_wall").gte("created_at", t0)), count(head(sb, "confess_reports").eq("status", "pending")),
    sb.from("wa_bot_health").select("*").eq("id", "main").maybeSingle(),
  ]);
  const { data: bal } = await sb.from("user_balances").select("balance").limit(10000);
  const circ = (bal || []).reduce((x: number, r: any) => x + Number(r.balance || 0), 0);
  const depSum = (depToday.data || []).reduce((x: number, r: any) => x + Number(r.amount || 0), 0);
  const { data: top } = await sb.from("products").select("title, sold_count").order("sold_count", { ascending: false }).limit(3);
  const h = health.data;
  const L: string[] = ["📊 *DASHBOARD ADMIN*", dt(new Date()), ""];
  L.push("⚙️ *SYSTEM*", `• Bot: ${h?.status || "-"} (v${h?.version || "-"})`, `• Uptime sejak: ${dt(h?.started_at)}`, `• Memori: ${h?.memory_mb ?? "-"} MB • Reconnect: ${h?.reconnect_count ?? 0}`, "• Database/Backend: ✅ terhubung", "");
  L.push("👤 *USER*", `• Total ${users} • Aktif 24j ${active} • Baru hari ini ${newU} • Online ${online}`, "");
  if (can(a, "finance_read") || can(a, "stats")) L.push("💰 *FINANCE*", `• Saldo beredar ${rp(circ)}`, `• Deposit pending ${pendingDep} • Deposit hari ini ${rp(depSum)}`, `• Transaksi hari ini ${trxToday}`, "");
  L.push("🛒 *STORE*", `• Produk ${prods} • Pesanan toko hari ini ${orders}`, `• Stok menipis: ${(lowStock.data || []).map((p: any) => `${clip(p.title, 20)}(${p.stock})`).join(", ") || "-"}`, `• Terlaris: ${(top || []).map((p: any) => `${clip(p.title, 20)}(${p.sold_count || 0})`).join(", ") || "-"}`, "");
  L.push("🔥 *FIRE PASS*", s ? `• ${s.name}: pemain ${fpPlayers} • premium ${fpPremium} • misi selesai hari ini ${fpDone}` : "• Tidak ada season aktif", "");
  L.push("👻 *ANON CHAT*", `• Antrian ${anonQ} • Sesi aktif ${anonS}`, "");
  L.push("🤖 *AI*", `• Feedback 24j ${aiFb} • Log request/error AI belum dicatat backend`, "");
  L.push("🎫 *TICKET*", `• Open ${tOpen} • Closed ${tClosed}`, "");
  L.push("💌 *CONFESS*", `• Baru hari ini ${cNew} • Laporan pending ${cRep}`);
  return L.join("\n");
}

// ═══════════════════════════ ACTIONS ═══════════════════════════
const A: Record<string, Action> = {};
const def = (names: string[], a: Action) => { for (const n of names) A[n] = a; };

// ─── MENU / HELP ───
const MENU: [string, string, string[]][] = [
  ["1", "👤 User", ["!user", "!alluser", "!detailuser", "!topuser", "!loginhistory", "!aktivitas", "!cariuser", "!banuser", "!unbanuser", "!warnuser", "!resetuser", "!edituser"]],
  ["2", "💰 Finance", ["!saldo", "!tambahsaldo", "!kurangsaldo", "!setsaldo", "!resetsaldo", "!deposit_admin", "!konfirmasi", "!tolakdeposit", "!rekapdeposit", "!riwayatdeposit"]],
  ["3", "🛒 Store", ["!produkadmin", "!tambahproduk", "!editproduk", "!hapusproduk", "!stok", "!setstok", "!kategoriadmin", "!tambahkategori", "!editkategori", "!hapuskategori", "!flashsaleadmin", "!grosiradmin", "!sponsoradmin"]],
  ["4", "📦 Order", ["!transaksi", "!detailtrx", "!pesanan", "!detailpesanan", "!batalkanpesanan", "!prosespesanan", "!selesaipesanan", "!refund", "!refundstatus"]],
  ["5", "🎮 Game", ["!game", "!setgame", "!resetgame", "!kredit", "!setkredit", "!resetkredit", "!streak", "!setstreak", "!resetstreak", "!gameconfig"]],
  ["6", "🔥 Fire Pass", ["!firepassadmin", "!fpuser", "!fpprogress", "!fpmisiadmin", "!fptambahmisi", "!fpeditmisi", "!fphapusmisi", "!fptieradmin", "!fptambahtier", "!fpedittier", "!fphapustier", "!fpxp", "!fpgive", "!fpgiverank", "!fppremium", "!fpreset", "!fpseason", "!fpstats"]],
  ["7", "👻 Anonymous Chat", ["!anonadmin", "!anonstats", "!anononline", "!anonqueue", "!anonsession", "!anonreport", "!anonreports", "!anonban", "!anonunban", "!anonwarn", "!anonblock", "!anonunblock", "!anonmoderasi", "!anonviolations"]],
  ["8", "🤖 Store AI", ["!aadmin", "!aistats", "!aiusers", "!aiusage", "!aierrors", "!aichatlog", "!aimodel", "!aiconfig", "!aitest", "!aireload", "!adminai"]],
  ["9", "💙 Bot Galau", ["!galauadmin", "!galaustats", "!galauusers", "!galausage", "!galausessions", "!galauerrors", "!galauconfig", "!galaureset"]],
  ["10", "💌 Confess", ["!confessadmin", "!confesslist", "!confessdetail", "!confessapprove", "!confessreject", "!confesshide", "!confessrestore", "!confessdelete", "!confesspin", "!confessunpin", "!confessreport", "!confessreports", "!confessstats", "!confessbroadcast"]],
  ["11", "🎫 Ticket", ["!tiket", "!tiketdetail", "!balastiket", "!adminbalas", "!settiket", "!tiketclose", "!tiketopen", "!tiketassign", "!lihatsemuatiket", "!tiketstats"]],
  ["12", "🔔 Notification", ["!notif", "!notifuser", "!notiftrx", "!notifdeposit", "!notifpesanan", "!notiffirepass", "!notifbroadcast", "!notifstatus", "!notiftest"]],
  ["13", "📢 Broadcast", ["!broadcast"]],
  ["14", "📊 Statistics", ["!dashboard", "!report", "!searchadmin", "!exportuser", "!exporttrx", "!exportdeposit", "!exportticket", "!exportactivity", "!exportfirepass"]],
  ["15", "🛡️ Security", ["!auditlog", "!adminlist", "!whoami"]],
  ["16", "⚙️ Bot System", ["!botstatus", "!botstats", "!boterrors", "!botrestart", "!botreload", "!botversion", "!botuptime", "!maintenance"]],
];
// Command lama yang tetap dijalankan bot (logika lama), tapi DIIZINKAN oleh server.
export const LEGACY_PERMS: Record<string, string> = {
  "!buattoken": "user_write", "!konfirmasi": "finance", "!tolakdeposit": "finance", "!deposit_admin": "finance_read", "!rekapdeposit": "finance_read",
  "!adminbalas": "ticket", "!saldo": "finance_read", "!game": "game_read", "!kredit": "game_read", "!setkredit": "game", "!resetkredit": "game", "!resetgame": "game",
  "!streak": "game_read", "!setstreak": "game", "!resetstreak": "game", "!stok": "store", "!stoksponsor": "store", "!user": "user_basic", "!alluser": "user_basic", "!topuser": "user_basic",
  "!loginhistory": "user", "!transaksi": "order_read", "!tiket": "ticket", "!settiket": "ticket", "!tiketdetail": "ticket", "!lihatsemuatiket": "ticket", "!notif": "notify_user", "!report": "stats_basic", "!aktivitas": "stats_basic", "!token": "user_write",
};

async function menuText(c: Ctx, cfg: any) {
  const sel = c.args[0];
  const featOf: Record<string, string> = { "6": "firepass", "7": "anon", "8": "ai", "9": "galau", "10": "confess", "12": "notif", "13": "broadcast" };
  const avail = (cmd: string) => { const act = A[cmd.slice(1)]; const p = act?.perm || LEGACY_PERMS[cmd]; return p ? can(c.actor, p) : false; };
  if (sel && /^\d+$/.test(sel)) {
    const m = MENU.find((x) => x[0] === sel); need(m, "Kategori tidak ada. Ketik !adminmenu");
    const f = featOf[m![0]]; const st = f ? (cfg.features[f] ? "ON" : "OFF") : "ON";
    const lines = m![2].filter(avail).map((cmd) => { const act = A[cmd.slice(1)]; return `• ${cmd}${act?.usage ? " " + act.usage : ""}${act ? " — " + act.desc : " (lama)"}`; });
    return `${m![1]} [${st}]\n\n` + (lines.length ? lines.join("\n") : "Tidak ada command yang diizinkan untuk role Anda.");
  }
  const cats = MENU.filter((m) => m[2].some(avail)).map((m) => { const f = featOf[m[0]]; return `${m[0]}. ${m[1]}${f ? (cfg.features[f] ? " • ON" : " • OFF") : ""}`; });
  return ["🛡️ *ADMIN CENTER*", `Role: *${c.actor.role}*${cfg.maintenance ? " • 🔧 MAINTENANCE ON" : ""}`, "", ...cats, "", "Ketik *!adminmenu [nomor]* untuk submenu.", "Contoh: !adminmenu 2", "", "Detail semua command: *!adminhelp*"].join("\n");
}
def(["admin", "adminmenu"], { perm: "user_basic", desc: "Menu admin", run: async (c) => menuText(c, await loadConfig(c.sb)) });
def(["adminhelp"], { perm: "user_basic", desc: "Semua command yang tersedia", run: async (c) => {
  const cfg = await loadConfig(c.sb);
  const featOf: Record<string, string> = { "6": "firepass", "7": "anon", "8": "ai", "9": "galau", "10": "confess", "12": "notif", "13": "broadcast" };
  const out = ["📘 *ADMIN HELP* (role " + c.actor.role + ")", ""];
  for (const m of MENU) {
    const cmds = m[2].filter((cmd) => { const act = A[cmd.slice(1)]; const p = act?.perm || LEGACY_PERMS[cmd]; return p && can(c.actor, p); });
    if (!cmds.length) continue;
    const f = featOf[m[0]];
    out.push(`*${m[1]}* [${f ? (cfg.features[f] ? "ON" : "OFF") : "ON"}]`);
    out.push(cmds.map((cmd) => { const act = A[cmd.slice(1)]; return cmd + (act?.usage ? " " + act.usage : ""); }).join("\n"), "");
  }
  return out.join("\n");
} });
def(["whoami"], { perm: "user_basic", desc: "Role Anda", run: async (c) => `🛡️ Nomor: ${maskPhone(c.actor.phone)}\nRole: *${c.actor.role}*\nPermission: ${[...c.actor.perms].join(", ")}` });

// ─── DASHBOARD ───
def(["dashboard"], { perm: "stats_basic", heavy: true, desc: "Ringkasan sistem", run: async (c) => dashboardText(c.sb, c.actor) });

// ─── USER ───
def(["cariuser"], { perm: "user_basic", usage: "[kata]", desc: "Cari user", run: async (c) => {
  const q = c.args.join(" ").trim(); need(q.length >= 2, "Format: !cariuser [kata min 2 huruf]");
  const { data } = await c.sb.from("user_balances").select("username, phone, balance").or(`username.ilike.%${q.replace(/[,()%]/g, "")}%,phone.ilike.%${digits(q) || "x"}%`).limit(200);
  return pageText(`🔎 *Cari user "${q}"*`, (data || []).map((u: any) => `${u.username} • ${maskPhone(u.phone)} • ${rp(u.balance)}`), c.page, "!cariuser " + q);
} });
def(["detailuser"], { perm: "user_basic", usage: "[nama/hp/email]", desc: "Detail lengkap user", run: async (c) => {
  const u = await needUser(c); const vid = u.visitor_id; const s = await activeSeason(c.sb);
  const [trx, games, credit, streak, fp, ban, warns, act, login, prof] = await Promise.all([
    count(head(c.sb, "balance_transactions").eq("visitor_id", vid)), c.sb.from("game_stats").select("game_type, wins, losses, points").eq("visitor_id", vid),
    c.sb.from("user_game_credits").select("credits, unlimited_until").eq("visitor_id", vid).maybeSingle(), c.sb.from("daily_streaks").select("current_streak, longest_streak").eq("visitor_id", vid).maybeSingle(),
    s ? c.sb.from("fire_pass_progress").select("badges, is_premium, claimed_free_tiers, claimed_premium_tiers").eq("season_id", s.id).eq("visitor_id", vid).maybeSingle() : { data: null },
    c.sb.rpc("get_account_ban_info", { p_visitor_id: vid }), count(head(c.sb, "wa_admin_audit_log").in("action", ["warnuser", "anonwarn"]).eq("target", vid)),
    c.sb.from("profile_activity_log").select("action, created_at").eq("visitor_id", vid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    c.sb.from("balance_login_history").select("logged_in_at").eq("visitor_id", vid).order("logged_in_at", { ascending: false }).limit(1).maybeSingle(),
    c.sb.from("game_profiles").select("display_name").eq("visitor_id", vid).maybeSingle(),
  ]);
  const g = games.data || []; const banInfo = Array.isArray(ban.data) ? ban.data[0] : ban.data;
  const showEmail = can(c.actor, "user");
  return [
    "👤 *DETAIL USER*", "",
    `Nama: ${prof.data?.display_name || "-"}`, `Username: ${u.username}`, `HP: ${can(c.actor, "user") ? u.phone || "-" : maskPhone(u.phone)}`,
    showEmail ? `Email: ${u.email || "-"}` : "Email: (butuh permission admin)",
    `Saldo: ${rp(u.balance)} • Saldo IN: ${rp(u.bonus_balance)}`, `Status: ${banInfo?.is_banned || banInfo?.banned ? "⛔ BANNED" : "✅ Normal"} • Warning: ${warns}`,
    `2FA: ${u.totp_enabled ? "aktif" : "tidak"}`, `Daftar: ${dt(u.created_at)}`, `Terakhir aktif: ${dt(u.last_seen_at)}`, `Login terakhir: ${dt(login.data?.logged_in_at)}`,
    `Aktivitas terakhir: ${act.data ? act.data.action + " (" + dt(act.data.created_at) + ")" : "-"}`, "",
    `🧾 Transaksi: ${trx}`, `🎮 Game: ${g.length ? g.map((x: any) => `${x.game_type} ${x.wins}W/${x.losses}L ${x.points}pt`).slice(0, 5).join(", ") : "-"}`,
    `🎟️ Kredit: ${credit.data?.credits ?? 0}${credit.data?.unlimited_until ? " (unlimited s/d " + dt(credit.data.unlimited_until) + ")" : ""}`,
    `🔥 Streak: ${streak.data?.current_streak ?? 0} (terpanjang ${streak.data?.longest_streak ?? 0})`,
    `🏆 Fire Pass: ${fp.data ? `${fp.data.badges} badge • ${fp.data.is_premium ? "Premium" : "Free"} • klaim ${(fp.data.claimed_free_tiers || []).length + (fp.data.claimed_premium_tiers || []).length}` : "belum ikut"}`,
  ].join("\n");
} });
def(["banuser"], { perm: "ban", confirm: true, usage: "[user] [jam/permanen] [alasan]", desc: "Ban akun", preview: async (c) => { const u = await needUser(c); return `⛔ Ban user *${u.username}*\nDurasi: ${c.args[1] || "permanen"}\nAlasan: ${c.args.slice(2).join(" ") || "-"}`; }, run: async (c) => {
  const u = await needUser(c); const hours = num(c.args[1]); const perm = !Number.isFinite(hours) || hours <= 0;
  await c.sb.from("account_bans").update({ is_active: false }).eq("visitor_id", u.visitor_id).eq("is_active", true);
  const { error } = await c.sb.from("account_bans").insert({ visitor_id: u.visitor_id, user_balance_id: u.id, reason: c.args.slice(2).join(" ") || "Dibanned admin via WA", is_permanent: perm, banned_until: perm ? null : new Date(Date.now() + hours * 3600e3).toISOString(), is_active: true, banned_by: "wa:" + c.actor.role });
  if (error) throw error;
  await notify(c.sb, u.visitor_id, "Akun dibatasi", "Akun Anda dibatasi oleh admin.", "warning");
  return `✅ ${u.username} dibanned ${perm ? "permanen" : hours + " jam"}.`;
} });
def(["unbanuser"], { perm: "ban", usage: "[user] [alasan]", desc: "Cabut ban", run: async (c) => {
  const u = await needUser(c);
  const { data } = await c.sb.from("account_bans").update({ is_active: false, unbanned_at: new Date().toISOString(), unban_reason: c.args.slice(1).join(" ") || "Unban via WA" }).eq("visitor_id", u.visitor_id).eq("is_active", true).select("id");
  return (data || []).length ? `✅ Ban ${u.username} dicabut.` : `ℹ️ ${u.username} tidak sedang dibanned.`;
} });
def(["warnuser"], { perm: "ban", usage: "[user] [alasan]", desc: "Beri peringatan", run: async (c) => {
  const u = await needUser(c); const why = c.args.slice(1).join(" ") || "Pelanggaran aturan";
  await notify(c.sb, u.visitor_id, "⚠️ Peringatan dari admin", why, "warning");
  const n = await count(head(c.sb, "wa_admin_audit_log").in("action", ["warnuser", "anonwarn"]).eq("target", u.visitor_id));
  return `⚠️ Peringatan dikirim ke ${u.username}. Total peringatan: ${n + 1}.`;
} });
def(["resetuser"], { perm: "user_write", confirm: true, usage: "[user] [game/kredit/streak/semua]", desc: "Reset data game user", preview: async (c) => { const u = await needUser(c); return `♻️ Reset *${c.args[1] || "semua"}* milik ${u.username}\n(saldo TIDAK ikut direset)`; }, run: async (c) => {
  const u = await needUser(c); const what = (c.args[1] || "semua").toLowerCase(); const done: string[] = [];
  if (what === "game" || what === "semua") { await c.sb.from("game_stats").update({ wins: 0, losses: 0, points: 0, total_questions: 0 }).eq("visitor_id", u.visitor_id); done.push("game"); }
  if (what === "kredit" || what === "semua") { await c.sb.from("user_game_credits").update({ credits: 0, unlimited_until: null }).eq("visitor_id", u.visitor_id); done.push("kredit"); }
  if (what === "streak" || what === "semua") { await c.sb.from("daily_streaks").update({ current_streak: 0 }).eq("visitor_id", u.visitor_id); done.push("streak"); }
  need(done.length, "Pilihan: game / kredit / streak / semua");
  await notify(c.sb, u.visitor_id, "Data direset admin", "Direset: " + done.join(", "), "warning");
  return `✅ Reset ${done.join(", ")} untuk ${u.username}.`;
} });
def(["edituser"], { perm: "user_write", confirm: true, usage: "[user] [username/hp/email] [nilai]", desc: "Ubah profil user", preview: async (c) => { const u = await needUser(c); return `✏️ Ubah ${c.args[1]} milik ${u.username} → ${c.args.slice(2).join(" ")}`; }, run: async (c) => {
  const u = await needUser(c); const f = (c.args[1] || "").toLowerCase(); const v = c.args.slice(2).join(" ").trim();
  need(["username", "hp", "email"].includes(f) && v, "Format: !edituser [user] [username/hp/email] [nilai]");
  const col = f === "hp" ? "phone" : f;
  if (col === "username") need(/^[a-zA-Z0-9_.]{3,30}$/.test(v), "Username 3-30 karakter huruf/angka/_/.");
  if (col === "email") need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email tidak valid.");
  const { data: dup } = await c.sb.from("user_balances").select("id").ilike(col, col === "phone" ? canonPhone(v) : v).neq("id", u.id).limit(1);
  need(!(dup || []).length, `${f} sudah dipakai akun lain.`);
  const { error } = await c.sb.from("user_balances").update({ [col]: col === "phone" ? canonPhone(v) : v }).eq("id", u.id);
  if (error) throw error;
  return `✅ ${f} ${u.username} diubah.`;
} });

// ─── FINANCE ───
const balPreview = (op: string) => async (c: Ctx) => {
  const u = await needUser(c); const amt = num(c.args[1]);
  if (op !== "reset") need(Number.isFinite(amt) && amt > 0 && amt <= 100_000_000, "Jumlah harus angka 1 – 100.000.000.");
  const after = op === "add" ? u.balance + amt : op === "deduct" ? u.balance - amt : op === "set" ? amt : 0;
  need(after >= 0, `Saldo tidak cukup (saldo ${rp(u.balance)}).`);
  return `💰 *${op === "add" ? "TAMBAH" : op === "deduct" ? "KURANGI" : op === "set" ? "SET" : "RESET"} SALDO*\nTarget: ${u.username} (${maskPhone(u.phone)})\nSaldo saat ini: ${rp(u.balance)}${op !== "reset" ? "\nJumlah: " + rp(amt) : ""}\nSaldo setelah: ${rp(after)}${op === "add" && amt >= 10000 ? "\nBonus Saldo IN 15%: " + rp(Math.floor(amt * 0.15)) : ""}`;
};
const balRun = (op: string) => async (c: Ctx) => { const u = await needUser(c); const r = await balanceOp(c.sb, op, u.visitor_id, op === "reset" ? 0 : num(c.args[1])); return `✅ Saldo ${u.username}: ${rp(r.old)} → ${rp(r.next)}${r.bonus ? `\n🎁 Bonus Saldo IN ${rp(r.bonus)}` : ""}`; };
def(["tambahsaldo"], { perm: "finance", confirm: true, usage: "[user] [jumlah]", desc: "Tambah saldo", preview: balPreview("add"), run: balRun("add") });
def(["kurangsaldo"], { perm: "finance", confirm: true, usage: "[user] [jumlah]", desc: "Kurangi saldo", preview: balPreview("deduct"), run: balRun("deduct") });
def(["setsaldo"], { perm: "finance", confirm: true, usage: "[user] [jumlah]", desc: "Set saldo", preview: balPreview("set"), run: balRun("set") });
def(["resetsaldo"], { perm: "finance", confirm: true, usage: "[user]", desc: "Reset saldo ke 0", preview: balPreview("reset"), run: balRun("reset") });
def(["riwayatdeposit"], { perm: "finance_read", usage: "[user?]", desc: "Riwayat deposit", run: async (c) => {
  let q = c.sb.from("deposits").select("username, amount, status, trx_id, created_at").order("created_at", { ascending: false }).limit(300);
  if (c.args[0]) { const u = await needUser(c); q = q.eq("visitor_id", u.visitor_id); }
  const { data } = await q;
  return pageText("🏦 *Riwayat Deposit*", (data || []).map((d: any) => `${d.trx_id} • ${d.username} • ${rp(d.amount)} • ${d.status} • ${dt(d.created_at)}`), c.page, "!riwayatdeposit " + (c.args[0] || ""));
} });

// ─── STORE ───
def(["produkadmin"], { perm: "store", usage: "[kata?]", desc: "Daftar produk", run: async (c) => {
  let q = c.sb.from("products").select("id, title, price, stock, category, sold_count").order("created_at", { ascending: false }).limit(500);
  if (c.args[0] && c.args[0] !== "hal") q = q.ilike("title", `%${c.args.join(" ")}%`);
  const { data } = await q;
  return pageText("🛒 *Produk*", (data || []).map((p: any) => `${clip(p.title, 30)} • ${rp(p.price)} • stok ${p.stock} • ${p.category || "-"} • ID ${p.id.slice(0, 8)}`), c.page, "!produkadmin");
} });
async function productByRef(sb: any, ref: string) {
  need(ref, "ID produk wajib (8 karakter pertama cukup).");
  const r = ref.replace(/^#/, "");
  const { data } = await sb.from("products").select("id, title, price, stock, category").limit(1000);
  const p = (data || []).find((x: any) => x.id === r || x.id.startsWith(r.toLowerCase()) || x.title.toLowerCase() === r.toLowerCase());
  need(p, "Produk tidak ditemukan."); return p;
}
def(["tambahproduk"], { perm: "store", confirm: true, usage: "nama | harga | stok | kategori | deskripsi", desc: "Tambah produk", preview: async (c) => { const [t, h, s, k] = c.raw.split("|").map((x) => x.trim()); need(t && num(h) > 0, "Format: !tambahproduk nama | harga | stok | kategori | deskripsi"); return `➕ Produk baru\nNama: ${t}\nHarga: ${rp(num(h))}\nStok: ${num(s) || 0}\nKategori: ${k || "-"}`; }, run: async (c) => {
  const [t, h, s, k, d] = c.raw.split("|").map((x) => x.trim());
  const { data, error } = await c.sb.from("products").insert({ title: t, price: num(h), stock: Math.max(0, num(s) || 0), category: k || null, description: d || null }).select("id").single();
  if (error) throw error; return `✅ Produk "${t}" ditambahkan. ID ${data.id.slice(0, 8)}`;
} });
def(["editproduk"], { perm: "store", confirm: true, usage: "[id] [nama/harga/stok/kategori/deskripsi] [nilai]", desc: "Ubah produk", preview: async (c) => { const p = await productByRef(c.sb, c.args[0]); return `✏️ ${p.title}\n${c.args[1]} → ${c.args.slice(2).join(" ")}`; }, run: async (c) => {
  const p = await productByRef(c.sb, c.args[0]); const map: Record<string, string> = { nama: "title", harga: "price", stok: "stock", kategori: "category", deskripsi: "description" };
  const col = map[(c.args[1] || "").toLowerCase()]; const v = c.args.slice(2).join(" ");
  need(col && v, "Field: nama/harga/stok/kategori/deskripsi");
  const val = col === "price" || col === "stock" ? num(v) : v; if (typeof val === "number") need(val >= 0, "Nilai harus ≥ 0.");
  const { error } = await c.sb.from("products").update({ [col]: val, updated_at: new Date().toISOString() }).eq("id", p.id); if (error) throw error;
  return `✅ ${p.title}: ${c.args[1]} diperbarui.`;
} });
def(["hapusproduk"], { perm: "store", confirm: true, usage: "[id]", desc: "Hapus produk", preview: async (c) => { const p = await productByRef(c.sb, c.args[0]); return `🗑️ HAPUS produk *${p.title}* (stok ${p.stock}). Tidak bisa dibatalkan.`; }, run: async (c) => {
  const p = await productByRef(c.sb, c.args[0]); const { error } = await c.sb.from("products").delete().eq("id", p.id);
  if (error) return `❌ Produk tidak bisa dihapus karena masih dipakai data lain (riwayat/gambar). Set stok 0 dengan !setstok ${p.id.slice(0, 8)} 0.`;
  return `✅ Produk ${p.title} dihapus.`;
} });
def(["setstok"], { perm: "store", usage: "[id] [jumlah]", desc: "Set stok produk", run: async (c) => {
  const p = await productByRef(c.sb, c.args[0]); const n = num(c.args[1]); need(Number.isFinite(n) && n >= 0, "Jumlah stok harus ≥ 0.");
  await c.sb.from("products").update({ stock: n, updated_at: new Date().toISOString() }).eq("id", p.id); return `✅ Stok ${p.title}: ${p.stock} → ${n}`;
} });
def(["kategoriadmin"], { perm: "store", desc: "Kategori produk", run: async (c) => {
  const { data } = await c.sb.from("products").select("category").limit(2000);
  const m: Record<string, number> = {}; (data || []).forEach((p: any) => { const k = p.category || "(tanpa kategori)"; m[k] = (m[k] || 0) + 1; });
  const extra = JSON.parse(await getSetting(c.sb, "product_categories_extra", "[]") || "[]") as string[];
  extra.forEach((k) => { if (!(k in m)) m[k] = 0; });
  return pageText("🏷️ *Kategori*", Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} • ${v} produk`), c.page, "!kategoriadmin");
} });
def(["tambahkategori"], { perm: "store", usage: "[nama]", desc: "Daftarkan kategori", run: async (c) => {
  const k = c.args.join(" ").trim(); need(k.length >= 2, "Format: !tambahkategori [nama]");
  const extra = JSON.parse(await getSetting(c.sb, "product_categories_extra", "[]") || "[]") as string[];
  if (!extra.includes(k)) extra.push(k); await setSetting(c.sb, "product_categories_extra", JSON.stringify(extra));
  return `✅ Kategori "${k}" terdaftar. Pakai saat !tambahproduk / !editproduk.`;
} });
def(["editkategori"], { perm: "store", confirm: true, usage: "lama | baru", desc: "Ganti nama kategori", preview: async (c) => { const [a, b] = c.raw.split("|").map((x) => x.trim()); need(a && b, "Format: !editkategori lama | baru"); const n = await count(head(c.sb, "products").ilike("category", a)); return `✏️ Kategori "${a}" → "${b}" (${n} produk)`; }, run: async (c) => {
  const [a, b] = c.raw.split("|").map((x) => x.trim()); const { data } = await c.sb.from("products").update({ category: b }).ilike("category", a).select("id"); return `✅ ${(data || []).length} produk dipindah ke "${b}".`;
} });
def(["hapuskategori"], { perm: "store", confirm: true, usage: "[nama]", desc: "Kosongkan kategori", preview: async (c) => { const k = c.args.join(" "); const n = await count(head(c.sb, "products").ilike("category", k)); return `🗑️ Hapus kategori "${k}" — ${n} produk akan tanpa kategori.`; }, run: async (c) => {
  const k = c.args.join(" "); const { data } = await c.sb.from("products").update({ category: null }).ilike("category", k).select("id");
  const extra = (JSON.parse(await getSetting(c.sb, "product_categories_extra", "[]") || "[]") as string[]).filter((x) => x !== k); await setSetting(c.sb, "product_categories_extra", JSON.stringify(extra));
  return `✅ Kategori "${k}" dihapus (${(data || []).length} produk).`;
} });
def(["flashsaleadmin"], { perm: "store", desc: "Flash sale aktif", run: async (c) => {
  const now = new Date().toISOString();
  const [a, b] = await Promise.all([c.sb.from("store_flash_sales").select("product_id, mode, discount_percent, flash_price, quota, sold, ends_at, is_active").eq("is_active", true).gte("ends_at", now).limit(50), c.sb.from("flash_sales").select("title, discount_percent, ends_at, is_active").eq("is_active", true).gte("ends_at", now).limit(50)]);
  const rows = [...(a.data || []).map((f: any) => `Toko • ${f.mode === "fixed_price" ? rp(f.flash_price) : f.discount_percent + "%"} • terjual ${f.sold}/${f.quota ?? "∞"} • s/d ${dt(f.ends_at)}`), ...(b.data || []).map((f: any) => `${f.title} • ${f.discount_percent}% • s/d ${dt(f.ends_at)}`)];
  return pageText("⚡ *Flash Sale Aktif*", rows, c.page, "!flashsaleadmin");
} });
def(["grosiradmin"], { perm: "store", desc: "Harga grosir", run: async (c) => {
  const { data, error } = await c.sb.from("wholesale_prices").select("*").limit(200);
  if (error) return "ℹ️ Data grosir dikelola dari website (Admin → Produk). Tidak ada tabel grosir yang bisa dibaca.";
  return pageText("📦 *Grosir*", (data || []).map((w: any) => JSON.stringify(w).slice(0, 90)), c.page, "!grosiradmin");
} });
def(["sponsoradmin"], { perm: "store", desc: "Daftar sponsor", run: async (c) => {
  const { data } = await c.sb.from("sponsors").select("sponsor_number, title, price, stock, is_active, expires_at").order("sponsor_number").limit(300);
  return pageText("🏪 *Sponsor*", (data || []).map((s: any) => `#${s.sponsor_number} ${clip(s.title, 25)} • ${rp(s.price)} • stok ${s.stock ?? "-"} • ${s.is_active ? "aktif" : "off"}`), c.page, "!sponsoradmin");
} });

// ─── ORDER (pesanan toko marketplace; memakai RPC refund yang sama dengan web) ───
async function orderByRef(sb: any, ref: string) {
  need(ref, "Kode pesanan wajib.");
  const r = ref.replace(/^#/, "");
  let q = sb.from("seller_orders").select("*").limit(1);
  q = /^\d+$/.test(r) ? q.eq("order_number", Number(r)) : r.length === 36 ? q.eq("id", r) : q.ilike("order_code", r);
  const { data } = await q.maybeSingle(); need(data, "Pesanan tidak ditemukan."); return data;
}
def(["detailtrx"], { perm: "order_read", usage: "[trx_id]", desc: "Detail transaksi", run: async (c) => {
  need(c.args[0], "Format: !detailtrx [trx_id]");
  const { data } = await c.sb.from("balance_transactions").select("visitor_id, type, amount, description, trx_id, created_at").eq("trx_id", c.args[0]).maybeSingle();
  need(data, "Transaksi tidak ditemukan.");
  const { data: u } = await c.sb.from("user_balances").select("username").eq("visitor_id", data.visitor_id).maybeSingle();
  return `🧾 *${data.trx_id}*\nUser: ${u?.username || "-"}\nTipe: ${data.type}\nJumlah: ${rp(data.amount)}\nKet: ${data.description || "-"}\nWaktu: ${dt(data.created_at)}`;
} });
def(["pesanan"], { perm: "order_read", usage: "[status?]", desc: "Pesanan toko", run: async (c) => {
  let q = c.sb.from("seller_orders").select("order_code, order_number, store_name, product_title, grand_total, total, status, created_at").order("created_at", { ascending: false }).limit(300);
  if (c.args[0] && c.args[0] !== "hal") q = q.eq("status", c.args[0]);
  const { data } = await q;
  return pageText("📦 *Pesanan*", (data || []).map((o: any) => `${o.order_code || o.order_number} • ${clip(o.product_title, 20)} • ${rp(o.grand_total ?? o.total)} • ${o.status}`), c.page, "!pesanan " + (c.args[0] || ""));
} });
def(["detailpesanan"], { perm: "order_read", usage: "[kode]", desc: "Detail pesanan", run: async (c) => {
  const o = await orderByRef(c.sb, c.args[0]);
  return `📦 *Pesanan ${o.order_code || o.order_number}*\nToko: ${o.store_name || "-"}\nProduk: ${o.product_title} x${o.qty}\nTotal: ${rp(o.grand_total ?? o.total)}\nStatus: ${o.status} • Escrow: ${o.escrow_status || "-"}\nPembeli: ${o.buyer_name || "-"} (${maskPhone(o.buyer_phone)})\nDibuat: ${dt(o.created_at)}\nDibayar: ${dt(o.paid_at)}\nSelesai: ${dt(o.completed_at)}${o.refunded_at ? "\nRefund: " + dt(o.refunded_at) : ""}`;
} });
const orderStatus = (status: string, extra: Record<string, unknown>) => async (c: Ctx) => {
  const o = await orderByRef(c.sb, c.args[0]);
  const { error } = await c.sb.from("seller_orders").update({ status, updated_at: new Date().toISOString(), ...extra }).eq("id", o.id); if (error) throw error;
  await notify(c.sb, o.buyer_visitor_id, "Status pesanan", `Pesanan ${o.order_code || o.order_number} kini: ${status}`);
  return `✅ Pesanan ${o.order_code || o.order_number} → ${status}`;
};
def(["prosespesanan"], { perm: "order", usage: "[kode]", desc: "Tandai diproses", run: orderStatus("diproses", { processed_at: new Date().toISOString() }) });
def(["selesaipesanan"], { perm: "order", confirm: true, usage: "[kode]", desc: "Tandai selesai", preview: async (c) => { const o = await orderByRef(c.sb, c.args[0]); return `✅ Selesaikan pesanan ${o.order_code || o.order_number} (${rp(o.grand_total ?? o.total)}).\nDana escrow dirilis oleh sistem otomatis seperti di website.`; }, run: orderStatus("selesai", { completed_at: new Date().toISOString() }) });
def(["batalkanpesanan", "refund"], { perm: "finance", confirm: true, usage: "[kode]", desc: "Batalkan + refund ke pembeli", preview: async (c) => { const o = await orderByRef(c.sb, c.args[0]); need(["held", "frozen"].includes(o.escrow_status), `Pesanan tidak bisa direfund (escrow: ${o.escrow_status || "-"}).`); return `↩️ REFUND pesanan ${o.order_code || o.order_number}\nJumlah: ${rp(o.grand_total ?? o.total)} ke pembeli\nStok dikembalikan.`; }, run: async (c) => {
  const o = await orderByRef(c.sb, c.args[0]); const { data, error } = await c.sb.rpc("seller_refund_order", { p_order_id: o.id }); if (error) throw error;
  if (!data) return "❌ Refund ditolak sistem (status escrow sudah berubah).";
  await notify(c.sb, o.buyer_visitor_id, "Refund pesanan", `Dana ${rp(o.grand_total ?? o.total)} untuk pesanan ${o.order_code || o.order_number} dikembalikan.`, "success");
  return `✅ Refund ${rp(o.grand_total ?? o.total)} berhasil.`;
} });
def(["refundstatus"], { perm: "order_read", usage: "[kode?]", desc: "Status refund", run: async (c) => {
  if (c.args[0] && c.args[0] !== "hal") { const o = await orderByRef(c.sb, c.args[0]); return `↩️ ${o.order_code || o.order_number}: escrow ${o.escrow_status || "-"}${o.refunded_at ? " • direfund " + dt(o.refunded_at) : ""}`; }
  const { data } = await c.sb.from("seller_orders").select("order_code, order_number, grand_total, total, refunded_at").not("refunded_at", "is", null).order("refunded_at", { ascending: false }).limit(200);
  return pageText("↩️ *Refund*", (data || []).map((o: any) => `${o.order_code || o.order_number} • ${rp(o.grand_total ?? o.total)} • ${dt(o.refunded_at)}`), c.page, "!refundstatus");
} });

// ─── GAME ───
def(["setgame"], { perm: "game", usage: "[user] [game] [poin]", desc: "Set poin game", run: async (c) => {
  const u = await needUser(c); const g = c.args[1]; const p = num(c.args[2]); need(g && Number.isFinite(p) && p >= 0, "Format: !setgame [user] [game_type] [poin]");
  const { data } = await c.sb.from("game_stats").update({ points: p, updated_at: new Date().toISOString() }).eq("visitor_id", u.visitor_id).eq("game_type", g).select("id");
  if (!(data || []).length) await c.sb.from("game_stats").insert({ visitor_id: u.visitor_id, game_type: g, points: p, wins: 0, losses: 0, total_questions: 0 });
  return `✅ Poin ${g} ${u.username} = ${p}`;
} });
def(["gameconfig"], { perm: "game_read", desc: "Konfigurasi game", run: async (c) => {
  const [cp, lv] = await Promise.all([c.sb.from("credit_packages").select("name, credits, price, is_active").order("price").limit(20), c.sb.from("game_levels").select("*").limit(10)]);
  return "🎮 *Game Config*\n\nPaket kredit:\n" + ((cp.data || []).map((p: any) => `• ${p.name} ${p.credits} kredit ${rp(p.price)} ${p.is_active ? "ON" : "OFF"}`).join("\n") || "-") + `\n\nLevel game terdaftar: ${(lv.data || []).length}\nUbah paket/level lewat website Admin → Game.`;
} });

// ─── FIRE PASS (tabel yang sama dengan function fire-pass & admin web) ───
async function fpProgress(sb: any, vid: string, seasonId: string) {
  const { data } = await sb.from("fire_pass_progress").select("*").eq("season_id", seasonId).eq("visitor_id", vid).maybeSingle(); return data;
}
async function fpUpsert(sb: any, u: any, s: any, patch: Record<string, unknown>) {
  const p = await fpProgress(sb, u.visitor_id, s.id);
  if (p) { await sb.from("fire_pass_progress").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", p.id); return; }
  await sb.from("fire_pass_progress").insert({ season_id: s.id, visitor_id: u.visitor_id, user_balance_id: u.id, badges: 0, is_premium: false, claimed_free_tiers: [], claimed_premium_tiers: [], ...patch });
}
const needSeason = async (sb: any) => { const s = await activeSeason(sb); need(s, "Tidak ada season Fire Pass aktif."); return s; };
def(["firepassadmin", "fpstats"], { perm: "firepass_read", feature: "firepass", desc: "Ringkasan Fire Pass", run: async (c) => {
  const s = await needSeason(c.sb);
  const [pl, pr, ms, ti, done, claimed] = await Promise.all([count(head(c.sb, "fire_pass_progress").eq("season_id", s.id)), count(head(c.sb, "fire_pass_progress").eq("season_id", s.id).eq("is_premium", true)), count(head(c.sb, "fire_pass_missions").eq("season_id", s.id).eq("is_active", true)), count(head(c.sb, "fire_pass_tiers").eq("season_id", s.id)), count(head(c.sb, "fire_pass_mission_progress").eq("is_completed", true).gte("created_at", s.starts_at)), count(head(c.sb, "fire_pass_mission_progress").eq("is_claimed", true).gte("created_at", s.starts_at))]);
  return `🔥 *FIRE PASS — ${s.name}* (S${s.season_number})\n${dt(s.starts_at)} → ${dt(s.ends_at)}\n\n👥 Pemain ${pl} • 👑 Premium ${pr}\n🎯 Misi aktif ${ms} • 🏅 Tier ${ti}\n✅ Misi selesai ${done} • diklaim ${claimed}\n💳 Harga premium ${rp(s.price_saldo_in)} Saldo IN / ${s.price_gems} gem`;
} });
def(["fpuser", "fpprogress", "fpxp"], { perm: "firepass_read", feature: "firepass", usage: "[user]", desc: "Progress Fire Pass user", run: async (c) => {
  const u = await needUser(c); const s = await needSeason(c.sb); const p = await fpProgress(c.sb, u.visitor_id, s.id);
  if (!p) return `🔥 ${u.username} belum ikut ${s.name}.`;
  const { data: tiers } = await c.sb.from("fire_pass_tiers").select("tier_level, badge_required").eq("season_id", s.id).order("tier_level");
  const rank = (tiers || []).filter((t: any) => p.badges >= t.badge_required).pop();
  const { count: done } = await c.sb.from("fire_pass_mission_progress").select("*", { count: "exact", head: true }).eq("visitor_id", u.visitor_id).eq("is_completed", true).gte("created_at", s.starts_at);
  return `🔥 *${u.username}* — ${s.name}\nBadge (XP): ${p.badges}\nTier: ${rank?.tier_level ?? 0}/${(tiers || []).length}\nStatus: ${p.is_premium ? "👑 Premium" : "Free"}\nKlaim free: ${(p.claimed_free_tiers || []).join(",") || "-"}\nKlaim premium: ${(p.claimed_premium_tiers || []).join(",") || "-"}\nMisi selesai: ${done || 0}`;
} });
def(["fpgive"], { perm: "firepass", feature: "firepass", confirm: true, usage: "[user] [badge]", desc: "Tambah badge/XP", preview: async (c) => { const u = await needUser(c); const n = num(c.args[1]); need(Number.isFinite(n) && n !== 0 && Math.abs(n) <= 100000, "Jumlah badge tidak valid."); return `🔥 ${n > 0 ? "Tambah" : "Kurangi"} ${Math.abs(n)} badge untuk ${u.username}`; }, run: async (c) => {
  const u = await needUser(c); const s = await needSeason(c.sb); const p = await fpProgress(c.sb, u.visitor_id, s.id); const n = num(c.args[1]);
  const next = Math.max(0, (p?.badges || 0) + n); await fpUpsert(c.sb, u, s, { badges: next });
  await c.sb.from("fire_pass_badge_log").insert({ season_id: s.id, visitor_id: u.visitor_id, amount: n, source: "admin_wa", note: "Admin WA" }).then(() => {}, () => {});
  await notify(c.sb, u.visitor_id, "🔥 Fire Pass", `Admin ${n > 0 ? "menambah" : "mengurangi"} ${Math.abs(n)} badge. Total: ${next}.`);
  return `✅ Badge ${u.username}: ${p?.badges || 0} → ${next}`;
} });
def(["fpgiverank"], { perm: "firepass", feature: "firepass", confirm: true, usage: "[user] [tier]", desc: "Set tier", preview: async (c) => { const u = await needUser(c); return `🔥 Set ${u.username} ke tier ${c.args[1]}`; }, run: async (c) => {
  const u = await needUser(c); const s = await needSeason(c.sb); const lvl = num(c.args[1]);
  const { data: t } = await c.sb.from("fire_pass_tiers").select("badge_required").eq("season_id", s.id).eq("tier_level", lvl).maybeSingle(); need(t, "Tier tidak ada.");
  await fpUpsert(c.sb, u, s, { badges: t.badge_required }); return `✅ ${u.username} kini tier ${lvl} (${t.badge_required} badge).`;
} });
def(["fppremium"], { perm: "firepass", feature: "firepass", confirm: true, usage: "[user] [on/off]", desc: "Premium Fire Pass", preview: async (c) => { const u = await needUser(c); return `👑 Premium Fire Pass ${u.username} → ${(c.args[1] || "on").toUpperCase()}`; }, run: async (c) => {
  const u = await needUser(c); const s = await needSeason(c.sb); const on = (c.args[1] || "on").toLowerCase() !== "off";
  await fpUpsert(c.sb, u, s, { is_premium: on, premium_activated_at: on ? new Date().toISOString() : null });
  await notify(c.sb, u.visitor_id, "🔥 Fire Pass", on ? "Fire Pass Premium diaktifkan admin." : "Fire Pass Premium dinonaktifkan admin.");
  return `✅ Premium ${u.username}: ${on ? "ON" : "OFF"}`;
} });
def(["fpreset"], { perm: "firepass", feature: "firepass", confirm: true, usage: "[user]", desc: "Reset progress season ini", preview: async (c) => { const u = await needUser(c); const s = await needSeason(c.sb); const p = await fpProgress(c.sb, u.visitor_id, s.id); return `♻️ RESET Fire Pass ${u.username}\nBadge ${p?.badges || 0} → 0, klaim tier dihapus.\nStatus premium tetap.`; }, run: async (c) => {
  const u = await needUser(c); const s = await needSeason(c.sb); await fpUpsert(c.sb, u, s, { badges: 0, claimed_free_tiers: [], claimed_premium_tiers: [] });
  await c.sb.from("fire_pass_mission_progress").delete().eq("visitor_id", u.visitor_id).gte("created_at", s.starts_at); return `✅ Fire Pass ${u.username} direset.`;
} });
def(["fpseason"], { perm: "firepass_read", feature: "firepass", usage: "[aktifkan no?]", desc: "Daftar/aktifkan season", run: async (c) => {
  if ((c.args[0] || "").toLowerCase() === "aktifkan") {
    need(can(c.actor, "firepass"), "Butuh permission firepass."); const n = num(c.args[1]);
    const { data: s } = await c.sb.from("fire_pass_seasons").select("id, name").eq("season_number", n).maybeSingle(); need(s, "Season tidak ada.");
    await c.sb.from("fire_pass_seasons").update({ is_active: false }).neq("id", s.id); await c.sb.from("fire_pass_seasons").update({ is_active: true }).eq("id", s.id);
    return `✅ Season ${s.name} diaktifkan.`;
  }
  const { data } = await c.sb.from("fire_pass_seasons").select("season_number, name, is_active, starts_at, ends_at").order("season_number", { ascending: false }).limit(20);
  return "🔥 *Season*\n" + (data || []).map((s: any) => `• S${s.season_number} ${s.name} ${s.is_active ? "🟢" : "⚪"} ${dt(s.starts_at)} → ${dt(s.ends_at)}`).join("\n") + "\n\nAktifkan: !fpseason aktifkan [no]";
} });
def(["fpmisiadmin"], { perm: "firepass_read", feature: "firepass", desc: "Daftar misi", run: async (c) => {
  const s = await needSeason(c.sb); const { data } = await c.sb.from("fire_pass_missions").select("id, code, title, mission_type, target_value, badge_reward, is_active").eq("season_id", s.id).order("sort_order");
  return pageText("🎯 *Misi Fire Pass*", (data || []).map((m: any) => `${m.code} • ${clip(m.title, 25)} • ${m.mission_type} • target ${m.target_value} • +${m.badge_reward} • ${m.is_active ? "ON" : "OFF"}`), c.page, "!fpmisiadmin");
} });
def(["fptambahmisi"], { perm: "firepass", feature: "firepass", usage: "kode | judul | daily/weekly | requirement | target | badge", desc: "Tambah misi", run: async (c) => {
  const [code, title, type, req, target, badge] = c.raw.split("|").map((x) => x.trim()); need(code && title && num(target) > 0 && num(badge) > 0, "Format: !fptambahmisi kode | judul | daily/weekly | requirement_type | target | badge");
  const s = await needSeason(c.sb); const { error } = await c.sb.from("fire_pass_missions").insert({ season_id: s.id, code, title, mission_type: type || "daily", requirement_type: req || "login", target_value: num(target), badge_reward: num(badge), is_active: true, sort_order: 999 });
  if (error) throw new UserErr("Gagal: " + error.message); return `✅ Misi ${code} ditambahkan.`;
} });
def(["fpeditmisi"], { perm: "firepass", feature: "firepass", usage: "[kode] [judul/target/badge/aktif] [nilai]", desc: "Ubah misi", run: async (c) => {
  const s = await needSeason(c.sb); const map: Record<string, string> = { judul: "title", target: "target_value", badge: "badge_reward", aktif: "is_active" }; const col = map[(c.args[1] || "").toLowerCase()]; need(col, "Field: judul/target/badge/aktif");
  const raw = c.args.slice(2).join(" "); const val = col === "title" ? raw : col === "is_active" ? /^(on|ya|true|1)$/i.test(raw) : num(raw);
  const { data } = await c.sb.from("fire_pass_missions").update({ [col]: val, updated_at: new Date().toISOString() }).eq("season_id", s.id).eq("code", c.args[0]).select("id"); need((data || []).length, "Misi tidak ditemukan."); return `✅ Misi ${c.args[0]} diperbarui.`;
} });
def(["fphapusmisi"], { perm: "firepass", feature: "firepass", confirm: true, usage: "[kode]", desc: "Nonaktifkan misi", preview: async (c) => `🗑️ Nonaktifkan misi ${c.args[0]} (progress user tetap tersimpan).`, run: async (c) => {
  const s = await needSeason(c.sb); const { data } = await c.sb.from("fire_pass_missions").update({ is_active: false }).eq("season_id", s.id).eq("code", c.args[0]).select("id"); need((data || []).length, "Misi tidak ditemukan."); return `✅ Misi ${c.args[0]} dinonaktifkan.`;
} });
def(["fptieradmin"], { perm: "firepass_read", feature: "firepass", desc: "Daftar tier", run: async (c) => {
  const s = await needSeason(c.sb); const { data } = await c.sb.from("fire_pass_tiers").select("tier_level, badge_required, free_reward_label, premium_reward_label").eq("season_id", s.id).order("tier_level");
  return pageText("🏅 *Tier Fire Pass*", (data || []).map((t: any) => `Tier ${t.tier_level} • ${t.badge_required} badge • Free: ${t.free_reward_label || "-"} • Premium: ${t.premium_reward_label || "-"}`), c.page, "!fptieradmin");
} });
def(["fptambahtier"], { perm: "firepass", feature: "firepass", usage: "level | badge | hadiah free | hadiah premium", desc: "Tambah tier", run: async (c) => {
  const [lvl, badge, fl, pl] = c.raw.split("|").map((x) => x.trim()); need(num(lvl) > 0 && num(badge) >= 0, "Format: !fptambahtier level | badge | label free | label premium");
  const s = await needSeason(c.sb); const { error } = await c.sb.from("fire_pass_tiers").insert({ season_id: s.id, tier_level: num(lvl), badge_required: num(badge), free_reward_type: "gems", free_reward_value: 0, free_reward_label: fl || null, premium_reward_type: "gems", premium_reward_value: 0, premium_reward_label: pl || null });
  if (error) throw new UserErr("Gagal: " + error.message); return `✅ Tier ${lvl} ditambahkan. Atur jenis & nilai hadiah lewat website Admin → Fire Pass.`;
} });
def(["fpedittier"], { perm: "firepass", feature: "firepass", usage: "[level] [badge/free/premium] [nilai]", desc: "Ubah tier", run: async (c) => {
  const s = await needSeason(c.sb); const map: Record<string, string> = { badge: "badge_required", free: "free_reward_label", premium: "premium_reward_label" }; const col = map[(c.args[1] || "").toLowerCase()]; need(col, "Field: badge/free/premium");
  const raw = c.args.slice(2).join(" "); const { data } = await c.sb.from("fire_pass_tiers").update({ [col]: col === "badge_required" ? num(raw) : raw, updated_at: new Date().toISOString() }).eq("season_id", s.id).eq("tier_level", num(c.args[0])).select("id");
  need((data || []).length, "Tier tidak ditemukan."); return `✅ Tier ${c.args[0]} diperbarui.`;
} });
def(["fphapustier"], { perm: "firepass", feature: "firepass", confirm: true, usage: "[level]", desc: "Hapus tier", preview: async (c) => `🗑️ HAPUS tier ${c.args[0]} season aktif.`, run: async (c) => {
  const s = await needSeason(c.sb); const { data, error } = await c.sb.from("fire_pass_tiers").delete().eq("season_id", s.id).eq("tier_level", num(c.args[0])).select("id");
  if (error) return "❌ Tier tidak bisa dihapus karena sudah dipakai data lain."; need((data || []).length, "Tier tidak ditemukan."); return `✅ Tier ${c.args[0]} dihapus.`;
} });

// ─── ANONYMOUS CHAT (tidak pernah menampilkan identitas ke user lain; admin melihat nickname,
//     username hanya untuk role dengan permission user penuh) ───
async function anonTarget(c: Ctx, i = 0) {
  const q = c.args[i]; need(q, "Target wajib (nickname anon / username).");
  const { data: prof } = await c.sb.from("anon_chat_profiles").select("visitor_id, nickname").ilike("nickname", q).limit(1).maybeSingle();
  if (prof) return { visitor_id: prof.visitor_id, label: prof.nickname };
  const u = await resolveUser(c.sb, q); need(u, "Target tidak ditemukan."); return { visitor_id: u.visitor_id, label: u.username };
}
def(["anonadmin", "anonstats", "anonmoderasi"], { perm: "anon_read", feature: "anon", desc: "Statistik Anonymous Chat", run: async (c) => {
  const [acc, online, q, s, msg, msgToday, viol, bans, blocks] = await Promise.all([count(head(c.sb, "anon_chat_accounts")), count(head(c.sb, "anon_chat_profiles").gte("last_seen_at", since(0.25))), count(head(c.sb, "anon_chat_queue")), count(head(c.sb, "anon_chat_sessions").eq("status", "active")), count(head(c.sb, "anon_chat_messages")), count(head(c.sb, "anon_chat_messages").gte("created_at", todayStart())), count(head(c.sb, "chat_violations").gte("created_at", since(24 * 7))), count(head(c.sb, "account_bans").eq("is_active", true).ilike("reason", "[anon]%")), count(head(c.sb, "anon_chat_blocked_matches"))]);
  return `👻 *ANONYMOUS CHAT*\n\n👤 Akun ${acc} • Online ${online}\n⏳ Antrian ${q}\n💬 Sesi aktif ${s}\n✉️ Pesan total ${msg} • hari ini ${msgToday}\n🚩 Pelanggaran 7 hari ${viol}\n⛔ Dibatasi (anon) ${bans} • Blokir pasangan ${blocks}\n🟢 Sistem: aktif\n\nCommand: !anononline !anonqueue !anonsession !anonreports !anonviolations !anonban !anonunban !anonwarn !anonblock !anonunblock`;
} });
def(["anononline"], { perm: "anon_read", feature: "anon", desc: "User anon online", run: async (c) => { const { data } = await c.sb.from("anon_chat_profiles").select("nickname, last_seen_at").gte("last_seen_at", since(0.25)).order("last_seen_at", { ascending: false }).limit(300); return pageText("🟢 *Anon Online*", (data || []).map((p: any) => `${p.nickname || "Anon"} • ${dt(p.last_seen_at)}`), c.page, "!anononline"); } });
def(["anonqueue"], { perm: "anon_read", feature: "anon", desc: "Antrian", run: async (c) => { const { data } = await c.sb.from("anon_chat_queue").select("nickname, my_gender, pref_gender, interest, created_at").order("created_at").limit(300); return pageText("⏳ *Antrian Anon*", (data || []).map((q: any) => `${q.nickname || "Anon"} • ${q.my_gender || "-"}→${q.pref_gender || "-"} • ${q.interest || "-"} • ${dt(q.created_at)}`), c.page, "!anonqueue"); } });
def(["anonsession"], { perm: "anon_read", feature: "anon", usage: "[id?]", desc: "Sesi aktif / detail", run: async (c) => {
  if (c.args[0] && c.args[0] !== "hal") {
    const { data: all } = await c.sb.from("anon_chat_sessions").select("*").order("created_at", { ascending: false }).limit(500);
    const s = (all || []).find((x: any) => x.id.startsWith(c.args[0].toLowerCase())); need(s, "Sesi tidak ditemukan.");
    const n = await count(head(c.sb, "anon_chat_messages").eq("session_id", s.id));
    return `💬 Sesi ${s.id.slice(0, 8)}\n${s.nickname_a || "Anon"} ↔ ${s.nickname_b || "Anon"}\nStatus ${s.status} • minat ${s.interest || "-"}\nPesan: ${n}\nMulai ${dt(s.created_at)}${s.ended_at ? " • selesai " + dt(s.ended_at) : ""}\n(Isi pesan tidak ditampilkan demi privasi.)`;
  }
  const { data } = await c.sb.from("anon_chat_sessions").select("id, nickname_a, nickname_b, created_at").eq("status", "active").order("created_at", { ascending: false }).limit(300);
  return pageText("💬 *Sesi Aktif*", (data || []).map((s: any) => `${s.id.slice(0, 8)} • ${s.nickname_a || "Anon"} ↔ ${s.nickname_b || "Anon"} • ${dt(s.created_at)}`), c.page, "!anonsession");
} });
def(["anonreports", "anonviolations", "anonreport"], { perm: "anon_read", feature: "anon", desc: "Laporan & pelanggaran", run: async (c) => {
  const { data } = await c.sb.from("chat_violations").select("visitor_id, kind, detail, created_at").order("created_at", { ascending: false }).limit(300);
  const ids = [...new Set((data || []).map((v: any) => v.visitor_id))];
  const { data: profs } = ids.length ? await c.sb.from("anon_chat_profiles").select("visitor_id, nickname").in("visitor_id", ids) : { data: [] };
  const nick: Record<string, string> = Object.fromEntries((profs || []).map((p: any) => [p.visitor_id, p.nickname]));
  return pageText("🚩 *Pelanggaran / Laporan Chat*", (data || []).map((v: any) => `${nick[v.visitor_id] || "Anon"} • ${v.kind} • ${clip(v.detail, 40)} • ${dt(v.created_at)}`), c.page, "!anonreports");
} });
def(["anonban"], { perm: "anon", feature: "anon", confirm: true, usage: "[nickname/user] [jam] [alasan]", desc: "Batasi akun", preview: async (c) => { const t = await anonTarget(c); return `⛔ Batasi ${t.label} ${c.args[1] || "24"} jam\nAlasan: ${c.args.slice(2).join(" ") || "-"}`; }, run: async (c) => {
  const t = await anonTarget(c); const h = num(c.args[1]) > 0 ? num(c.args[1]) : 24;
  await c.sb.from("account_bans").insert({ visitor_id: t.visitor_id, reason: "[anon] " + (c.args.slice(2).join(" ") || "Pelanggaran Anonymous Chat"), is_permanent: false, banned_until: new Date(Date.now() + h * 3600e3).toISOString(), is_active: true, banned_by: "wa:" + c.actor.role });
  await c.sb.from("anon_chat_queue").delete().eq("visitor_id", t.visitor_id);
  await notify(c.sb, t.visitor_id, "Akun dibatasi", `Akun dibatasi ${h} jam karena pelanggaran.`, "warning"); return `✅ ${t.label} dibatasi ${h} jam.`;
} });
def(["anonunban"], { perm: "anon", feature: "anon", usage: "[nickname/user]", desc: "Cabut batasan", run: async (c) => { const t = await anonTarget(c); const { data } = await c.sb.from("account_bans").update({ is_active: false, unbanned_at: new Date().toISOString(), unban_reason: "Unban via WA" }).eq("visitor_id", t.visitor_id).eq("is_active", true).ilike("reason", "[anon]%").select("id"); return (data || []).length ? `✅ Batasan ${t.label} dicabut.` : "ℹ️ Tidak ada batasan anon aktif."; } });
def(["anonwarn"], { perm: "anon", feature: "anon", usage: "[nickname/user] [alasan]", desc: "Peringatan", run: async (c) => { const t = await anonTarget(c); await notify(c.sb, t.visitor_id, "⚠️ Peringatan Anonymous Chat", c.args.slice(1).join(" ") || "Harap jaga sikap di Anonymous Chat.", "warning"); await c.sb.from("chat_violations").insert({ visitor_id: t.visitor_id, kind: "admin_warn", detail: c.args.slice(1).join(" ") || "warn" }); return `⚠️ Peringatan dikirim ke ${t.label}.`; } });
def(["anonblock"], { perm: "anon", feature: "anon", usage: "[nick A] [nick B]", desc: "Cegah 2 user dipasangkan", run: async (c) => { const a = await anonTarget(c, 0); const b = await anonTarget(c, 1); await c.sb.from("anon_chat_blocked_matches").insert([{ visitor_id: a.visitor_id, blocked_visitor: b.visitor_id }, { visitor_id: b.visitor_id, blocked_visitor: a.visitor_id }]); return `✅ ${a.label} dan ${b.label} tidak akan dipasangkan lagi.`; } });
def(["anonunblock"], { perm: "anon", feature: "anon", usage: "[nick A] [nick B]", desc: "Buka blokir pasangan", run: async (c) => { const a = await anonTarget(c, 0); const b = await anonTarget(c, 1); await c.sb.from("anon_chat_blocked_matches").delete().or(`and(visitor_id.eq.${a.visitor_id},blocked_visitor.eq.${b.visitor_id}),and(visitor_id.eq.${b.visitor_id},blocked_visitor.eq.${a.visitor_id})`); return `✅ Blokir ${a.label} ↔ ${b.label} dibuka.`; } });

// ─── STORE AI (API key provider TIDAK PERNAH ditampilkan) ───
def(["aadmin", "aistats", "aiusage", "aiusers"], { perm: "ai_read", feature: "ai", desc: "Statistik Store AI", run: async (c) => {
  const { data: fb } = await c.sb.from("ai_message_feedback").select("visitor_id, conversation_id, feedback, created_at").gte("created_at", since(24 * 30)).limit(5000);
  const users = new Set((fb || []).map((f: any) => f.visitor_id)); const convs = new Set((fb || []).map((f: any) => f.conversation_id));
  const up = (fb || []).filter((f: any) => f.feedback === "up").length; const down = (fb || []).filter((f: any) => f.feedback === "down").length;
  const { data: prov } = await c.sb.from("ai_providers").select("label, provider_type, model, is_selected, is_active, auto_fallback, base_url").order("is_selected", { ascending: false });
  const sel = (prov || []).find((p: any) => p.is_selected && p.is_active);
  return `🤖 *STORE AI* (30 hari, dari feedback tersimpan)\n\n👥 Pengguna memberi feedback: ${users.size}\n💬 Percakapan: ${convs.size}\n👍 ${up} • 👎 ${down}\n\n⚙️ Provider aktif: ${sel ? `${sel.label} (${sel.provider_type})` : "Lovable AI (default)"}\n🧠 Model: ${sel?.model || "google/gemini-2.5-flash"}\n🌐 API Base: ${sel?.base_url ? "terkonfigurasi" : "default"}\n🔁 Auto fallback: ${sel ? (sel.auto_fallback ? "ON" : "OFF") : "-"}\n\nℹ️ Jumlah request & error AI belum dicatat backend (hanya feedback). Cek !aitest untuk status langsung.`;
} });
def(["aierrors"], { perm: "ai_read", feature: "ai", desc: "Error AI", run: async (c) => { const { data } = await c.sb.from("ai_message_feedback").select("reason, created_at").eq("feedback", "down").order("created_at", { ascending: false }).limit(100); return pageText("⚠️ *Keluhan AI (👎)*\nLog error teknis belum dicatat backend.", (data || []).map((f: any) => `${clip(f.reason || "(tanpa alasan)", 50)} • ${dt(f.created_at)}`), c.page, "!aierrors"); } });
def(["aichatlog"], { perm: "ai_read", feature: "ai", desc: "Log feedback AI", run: async (c) => { const { data } = await c.sb.from("ai_message_feedback").select("conversation_id, feedback, reason, created_at").order("created_at", { ascending: false }).limit(200); return pageText("📜 *Log Feedback Store AI*\nIsi percakapan tidak disimpan di server (privasi).", (data || []).map((f: any) => `${String(f.conversation_id).slice(0, 8)} • ${f.feedback} • ${clip(f.reason || "-", 30)} • ${dt(f.created_at)}`), c.page, "!aichatlog"); } });
def(["aimodel", "aiconfig"], { perm: "ai_read", feature: "ai", desc: "Provider & model", run: async (c) => { const { data } = await c.sb.from("ai_providers").select("label, provider_type, model, models, is_selected, is_active, auto_fallback, api_key").order("created_at"); return "🧠 *Provider AI*\n\n" + ((data || []).map((p: any) => `${p.is_selected ? "✅" : "▫️"} ${p.label} (${p.provider_type}) • ${p.model} • ${p.is_active ? "aktif" : "off"} • fallback ${p.auto_fallback ? "ON" : "OFF"} • key ${p.api_key ? "tersimpan 🔒" : "-"}`).join("\n") || "Belum ada provider custom — memakai Lovable AI default.") + "\n\nPilih model: !aimodel pilih [label]"; } });
A["aimodel"] = { ...A["aimodel"], usage: "[pilih label?]", run: async (c) => {
  if ((c.args[0] || "").toLowerCase() === "pilih") {
    need(can(c.actor, "*"), "Hanya SUPER ADMIN yang bisa mengganti provider."); const label = c.args.slice(1).join(" ");
    const { data: p } = await c.sb.from("ai_providers").select("id").ilike("label", label).maybeSingle(); need(p, "Provider tidak ada.");
    await c.sb.from("ai_providers").update({ is_selected: false }).neq("id", p.id); await c.sb.from("ai_providers").update({ is_selected: true, is_active: true }).eq("id", p.id); return `✅ Provider "${label}" dipilih.`;
  }
  return A["aiconfig"].run(c);
} };
def(["aitest"], { perm: "ai_read", feature: "ai", heavy: true, desc: "Tes AI langsung", run: async (c) => {
  const t = Date.now();
  const { resp, provider, usedFallback } = await aiChatCompletion(c.sb, { messages: [{ role: "user", content: "Balas satu kata: OK" }], max_tokens: 10 });
  const ok = resp.ok; const j = ok ? await resp.json().catch(() => null) : null;
  return `${ok ? "✅" : "❌"} AI ${ok ? "merespons" : "gagal (HTTP " + resp.status + ")"}\nProvider: ${provider.label || provider.provider_type}${usedFallback ? " (fallback)" : ""}\nModel: ${provider.model}\nLatensi: ${Date.now() - t} ms${j ? "\nBalasan: " + clip(j?.choices?.[0]?.message?.content, 40) : ""}`;
} });
def(["aireload"], { perm: "ai_read", feature: "ai", desc: "Muat ulang config AI", run: async () => "✅ Konfigurasi AI dibaca ulang setiap permintaan dari database — perubahan provider langsung berlaku tanpa restart." });

// ─── BOT GALAU (sesi peer galau di server; riwayat AI curhat tersimpan di perangkat user) ───
def(["galauadmin", "galaustats", "galausage"], { perm: "galau_read", feature: "galau", desc: "Statistik Bot Galau", run: async (c) => {
  const [p, on, q, act, tot, msg, today] = await Promise.all([count(head(c.sb, "galau_profiles")), count(head(c.sb, "galau_profiles").gte("last_seen_at", since(0.25))), count(head(c.sb, "galau_queue")), count(head(c.sb, "galau_sessions").eq("status", "active")), count(head(c.sb, "galau_sessions")), count(head(c.sb, "galau_messages")), count(head(c.sb, "galau_messages").gte("created_at", todayStart()))]);
  return `💙 *BOT GALAU*\n\n👥 Profil ${p} • online ${on}\n⏳ Antrian ${q}\n💬 Sesi aktif ${act} / total ${tot}\n✉️ Pesan ${msg} • hari ini ${today}\n\nℹ️ Riwayat curhat AI disimpan di perangkat user (tidak dikirim ke server), jadi tidak bisa dibaca admin.`;
} });
def(["galauusers"], { perm: "galau_read", feature: "galau", desc: "Pengguna Bot Galau", run: async (c) => { const { data } = await c.sb.from("galau_profiles").select("nickname, total_sessions, last_seen_at").order("last_seen_at", { ascending: false }).limit(300); return pageText("💙 *Pengguna Galau*", (data || []).map((p: any) => `${p.nickname || "Anon"} • ${p.total_sessions || 0} sesi • ${dt(p.last_seen_at)}`), c.page, "!galauusers"); } });
def(["galausessions"], { perm: "galau_read", feature: "galau", desc: "Sesi galau", run: async (c) => { const { data } = await c.sb.from("galau_sessions").select("id, nickname_a, nickname_b, mood_a, mood_b, status, created_at").order("created_at", { ascending: false }).limit(300); return pageText("💬 *Sesi Galau*", (data || []).map((s: any) => `${s.id.slice(0, 8)} • ${s.nickname_a || "Anon"}(${s.mood_a || "-"}) ↔ ${s.nickname_b || "Anon"}(${s.mood_b || "-"}) • ${s.status}`), c.page, "!galausessions"); } });
def(["galauerrors"], { perm: "galau_read", feature: "galau", desc: "Error Bot Galau", run: async () => "ℹ️ Backend Bot Galau belum mencatat log error ke database. Gunakan !aitest untuk mengecek AI yang juga dipakai Bot Galau." });
def(["galauconfig"], { perm: "galau_read", feature: "galau", desc: "Konfigurasi", run: async (c) => { const cfg = await loadConfig(c.sb); return `💙 Bot Galau via WA: ${cfg.features.galau ? "ON" : "OFF"}\nAI memakai provider Store AI yang sama (lihat !aimodel).\nUbah ON/OFF: website Admin → Bot WA.`; } });
def(["galaureset"], { perm: "galau", feature: "galau", confirm: true, desc: "Bersihkan antrian & sesi macet", preview: async (c) => { const q = await count(head(c.sb, "galau_queue").lt("joined_at", since(1))); const s = await count(head(c.sb, "galau_sessions").eq("status", "active").lt("created_at", since(24))); return `♻️ Bersihkan ${q} antrian >1 jam dan akhiri ${s} sesi aktif >24 jam.`; }, run: async (c) => {
  const { data: q } = await c.sb.from("galau_queue").delete().lt("joined_at", since(1)).select("visitor_id"); const { data: s } = await c.sb.from("galau_sessions").update({ status: "ended", ended_by: "admin", ended_at: new Date().toISOString() }).eq("status", "active").lt("created_at", since(24)).select("id");
  return `✅ ${(q || []).length} antrian dihapus, ${(s || []).length} sesi diakhiri.`;
} });

// ─── CONFESS (identitas pengirim tidak dibuka; hanya nomor tersamar) ───
async function wallByRef(sb: any, ref: string) {
  need(ref, "ID confess wajib (8 karakter pertama)."); const { data } = await sb.from("confess_public_wall").select("*").order("created_at", { ascending: false }).limit(2000);
  const w = (data || []).find((x: any) => x.id.startsWith(ref.toLowerCase())); need(w, "Confess tidak ditemukan."); return w;
}
def(["confessadmin", "confessstats"], { perm: "confess_read", feature: "confess", desc: "Statistik Confess", run: async (c) => {
  const [tot, today, hidden, rep, pinned, conf] = await Promise.all([count(head(c.sb, "confess_public_wall")), count(head(c.sb, "confess_public_wall").gte("created_at", todayStart())), count(head(c.sb, "confess_public_wall").eq("is_hidden", true)), count(head(c.sb, "confess_reports").eq("status", "pending")), count(head(c.sb, "confess_public_wall").eq("is_pinned", true)), count(head(c.sb, "confessions").gte("created_at", todayStart()))]);
  return `💌 *CONFESS*\n\n📝 Wall total ${tot} • baru hari ini ${today}\n🙈 Disembunyikan ${hidden} • 📌 Dipin ${pinned}\n🚩 Laporan pending ${rep}\n📨 Confess WA terkirim hari ini ${conf}\n\nCommand: !confesslist !confessreports !confessdetail [id]`;
} });
def(["confesslist"], { perm: "confess_read", feature: "confess", usage: "[hidden?]", desc: "Daftar confess", run: async (c) => {
  let q = c.sb.from("confess_public_wall").select("id, message, mood_tag, is_hidden, is_pinned, report_count, created_at").order("created_at", { ascending: false }).limit(300);
  if (c.args[0] === "hidden") q = q.eq("is_hidden", true);
  const { data } = await q;
  return pageText("💌 *Confess Wall*", (data || []).map((w: any) => `${w.id.slice(0, 8)} ${w.is_pinned ? "📌" : ""}${w.is_hidden ? "🙈" : ""} ${clip(w.message, 45)} • 🚩${w.report_count || 0}`), c.page, "!confesslist " + (c.args[0] || ""));
} });
def(["confessdetail"], { perm: "confess_read", feature: "confess", usage: "[id]", desc: "Detail confess", run: async (c) => { const w = await wallByRef(c.sb, c.args[0]); return `💌 *${w.id.slice(0, 8)}*\nPengirim: ${w.is_mystery ? "🕵️ Mystery" : w.sender_name || "Anonim"} • ${w.masked_phone || "-"}\nMood: ${w.mood_tag || "-"}\nStatus: ${w.is_hidden ? "disembunyikan" : "tampil"}${w.is_pinned ? " • dipin" : ""}\n❤️ ${w.total_reactions || 0} • 💬 ${w.reply_count || 0} • 👁️ ${w.view_count || 0} • 🚩 ${w.report_count || 0}\n${dt(w.created_at)}\n\n${clip(w.message, 900)}\n\n(Identitas asli tidak ditampilkan.)`; } });
const wallSet = (patch: Record<string, unknown>, label: string, reportStatus?: string) => async (c: Ctx) => {
  const w = await wallByRef(c.sb, c.args[0]); await c.sb.from("confess_public_wall").update(patch).eq("id", w.id);
  if (reportStatus) await c.sb.from("confess_reports").update({ status: reportStatus }).eq("target_id", w.id).eq("status", "pending");
  return `✅ Confess ${w.id.slice(0, 8)} ${label}.`;
};
def(["confessapprove"], { perm: "confess", feature: "confess", usage: "[id]", desc: "Setujui (tampilkan, tutup laporan)", run: wallSet({ is_hidden: false }, "disetujui", "dismissed") });
def(["confessreject"], { perm: "confess", feature: "confess", usage: "[id]", desc: "Tolak (sembunyikan, laporan diterima)", run: wallSet({ is_hidden: true }, "ditolak & disembunyikan", "actioned") });
def(["confesshide"], { perm: "confess", feature: "confess", usage: "[id]", desc: "Sembunyikan", run: wallSet({ is_hidden: true }, "disembunyikan") });
def(["confessrestore"], { perm: "confess", feature: "confess", usage: "[id]", desc: "Tampilkan lagi", run: wallSet({ is_hidden: false }, "ditampilkan lagi") });
def(["confesspin"], { perm: "confess", feature: "confess", usage: "[id]", desc: "Pin", run: wallSet({ is_pinned: true }, "dipin") });
def(["confessunpin"], { perm: "confess", feature: "confess", usage: "[id]", desc: "Lepas pin", run: wallSet({ is_pinned: false }, "dilepas pin") });
def(["confessdelete"], { perm: "confess", feature: "confess", confirm: true, usage: "[id]", desc: "Hapus permanen", preview: async (c) => { const w = await wallByRef(c.sb, c.args[0]); return `🗑️ HAPUS PERMANEN confess ${w.id.slice(0, 8)}:\n"${clip(w.message, 80)}"`; }, run: async (c) => {
  const w = await wallByRef(c.sb, c.args[0]); const { error } = await c.sb.from("confess_public_wall").delete().eq("id", w.id);
  if (error) { await c.sb.from("confess_public_wall").update({ is_hidden: true }).eq("id", w.id); return "⚠️ Tidak bisa dihapus (masih terhubung data lain) — confess disembunyikan permanen."; }
  return `✅ Confess ${w.id.slice(0, 8)} dihapus.`;
} });
def(["confessreports", "confessreport"], { perm: "confess_read", feature: "confess", desc: "Laporan confess", run: async (c) => { const { data } = await c.sb.from("confess_reports").select("target_type, target_id, reason, status, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(300); return pageText("🚩 *Laporan Confess*", (data || []).map((r: any) => `${r.target_type} ${String(r.target_id).slice(0, 8)} • ${clip(r.reason, 35)} • ${dt(r.created_at)}`), c.page, "!confessreports"); } });

// ─── TICKET (tabel support_tickets yang sama dengan website) ───
async function ticketByRef(sb: any, ref: string) { need(ref, "Nomor tiket wajib."); const r = ref.replace(/^#/, ""); const { data } = await sb.from("support_tickets").select("*").or(/^\d+$/.test(r) ? `ticket_number.eq.${r}` : `id.eq.${r}`).maybeSingle(); need(data, "Tiket tidak ditemukan."); return data; }
def(["balastiket"], { perm: "ticket", usage: "[no] [pesan]", desc: "Balas tiket (admin)", run: async (c) => {
  const t = await ticketByRef(c.sb, c.args[0]); const m = c.args.slice(1).join(" ").trim(); need(m, "Format: !balastiket [no] [pesan]");
  await c.sb.from("ticket_messages").insert({ ticket_id: t.id, sender_type: "admin", message: m }); await c.sb.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", t.id);
  return `✅ Balasan terkirim ke tiket #${t.ticket_number}.`;
} });
const ticketStatus = (status: string) => async (c: Ctx) => { const t = await ticketByRef(c.sb, c.args[0]); await c.sb.from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", t.id); return `✅ Tiket #${t.ticket_number} → ${status}`; };
def(["tiketclose"], { perm: "ticket", usage: "[no]", desc: "Tutup tiket", run: ticketStatus("closed") });
def(["tiketopen"], { perm: "ticket", usage: "[no]", desc: "Buka lagi tiket", run: ticketStatus("open") });
def(["tiketassign"], { perm: "ticket", usage: "[no] [nama admin]", desc: "Tugaskan tiket", run: async (c) => { const t = await ticketByRef(c.sb, c.args[0]); const who = c.args.slice(1).join(" ") || c.actor.label || c.actor.role; await c.sb.from("support_tickets").update({ assigned_to: who, status: t.status === "open" ? "pending" : t.status, updated_at: new Date().toISOString() }).eq("id", t.id); return `✅ Tiket #${t.ticket_number} ditugaskan ke ${who}.`; } });
def(["tiketstats"], { perm: "ticket", desc: "Statistik tiket", run: async (c) => { const [o, p, cl, today] = await Promise.all([count(head(c.sb, "support_tickets").eq("status", "open")), count(head(c.sb, "support_tickets").eq("status", "pending")), count(head(c.sb, "support_tickets").eq("status", "closed")), count(head(c.sb, "support_tickets").gte("created_at", todayStart()))]); return `🎫 *Statistik Tiket*\nOpen ${o} • Pending ${p} • Closed ${cl}\nBaru hari ini ${today}`; } });

// ─── NOTIFICATION (tabel notifications + konfigurasi WA notif yang sudah ada) ───
def(["notifuser"], { perm: "notify_user", feature: "notif", usage: "[user] [pesan]", desc: "Kirim notif ke user", run: async (c) => { const u = await needUser(c); const m = c.args.slice(1).join(" "); need(m, "Pesan wajib."); await notify(c.sb, u.visitor_id, "Pesan Admin", m); return `✅ Notif terkirim ke ${u.username}.`; } });
const notifList = (type: string | null, title: string) => async (c: Ctx) => { let q = c.sb.from("notifications").select("title, message, type, created_at").order("created_at", { ascending: false }).limit(200); if (type) q = q.ilike("title", `%${type}%`); const { data } = await q; return pageText(title, (data || []).map((n: any) => `${clip(n.title, 25)} • ${clip(n.message, 35)} • ${dt(n.created_at)}`), c.page, "!notifstatus"); };
def(["notiftrx"], { perm: "notify", feature: "notif", desc: "Notif transaksi terbaru", run: notifList("pembelian", "🔔 *Notif Transaksi*") });
def(["notifdeposit"], { perm: "notify", feature: "notif", desc: "Notif deposit", run: notifList("deposit", "🔔 *Notif Deposit*") });
def(["notifpesanan"], { perm: "notify", feature: "notif", desc: "Notif pesanan", run: notifList("pesanan", "🔔 *Notif Pesanan*") });
def(["notiffirepass"], { perm: "notify", feature: "notif", desc: "Notif Fire Pass", run: notifList("fire pass", "🔔 *Notif Fire Pass*") });
def(["notifstatus"], { perm: "notify", feature: "notif", desc: "Status sistem notif WA", run: async (c) => {
  const [cfg, today, wa] = await Promise.all([c.sb.from("wa_notification_configs").select("event_type, enabled"), count(head(c.sb, "notifications").gte("created_at", todayStart())), c.sb.from("wa_outbox").select("status").gte("created_at", since(24)).limit(2000)]);
  const st: Record<string, number> = {}; (wa.data || []).forEach((r: any) => { st[r.status] = (st[r.status] || 0) + 1; });
  return "🔔 *Status Notifikasi*\n\nEvent WA:\n" + ((cfg.data || []).map((e: any) => `• ${e.event_type}: ${e.enabled ? "ON" : "OFF"}`).join("\n") || "-") + `\n\nNotif web hari ini: ${today}\nAntrian WA 24j: ${Object.entries(st).map(([k, v]) => k + " " + v).join(", ") || "-"}`;
} });
def(["notiftest"], { perm: "notify", feature: "notif", desc: "Tes notif ke akun Anda", run: async (c) => {
  const u = await resolveUser(c.sb, c.actor.phone);
  if (u) await notify(c.sb, u.visitor_id, "🔔 Tes notifikasi admin", "Jika ini muncul di website, jalur notifikasi berfungsi.");
  return `✅ Jalur WA bot → admin berfungsi (pesan ini).\n${u ? `✅ Notif web dikirim ke akun ${u.username}.` : "ℹ️ Nomor admin ini tidak terhubung ke akun website, notif web tidak dikirim."}`;
} });
def(["notifbroadcast"], { perm: "broadcast", feature: "broadcast", usage: "(alias !broadcast)", desc: "Broadcast notif", run: async (c) => A["broadcast"].run(c) });

// ─── BROADCAST (preview → konfirmasi → kirim bertahap) ───
def(["broadcast", "confessbroadcast"], { perm: "broadcast", feature: "broadcast", confirm: true, heavy: true, usage: "[target] | judul | isi", desc: "Broadcast dengan preview", preview: async (c) => {
  const { targetArgs, title, message } = splitBroadcast(c); need(title && message, "Format: !broadcast [target] | judul | isi\nTarget: semua, useraktif, user [nama], saldo [min], pembeli, kategori [nama], status [banned/normal], firepass, fppremium, role [role]");
  const recent = await count(head(c.sb, "wa_admin_audit_log").eq("action", "broadcast").eq("result", "ok").gte("created_at", since(0.5)));
  need(can(c.actor, "*") || recent < 3, "Batas broadcast: maks 3 per 30 menit.");
  const t = await broadcastTargets(c.sb, targetArgs); const wa = t.rows.filter((r: any) => digits(r.phone).length >= 9).length;
  return `📢 *PREVIEW BROADCAST*\nTarget: ${t.label}\nPenerima: ${t.rows.length} (WA: ${Math.min(wa, 200)}${wa > 200 ? ", dibatasi 200" : ""})\n\n*${title}*\n${clip(message, 500)}\n\nPesan WA dikirim bertahap (±3 detik/pesan) agar aman dari spam.`;
}, run: async (c) => {
  const { targetArgs, title, message } = splitBroadcast(c); const t = await broadcastTargets(c.sb, targetArgs);
  const vids = t.rows.map((r: any) => r.visitor_id).filter(Boolean);
  for (let i = 0; i < vids.length; i += 500) await c.sb.from("notifications").insert(vids.slice(i, i + 500).map((v: string) => ({ visitor_id: v, title, message, type: "info" })));
  const phones = [...new Set(t.rows.map((r: any) => canonPhone(r.phone || "")).filter((p: string) => p.length >= 10))].slice(0, 200) as string[];
  return { text: `✅ Broadcast "${title}" → ${vids.length} notif web. Mengirim WA ke ${phones.length} nomor secara bertahap...`, recipients: phones, broadcastText: `📢 *${title}*\n\n${message}` } as any;
} });

// ─── SEARCH / EXPORT ───
def(["searchadmin"], { perm: "search", usage: "[kata]", desc: "Cari universal", run: async (c) => {
  const q = c.args.join(" ").replace(/[,()%]/g, "").trim(); need(q.length >= 2, "Minimal 2 huruf."); const out: string[] = [`🔎 *Hasil "${q}"*`];
  if (can(c.actor, "user_basic")) { const { data } = await c.sb.from("user_balances").select("username").ilike("username", `%${q}%`).limit(5); if ((data || []).length) out.push("\n👤 User: " + data.map((u: any) => u.username).join(", ")); }
  if (can(c.actor, "order_read")) { const { data } = await c.sb.from("balance_transactions").select("trx_id, amount").ilike("trx_id", `%${q}%`).limit(5); if ((data || []).length) out.push("🧾 Trx: " + data.map((t: any) => `${t.trx_id} ${rp(t.amount)}`).join(", ")); }
  if (can(c.actor, "store")) { const { data } = await c.sb.from("products").select("title, id").ilike("title", `%${q}%`).limit(5); if ((data || []).length) out.push("🛒 Produk: " + data.map((p: any) => `${p.title} (${p.id.slice(0, 8)})`).join(", ")); }
  if (can(c.actor, "ticket")) { const { data } = await c.sb.from("support_tickets").select("ticket_number, name").or(`name.ilike.%${q}%,description.ilike.%${q}%`).limit(5); if ((data || []).length) out.push("🎫 Tiket: " + data.map((t: any) => `#${t.ticket_number} ${t.name}`).join(", ")); }
  if (can(c.actor, "confess_read")) { const { data } = await c.sb.from("confess_public_wall").select("id, message").ilike("message", `%${q}%`).limit(5); if ((data || []).length) out.push("💌 Confess: " + data.map((w: any) => `${w.id.slice(0, 8)} "${clip(w.message, 25)}"`).join(", ")); }
  if (can(c.actor, "firepass_read")) { const { data } = await c.sb.from("fire_pass_missions").select("code, title").or(`code.ilike.%${q}%,title.ilike.%${q}%`).limit(5); if ((data || []).length) out.push("🔥 Misi FP: " + data.map((m: any) => m.code).join(", ")); }
  if (can(c.actor, "order_read")) { const { data } = await c.sb.from("seller_reports").select("report_number, reason").ilike("reason", `%${q}%`).limit(5); if ((data || []).length) out.push("🚩 Laporan: " + data.map((r: any) => `${r.report_number} ${clip(r.reason, 20)}`).join(", ")); }
  return out.length > 1 ? out.join("\n") : `🔎 Tidak ada hasil untuk "${q}".`;
} });
function csv(rows: any[], cols: string[]) { const esc = (v: any) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return [cols.join(","), ...rows.map((r) => cols.map((k) => esc(r[k])).join(","))].join("\n"); }
const exporter = (table: string, cols: string, perm: string, name: string, order = "created_at") => ({ perm, heavy: true, desc: "Export CSV (maks 2000 baris)", run: async (c: Ctx) => {
  const { data, error } = await c.sb.from(table).select(cols).order(order, { ascending: false }).limit(2000); if (error) throw error;
  return { text: `📤 Export ${name}: ${(data || []).length} baris (file CSV dikirim).`, file: { name: `${name}-${new Date().toISOString().slice(0, 10)}.csv`, content: csv(data || [], cols.split(",").map((s) => s.trim())) } } as any;
} });
def(["exportuser"], exporter("user_balances", "username, balance, bonus_balance, created_at, last_seen_at", "export", "users"));
def(["exporttrx"], exporter("balance_transactions", "trx_id, type, amount, description, created_at", "export", "transaksi"));
def(["exportdeposit"], exporter("deposits", "trx_id, username, amount, payment_method, status, created_at", "finance_read", "deposit"));
def(["exportticket"], exporter("support_tickets", "ticket_number, name, category, status, assigned_to, created_at", "ticket", "tiket"));
def(["exportactivity"], exporter("wa_admin_audit_log", "created_at, actor_role, action, target, result", "export", "audit"));
def(["exportfirepass"], exporter("fire_pass_progress", "visitor_id, badges, is_premium, created_at", "firepass_read", "firepass"));

// ─── SECURITY ───
def(["auditlog"], { perm: "*", desc: "Audit log admin", run: async (c) => { const { data } = await c.sb.from("wa_admin_audit_log").select("actor_phone, actor_role, action, target, result, created_at").order("created_at", { ascending: false }).limit(300); return pageText("🛡️ *Audit Log*", (data || []).map((l: any) => `${dt(l.created_at)} • ${maskPhone(l.actor_phone)}(${l.actor_role}) • ${l.action} • ${clip(l.target || "-", 12)} • ${l.result}`), c.page, "!auditlog"); } });
def(["adminlist"], { perm: "*", desc: "Daftar admin WA", run: async (c) => { const { data } = await c.sb.from("wa_bot_admins").select("phone, label, role, is_active").order("created_at"); return "🛡️ *Admin WA*\n" + (data || []).map((a: any) => `• ${maskPhone(a.phone)} ${a.label || ""} — ${a.role} ${a.is_active ? "" : "(nonaktif)"}`).join("\n") + "\n\nKelola di website: Admin → Bot WA."; } });

// ─── BOT SYSTEM ───
async function healthText(sb: any) {
  const { data: h } = await sb.from("wa_bot_health").select("*").eq("id", "main").maybeSingle(); const cfg = await loadConfig(sb);
  if (!h) return "⚠️ Bot belum mengirim heartbeat.";
  const age = Math.round((Date.now() - new Date(h.updated_at).getTime()) / 1000);
  const up = h.started_at ? Math.floor((Date.now() - new Date(h.started_at).getTime()) / 60000) : 0;
  return `🤖 *BOT STATUS*\nWhatsApp: ${h.status || "-"} (heartbeat ${age}s lalu)\nVersi: ${h.version || "-"}\nUptime: ${Math.floor(up / 60)} jam ${up % 60} menit\nReconnect: ${h.reconnect_count}\nMemori: ${h.memory_mb ?? "-"} MB • CPU load: ${h.cpu_load ?? "-"}\nError command: ${h.command_errors} • Error pesan: ${h.message_errors}\nDatabase/Backend: ✅\nMaintenance: ${cfg.maintenance ? "ON" : "OFF"} • Bot: ${cfg.bot_enabled ? "ON" : "OFF"}`;
}
def(["botstatus"], { perm: "stats_basic", desc: "Status bot & layanan", run: async (c) => `${await healthText(c.sb)}\n\n*Layanan:*\n${await serviceStatus(c.sb)}` });
def(["botuptime", "botversion"], { perm: "stats_basic", desc: "Kesehatan bot", run: async (c) => healthText(c.sb) });
def(["botstats"], { perm: "stats_basic", desc: "Statistik bot 24 jam", run: async (c) => waUserStats(c.sb) });
def(["boterrors"], { perm: "stats_basic", desc: "Error terakhir", run: async (c) => { const { data: h } = await c.sb.from("wa_bot_health").select("last_error, command_errors, message_errors").eq("id", "main").maybeSingle(); const { data } = await c.sb.from("wa_admin_audit_log").select("action, result, created_at").like("result", "error%").order("created_at", { ascending: false }).limit(10); return `⚠️ *Error Bot*\nCommand error: ${h?.command_errors ?? 0} • Pesan error: ${h?.message_errors ?? 0}\nTerakhir: ${sanitize(h?.last_error || "-")}\n\nCommand user gagal:\n${await waUserErrors(c.sb)}\n\nAdmin command gagal:\n${(data || []).map((l: any) => `• ${l.action} ${dt(l.created_at)}`).join("\n") || "-"}`; } });
def(["botrestart"], { perm: "*", confirm: true, desc: "Restart bot", preview: async () => "🔄 RESTART bot sekarang? Bot akan tersambung ulang dalam beberapa detik (butuh process manager / panel yang auto-restart).", run: async () => ({ text: "🔄 Bot direstart...", control: "restart" }) });
def(["botreload"], { perm: "*", desc: "Muat ulang konfigurasi", run: async () => ({ text: "✅ Konfigurasi & cache admin dimuat ulang.", control: "reload" }) });
def(["maintenance", "botmaintenance"], { perm: "*", usage: "[on/off]", desc: "Mode maintenance", run: async (c) => { const v = (c.args[0] || "").toLowerCase(); need(v === "on" || v === "off", "Format: !maintenance on / off"); await setSetting(c.sb, "wa_maintenance", v === "on" ? "true" : "false"); return { text: v === "on" ? "🔧 Maintenance ON — user biasa menerima pesan maintenance, admin tetap bisa akses." : "✅ Maintenance OFF.", control: "reload" }; } });

// ─── ADMIN AI (hanya membaca data sesuai permission; perubahan → konfirmasi) ───
def(["adminai"], { perm: "stats_basic", heavy: true, usage: "[pertanyaan]", desc: "Tanya AI tentang data", run: async (c) => {
  const q = c.args.join(" ").trim(); need(q.length >= 3, "Format: !adminai [pertanyaan]");
  // Deteksi permintaan perubahan saldo → arahkan ke alur konfirmasi resmi.
  const m = q.match(/(tambah|kurang)\w*\s+saldo.*?(\+?\d[\d\s-]{7,}|[a-z0-9_.]{3,})\D+?(\d[\d.]{2,})/i);
  if (m) { const op = /kurang/i.test(m[1]) ? "kurangsaldo" : "tambahsaldo"; return { text: "", redirect: { action: op, args: [m[2].replace(/\s|-/g, ""), m[3].replace(/\./g, "")] } } as any; }
  const snap: Record<string, unknown> = {};
  if (can(c.actor, "stats_basic")) snap.dashboard = await dashboardText(c.sb, c.actor);
  if (can(c.actor, "store")) snap.stok_menipis = ((await c.sb.from("products").select("title, stock").lte("stock", 5).order("stock").limit(15)).data || []);
  if (can(c.actor, "finance_read")) snap.deposit_pending = ((await c.sb.from("deposits").select("username, amount, created_at").eq("status", "pending").limit(20)).data || []);
  if (can(c.actor, "ticket")) snap.tiket_open = ((await c.sb.from("support_tickets").select("ticket_number, name, category").eq("status", "open").limit(15)).data || []);
  const { resp } = await aiChatCompletion(c.sb, { messages: [{ role: "system", content: "Kamu asisten admin toko. Jawab singkat dalam Bahasa Indonesia HANYA dari DATA JSON. Jika data tidak tersedia katakan tidak tersedia untuk role ini. Jangan mengarang angka. Kamu tidak bisa mengubah data; untuk perubahan sarankan command admin yang sesuai." }, { role: "user", content: `DATA (role ${c.actor.role}):\n${JSON.stringify(snap).slice(0, 12000)}\n\nPERTANYAAN: ${q}` }], max_tokens: 500 });
  if (!resp.ok) return "❌ AI sedang tidak tersedia. Coba lagi nanti.";
  const j = await resp.json().catch(() => null); return "🤖 " + (j?.choices?.[0]?.message?.content || "(tidak ada jawaban)");
} });

// ═══════════════════════════ ENTRY ═══════════════════════════
async function getActor(sb: any, phone: string): Promise<Actor | null> {
  const v = phoneVariants(phone); if (!v.length) return null;
  const { data } = await sb.from("wa_bot_admins").select("phone, role, label, is_active").in("phone", v).eq("is_active", true).limit(1).maybeSingle();
  if (!data) return null; return { phone: data.phone, role: data.role, label: data.label, perms: permsFor(data.role) };
}
async function audit(sb: any, a: Actor | null, phone: string, action: string, target: string | null, detail: Record<string, unknown>, result: string) {
  // Tidak pernah mencatat PIN/password/token/API key — hanya argumen command yang sudah disaring.
  const clean = JSON.parse(JSON.stringify(detail, (k, v) => (/pin|password|sandi|token|api_?key|secret/i.test(k) ? "[redacted]" : v)));
  await sb.from("wa_admin_audit_log").insert({ actor_phone: canonPhone(phone), actor_role: a?.role || "none", action, target, detail: clean, result: result.slice(0, 200) });
}
async function targetOf(sb: any, args: string[]) { const u = args[0] ? await resolveUser(sb, args[0]).catch(() => null) : null; return u?.visitor_id || args[0] || null; }

export async function handleWaAdmin(sb: any, body: any): Promise<Record<string, unknown>> {
  const phone = canonPhone(String(body?.actor_phone || ""));
  const op = String(body?.op || "run");

  if (op === "heartbeat") {
    const h = body?.health || {};
    await sb.from("wa_bot_health").upsert({ id: "main", status: String(h.status || "open").slice(0, 30), version: String(h.version || "").slice(0, 20), started_at: h.started_at || null, reconnect_count: Number(h.reconnect_count || 0), memory_mb: Number(h.memory_mb || 0), cpu_load: Number(h.cpu_load || 0), command_errors: Number(h.command_errors || 0), message_errors: Number(h.message_errors || 0), last_error: h.last_error ? String(h.last_error).slice(0, 300) : null, updated_at: new Date().toISOString() });
    const cfg = await loadConfig(sb); return { ok: true, config: cfg };
  }
  if (op === "config") return { config: await loadConfig(sb) };
  if (op === "bootstrap") {
    // Hanya saat belum ada admin sama sekali: nomor admin bawaan ZIP bot menjadi super admin pertama.
    const { count: n } = await sb.from("wa_bot_admins").select("*", { count: "exact", head: true });
    if (n) return { ok: true, skipped: true };
    const list = (Array.isArray(body?.numbers) ? body.numbers : []).map((x: string) => canonPhone(x)).filter((x: string) => x.length >= 10).slice(0, 5);
    if (list.length) await sb.from("wa_bot_admins").insert(list.map((p: string) => ({ phone: p, role: "super_admin", label: "Admin bawaan bot" })));
    return { ok: true, added: list.length };
  }
  if (op === "alerts") {
    // Notifikasi otomatis untuk admin (deposit baru, tiket baru, laporan, stok habis, pesanan dibatalkan).
    const cursor = await getSetting(sb, "wa_admin_alert_cursor", since(0.1)); const now = new Date().toISOString();
    const [dep, tix, rep, crep, stock, ord] = await Promise.all([
      Promise.resolve({ data: [] as any[] }), // deposit: alert dikirim bot setelah bukti foto tersimpan (bukan saat dibuat)
      sb.from("support_tickets").select("ticket_number, name, category").gt("created_at", cursor).limit(10),
      sb.from("chat_violations").select("kind").gt("created_at", cursor).limit(20),
      sb.from("confess_reports").select("reason").gt("created_at", cursor).limit(10),
      sb.from("products").select("title").eq("stock", 0).gt("updated_at", cursor).limit(10),
      sb.from("seller_orders").select("order_code, status").in("status", ["batal", "dibatalkan"]).gt("updated_at", cursor).limit(10),
    ]);
    await setSetting(sb, "wa_admin_alert_cursor", now);
    const { data: admins } = await sb.from("wa_bot_admins").select("phone, role").eq("is_active", true);
    const msgs: { phone: string; text: string }[] = [];
    const push = (perm: string, text: string) => { for (const a of admins || []) if (permsFor(a.role).has("*") || permsFor(a.role).has(perm)) msgs.push({ phone: a.phone, text }); };
    for (const d of dep.data || []) push("finance", `🏦 Deposit baru: ${d.username} ${rp(d.amount)} (${d.trx_id})\n!konfirmasi ${d.trx_id}`);
    for (const t of tix.data || []) push("ticket", `🎫 Tiket baru #${t.ticket_number} — ${t.name} (${t.category || "-"})`);
    if ((rep.data || []).length) push("anon", `🚩 ${rep.data.length} laporan/pelanggaran Anonymous Chat baru. Cek !anonreports`);
    for (const r of crep.data || []) push("confess", `🚩 Laporan confess: ${clip(r.reason, 60)}. Cek !confessreports`);
    for (const p of stock.data || []) push("store", `📦 Stok habis: ${p.title}`);
    for (const o of ord.data || []) push("order", `⚠️ Pesanan ${o.order_code} ${o.status}`);
    const { data: h } = await sb.from("wa_bot_health").select("last_error, updated_at").eq("id", "main").maybeSingle();
    return { messages: msgs.slice(0, 40), last_error: h?.last_error || null };
  }

  const actor = await getActor(sb, phone);
  if (op === "whoami") return actor ? { admin: true, role: actor.role, perms: [...actor.perms], legacy: LEGACY_PERMS } : { admin: false };
  if (!actor) { await audit(sb, null, phone, String(body?.action || op), null, {}, "denied:not_admin"); return { denied: true, text: "❌ Akses ditolak. Nomor ini bukan admin." }; }

  // Menu interaktif Admin Center: hanya kategori & command yang diizinkan role ini.
  if (op === "menu_ui") {
    const cfg0 = await loadConfig(sb);
    const featOf: Record<string, string> = { "6": "firepass", "7": "anon", "8": "ai", "9": "galau", "10": "confess", "12": "notif", "13": "broadcast" };
    const sections = MENU.map((m) => ({
      id: m[0], title: m[1], feature_on: featOf[m[0]] ? !!cfg0.features[featOf[m[0]]] : true,
      rows: m[2].filter((cmd) => { const a = A[cmd.slice(1)]; const p = a?.perm || LEGACY_PERMS[cmd]; return !!p && can(actor, p); })
        .map((cmd) => { const a = A[cmd.slice(1)]; return { id: cmd, title: cmd, desc: clip((a?.desc || "command lama") + (a?.usage ? " • " + a.usage : ""), 70), needs_args: !!a?.usage }; }),
    })).filter((s) => s.rows.length);
    return { role: actor.role, maintenance: !!cfg0.maintenance, sections };
  }

  // Rate limit per admin (server-side, lintas restart bot).
  const cfg = await loadConfig(sb);
  const limit = actor.role === "super_admin" ? cfg.rate_limit_per_min * 3 : cfg.rate_limit_per_min;
  const recent = await count(sb.from("wa_admin_audit_log").select("*", { count: "exact", head: true }).eq("actor_phone", actor.phone).gte("created_at", since(1 / 60)));
  if (recent >= limit) return { text: "⏳ Terlalu banyak perintah. Tunggu 1 menit." };

  if (op === "legacy") {
    const cmd = String(body?.command || ""); const perm = LEGACY_PERMS[cmd];
    const ok = !!perm && can(actor, perm);
    await audit(sb, actor, phone, cmd.replace(/^!/, ""), await targetOf(sb, body?.args || []), { args: (body?.args || []).slice(0, 4) }, ok ? "ok:legacy" : "denied:perm");
    return ok ? { allowed: true } : { allowed: false, text: `❌ Role *${actor.role}* tidak punya izin untuk ${cmd}.` };
  }

  let actionName = String(body?.action || "").replace(/^!/, "").toLowerCase();
  let args: string[] = Array.isArray(body?.args) ? body.args.map(String).slice(0, 40) : [];
  let raw = String(body?.raw || args.join(" ")).slice(0, 4000);

  if (op === "confirm") {
    const tok = String(body?.token || "");
    const { data: p } = await sb.from("wa_admin_pending").select("*").eq("token", tok).maybeSingle();
    if (!p || p.used_at || canonPhone(p.actor_phone) !== canonPhone(actor.phone)) return { text: "❌ Tidak ada aksi yang menunggu konfirmasi." };
    if (new Date(p.expires_at).getTime() < Date.now()) return { text: "⌛ Konfirmasi kedaluwarsa (2 menit). Ulangi perintah." };
    const { data: used } = await sb.from("wa_admin_pending").update({ used_at: new Date().toISOString() }).eq("token", tok).is("used_at", null).select("token");
    if (!(used || []).length) return { text: "❌ Aksi sudah dijalankan." };
    actionName = p.action; args = p.params.args || []; raw = p.params.raw || "";
  }

  const act = A[actionName];
  if (!act) return { text: "❓ Command admin tidak dikenal. Ketik !adminmenu" };
  if (!can(actor, act.perm)) { await audit(sb, actor, phone, actionName, null, { args: args.slice(0, 3) }, "denied:perm"); return { text: `❌ Role *${actor.role}* tidak punya izin untuk !${actionName}.` }; }
  if (act.feature && !cfg.features[act.feature] && actor.role !== "super_admin") return { text: `⛔ Fitur ${act.feature} sedang OFF.` };

  let page = 1; const hi = args.findIndex((a) => a.toLowerCase() === "hal");
  if (hi >= 0) { page = Math.max(1, Number(args[hi + 1]) || 1); args = args.slice(0, hi); }
  const ctx: Ctx = { sb, actor, args, raw, page };

  try {
    if (act.confirm && op !== "confirm") {
      const summary = act.preview ? await act.preview(ctx) : `Jalankan !${actionName} ${args.join(" ")}`;
      const token = crypto.randomUUID();
      await sb.from("wa_admin_pending").delete().lt("expires_at", new Date().toISOString());
      await sb.from("wa_admin_pending").insert({ token, actor_phone: actor.phone, action: actionName, params: { args, raw }, summary, expires_at: new Date(Date.now() + 120e3).toISOString() });
      await audit(sb, actor, phone, actionName, await targetOf(sb, args), { args: args.slice(0, 4), stage: "preview" }, "pending");
      return { needs_confirm: true, token, text: `⚠️ *KONFIRMASI*\n\n${summary}\n\nKetik *KONFIRMASI* (atau *YA*) dalam 2 menit untuk melanjutkan.\nKetik *BATAL* untuk membatalkan.` };
    }
    const out = await act.run(ctx);
    const res = typeof out === "string" ? { text: out } : out;
    if ((res as any).redirect) {
      const r = (res as any).redirect; return await handleWaAdmin(sb, { ...body, op: "run", action: r.action, args: r.args, raw: r.args.join(" ") });
    }
    await audit(sb, actor, phone, actionName, await targetOf(sb, args), { args: args.slice(0, 4), confirmed: op === "confirm" }, "ok");
    return res as any;
  } catch (e) {
    if (e instanceof UserErr) { await audit(sb, actor, phone, actionName, null, { args: args.slice(0, 3) }, "invalid"); return { text: "⚠️ " + e.message + (act.usage ? `\nFormat: !${actionName} ${act.usage}` : "") }; }
    console.error("[wa_admin]", actionName, (e as Error)?.message);
    await audit(sb, actor, phone, actionName, null, {}, "error: " + String((e as Error)?.message || e).slice(0, 120));
    return { text: "❌ Sistem sedang mengalami gangguan. Silakan coba lagi." };
  }
}

export const WA_ADMIN_ACTIONS = Object.keys(A);
