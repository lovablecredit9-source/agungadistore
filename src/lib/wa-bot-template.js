// =============================================
// 🤖 BOT WHATSAPP - Agung Adi Store v11.0.0
// =============================================
// Library: @whiskeysockets/baileys (QR / Pairing Code)
// Cara pakai:
//   1. npm install
//   2. node index.js
//   3. Pilih 1 = Scan QR / 2 = Pairing nomor
// =============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require("@whiskeysockets/baileys");
const buttonMenu = require("./lib/buttonMenu"); // quickReply/singleSelect/urlButton/sendButtons (Native Flow)
// Kartu Welcome/Profil PNG (resvg). Tidak tersedia → null, bot memakai foto profil / teks.
const cardRender = (() => { try { return require("./lib/cardRender"); } catch (e) { console.log("[card] renderer nonaktif:", e?.message); return null; } })();
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_RECONNECT_ATTEMPTS = 8;
const RECONNECT_DELAY_MS = 4000;
// Reconnect dengan backoff (pola Renzona): 3s → 6s → 12s … maks 2 menit.
const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 120000;
const BAD_SESSION_LIMIT = 3;
const PAIRING_MAX_TRIES = 3;
// Identitas perangkat WAJIB platform resmi. Nama custom ("Agung Adi Store Bot") membuat
// WhatsApp menolak kode pairing dengan "Gagal menautkan perangkat".
const WA_BROWSER = (Browsers && typeof Browsers.ubuntu === "function") ? Browsers.ubuntu("Chrome") : ["Ubuntu", "Chrome", "22.04.4"];

function normalizePhoneNumber(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}
// Nomor untuk requestPairingCode: hanya angka, 0xxx → 62xxx, tanpa @s.whatsapp.net.
function normalizePairingPhone(value) {
  let d = String(value || "").replace(/[^0-9]/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return /^\d{10,15}$/.test(d) ? d : "";
}

function cleanJid(jid) {
  const raw = String(jid || "").trim().toLowerCase();
  if (!raw) return "";
  const [userPart, domainPart] = raw.split("@");
  const user = String(userPart || "").split(":")[0];
  return domainPart ? user + "@" + domainPart : user;
}

const lidToPhone = {};
const peerJidToPhone = {};
const waMessageIdToPhone = {};

function phoneFromPnJid(jid) {
  const clean = cleanJid(jid);
  if (!clean || clean.endsWith("@lid")) return "";
  if (clean.endsWith("@s.whatsapp.net") || clean.endsWith("@c.us")) {
    return normalizePhoneNumber(clean.split("@")[0]);
  }
  const digits = normalizePhoneNumber(clean);
  return digits.length >= 9 && digits.length <= 16 ? digits : "";
}

function rememberLidPhone(lid, phone) {
  const lidKey = cleanJid(lid);
  const phoneDigits = phoneFromPnJid(phone) || normalizePhoneNumber(phone);
  if (lidKey.endsWith("@lid") && phoneDigits.length >= 9) {
    lidToPhone[lidKey] = phoneDigits;
    peerJidToPhone[lidKey] = phoneDigits;
  }
}

function rememberPeerPhone(jid, phone) {
  const jidKey = cleanJid(jid);
  const phoneDigits = phoneFromPnJid(phone) || normalizePhoneNumber(phone);
  if (!jidKey || phoneDigits.length < 9 || phoneDigits.length > 16) return;
  peerJidToPhone[jidKey] = phoneDigits;
  if (jidKey.endsWith("@lid")) lidToPhone[jidKey] = phoneDigits;
}

function rememberContactPhone(contact) {
  if (!contact) return;
  const id = cleanJid(contact.id);
  const lid = cleanJid(contact.lid);
  const phone = phoneFromPnJid(contact.phoneNumber) || phoneFromPnJid(contact.id);
  if (lid && phone) rememberLidPhone(lid, phone);
  if (id.endsWith("@lid") && phone) rememberLidPhone(id, phone);
}

function rememberLidMapping(mapping) {
  if (!mapping) return;
  const lid = mapping.lid || mapping.lidJid || mapping.lid_jid || mapping.lidUser || mapping.lid_user;
  const pn = mapping.pn || mapping.pnJid || mapping.pn_jid || mapping.phoneNumber || mapping.phone_number || mapping.jid;
  rememberLidPhone(lid, pn);
}

function phoneFromJid(jid) {
  const phone = phoneFromPnJid(jid);
  if (phone) return phone;
  const lidKey = cleanJid(jid);
  return peerJidToPhone[lidKey] || lidToPhone[lidKey] || "";
}

function collectJidsFromValue(value, out = new Set()) {
  if (!value) return out;
  if (typeof value === "string") {
    const clean = cleanJid(value);
    if (clean.includes("@")) out.add(clean);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJidsFromValue(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value)) collectJidsFromValue(v, out);
  }
  return out;
}

function collectMessagePeerJids(msg, remoteJid, content) {
  const out = new Set();
  collectJidsFromValue(remoteJid, out);
  collectJidsFromValue(msg?.key, out);
  collectJidsFromValue(content?.extendedTextMessage?.contextInfo, out);
  collectJidsFromValue(content?.imageMessage?.contextInfo, out);
  collectJidsFromValue(content?.videoMessage?.contextInfo, out);
  collectJidsFromValue(content?.audioMessage?.contextInfo, out);
  collectJidsFromValue(content?.documentMessage?.contextInfo, out);
  return [...out];
}

function rememberSentMessagePhone(sent, phoneDigits) {
  const list = Array.isArray(sent) ? sent : [sent];
  const peerJids = new Set();
  for (const item of list) {
    if (item?.key?.id) waMessageIdToPhone[item.key.id] = phoneDigits;
    collectJidsFromValue(item?.key, peerJids);
  }
  for (const jid of peerJids) rememberPeerPhone(jid, phoneDigits);
  return [...peerJids];
}

function resolveKnownConfessPhone(msg, remoteJid, quotedWaId, content) {
  const peerJids = collectMessagePeerJids(msg, remoteJid, content);
  for (const jid of peerJids) {
    const phone = phoneFromJid(jid);
    if (phone) return phone;
  }
  if (quotedWaId && waMessageIdToPhone[quotedWaId]) return waMessageIdToPhone[quotedWaId];
  return "";
}

function resolveSenderPhone(msg, remoteJid) {
  const candidates = [
    msg?.key?.remoteJidAlt,
    msg?.key?.participantAlt,
    msg?.key?.participant,
    msg?.key?.remoteJid,
    remoteJid,
  ].filter(Boolean);

  for (const jid of candidates) {
    const phone = phoneFromPnJid(jid);
    if (phone) return phone;
  }
  for (const jid of candidates) {
    const phone = phoneFromJid(jid);
    if (phone) return phone;
  }
  return "";
}

// Resolusi nomor asli dari LID lewat repository Baileys (sumber paling akurat).
async function resolveSenderPhoneAsync(client, msg, remoteJid) {
  const sync = resolveSenderPhone(msg, remoteJid);
  if (sync) return sync;

  const lidCandidates = [
    msg?.key?.remoteJidAlt,
    msg?.key?.participantAlt,
    msg?.key?.participant,
    msg?.key?.remoteJid,
    remoteJid,
  ].filter((j) => cleanJid(j).endsWith("@lid"));

  const mapper = client?.signalRepository?.lidMapping;
  for (const lid of lidCandidates) {
    // Coba API bawaan Baileys untuk memetakan LID -> nomor asli (PN)
    try {
      const getter = mapper?.getPNForLID || mapper?.getPnForLid || mapper?.getPNForLid || mapper?.getPnForLID;
      if (getter) {
        const pn = await getter.call(mapper, cleanJid(lid));
        const phone = phoneFromPnJid(pn);
        if (phone) {
          rememberLidPhone(lid, phone);
          return phone;
        }
      }
    } catch {}
  }

  // Fallback: tanya WhatsApp langsung apakah LID punya PN terdaftar
  for (const lid of lidCandidates) {
    try {
      const res = await client.onWhatsApp(cleanJid(lid));
      const pn = res?.[0]?.jid || res?.[0]?.lid;
      const phone = phoneFromPnJid(pn);
      if (phone) {
        rememberLidPhone(lid, phone);
        return phone;
      }
    } catch {}
  }
  return "";
}


function phoneVariants(value) {
  const digits = normalizePhoneNumber(value);
  const set = new Set();
  if (!digits) return [];
  set.add(digits);
  set.add("+" + digits);
  if (digits.startsWith("62")) set.add("0" + digits.slice(2));
  if (digits.startsWith("0")) {
    set.add("62" + digits.slice(1));
    set.add("+62" + digits.slice(1));
  }
  if (digits.startsWith("8")) {
    set.add("62" + digits);
    set.add("+62" + digits);
    set.add("0" + digits);
  }
  return [...set];
}

function formatPairingCode(code) {
  const cleaned = String(code || "").replace(/\s+/g, "").trim();
  if (!cleaned) return "-";
  return cleaned.match(/.{1,4}/g)?.join("-") || cleaned;
}

function getDisconnectMessage(lastDisconnect) {
  return lastDisconnect?.error?.message || lastDisconnect?.error?.data?.reason || "Connection Closed";
}

// ✅ Nilai ini otomatis diisi saat ZIP bot didownload dari dashboard admin.
const API_KEY = "__BOT_API_KEY__";
const BASE = "__BOT_BASE_URL__";
const WEB_URL = "__BOT_WEB_URL__";

const DEFAULT_PAIRING_PHONE = "__BOT_PAIRING_PHONE__"; // Opsional: nomor default pairing, format: 628xxxxxxxxxx

// === SESSION LOGIN USER (per nomor WA) — TIDAK simpan PIN ===
const userSessions = {};

// === PIN PENDING STATE (per nomor WA) — untuk flow interaktif ===
// Status input per JID otomatis diberi createdAt/expiresAt/remoteJid saat dibuat (lihat stampFlows).
const FLOW_TTL_MS = { login: 5 * 60000, resetsandi: 5 * 60000, resetpin: 5 * 60000, create_pin: 5 * 60000, gantiemail: 5 * 60000, gantinama: 5 * 60000, deposit: 10 * 60000, purchase: 10 * 60000 };
function flowTtl(type) { const k = Object.keys(FLOW_TTL_MS).find((x) => String(type || "").startsWith(x)); return k ? FLOW_TTL_MS[k] : 10 * 60000; }
function stampFlows(target, kind) {
  return new Proxy(target, { set(o, jid, v) {
    if (v && typeof v === "object") { const now = Date.now(); const type = kind || v.type; v.remoteJid = jid; v.createdAt = now; v.expiresAt = now + flowTtl(type); }
    o[jid] = v; return true;
  } });
}
const pinPending = stampFlows({}, "purchase");

// === FLOW CHAT INTERAKTIF ===
const chatFlows = stampFlows({});
const PW_OK = "✅ Password berhasil diperbarui.\n\n🔐 Demi keamanan, password tidak ditampilkan kembali di chat.";
const PIN_OK = "✅ PIN berhasil diperbarui.\n\n🔐 Demi keamanan, PIN tidak ditampilkan kembali di chat.";
const pendingDeposits = {};
const MAX_TEXT_CHUNK = 3500;

// === GAME TIMER WARNINGS ===
const gameTimerWarnings = {};

async function askAuthMethod() {
  const fs = require("fs");
  // Sesi sudah ada & terdaftar → langsung masuk, tidak minta QR/pairing ulang.
  try {
    const creds = JSON.parse(fs.readFileSync("./auth_session/creds.json", "utf8"));
    if (creds && creds.registered) { console.log("🔐 Sesi WhatsApp tersimpan ditemukan, menyambung..."); return { mode: "existing", phoneNum: "" }; }
  } catch {}
  const rl = readline.createInterface({ input, output });

  try {
    console.log("\n╭──────────────────────────────────────╮");
    console.log("│      🤖 AGUNG ADI STORE BOT          │");
    console.log("│            WHATSAPP LOGIN            │");
    console.log("╰──────────────────────────────────────╯\n");
    console.log("1️⃣  Scan QR");
    console.log("2️⃣  Pairing Nomor WhatsApp\n");

    const method = String(await rl.question("Pilih metode [1/2]: ")).trim();

    if (method === "1") {
      console.log("\n📷 Mode QR dipilih. Buka WhatsApp → Perangkat tertaut → Tautkan perangkat.\n");
      return { mode: "qr", phoneNum: "" };
    }

    let phoneNum = "";
    for (let i = 0; i < 3 && !phoneNum; i++) {
      const promptPhone = /^\d+$/.test(DEFAULT_PAIRING_PHONE)
        ? "\n📱 Masukkan nomor WhatsApp [" + DEFAULT_PAIRING_PHONE + "]:\n› "
        : "\n📱 Masukkan nomor WhatsApp (628xxxxxxxxxx):\n› ";
      const rawPhone = String(await rl.question(promptPhone)).trim();
      phoneNum = normalizePairingPhone(rawPhone || (/^\d+$/.test(DEFAULT_PAIRING_PHONE) ? DEFAULT_PAIRING_PHONE : ""));
      if (!phoneNum) console.log("❌ Nomor tidak valid. Contoh: 6285769302532 atau 085769302532");
    }
    if (!phoneNum) throw new Error("Nomor WhatsApp wajib diisi untuk pairing.");

    console.log("\n📱 Nomor: " + phoneNum);
    return { mode: "pairing", phoneNum };
  } finally {
    rl.close();
  }
}

// === KONFIGURASI ADMIN ===
// ADMIN_NUMBERS hanya dipakai sebagai admin pertama (bootstrap) + tujuan bukti deposit.
// Hak akses admin yang sebenarnya diputuskan SERVER (tabel wa_bot_admins + role).
const ADMIN_NUMBERS = __BOT_ADMIN_NUMBERS__;
const BOT_VERSION = "14.7.0";

// Cache identitas admin per nomor (diisi oleh adminWhoami sebelum command diproses).
const adminCache = {}; // phone -> { admin, role, perms, at }
const adminJidPhone = {}; // remoteJid -> phone

function isAdmin(msg) {
  // Dulu: daftar admin kosong = semua orang admin (celah keamanan). Sekarang wajib terdaftar di server.
  const phone = adminJidPhone[msg?.key?.remoteJid];
  const c = phone ? adminCache[phone] : null;
  return Boolean(c && c.admin);
}

const cut2 = (s, n) => { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const fmtRp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

// Short ID from UUID: #XXXXX (5 digit angka dari hash)
function shortId(uuid) {
  if (!uuid) return "#00000";
  const num = parseInt(uuid.replace(/-/g, "").slice(0, 10), 16) % 100000;
  return "#" + String(num).padStart(5, "0");
}

const api = async (ep, method, body) => {
  const opt = { method: method || "GET", headers: { "x-api-key": API_KEY, "Content-Type": "application/json" } };
  if (body) opt.body = JSON.stringify(body);
  const r = await fetch(BASE + "?endpoint=" + ep, opt);
  const j = await r.json().catch(() => ({ error: "Response API tidak valid" }));
  // Public API membungkus hasil sebagai { success, data }. Kalau data berisi
  // { hasPin/error/needPin }, tampilkan juga di top-level agar bot lama & baru
  // membaca status PIN yang sama dengan web.
  if (j && j.data && typeof j.data === "object" && !Array.isArray(j.data)) {
    return { ...j, ...j.data, data: j.data, error: j.error || j.data.error };
  }
  return j;
};

function apiData(res) {
  return res?.data !== undefined ? res.data : res;
}

function apiError(res) {
  return res?.error || res?.data?.error || "";
}

function apiNeedPin(res) {
  return Boolean(res?.needPin || res?.data?.needPin);
}

function apiHasPin(res) {
  const d = apiData(res);
  return Boolean(d?.hasPin);
}

// ═══════════════ ADMIN CENTER RUNTIME (v11) ═══════════════
const BOT_STARTED_AT = new Date().toISOString();
const botHealth = { status: "starting", reconnect_count: 0, command_errors: 0, message_errors: 0, last_error: null };
let botConfig = { bot_enabled: true, maintenance: false, features: {}, prefix: "!", rate_limit_per_min: 30 };
const adminPending = {}; // jid -> { token, at }
const adminLastList = {}; // jid -> { action, args, page }
const rateHits = {}; // key -> [timestamps]

// Command admin yang ditangani server (harus sama dengan WA_ADMIN_ACTIONS di backend).
const ADMIN_ACTIONS = new Set(("admin adminmenu adminhelp whoami dashboard cariuser detailuser banuser unbanuser warnuser resetuser edituser " +
  "tambahsaldo kurangsaldo setsaldo resetsaldo riwayatdeposit produkadmin tambahproduk editproduk hapusproduk setstok kategoriadmin tambahkategori editkategori hapuskategori flashsaleadmin grosiradmin sponsoradmin " +
  "detailtrx pesanan detailpesanan prosespesanan selesaipesanan batalkanpesanan refund refundstatus setgame gameconfig " +
  "firepassadmin fpstats fpuser fpprogress fpxp fpgive fpgiverank fppremium fpreset fpseason fpmisiadmin fptambahmisi fpeditmisi fphapusmisi fptieradmin fptambahtier fpedittier fphapustier " +
  "anonadmin anonstats anonmoderasi anononline anonqueue anonsession anonreports anonviolations anonreport anonban anonunban anonwarn anonblock anonunblock " +
  "aadmin aistats aiusage aiusers aierrors aichatlog aimodel aiconfig aitest aireload galauadmin galaustats galausage galauusers galausessions galauerrors galauconfig galaureset " +
  "confessadmin confessstats confesslist confessdetail confessapprove confessreject confesshide confessrestore confesspin confessunpin confessdelete confessreports confessreport " +
  "balastiket tiketclose tiketopen tiketassign tiketstats notifuser notiftrx notifdeposit notifpesanan notiffirepass notifstatus notiftest notifbroadcast broadcast confessbroadcast " +
  "searchadmin exportuser exporttrx exportdeposit exportticket exportactivity exportfirepass auditlog adminlist botstatus botstats botuptime botversion boterrors botrestart botreload maintenance botmaintenance adminai").split(/\s+/));
// Command yang juga dipakai user biasa: hanya dialihkan ke versi admin jika pengirim admin.
const SHARED_USER_COMMANDS = new Set(["detailtrx", "balastiket", "pesanan", "fppremium", "galaureset"]);
const USER_FIRST_COMMANDS = new Set(["pesanan", "fppremium", "galaureset"]);
const LEGACY_ADMIN_COMMANDS = new Set(["!buattoken", "!konfirmasi", "!tolakdeposit", "!deposit_admin", "!rekapdeposit", "!adminbalas", "!saldo", "!game", "!kredit", "!setkredit", "!resetkredit", "!resetgame", "!streak", "!setstreak", "!resetstreak", "!stok", "!stoksponsor", "!user", "!alluser", "!topuser", "!loginhistory", "!transaksi", "!tiket", "!settiket", "!tiketdetail", "!lihatsemuatiket", "!notif", "!report", "!aktivitas"]);

function withTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout " + (label || ""))), ms))]);
}
async function adminApi(body, ms) {
  const res = await withTimeout(api("wa_admin", "POST", body), ms || 25000, body.action || body.op);
  return apiData(res) || {};
}
async function adminWhoami(phone, remoteJid) {
  if (!phone) return null;
  adminJidPhone[remoteJid] = phone;
  const c = adminCache[phone];
  if (c && Date.now() - c.at < 60000) return c;
  try {
    const d = await adminApi({ op: "whoami", actor_phone: phone }, 10000);
    adminCache[phone] = { admin: !!d.admin, role: d.role || null, perms: d.perms || [], at: Date.now() };
  } catch { if (!c) return null; }
  return adminCache[phone];
}
// ═══════════════ SUPER BOT RUNTIME (v12) ═══════════════
// Semua data user dibaca server (endpoint wa_user) dan dibatasi ke sesi login nomor ini.
const anonMode = {};   // jid -> { since, visitor_id, waiting }
const galauMode = {};  // jid -> { history: [{role, content}], at }  (memori saja, per nomor)
const aiHistory = {};  // jid -> [{role, content}]
const notifSince = {}; // jid -> ISO
const statBuf = [];
function botStat(command, category, ok, actor, latency_ms, error) {
  // Hanya nama command + status; tidak pernah isi pesan, PIN, password, atau token.
  statBuf.push({ command: String(command || "?").slice(0, 40), category, ok: ok !== false, actor: actor || "", latency_ms: latency_ms || 0, error: error ? String(error).slice(0, 200) : null });
  if (statBuf.length > 200) statBuf.splice(0, statBuf.length - 200);
}
async function superApi(body) {
  try { return apiData(await withTimeout(api("wa_user", "POST", body), 60000, body.op)) || {}; }
  catch (e) { botStat(body.op, "user", false, body.actor, 0, e?.message); return { text: "❌ Terjadi kesalahan. Coba lagi." }; }
}

// ═══════════════ INTERACTIVE UI (v12.2) ═══════════════
// Tombol/list hanya berisi ID berupa command yang SUDAH ADA. Memilih tombol = mengetik command itu,
// jadi semua otorisasi (login, admin role/permission di server) tetap berlaku seperti biasa.
// Level: 1) tombol (≤3) → 2) list/sections → 3) teks bernomor (selalu disertakan; balas angka).
// WA_UI_MODE=text memaksa teks saja bila WhatsApp tidak menampilkan tombol/list.
const UI_MODE = String(process.env.WA_UI_MODE || "auto").toLowerCase();
const uiState = {}; // jid -> { options: [id], at }
const extractInteractiveId = buttonMenu.extractInteractiveId;
function uiTextMenu(ui, opts) {
  const lines = [];
  (ui.quick || []).forEach((b) => { opts.push(b.id); lines.push(opts.length + ". " + b.title); });
  (ui.buttons || []).forEach((b) => { opts.push(b.id); lines.push(opts.length + ". " + b.title); });
  (ui.sections || []).forEach((s) => {
    lines.push("", "*" + s.title + "*");
    s.rows.forEach((r) => { opts.push(r.id); lines.push(opts.length + ". " + r.title + (r.desc ? " — " + r.desc : "")); });
  });
  (ui.links || []).forEach((l) => lines.push("", l.title + ": " + l.url));
  return [ui.title ? "*" + ui.title + "*" : "", ui.body || "", "━━━━━━━━━━━━", ...lines, "", "↩️ Balas *angka* pilihan" + (ui.footer ? "\n" + ui.footer : "")]
    .filter((x, i) => x !== "" || i > 0).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
// Susun tombol native: list "☰ Pilih Menu" (sections) + quick_reply (ui.quick / navigasi) + cta_url (ui.links).
function buildNativeButtons(ui) {
  const { quickReply, singleSelect, urlButton } = buttonMenu;
  const btns = ui.buttons || [];
  const quick = ui.quick || [];
  const links = (ui.links || []).map((l) => urlButton(l.title, l.url));
  const secs = (ui.sections || []).filter((s) => s.rows && s.rows.length);
  if (!secs.length) {
    const all = [...quick, ...btns];
    if (all.length <= 3) return [...all.map((b) => quickReply(b.title, b.id)), ...links];
    return [singleSelect(ui.listLabel || "☰ Pilih Menu", [{ title: "Pilihan", rows: all }]), ...links];
  }
  const nav = btns.filter((b) => /Kembali|Menu Utama|Sebelumnya|Berikutnya|Refresh/i.test(b.title));
  const extra = btns.filter((b) => !nav.includes(b));
  const allSecs = extra.length ? [{ title: "Pintasan", rows: extra }, ...secs] : secs;
  return [singleSelect(ui.listLabel || "☰ Pilih Menu", allSecs), ...[...quick, ...nav].slice(0, 3).map((b) => quickReply(b.title, b.id)), ...links];
}
async function sendNativeFlow(client, jid, ui, footer, quoted) {
  const body = [ui.title ? "*" + ui.title + "*" : "", ui.body || ""].filter(Boolean).join("\n\n");
  await buttonMenu.sendButtons(client, jid, { body, footer: ui.footer ? ui.footer + " • " + footer : footer, buttons: buildNativeButtons(ui) }, quoted);
}
// Urutan: 1) Native Flow (single_select/quick_reply) → 2) list/buttons lama → 3) teks bernomor.
// WA_UI_MODE: auto (default) | native | legacy | text. Balasan angka selalu bekerja (uiState per JID).
async function sendUi(client, jid, ui, quoted) {
  const opts = [];
  const text = uiTextMenu(ui, opts);
  uiState[jid] = { options: opts, at: Date.now() };
  const footer = (botConfig.bot_name || "Agung Adi Store") + " • v" + BOT_VERSION;
  if ((UI_MODE === "auto" || UI_MODE === "native") && String(ui.body || "").length < 3500) {
    try { await sendNativeFlow(client, jid, ui, footer, quoted); return; }
    catch (e) { if (UI_MODE === "native") console.log("[ui] native flow gagal:", e?.message); }
  }
  if ((UI_MODE === "auto" || UI_MODE === "legacy") && text.length < 3500) {
    try {
      const btns = ui.buttons || [];
      if (!ui.sections?.length && btns.length && btns.length <= 3) {
        await client.sendMessage(jid, { text, footer, headerType: 1,
          buttons: btns.map((b) => ({ buttonId: b.id, buttonText: { displayText: String(b.title).slice(0, 20) }, type: 1 })) }, { quoted });
        return;
      }
      const sections = [];
      if (btns.length) sections.push({ title: "Navigasi", rows: btns.slice(0, 10).map((b) => ({ rowId: b.id, title: String(b.title).slice(0, 24) })) });
      for (const s of (ui.sections || []).slice(0, 9)) sections.push({ title: String(s.title).slice(0, 24), rows: s.rows.slice(0, 10).map((r) => ({ rowId: r.id, title: String(r.title).slice(0, 24), description: String(r.desc || "").slice(0, 72) })) });
      if (sections.length) {
        await client.sendMessage(jid, { text, footer, title: ui.title || "", buttonText: ui.listLabel || "☰ Pilih Menu", sections }, { quoted });
        return;
      }
    } catch (e) { /* library/WA tidak mendukung → fallback teks */ }
  }
  return sendLongMessage(client, jid, text, quoted);
}
const BACK = { id: "!ui main", title: "🏠 Menu Utama" };
// Owner: bisa diganti lewat env OWNER_WA. Link wa.me membuka chat langsung.
const OWNER_WA = String(process.env.OWNER_WA || "6285769302532").replace(/\D/g, "").replace(/^0/, "62");
const OWNER_LINK = { title: "📞 Hubungi Owner", url: "https://wa.me/" + OWNER_WA };
// Kartu foto: foto profil WA milik JID pengirim (tanpa cache global). Tidak ada foto → false, lanjut teks.
async function sendPhotoCard(client, jid, caption, quoted) {
  let url = null;
  try { url = await client.profilePictureUrl(jid, "image"); } catch {}
  if (!url) return false;
  try { await client.sendMessage(jid, { image: { url }, caption }, { quoted }); return true; } catch { return false; }
}
const WEB_HOST = String(WEB_URL || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const OWNER_LOCAL = OWNER_WA.replace(/^62/, "0");
// Kirim kartu PNG (kind: "welcome" | "profile") untuk JID ini. Urutan: kartu PNG → foto profil WA → false.
async function sendUserCard(client, jid, kind, data, caption, quoted) {
  if (cardRender) {
    try {
      const photo = await cardRender.fetchProfilePhoto(client, jid);
      const d = { ...data, photo, web: WEB_HOST, owner: OWNER_LOCAL, version: BOT_VERSION };
      const png = kind === "profile" ? cardRender.renderProfileCard(d) : cardRender.renderWelcomeCard(d);
      if (png) { await client.sendMessage(jid, { image: png, caption }, { quoted }); return true; }
    } catch (e) { console.log("[card] gagal:", e?.message); }
  }
  return sendPhotoCard(client, jid, caption, quoted);
}
// Saldo realtime milik visitor_id sesi ini (endpoint yang sama dengan !saldoku).
async function freshBalanceUser(session) {
  if (!session?.visitor_id) return null;
  try { const res = await api("balances"); return (res.data || []).find((u) => u.visitor_id === session.visitor_id) || null; } catch { return null; }
}
// Direktori .allmenu — hanya command yang ada handler-nya di bot ini.
const ALL_MENU = {
  akun: ["👤 Akun", [["!daftar", "Buat akun"], ["!login", "Login [user] [password]"], [".logintoken", "Token login WA"], ["!logout", "Logout"], ["!profilku", "Lihat profil"], ["!editprofil", "Edit profil"], ["!gantiemail", "Ganti email"], ["!resetsandi", "Reset password"], ["!buatpin", "Buat PIN"], ["!resetpin", "Reset PIN"], ["!nomorku", "Nomor WA"], ["!fotoprofil", "Foto profil"], ["!notifku", "Notifikasi"], ["!slotnotif", "Slot notif WA"]]],
  saldo: ["💰 Saldo & Deposit", [["!saldoku", "Cek saldo"], ["!deposit", "Deposit"], ["!bukti", "Kirim bukti bayar"], ["!cekdeposit", "Status deposit [ID]"], ["!riwayat", "Riwayat transaksi"], ["!detailtrx", "Detail transaksi [id]"], ["!download_riwayat", "Unduh riwayat [pdf/word/txt]"]]],
  produk: ["🛒 Produk & Toko", [["!produk", "Daftar produk"], ["!cari", "Cari [kata]"], ["!kategori", "Kategori"], ["!harga", "Filter [min] [max]"], ["!top", "Terpopuler"], ["!random", "Produk random"], ["!detailproduk", "Detail [#id]"], ["!grosir", "Harga grosir"], ["!flashsale", "Flash sale"], ["!keranjang", "Keranjang"], ["!toko", "Toko [ID]"], ["!beli", "Beli [#ID] [jumlah]"], ["!belistreak", "Beli paket streak"], ["!belikredit", "Beli kredit"], ["!belistorage", "Beli storage"], ["!belibundle", "Beli bundle"], ["!sponsor", "Sponsor aktif"]]],
  pesanan: ["📦 Pesanan", [["!pesanan", "Pesanan saya"], ["!pesanan detail", "Detail KODE"], ["!pesanan terima", "Terima KODE"], ["!pesanan batal", "Batal KODE"], ["!orderchat", "Chat penjual KODE"], ["!review", "Ulasan KODE [1-5]"], ["!dispute", "Komplain KODE"]]],
  reward: ["🎁 Reward", [["!referral", "Referral"], ["!wishlist", "Wishlist"], ["!klaim", "Klaim voucher"], ["!klaimstreak", "Klaim streak"], ["!streakku", "Status streak"], ["!quest", "Quest"], ["!lagaquest", "Laga quest"], ["!ruangku", "RuangKu"], ["!rodadiskon", "Roda diskon"], ["!premium", "Store premium"]]],
  firepass: ["🔥 Fire Pass", [["!firepass", "Status"], ["!fpmisi", "Misi"], ["!fpclaim", "Claim [id]"], ["!fptier", "Tier"], ["!fppremium", "Premium"], ["!fpriwayat", "Riwayat"]]],
  game: ["🎮 Game", [["!profilgame", "Profil game"], ["!gameku", "Statistik"], ["!kreditku", "Kredit"], ["!lbgame", "Leaderboard"], ["!tekateki", "Teka-teki"], ["!tebakkata", "Tebak kata"], ["!tebakangka", "Tebak angka"], ["!tebakgambar", "Tebak gambar"], ["!tebakbarang", "Tebak barang"], ["!pilihlanganda", "Pilihan ganda"], ["!kuisyatidak", "Kuis ya/tidak"], ["!tekatekilanjut", "Teka-teki V2"], ["!jawab", "Jawab"], ["!hint", "Petunjuk"], ["!nyerah", "Menyerah"]]],
  ai: ["🤖 AI", [["!ai", "Tanya AI"], ["!storeai", "Store AI"], ["!galau", "Bot galau"], ["!galaureset", "Reset galau"], ["!galauhelp", "Bantuan galau"]]],
  anon: ["👻 Anonymous Chat", [["!anon", "Info"], ["!anonmatch", "Cari match"], ["!anonstatus", "Status"], ["!anonprofile", "Profil"], ["!anonfriends", "Friends"], ["!anonpremium", "Premium"], ["!anonstop", "Stop"]]],
  confess: ["💌 Confess", [["!confess", "Kirim confess"], ["!balas", "Balas [pesan]"], ["!confessstatus", "Status"], ["!stopconfess", "Stop"], ["!confesshelp", "Bantuan"]]],
  musik: ["🎵 Musik", [["!lagu", "Daftar lagu"], ["!carilagu", "Cari lagu"], ["!download", "Link download"], ["!kirim", "Kirim audio"], ["!artis", "Artis"], ["!playlist", "Playlist"]]],
  like: ["❤️ Like", [["!likeproduk", "Like produk"], ["!likelagu", "Like lagu"], ["!likesponsor", "Like sponsor"], ["!likeku", "Favorit saya"]]],
  support: ["🎫 Support", [["!buattiket", "Buat tiket"], ["!tiketku", "Tiket saya"], ["!tiketpesan", "Pesan tiket [no]"], ["!balastiket", "Balas tiket [no] [pesan]"]]],
  info: ["ℹ️ Info", [["!info", "Statistik toko"], ["!paket", "Paket"], ["!sosmed", "Sosial media"], ["!webapp", "Web app"], ["!bantuan", "Pusat bantuan"], ["!syarat", "Syarat & ketentuan"], ["!help", "Cara pakai bot"]]],
  lainnya: ["🛠️ Lainnya", [["!allmenu teks", "Semua command (teks)"], ["!admin", "Admin Center (khusus admin)"]]],
};
// Kartu profil + tombol aksi; data diambil dari visitor_id sesi JID ini.
// Level game dari total poin (sama dengan aturan level di web: ambang tetap lalu berlipat dua).
function getGameLevel(points) {
  const pts = Math.max(0, Number(points) || 0);
  const thresholds = [0, 90, 250, 500, 1000, 2000, 4000, 8000];
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) { if (pts >= thresholds[i]) level = i + 1; else break; }
  if (level === thresholds.length) { let t = thresholds[thresholds.length - 1]; while (pts >= t * 2) { level++; t *= 2; } }
  return level;
}

async function renderProfile(client, jid, session, phoneText, quoted) {
  const user = await freshBalanceUser(session);
  if (!user) return sendLongMessage(client, jid, "❌ Profil tidak ditemukan.", quoted);
  session.balance = user.balance; session.username = user.username;
  const [pinCheck, gp, gs, gc] = await Promise.all([
    api("check_pin", "POST", { visitor_id: session.visitor_id }),
    api("game_profiles&visitor_id=" + session.visitor_id),
    api("game_stats&visitor_id=" + session.visitor_id),
    api("game_credits&visitor_id=" + session.visitor_id),
  ]);
  const pts = (gs.data || []).reduce((a, g) => a + (g.points || 0), 0);
  const p = gp.data?.[0];
  const caption = [
    "👤 *PROFIL SAYA*", "",
    "Nama: *" + (p?.display_name || user.username) + "*",
    "Username: @" + user.username,
    "Nomor: " + phoneText,
    "Email: " + (user.email || "-"),
    "", "💰 Saldo: *" + fmtRp(user.balance) + "*",
    "🎮 Level: " + getGameLevel(pts) + " (" + pts + " pts)",
    "🎟️ Kredit: " + (gc.data?.[0]?.credits || 0),
    "🔐 PIN: " + (apiHasPin(pinCheck) ? "Sudah dibuat" : "Belum — !buatpin"),
    "🔗 Status: Terhubung",
  ].join("\n");
  let sent = false;
  try {
    const ac = await api("account_card&visitor_id=" + session.visitor_id);
    if (ac?.user && cardRender?.renderInfoCard) {
      const pp = await safePhoto(client, jid);
      const u = ac.user;
      sent = await sendRenderedCard(client, jid, () => cardRender.renderInfoCard({ ...CARD_BASE(), color: "cyan", kicker: "PROFIL AKUN", headline: cut2(p?.display_name || u.username, 24), photo: pp, name: u.username,
        left: [["user", "Nama", u.username], ["wa", "WhatsApp", phoneText || u.phone || "Belum tersedia"], ["mail", "Email", u.email || "Belum tersedia"], ["money", "Saldo", fmtRp(u.balance), "#7de3ff"], ["clock", "Akun dibuat", dtText(u.created_at)]],
        right: [["id", "PIN", apiHasPin(pinCheck) ? "••••••" : "BELUM DIBUAT"], ["id", "2FA", u.totp_enabled ? "Aktif" : "Tidak aktif"], ["up", "Total transaksi", String(ac.tx_count)], ["wallet", "Hari ini", fmtRp(ac.spent_today)], ["wallet", "7 hari", fmtRp(ac.spent_7d)], ["wallet", "30 hari", fmtRp(ac.spent_30d)], ["plus", "Total Confess", String(ac.confess_count ?? 0)], ["clock", "Total pesanan", String(ac.order_count ?? 0)]],
        note: "Aktif: " + dtText(ac.last_active_at),
        status: "AKUN AKTIF", statusColor: "green", footer: ["AGUNG ADI STORE", "Level game " + getGameLevel(pts) + " • " + (gc.data?.[0]?.credits || 0) + " kredit"] }), "AGUNG ADI STORE • Profil", null, quoted);
    }
  } catch (e) { console.log("[profile-card] gagal:", e?.message); }
  if (!sent) sent = await sendUserCard(client, jid, "profile", { name: p?.display_name || user.username, username: user.username, phone: phoneText, balanceText: fmtRp(user.balance), level: getGameLevel(pts), credits: gc.data?.[0]?.credits || 0, status: "Terhubung" }, caption, quoted);
  return sendUi(client, jid, { title: "👤 PROFIL", body: sent ? "Pilih aksi profil di bawah." : caption, listLabel: "☰ Aksi Profil",
    sections: [
      { title: "Ubah Akun", rows: [{ id: "!editprofil username", title: "✏️ Ganti Nama" }, { id: "!gantiemail", title: "📧 Ganti Email" }, { id: "!resetsandi", title: "🔐 Ganti Password" }, { id: apiHasPin(pinCheck) ? "!resetpin" : "!buatpin", title: "🔑 Ganti PIN" }] },
      { title: "Lainnya", rows: [{ id: "!fotoprofil", title: "🖼️ Foto Profil" }, { id: "!profilgame", title: "🎮 Profil Game" }, { id: "!saldoku", title: "💰 Saldo" }, { id: "!riwayat", title: "📜 Riwayat" }] },
    ],
    buttons: [{ id: "!ui akun", title: "↩️ Kembali" }, BACK] }, quoted);
}
// Kategori user → command existing.
const USER_UI = {
  belanja: { title: "🛒 BELANJA", rows: [["!produk", "Semua Produk"], ["!kategori", "Kategori"], ["!cari", "Cari Produk", "!cari [kata]"], ["!top", "Terpopuler"], ["!random", "Produk Random"], ["!flashsale", "Flash Sale"], ["!pesanan", "Pesanan Saya"], ["!grosir", "Grosir"], ["!wishlist", "Wishlist"], ["!keranjang", "Keranjang"], ["!ai cari produk murah", "Cari dengan AI"]] },
  pesanan: { title: "📦 PESANAN", rows: [["!pesanan", "Pesanan Saya"], ["!riwayat", "Riwayat Transaksi"], ["!detailtrx", "Detail Transaksi", "!detailtrx [id]"], ["!download_riwayat pdf", "Invoice / Riwayat PDF"]] },
  saldo: { title: "💰 SALDO", rows: [["!saldoku", "💰 Cek Saldo"], ["!deposit", "➕ Deposit"], ["!cekdeposit", "Status Deposit"], ["!riwayat", "📜 Riwayat"], ["!detailtrx", "🧾 Detail Transaksi", "!detailtrx [id]"], ["!klaim", "🎁 Voucher", "!klaim [kode]"]] },
  profil: { title: "📱 PROFIL", rows: [["!profilku", "👤 Cek Profil"], ["!editprofil username", "✏️ Ganti Nama"], ["!gantiemail", "📧 Ganti Email"], ["!resetsandi", "🔑 Ganti Password"], ["!resetpin", "🔐 Kelola PIN"], ["!nomorku", "📱 Nomor WhatsApp"], ["!fotoprofil", "🖼️ Foto Profil"], ["!profilgame", "🎮 Profil Game"]] },
  reward: { title: "🎁 REWARD", rows: [["!referral", "Referral"], ["!quest", "Quest"], ["!lagaquest", "Laga Quest"], ["!ruangku", "RuangKu"], ["!rodadiskon", "Roda Diskon"], ["!streakku", "Streak"]] },
  firepass: { title: "🔥 FIRE PASS", rows: [["!firepass", "Fire Pass"], ["!fpmisi", "Misi"], ["!fptier", "Tier"], ["!fppremium", "Premium"], ["!fpriwayat", "Riwayat"]] },
  game: { title: "🎮 GAME", rows: [["!tekateki", "🎮 Teka-Teki"], ["!tebakkata", "🎮 Tebak Kata"], ["!tebakgambar", "🎮 Tebak Gambar"], ["!lbgame", "🏆 Leaderboard"], ["!quest", "🎯 Quest"], ["!profilgame", "👤 Profil Game"], ["!gameku", "📊 Statistik"], ["!kreditku", "💎 Kredit"], ["!belikredit", "Beli Kredit"]] },
  ai: { title: "🤖 AI CENTER", rows: [["!ai", "Tanya AI"], ["!storeai", "Store AI"], ["!galau", "Bot Galau"], ["!galaureset", "Reset Galau"], ["!galauhelp", "Bantuan"]] },
  galau: { title: "💙 BOT GALAU", rows: [["!galau", "Curhat"], ["!galaureset", "Reset"], ["!galaustop", "Keluar"], ["!galauhelp", "Bantuan"]] },
  anon: { title: "👻 ANONYMOUS", rows: [["!anonmatch", "Cari Partner"], ["!anonstatus", "Status"], ["!anonfriends", "Friends"], ["!anonprofile", "Profil Anon"], ["!anonpremium", "Premium"], ["!anonstop", "Stop"]] },
  confess: { title: "💌 CONFESS", rows: [["!confess", "Buat Confess"], ["!confessstatus", "Status"], ["!confesshelp", "Bantuan"], ["!stopconfess", "Stop Confess"]] },
  musik: { title: "🎵 MUSIK", rows: [["!lagu", "Lagu"], ["!carilagu", "Cari Lagu", "!carilagu [judul]"], ["!artis", "Artis"], ["!playlist", "Playlist"], ["!publik", "Publik"], ["!likeku", "Favorit"]] },
  akun: { title: "👤 AKUN SAYA", rows: [["!profilku", "Profil Saya"], ["!editprofil", "Edit Profil"], ["!editprofil username", "Ganti Nama"], ["!gantiemail", "Ganti Email"], ["!resetsandi", "Ganti/Reset Password"], ["!resetpin", "Ganti/Reset PIN"], ["!nomorku", "Nomor Saya"], ["!fotoprofil", "Foto Profil"], ["!notifku", "Notifikasi"], ["!logout", "Logout"]] },
  support: { title: "🎫 PUSAT BANTUAN", rows: [["!buattiket", "Buat Tiket"], ["!tiketku", "Tiket Saya"], ["!tiketpesan", "Pesan Tiket", "!tiketpesan [id]"], ["!balastiket", "Balas Tiket", "!balastiket [no] [pesan]"]] },
  info: { title: "ℹ️ INFO", rows: [["!info", "Tentang Toko"], ["!syarat", "Syarat & Ketentuan"], ["!help", "Bantuan"], ["!sosmed", "Sosial Media"], ["!webapp", "Web App"]] },
};
// Pengelompokan section per kategori (hanya command yang ada di USER_UI).
const USER_UI_GROUPS = {
  belanja: { body: "Temukan produk yang kamu butuhkan.", label: "☰ Pilih Produk", groups: [["Produk", ["!produk", "!top", "!random", "!flashsale", "!grosir"]], ["Pencarian", ["!cari", "!kategori", "!ai cari produk murah"]], ["Belanja Saya", ["!keranjang", "!wishlist", "!pesanan"]]] },
};
function userCategoryUi(key) {
  const c = USER_UI[key];
  if (!c) return null;
  const rows = c.rows.map(([id, title, desc]) => ({ id, title, desc }));
  const g = USER_UI_GROUPS[key];
  const sections = g ? g.groups.map(([t, ids]) => ({ title: t, rows: rows.filter((r) => ids.includes(r.id)) })).filter((s) => s.rows.length) : [{ title: c.title.replace(/^\S+\s/, ""), rows }];
  return { title: c.title, body: g?.body || "Silakan pilih fitur.", listLabel: g?.label || "☰ Pilih Menu", sections, buttons: [{ id: "!ui all", title: "↩️ Kembali" }, BACK] };
}
// Tombol lanjutan setelah halaman penting (semua ID = command existing).
const NAV_AFTER = {
  "!firepass": [["!fpmisi", "🎯 Misi"], ["!fptier", "🏆 Tier"], ["!fppremium", "⭐ Premium"], ["!fpriwayat", "📜 Riwayat"]],
  "!fpmisi": [["!firepass", "⬅️ Fire Pass"]],
  "!quest": [["!quest harian", "📅 Harian"], ["!quest mingguan", "📆 Mingguan"], ["!quest bulanan", "🗓️ Bulanan"], ["!quest klaimsemua", "🎁 Claim"]],
  "!anonstatus": [["!anonmatch", "🔎 Cari"], ["!anonfriends", "👥 Friends"], ["!anonpremium", "⭐ Premium"], ["!anonstop", "🛑 Stop"]],
  "!pesanan": [["!keranjang", "🛒 Keranjang"], ["!riwayat", "📜 Riwayat"]],
  "!referral": [["!ui akun", "⬅️ Akun"]],
  "!wishlist": [["!ui belanja", "⬅️ Belanja"]],
  "!keranjang": [["!ui belanja", "⬅️ Belanja"]],
  "!rodadiskon": [["!rodadiskon spin", "🎡 Spin"], ["!rodadiskon hadiah", "🎁 Hadiah"]],
  "!ruangku": [["!ruangku box", "🎁 Buka Kotak"]],
};
async function replyWithNav(client, jid, text, head, extraButtons, quoted) {
  const btns = [...(extraButtons || []), ...((NAV_AFTER[head] || []).map(([id, title]) => ({ id, title })))];
  if (!btns.length) return sendLongMessage(client, jid, text, quoted);
  btns.push(BACK);
  return sendUi(client, jid, { body: text, buttons: btns.slice(0, 8) }, quoted);
}
async function runStoreAi(jid, text, reply, session, actor) {
  if (rateLimited("ai:" + jid, 6, 60000)) return reply("⏳ Terlalu banyak permintaan. Coba lagi beberapa saat.");
  const h = aiHistory[jid] || [];
  const d = await superApi({ op: "ai", visitor_id: session?.visitor_id, text, history: h, actor });
  if (d.reply) { h.push({ role: "user", content: text }, { role: "assistant", content: d.reply }); aiHistory[jid] = h.slice(-8); }
  return reply(d.text || "❌ Terjadi kesalahan. Coba lagi.");
}
async function runGalau(jid, text, reply, actor) {
  if (rateLimited("galau:" + jid, 8, 60000)) return reply("⏳ Terlalu banyak permintaan. Coba lagi beberapa saat.");
  const g = galauMode[jid] || { history: [], at: Date.now() };
  const d = await superApi({ op: "galau", text, history: g.history, actor });
  if (d.reply) { g.history.push({ role: "user", content: text }, { role: "assistant", content: d.reply }); g.history = g.history.slice(-10); }
  g.at = Date.now(); galauMode[jid] = g;
  return reply(d.text || "❌ Terjadi kesalahan. Coba lagi.");
}
function startSuperBotTimers(client) {
  if (global.__superTimers) global.__superTimers.forEach(clearInterval);
  let busyA = false, busyN = false;
  const flush = async () => {
    if (!statBuf.length) return;
    const rows = statBuf.splice(0, 50);
    try { await api("wa_user", "POST", { op: "log", rows }); } catch {}
  };
  // Anon: teruskan pesan partner & kabari saat match ditemukan.
  const anonTick = async () => {
    if (busyA) return; busyA = true;
    try {
      for (const jid of Object.keys(anonMode)) {
        const m = anonMode[jid]; const s = userSessions[jid];
        if (!s || !s.visitor_id) { delete anonMode[jid]; continue; }
        const d = await superApi({ op: "anon_poll", visitor_id: s.visitor_id, since: m.since, actor: jid });
        if (!d.active) {
          if (!m.waiting) { delete anonMode[jid]; await client.sendMessage(jid, { text: "👋 Chat anonim telah berakhir." }).catch(() => {}); }
          else if (Date.now() - new Date(m.since).getTime() > 10 * 60000) { delete anonMode[jid]; await superApi({ op: "anon_stop", visitor_id: s.visitor_id }); await client.sendMessage(jid, { text: "⌛ Belum ada pasangan. Pencarian dihentikan, coba !anonmatch lagi." }).catch(() => {}); }
          continue;
        }
        if (m.waiting) { m.waiting = false; await client.sendMessage(jid, { text: "🎉 *MATCH!*\nPartner anonim ditemukan: *" + d.partner + "*\nKetik pesan biasa untuk mengobrol. !anonstop untuk akhiri." }).catch(() => {}); botStat("anonmatched", "anon_match", true, jid); }
        for (const msg of d.messages || []) {
          await client.sendMessage(jid, { text: "🕵️ *" + d.partner + ":* " + msg.text }).catch(() => {});
          m.since = msg.at;
        }
      }
    } finally { busyA = false; }
  };
  // Notifikasi pintar: maks 3 per 2 menit per nomor login, dari sistem notifikasi yang sudah ada.
  const notifTick = async () => {
    if (busyN || botConfig.features?.notif === false) return; busyN = true;
    try {
      for (const jid of Object.keys(userSessions)) {
        const s = userSessions[jid]; if (!s?.visitor_id) continue;
        const since = notifSince[jid] || new Date().toISOString();
        if (!notifSince[jid]) { notifSince[jid] = since; continue; }
        const d = await superApi({ op: "notif_poll", visitor_id: s.visitor_id, since, actor: jid });
        for (const it of d.items || []) { await client.sendMessage(jid, { text: it.text }).catch(() => {}); notifSince[jid] = it.at; await wait(1500); }
      }
    } finally { busyN = false; }
  };
  global.__superTimers = [setInterval(flush, 30000), setInterval(anonTick, 5000), setInterval(notifTick, 120000)];
}

function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = (rateHits[key] || []).filter((t) => now - t < windowMs);
  arr.push(now); rateHits[key] = arr;
  return arr.length > max;
}
async function refreshBotConfig() {
  try { const d = await adminApi({ op: "config" }, 10000); if (d.config) botConfig = d.config; } catch {}
}
async function sendAdminResult(client, jid, d, quoted) {
  if (d.text) await sendLongMessage(client, jid, d.text, quoted);
  if (d.file && d.file.content) {
    await client.sendMessage(jid, { document: Buffer.from(d.file.content, "utf8"), mimetype: "text/csv", fileName: d.file.name || "export.csv" }, { quoted });
  }
  if (Array.isArray(d.recipients) && d.recipients.length) {
    // Broadcast bertahap: 1 pesan / 3 detik agar WhatsApp tidak menandai spam.
    (async () => {
      let ok = 0, fail = 0;
      for (const p of d.recipients) {
        try { await client.sendMessage(p + "@s.whatsapp.net", { text: d.broadcastText || d.text.split("\n")[0] }); ok++; } catch { fail++; }
        await wait(3000);
      }
      try { await client.sendMessage(jid, { text: "📢 Broadcast WA selesai: " + ok + " terkirim, " + fail + " gagal." }); } catch {}
    })();
  }
  if (d.control === "reload") { Object.keys(adminCache).forEach((k) => delete adminCache[k]); await refreshBotConfig(); }
  if (d.control === "restart") { setTimeout(() => process.exit(1), 1500); }
}
async function runAdminAction(client, jid, phone, action, args, raw, quoted) {
  const d = await adminApi({ op: "run", actor_phone: phone, action, args, raw });
  if (d.needs_confirm && d.token) adminPending[jid] = { token: d.token, at: Date.now() };
  const _hi = args.findIndex((a) => String(a).toLowerCase() === "hal");
  const baseArgs = _hi >= 0 ? args.slice(0, _hi) : args;
  if (d.pages && d.pages > 1) adminLastList[jid] = { action, args: baseArgs, page: d.page || 1 };
  // UI interaktif: konfirmasi (broadcast/aksi sensitif) & pagination memakai alur server yang sama.
  if (d.needs_confirm && d.token) {
    return sendUi(client, jid, { title: "⚠️ KONFIRMASI", body: String(d.text || "").replace(/\n*Ketik \*KONFIRMASI\*[\s\S]*$/, ""), buttons: [{ id: "konfirmasi", title: "✅ KONFIRMASI" }, { id: "batal", title: "❌ BATAL" }], footer: "Berlaku 2 menit." }, quoted);
  }
  if (d.pages && d.pages > 1 && d.text && !d.file && !(Array.isArray(d.recipients) && d.recipients.length)) {
    const btns = [];
    if ((d.page || 1) > 1) btns.push({ id: "!" + action + " " + [...baseArgs, "hal", String((d.page || 1) - 1)].join(" "), title: "◀️ Sebelumnya" });
    if ((d.page || 1) < d.pages) btns.push({ id: "!next", title: "▶️ Berikutnya" });
    btns.push({ id: "!ui admin", title: "⬅️ Admin Center" });
    return sendUi(client, jid, { body: d.text + "\n\nHalaman " + (d.page || 1) + "/" + d.pages, buttons: btns }, quoted);
  }
  await sendAdminResult(client, jid, d, quoted);
}
async function startAdminBackground(client) {
  // Bootstrap admin pertama dari nomor bawaan ZIP (hanya jika server belum punya admin).
  try { await adminApi({ op: "bootstrap", numbers: ADMIN_NUMBERS.map((j) => String(j).split("@")[0]) }, 15000); } catch {}
  await refreshBotConfig();
  if (global.__adminTimers) global.__adminTimers.forEach(clearInterval);
  const beat = async () => {
    try {
      const d = await adminApi({ op: "heartbeat", health: { ...botHealth, version: BOT_VERSION, started_at: BOT_STARTED_AT, memory_mb: Math.round(process.memoryUsage().rss / 1048576), cpu_load: Math.round((os.loadavg()[0] || 0) * 100) / 100 } }, 15000);
      if (d.config) botConfig = d.config;
    } catch {}
  };
  const alerts = async () => {
    try {
      const d = await adminApi({ op: "alerts" }, 20000);
      for (const m of d.messages || []) { try { await client.sendMessage(m.phone + "@s.whatsapp.net", { text: "🔔 *ADMIN ALERT*\n" + m.text }); } catch {} await wait(1500); }
    } catch {}
  };
  beat();
  global.__adminTimers = [setInterval(beat, 60000), setInterval(alerts, 90000)];
}


// === CONFESS STATE ===
let _confessPollTimer = null;
let _confessChatTimer = null;
let _confessRevokeTimer = null;
let _confessReactionTimer = null;
let _confessEditTimer = null;
let _activeClient = null;
const _confessSent = new Set();
const _confessChatSent = new Set();
const _confessRevokeSent = new Set();
const _confessReactionSent = new Set();
const _confessEditSent = new Set();
// phone -> { trx_id, expires_at }
const _lastConfessByPhone = {};
// wa message id -> { jid, key } for revoke
const _waMsgKeys = {};

async function syncWaContactInfo(client, phoneDigits) {
  const jid = phoneDigits + "@s.whatsapp.net";
  let pic = null;
  let displayName = null;
  const peerJids = new Set();
  peerJids.add(jid);
  try { pic = await client.profilePictureUrl(jid, "image"); } catch {}
  try {
    const onWa = await client.onWhatsApp(jid);
    displayName = onWa?.[0]?.notify || null;
    // Simpan pemetaan LID -> nomor asli agar balasan penerima (yang dikirim
    // WhatsApp sebagai @lid) tetap bisa dicocokkan ke thread confess.
    const lid = onWa?.[0]?.lid;
    if (lid) {
      rememberLidPhone(lid, phoneDigits);
      peerJids.add(cleanJid(lid));
    }
    if (onWa?.[0]?.jid) peerJids.add(cleanJid(onWa[0].jid));
  } catch {}
  try {
    const mapper = client?.signalRepository?.lidMapping;
    const getter = mapper?.getLIDForPN || mapper?.getLidForPn || mapper?.getLIDForPn || mapper?.getLidForPN;
    if (getter) {
      const lid = await getter.call(mapper, jid);
      if (lid) rememberLidPhone(lid, phoneDigits);
      if (lid) peerJids.add(cleanJid(lid));
    }
  } catch {}
  try { await client.presenceSubscribe(jid); } catch {}
  await api("confess_presence_save", "POST", {
    phone: phoneDigits,
    profile_pic_url: pic,
    display_name: displayName,
    wa_peer_jids: [...peerJids].filter(Boolean),
  });
}

function isConnectionClosedError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("connection closed") || msg.includes("connection terminated") || msg.includes("timed out") || msg.includes("socket") || msg.includes("not open");
}

function extractWaMessageId(sent) {
  if (Array.isArray(sent)) return sent.find((x) => x?.key?.id)?.key?.id || null;
  return sent?.key?.id || null;
}

function cacheWaMessageKey(jid, sent) {
  const list = Array.isArray(sent) ? sent : [sent];
  for (const item of list) {
    if (item?.key?.id) _waMsgKeys[item.key.id] = { jid, key: item.key };
  }
}

function extractWaPeerJids(sent) {
  const list = Array.isArray(sent) ? sent : [sent];
  const out = new Set();
  for (const item of list) collectJidsFromValue(item?.key, out);
  return [...out];
}

const VIEW_ONCE_PREFIX = "__view_once__::";
function isViewOnceMedia(media) {
  return String(media?.name || "").startsWith(VIEW_ONCE_PREFIX);
}
function cleanMediaName(name) {
  return String(name || "file").replace(VIEW_ONCE_PREFIX, "");
}

function guessExtFromMime(mime, fallback) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("wav")) return "wav";
  return fallback || "bin";
}

function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic) return ffmpegStatic;
  } catch {}
  return "ffmpeg";
}

async function convertToWhatsAppVoice(buffer, mime) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aas-vn-"));
  const inputPath = path.join(tmpDir, "input." + guessExtFromMime(mime, "webm"));
  const outputPath = path.join(tmpDir, "voice.ogg");
  fs.writeFileSync(inputPath, buffer);
  try {
    await new Promise((resolve, reject) => {
      const ff = spawn(resolveFfmpegPath(), [
        "-y", "-hide_banner", "-loglevel", "error",
        "-i", inputPath,
        "-vn", "-ac", "1", "-ar", "48000",
        "-c:a", "libopus", "-b:a", "32k",
        "-f", "ogg", outputPath,
      ]);
      let err = "";
      ff.stderr.on("data", (d) => { err += d.toString(); });
      ff.on("error", reject);
      ff.on("close", (code) => code === 0 ? resolve() : reject(new Error(err || "ffmpeg gagal convert audio")));
    });
    return fs.readFileSync(outputPath);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

function getMessageContent(message) {
  let m = message || {};
  for (let i = 0; i < 4; i++) {
    if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
    else if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
    else if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
    else if (m.viewOnceMessageV2Extension?.message) m = m.viewOnceMessageV2Extension.message;
    else break;
  }
  return m;
}

async function sendConfessToWa(client, jid, text, media) {
  const body = String(text || "").slice(0, 4000);
  if (media?.url && media.type === "image") {
    // Gabung foto + teks jadi SATU pesan (caption) agar tidak terpisah di WhatsApp.
    // Caption WA dibatasi ~1024 karakter.
    const caption = body.slice(0, 1024);
    const payload = { image: { url: media.url }, caption: caption || undefined };
    if (isViewOnceMedia(media)) payload.viewOnce = true;
    const mediaMsg = await client.sendMessage(jid, payload);
    // Kalau teks melebihi batas caption, kirim sisanya sebagai pesan lanjutan.
    if (body.length > 1024) {
      const rest = await client.sendMessage(jid, { text: body.slice(1024) });
      return [mediaMsg, rest].filter(Boolean);
    }
    return mediaMsg;
  }
  if (media?.url && media.type === "video") {
    const textMsg = body ? await client.sendMessage(jid, { text: body }) : null;
    const payload = { video: { url: media.url }, caption: cleanMediaName(media.name) || undefined };
    if (isViewOnceMedia(media)) payload.viewOnce = true;
    const mediaMsg = await client.sendMessage(jid, payload);
    return [textMsg, mediaMsg].filter(Boolean);
  }
  if (media?.url && media.type === "audio") {
    const textMsg = body ? await client.sendMessage(jid, { text: body }) : null;
    // WhatsApp VN wajib OGG/Opus. Audio web biasanya WebM/Opus; kalau dikirim
    // dengan mimetype OGG tanpa konversi, WA menampilkan "audio tidak tersedia".
    let audioMsg;
    try {
      const resp = await fetch(media.url);
      const arr = await resp.arrayBuffer();
      const original = Buffer.from(arr);
      const converted = String(media.mime || "").toLowerCase().includes("ogg") ? original : await convertToWhatsAppVoice(original, media.mime || cleanMediaName(media.name));
      audioMsg = await client.sendMessage(jid, { audio: converted, ptt: true, mimetype: "audio/ogg; codecs=opus" });
    } catch (e) {
      console.error("VN convert/send error:", e?.message || e);
      // Fallback terakhir: jangan palsukan sebagai OGG; kirim sebagai audio biasa agar tidak corrupt.
      audioMsg = await client.sendMessage(jid, { audio: { url: media.url }, ptt: false, mimetype: media.mime || "audio/mpeg" });
    }
    return [textMsg, audioMsg].filter(Boolean);
  }

  if (media?.url) {
    const textMsg = body ? await client.sendMessage(jid, { text: body }) : null;
    const fileMsg = await client.sendMessage(jid, { document: { url: media.url }, fileName: cleanMediaName(media.name), mimetype: media.mime || "application/octet-stream" });
    return [textMsg, fileMsg].filter(Boolean);
  }
  if (!body) throw new Error("empty");
  return await client.sendMessage(jid, { text: body });
}

function resetConfessPollers() {
  if (_confessPollTimer) clearInterval(_confessPollTimer);
  if (_confessChatTimer) clearInterval(_confessChatTimer);
  if (_confessRevokeTimer) clearInterval(_confessRevokeTimer);
  if (_confessReactionTimer) clearInterval(_confessReactionTimer);
  if (_confessEditTimer) clearInterval(_confessEditTimer);
  _confessPollTimer = null;
  _confessChatTimer = null;
  _confessRevokeTimer = null;
  _confessReactionTimer = null;
  _confessEditTimer = null;
  _confessSent.clear();
  _confessChatSent.clear();
  _confessRevokeSent.clear();
  _confessReactionSent.clear();
  _confessEditSent.clear();
}

function startConfessOutbox(client) {
  if (_confessPollTimer) return;
  const tick = async () => {
    try {
      const res = await api("confess_outbox");
      const items = res?.data || [];
      for (const t of items) {
        if (client !== _activeClient) return;
        if (_confessSent.has(t.id)) continue;
        _confessSent.add(t.id);
        const conf = t.confessions || {};
        const sender = (conf.sender_name && String(conf.sender_name).trim()) || "Anonim";
        const text =
          "💌 *Confess Anonim untuk Kamu*\n" +
          "─────────────────────\n" +
          conf.message + "\n" +
          "─────────────────────\n" +
          "👤 Dari: *" + sender + "*\n" +
          "🆔 " + conf.trx_id + "\n\n" +
          "💬 Mau balas? Langsung ketik balasanmu di sini, atau ketik:\n*!balas isi balasanmu*\n(balasan akan diteruskan ke pengirim — identitas kamu hanya berupa nomor)";
        const phoneDigits = String(t.phone).replace(/\D/g, "");
        const jid = phoneDigits + "@s.whatsapp.net";
        try {
          await syncWaContactInfo(client, phoneDigits).catch(() => {});
          // Kartu CONFESS MASUK: hanya nama samaran — tanpa nomor/email/ID pengirim.
          try {
            const rn = (await confessRecipients([phoneDigits]))[0] || "Kamu";
            const at = fmtDT(conf.created_at || new Date());
            await sendConfessCard(client, jid, { kicker: "CONFESS MASUK", headline: "ADA CONFESS UNTUKMU",
              left: [["user", "Dari", sender], ["user", "Untuk", rn], ["id", "ID Confess", conf.trx_id || "-"]],
              right: [["money", "Biaya", "Dibayar pengirim"], ["clock", "Tanggal", at.date], ["clock", "Waktu", at.time], ["clock", "Masa chat", "24 jam"]],
              status: "PESAN BARU", statusColor: "pink", note: "Balas langsung di chat ini.", footer: ["Pesan ini dikirim melalui layanan Confess Agung Adi Store.", "Balas untuk lanjut • ketik !stopconfess untuk mengakhiri."] }, "💌 CONFESS MASUK • AGUNG ADI STORE", null);
          } catch (e) { console.log("[confess-in-card] gagal:", e?.message); }
          const sent = await sendConfessToWa(client, jid, text, { url: t.media_url, type: t.media_type, name: t.media_name, mime: t.media_mime });
          // Simpan ke cache untuk auto-reply tanpa !balas (TTL 30 menit)
          _lastConfessByPhone[phoneDigits] = {
            trx_id: conf.trx_id,
            expires_at: Date.now() + 30 * 60 * 1000,
          };
          // Track key untuk revoke
          cacheWaMessageKey(jid, sent);
          const peerJids = rememberSentMessagePhone(sent, phoneDigits);
          await api("confess_mark_sent", "POST", { target_id: t.id, success: true, wa_message_id: extractWaMessageId(sent), target_phone: phoneDigits, wa_peer_jids: peerJids.length ? peerJids : extractWaPeerJids(sent) });
          // Sinkron foto profil + last seen + presence subscribe
          syncWaContactInfo(client, phoneDigits).catch(() => {});
        } catch (err) {
          _confessSent.delete(t.id);
          if (!isConnectionClosedError(err)) {
            await api("confess_mark_sent", "POST", { target_id: t.id, success: false, error: String(err?.message || err).slice(0, 200) });
          } else {
            console.log("⚠️ Confess belum terkirim karena koneksi WA tertutup, akan retry otomatis.");
          }
        }
        await wait(800);
      }
    } catch {}
  };
  tick();
  _confessPollTimer = setInterval(tick, 12000);
}

// Kirim pesan lanjutan dari web (chat thread) ke WA
function startConfessChatOutbox(client) {
  if (_confessChatTimer) return;
  const tick = async () => {
    try {
      const res = await api("confess_chat_outbox");
      const items = res?.data || [];
      for (const m of items) {
        if (client !== _activeClient) return;
        if (_confessChatSent.has(m.id)) continue;
        _confessChatSent.add(m.id);
        const thread = m.confess_threads || {};
        const phoneDigits = String(thread.target_phone || "").replace(/\D/g, "");
        if (!phoneDigits) {
          await api("confess_chat_mark_sent", "POST", { message_id: m.id, success: false, error: "no phone" });
          continue;
        }
        const jid = phoneDigits + "@s.whatsapp.net";
        try {
          await syncWaContactInfo(client, phoneDigits).catch(() => {});
          const body = String(m.text || "").slice(0, 4000);
          const sent = await sendConfessToWa(client, jid, body, { url: m.media_url, type: m.media_type, name: m.media_name, mime: m.media_mime });
          const waId = extractWaMessageId(sent);
          cacheWaMessageKey(jid, sent);
          const peerJids = rememberSentMessagePhone(sent, phoneDigits);
          await api("confess_chat_mark_sent", "POST", { message_id: m.id, success: true, wa_message_id: waId, target_phone: phoneDigits, wa_peer_jids: peerJids.length ? peerJids : extractWaPeerJids(sent) });
          // Refresh cache TTL
          _lastConfessByPhone[phoneDigits] = {
            trx_id: _lastConfessByPhone[phoneDigits]?.trx_id || null,
            expires_at: Date.now() + 30 * 60 * 1000,
          };
        } catch (err) {
          _confessChatSent.delete(m.id);
          if (!isConnectionClosedError(err)) {
            await api("confess_chat_mark_sent", "POST", { message_id: m.id, success: false, error: String(err?.message || err).slice(0, 200) });
          } else {
            console.log("⚠️ Chat Confess belum terkirim karena koneksi WA tertutup, akan retry otomatis.");
          }
        }
        await wait(600);
      }
    } catch {}
  };
  tick();
  _confessChatTimer = setInterval(tick, 6000);
}

// Poll pesan yang dihapus di web → revoke di WA
function startConfessRevokePoller(client) {
  if (_confessRevokeTimer) return;
  const tick = async () => {
    try {
      const res = await api("confess_pending_revokes");
      const items = res?.data || [];
      const done = [];
      for (const it of items) {
        if (_confessRevokeSent.has(it.id)) continue;
        const waId = it.wa_message_id;
        const phone = (it.confess_threads?.target_phone || "").replace(/\D/g, "");
        const cached = _waMsgKeys[waId];
        try {
          if (cached) {
            await client.sendMessage(cached.jid, { delete: cached.key });
          } else if (phone) {
            // Fallback: dummy key (fromMe true)
            const jid = phone + "@s.whatsapp.net";
            await client.sendMessage(jid, { delete: { id: waId, remoteJid: jid, fromMe: true } });
          }
          _confessRevokeSent.add(it.id);
          done.push(it.id);
        } catch (err) {
          // ignore; akan diretry kalau masih dalam window
        }
        await wait(300);
      }
      if (done.length) await api("confess_mark_revoked", "POST", { ids: done });
    } catch {}
  };
  tick();
  _confessRevokeTimer = setInterval(tick, 8000);
}

function startConfessReactionPoller(client) {
  if (_confessReactionTimer) return;
  const tick = async () => {
    try {
      const res = await api("confess_pending_reactions");
      const items = res?.data || [];
      const done = [];
      for (const it of items) {
        // Tidak pakai dedupe permanen: backend sudah gate via reaction_wa_sent_at.
        // Ini penting agar UBAH/HAPUS reaksi ikut tersinkron ke WA (bukan sekali saja).
        const waId = it.wa_message_id;
        const phone = (it.confess_threads?.target_phone || "").replace(/\D/g, "");
        const jid = phone ? phone + "@s.whatsapp.net" : null;
        const cached = _waMsgKeys[waId];
        try {
          const key = cached?.key || (jid ? { id: waId, remoteJid: jid, fromMe: true } : null);
          if (key && (cached?.jid || jid)) await client.sendMessage(cached?.jid || jid, { react: { text: it.reaction || "", key } });
          done.push(it.id);
        } catch {}
        await wait(250);
      }
      if (done.length) await api("confess_mark_reaction_sent", "POST", { ids: done });
    } catch {}
  };
  tick();
  _confessReactionTimer = setInterval(tick, 5000);
}

function startConfessEditPoller(client) {
  if (_confessEditTimer) return;
  const tick = async () => {
    try {
      const res = await api("confess_pending_edits");
      const items = res?.data || [];
      const done = [];
      for (const it of items) {
        // Tanpa dedupe permanen: backend gate via wa_edit_sent_at, sehingga
        // pesan bisa diedit BERKALI-KALI (bukan cuma sekali).
        const waId = it.wa_message_id;
        const phone = (it.confess_threads?.target_phone || "").replace(/\D/g, "");
        const jid = phone ? phone + "@s.whatsapp.net" : null;
        const cached = _waMsgKeys[waId];
        try {
          const key = cached?.key || (jid ? { id: waId, remoteJid: jid, fromMe: true } : null);
          if (key && (cached?.jid || jid)) {
            try {
              await client.sendMessage(cached?.jid || jid, { text: String(it.text || "").slice(0, 4000), edit: key });
            } catch {
              await client.sendMessage(cached?.jid || jid, { text: "✏️ *Pesan diedit:*\n" + String(it.text || "").slice(0, 3900) });
            }
          }
          done.push(it.id);
        } catch {}
        await wait(300);
      }
      if (done.length) await api("confess_mark_edit_sent", "POST", { ids: done });
    } catch {}
  };
  tick();
  _confessEditTimer = setInterval(tick, 5000);
}




async function sendLongMessage(client, jid, text, quoted) {
  const message = String(text || "").trim();
  if (!message) return;
  if (message.length <= MAX_TEXT_CHUNK) {
    await client.sendMessage(jid, { text: message }, { quoted });
    return;
  }

  let rest = message;
  while (rest.length > MAX_TEXT_CHUNK) {
    let cut = rest.lastIndexOf("\n", MAX_TEXT_CHUNK);
    if (cut < 1200) cut = MAX_TEXT_CHUNK;
    await client.sendMessage(jid, { text: rest.slice(0, cut).trim() }, { quoted });
    rest = rest.slice(cut).trim();
  }

  if (rest) {
    await client.sendMessage(jid, { text: rest }, { quoted });
  }
}

function parseResetToken(value) {
  const cleaned = String(value || "").trim();
  if (!/^#?\d{5}$/.test(cleaned)) return null;
  return cleaned.replace("#", "");
}

async function fetchPaymentSettings() {
  const res = await api("admin_settings");
  const rows = res.data || [];
  const settings = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value || ""]));
  let ewallets = [];
  try { ewallets = JSON.parse(settings.ewallets || "[]"); } catch { ewallets = []; }
  const dana = ewallets.find((item) => String(item.name || "").toLowerCase().includes("dana"));
  return {
    qrisUrl: settings.qris_url || "",
    danaName: dana?.name || "DANA",
    danaNumber: dana?.number || "085769302532",
  };
}

async function getLatestPendingDeposit(session, remoteJid) {
  if (!session?.visitor_id) return null;
  const res = await api("deposits");
  const deposit = (res.data || [])
    .filter((dep) => dep.visitor_id === session.visitor_id && String(dep.status || "").toLowerCase() === "pending")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
  if (deposit) pendingDeposits[remoteJid] = deposit;
  else delete pendingDeposits[remoteJid];
  return deposit;
}

// ── Kartu deposit: semua data dari database (deposit_detail / respons server), bukan dari teks chat ──
const DEP_WEB = String(process.env.DEPOSIT_WEB || "agungadistore.lovable.app");
function waJidFromPhone(p) { const d = String(p || "").replace(/\D/g, "").replace(/^0/, "62"); return /^62\d{8,13}$/.test(d) ? d + "@s.whatsapp.net" : null; }
function depCardData(dep, user, extra) {
  const ts = new Date((extra && extra.at) || dep.processed_at || dep.proof_received_at || dep.created_at || Date.now());
  const bal = Number(user?.balance || 0);
  return {
    username: user?.username || dep.username || "", phone: user?.phone || (extra && extra.phone) || "", email: user?.email || "",
    trxId: dep.trx_id || "-", amount: fmtRp(dep.amount), method: String(dep.payment_method || "-").toUpperCase(),
    balanceBefore: fmtRp(extra && extra.before != null ? extra.before : bal),
    balanceAfter: fmtRp(extra && extra.after != null ? extra.after : bal + Number(dep.amount || 0)),
    date: ts.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "long", year: "numeric" }),
    time: ts.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) + " WIB",
    reason: (extra && extra.reason) || dep.cancel_reason || "", web: DEP_WEB, owner: OWNER_LOCAL,
  };
}
// ── BotWaCardRenderer helper: render terisolasi + fallback teks; tidak pernah menyentuh koneksi/socket ──
const fmtDT = (v) => { if (!v) return null; const d = new Date(v); if (isNaN(d)) return null; return { date: d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "long", year: "numeric" }), time: d.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replace(/\./g, ":") + " WIB" }; };
const dtText = (v) => { const x = fmtDT(v); return x ? x.date + " • " + x.time : "Belum ada"; };
const CARD_BASE = () => ({ web: DEP_WEB, owner: OWNER_LOCAL });
async function sendRenderedCard(client, jid, renderFn, caption, fallbackText, quoted) {
  let png = null;
  try { png = renderFn ? renderFn() : null; } catch (e) { console.log("[card] render gagal:", e?.message); }
  try {
    if (png) { await client.sendMessage(jid, { image: png, caption }, quoted ? { quoted } : undefined); return true; }
    await client.sendMessage(jid, { text: fallbackText || caption }, quoted ? { quoted } : undefined); return false;
  } catch (e) { console.log("[card] kirim gagal:", e?.message); return false; }
}
async function safePhoto(client, jid) { try { return cardRender?.fetchProfilePhoto ? await cardRender.fetchProfilePhoto(client, jid) : null; } catch { return null; } }
// Cegah "Cannot derive from empty media key": unduh hanya jika mediaKey ada.
function hasMediaKey(msg) {
  const m = msg?.message || {}; const inner = m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.ephemeralMessage?.message || m;
  const media = inner.imageMessage || inner.audioMessage || inner.videoMessage || inner.documentMessage || inner.stickerMessage;
  const k = media?.mediaKey; return Boolean(k && (k.length || Object.keys(k).length));
}
// ── Kartu Confess: satu renderer (renderInfoCard) untuk semua tahap; gagal → teks. Tidak menyentuh socket. ──
const maskPhoneC = (p) => { const d = String(p || "").replace(/\D/g, ""); const l = d.startsWith("62") ? "0" + d.slice(2) : d; return l.length > 6 ? l.slice(0, 4) + "****" + l.slice(-4) : "****"; };
const confessPriceFor = (n, p) => { if (!p) return null; if (n === 1) return Number(p.price1); if (n === 2) return Number(p.price2); if (n === 3) return Number(p.price3); if (n <= 5) return 6000; if (n <= 10) return 7000; if (n <= 15) return 8000; return null; };
async function confessAccount(session) { try { const ac = await api("account_card&visitor_id=" + session.visitor_id); return ac?.user || null; } catch { return null; } }
async function confessRecipients(phones) {
  try { const r = await api("confess_recipient_info&phones=" + encodeURIComponent(phones.join(","))); return (r?.data || []).map((x) => x.name).filter(Boolean); } catch { return []; }
}
const recipText = (phones) => phones.slice(0, 2).map(maskPhoneC).join(", ") + (phones.length > 2 ? " +" + (phones.length - 2) : "");
const recipNameText = (names, phones) => names.length ? names.slice(0, 2).join(", ") + (phones.length > names.length ? " +" + (phones.length - names.length) + " anonim" : "") : "Anonim / Belum terdaftar";
async function sendConfessCard(client, jid, o, caption, fallback, quoted) {
  return sendRenderedCard(client, jid, () => cardRender?.renderInfoCard?.({ ...CARD_BASE(), color: o.color || "pink", kicker: o.kicker, headline: o.headline, left: o.left, right: o.right, status: o.status, statusColor: o.statusColor, note: o.note, footer: o.footer || ["AGUNG ADI STORE • CONFESS"] }), caption, fallback || caption, quoted);
}
async function fetchDepositDetail(trxId) {
  try { const r = await api("deposit_detail&trx_id=" + encodeURIComponent(trxId)); return r?.deposit ? { deposit: r.deposit, user: r.user || null } : null; } catch { return null; }
}
// Render terisolasi: gagal render → kirim teks; transaksi tidak pernah ikut gagal.
async function sendDepositCard(client, jid, kind, data, caption, quoted) {
  let png = null;
  try { png = cardRender && cardRender.renderDepositCard ? cardRender.renderDepositCard(kind, data) : null; } catch (e) { console.log("[deposit-card] render gagal:", e?.message); }
  try {
    if (png) await client.sendMessage(jid, { image: png, caption }, quoted ? { quoted } : undefined);
    else await client.sendMessage(jid, { text: caption }, quoted ? { quoted } : undefined);
    return true;
  } catch (e) { console.log("[deposit-card] kirim gagal:", e?.message); return false; }
}

async function sendDepositInstructions(client, remoteJid, quotedMsg, deposit) {
  const settings = await fetchPaymentSettings().catch(() => ({ qrisUrl: "", danaName: "DANA", danaNumber: "" }));
  const method = String(deposit.payment_method || "").trim().toUpperCase();
  const detail = await fetchDepositDetail(deposit.trx_id);
  const dep = detail?.deposit || deposit;
  const data = depCardData(dep, detail?.user, { phone: phoneFromJid(remoteJid) });
  const caption = [
    "✅ *Deposit Dibuat!*", "",
    "🆔 ID: " + data.trxId, "💰 Nominal: " + data.amount, "💳 Metode: " + method,
    "💵 Saldo Awal: " + data.balanceBefore, "📈 Saldo Setelah Deposit: " + data.balanceAfter,
    "📌 Status: 🟡 PENDING", "",
    "📸 Setelah bayar ketik *bukti* lalu kirim foto bukti transfer.",
    "📋 Cek status: !cekdeposit " + data.trxId,
  ].join("\n");
  await sendDepositCard(client, remoteJid, "pending", data, caption, quotedMsg);

  if (method === "QRIS") {
    if (!settings.qrisUrl) return client.sendMessage(remoteJid, { text: "QRIS belum diatur admin. Sementara buka web: " + WEB_URL }).catch(() => {});
    // QRIS asli dari pengaturan admin (tidak dibuat ulang), ditempel ke kartu pembayaran.
    let png = null;
    try {
      const qr = cardRender?.fetchImageBuffer ? await cardRender.fetchImageBuffer(settings.qrisUrl) : null;
      if (qr && cardRender.renderPaymentCard) png = cardRender.renderPaymentCard(data, qr);
    } catch (e) { console.log("[payment-card] gagal:", e?.message); }
    const payCap = "📱 *Pembayaran QRIS* — " + data.amount + "\nScan QRIS untuk membayar, lalu kirim foto bukti pembayaran.";
    try { await client.sendMessage(remoteJid, png ? { image: png, caption: payCap } : { image: { url: settings.qrisUrl }, caption: payCap }); } catch (e) { console.log("[payment-card] kirim gagal:", e?.message); }
    return;
  }
  await client.sendMessage(remoteJid, { text: "📱 *Pembayaran " + method + "*\nTransfer ke:\n👤 Nama: " + settings.danaName + "\n📞 Nomor: " + settings.danaNumber + "\n\nSetelah bayar, kirim foto bukti pembayaran di chat ini." }).catch(() => {});
}

// Bukti foto: simpan dulu ke server (storage + deposit), BARU kartu user & ADMIN ALERT + foto. Saldo tidak disentuh.
async function sendDepositProofToAdmin(client, remoteJid, msg, session, deposit) {
  if (!hasMediaKey(msg)) throw new Error("Foto bukti tidak bisa diunduh (kirim ulang sebagai foto biasa, bukan sekali lihat/terusan)");
  const buffer = await client.downloadMediaMessage(msg);
  if (!buffer || !buffer.length) throw new Error("Bukti pembayaran kosong");
  const mime = msg.message?.imageMessage?.mimetype || "image/jpeg";
  const saved = await api("deposit_proof", "POST", { visitor_id: session.visitor_id, trx_id: deposit.trx_id, image_base64: Buffer.from(buffer).toString("base64"), mime });
  if (saved?.error || !saved?.deposit) throw new Error(saved?.error || "Bukti gagal disimpan");
  const data = depCardData(saved.deposit, saved.user, { phone: phoneFromJid(remoteJid), at: saved.deposit.proof_received_at });

  await sendDepositCard(client, remoteJid, "proof", data, "✅ *Bukti pembayaran diterima*\n🆔 " + data.trxId + "\n🟡 Status: MENUNGGU KONFIRMASI ADMIN\n\nMohon tunggu admin melakukan pengecekan.", msg);

  const alert = [
    "🔔 *ADMIN ALERT*", "🔔 *DEPOSIT — BUKTI BARU*", "",
    "👤 Username: " + (data.username || "-"), "📱 WhatsApp: " + (data.phone || "belum terbaca (ID privat/LID)"), "📧 Email: " + (data.email || "Belum tersedia"),
    "🆔 Deposit: " + data.trxId, "💰 Nominal: " + data.amount, "💵 Saldo Awal: " + data.balanceBefore, "💳 Metode: " + data.method,
    "🟡 Status: PENDING", "📅 Waktu: " + data.date + " " + data.time, "",
    "✅ !konfirmasi " + data.trxId, "❌ !tolakdeposit " + data.trxId + " [alasan]",
  ].join("\n");
  for (const adminJid of ADMIN_NUMBERS) {
    try { await client.sendMessage(adminJid, { image: buffer, caption: alert }); } catch (e) { console.log("[admin-alert] foto gagal:", e?.message); }
    await sendDepositCard(client, adminJid, "admin", data, "🧾 Kartu deposit " + data.trxId);
  }
}

// Kirim kartu hasil (success/rejected) ke WA pemilik deposit (nomor dari database).
async function notifyDepositResult(client, kind, res, reason) {
  const dep = res?.deposit; if (!dep) return null;
  const data = depCardData(dep, res.user, { before: res.balance_before ?? dep.balance_before, after: res.balance_after ?? dep.balance_after, reason, at: dep.processed_at });
  const jid = waJidFromPhone(res.user?.phone);
  const cap = kind === "success"
    ? "✅ *DEPOSIT BERHASIL*\n🆔 " + data.trxId + "\n💵 Saldo Sebelum: " + data.balanceBefore + "\n➕ Deposit: " + data.amount + "\n💰 Saldo Sekarang: " + data.balanceAfter + (res.bonus ? "\n🎁 Bonus Saldo IN: " + fmtRp(res.bonus) : "")
    : "❌ *DEPOSIT DITOLAK*\n🆔 " + data.trxId + "\n💰 " + data.amount + "\nAlasan: " + (data.reason || "-") + "\n\nSilakan hubungi admin apabila membutuhkan bantuan.";
  if (jid) await sendDepositCard(client, jid, kind, data, cap);
  return { data, jid, cap };
}

// Helper: resolve username/identifier to visitor_id
async function resolveVid(identifier) {
  if (!identifier) return null;
  const res = await api("balances");
  const users = res.data || [];
  const exact = users.find((u) => String(u.username || "").toLowerCase() === identifier.toLowerCase());
  if (exact) return exact;
  const partial = users.find((u) => String(u.username || "").toLowerCase().includes(identifier.toLowerCase()));
  if (partial) return partial;
  const byVid = users.find((u) => u.visitor_id === identifier);
  return byVid || null;
}

// Helper: find product by short ID (#XXXXX) or name or UUID
async function findProduct(query) {
  const res = await api("products");
  const products = res.data || [];
  // Check short ID format
  if (/^#?\d{3,5}$/.test(query)) {
    const targetShort = query.startsWith("#") ? query : "#" + query;
    const found = products.find((p) => shortId(p.id) === targetShort);
    if (found) return found;
  }
  // Check UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(query.toLowerCase());
  if (isUuid) {
    const found = products.find((p) => p.id === query);
    if (found) return found;
  }
  // Check name
  const found = products.find((p) => p.title.toLowerCase().includes(query.toLowerCase()));
  return found || null;
}

// Helper: setup game timer warnings
function setupGameTimerWarnings(jid, game, replyFn) {
  // Clear existing timers
  clearGameTimerWarnings(jid);
  const warnings = [];
  const totalSec = game.timerSeconds || 90;
  const warnAt = [30, 20, 10];
  warnAt.forEach((sec) => {
    const delay = (totalSec - sec) * 1000;
    if (delay > 0 && delay < totalSec * 1000) {
      const timer = setTimeout(async () => {
        if (userSessions[jid + "_game"]) {
          try { await replyFn("⏱️ *Sisa waktu: " + sec + " detik!*"); } catch {}
        }
      }, delay);
      warnings.push(timer);
    }
  });
  gameTimerWarnings[jid] = warnings;
}

function clearGameTimerWarnings(jid) {
  if (gameTimerWarnings[jid]) {
    gameTimerWarnings[jid].forEach((t) => clearTimeout(t));
    delete gameTimerWarnings[jid];
  }
}

// State koneksi lintas socket (pola Renzona): satu socket aktif, satu jadwal reconnect.
const conn = { current: null, reconnecting: false, attempt: 0, badSessionStreak: 0, pairingCycles: 0, stopped: false };

function stopReconnect(lines) {
  conn.stopped = true;
  for (const l of lines) console.log(l);
  console.log("   Bot berhenti mencoba reconnect otomatis.\n");
}

function scheduleReconnect(authChoice, delayMs, reason) {
  if (conn.reconnecting || conn.stopped) return; // cegah dua socket berebut sesi
  conn.reconnecting = true;
  console.log("🔄 " + reason + " Sambung ulang dalam " + Math.round(delayMs / 1000) + " detik...");
  setTimeout(() => {
    connectToWhatsApp(authChoice, conn.attempt).catch((error) => {
      conn.reconnecting = false;
      conn.attempt++;
      console.error("❌ Gagal reconnect:", error?.message || error);
      scheduleReconnect(authChoice, Math.min(RECONNECT_BASE_MS * 2 ** conn.attempt, RECONNECT_MAX_MS), "Mencoba lagi.");
    });
  }, delayMs);
}

async function connectToWhatsApp(authChoice, attempt = 0) {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_session");
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = undefined; } // gagal → pakai versi bawaan library
  // Tutup socket lama dulu supaya tidak ada dua koneksi memakai auth_session yang sama.
  if (conn.current) { try { conn.current.ev.removeAllListeners("connection.update"); conn.current.end(undefined); } catch {} }
  const client = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: WA_BROWSER,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 20_000,
    connectTimeoutMs: 30_000,
  });
  conn.current = client;
  conn.reconnecting = false;

  const phoneNum = normalizePairingPhone(authChoice.phoneNum);
  let pairingRequested = false; // lock: satu permintaan kode per socket
  let pairingCodeShown = false;
  let qrShown = false;
  let connectingLogged = false;

  async function requestPairingCodeOnce() {
    if (authChoice.mode !== "pairing" || pairingRequested || client.authState?.creds?.registered) return;
    if (!phoneNum) throw new Error("Nomor WhatsApp untuk pairing belum diisi!");
    pairingRequested = true;
    console.log("⏳ Menyiapkan pairing...");
    await wait(3000); // socket perlu siap dulu (pola Renzona)
    let code = null;
    for (let i = 1; i <= PAIRING_MAX_TRIES && !code; i++) {
      if (conn.current !== client) return; // socket sudah diganti
      try {
        code = await client.requestPairingCode(phoneNum);
      } catch (error) {
        console.log("⚠️ Gagal meminta kode (percobaan " + i + "/" + PAIRING_MAX_TRIES + "): " + (error?.message || error));
        if (i < PAIRING_MAX_TRIES) await wait(3000 * i);
      }
    }
    if (!code) {
      console.log("\n❌ Gagal mendapatkan kode pairing.\n\nKemungkinan penyebab:\n• koneksi internet/server\n• nomor tidak dapat dipairing saat ini\n• sesi lama bermasalah\n• versi Baileys tidak kompatibel\n");
      pairingRequested = false;
      conn.attempt++;
      try { client.end(undefined); } catch {}
      return; // close event menjadwalkan socket baru
    }
    pairingCodeShown = true;
    // Kode asli dari Baileys dipakai apa adanya; tanda "-" hanya untuk tampilan.
    const shown = formatPairingCode(code);
    const pad = Math.max(0, Math.floor((38 - shown.length) / 2));
    console.log("\n╭──────────────────────────────────────╮");
    console.log("│       📲 KODE PAIRING WHATSAPP       │");
    console.log("├──────────────────────────────────────┤");
    console.log("│                                      │");
    console.log("│" + " ".repeat(pad) + shown + " ".repeat(38 - pad - shown.length) + "│");
    console.log("│                                      │");
    console.log("╰──────────────────────────────────────╯\n");
    console.log("📱 Nomor: " + phoneNum + "\n");
    console.log("Buka WhatsApp di HP nomor tersebut:");
    console.log("→ Perangkat tertaut → Tautkan perangkat");
    console.log("→ Tautkan dengan nomor telepon");
    console.log("→ Masukkan kode di atas.\n");
    console.log("⏳ Menunggu konfirmasi...\n");
  }

  client.ev.on("creds.update", saveCreds);

  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    const isRegistered = Boolean(client.authState?.creds?.registered);

    if (connection === "connecting" && !connectingLogged) {
      connectingLogged = true;
      console.log(attempt === 0 ? "🔌 Menghubungkan ke server WhatsApp..." : "🔌 Menghubungkan ulang ke server WhatsApp...");
    }

    // Event qr pertama = socket siap menerima permintaan pairing (QR tidak ditampilkan di mode pairing).
    if (qr && authChoice.mode === "pairing" && !isRegistered) {
      requestPairingCodeOnce().catch((error) => console.error("❌ Gagal pairing:", error?.message || error));
    }

    if (qr && authChoice.mode === "qr" && !isRegistered) {
      qrShown = true;
      console.log("\n" + "=".repeat(40));
      console.log("  📷 SCAN QR DI BAWAH INI");
      console.log("=".repeat(40));
      qrcode.generate(qr, { small: true });
      console.log("✅ Buka WhatsApp > Perangkat tertaut > Tautkan perangkat");
      console.log("⏳ Jika QR expired, bot akan tunggu QR baru otomatis.\n");
    }

    if (connection === "open") {
      conn.attempt = 0; conn.badSessionStreak = 0; conn.pairingCycles = 0;
      _activeClient = client;
      resetConfessPollers();
      const myNum = String(client.user?.id || "").split(":")[0].split("@")[0];
      console.log("\n✅ WhatsApp berhasil terhubung!\n");
      console.log("🤖 Agung Adi Store Bot siap digunakan. (v" + BOT_VERSION + ")");
      console.log("Nomor: " + (myNum || "-"));
      console.log("📋 Kirim !help di chat untuk lihat perintah\n");
      startConfessOutbox(client);
      startSuperBotTimers(client);
      startConfessChatOutbox(client);
      startConfessRevokePoller(client);
      startConfessReactionPoller(client);
      startConfessEditPoller(client);
      botHealth.status = "open";
      startAdminBackground(client).catch(() => {});
      // Presence updates → sinkron ke web
      client.ev.on("presence.update", async ({ id, presences }) => {
        try {
          const phone = String(id || "").replace(/\D/g, "");
          if (!phone || !presences) return;
          const p = presences[id] || Object.values(presences)[0];
          if (!p) return;
          const presence = p.lastKnownPresence || null; // available|composing|recording|paused|unavailable
          const lastSeen = p.lastSeen ? new Date(p.lastSeen * 1000).toISOString() : null;
          await api("confess_presence_save", "POST", { phone, presence, last_seen_at: lastSeen });
        } catch {}
      });
      // Revoke dari WA → tandai dihapus di web
      client.ev.on("messages.update", async (updates) => {
        for (const u of updates || []) {
          try {
            const isRevoke = u.update?.messageStubType === 2 || u.update?.message === null;
            if (!isRevoke) continue;
            const waId = u.key?.id;
            if (!waId) continue;
            await api("confess_revoke_message", "POST", { wa_message_id: waId, deleted_by: "wa" });
          } catch {}
        }
      });
      return;
    }

    if (connection === "close") {
      if (conn.current !== client) return; // socket lama yang sengaja diganti
      botHealth.status = "close";
      botHealth.reconnect_count++;
      const reason = lastDisconnect?.error?.output?.statusCode;
      const message = getDisconnectMessage(lastDisconnect);
      if (_activeClient === client) {
        _activeClient = null;
        resetConfessPollers();
      }
      const R = DisconnectReason;

      if (reason === R.loggedOut) {
        return stopReconnect(["\n❌ Session WhatsApp sudah logout.", "   Untuk membuat sesi baru:", "   rm -rf auth_session", "   npm start"]);
      }
      if (reason === R.connectionReplaced) {
        return stopReconnect(["\n❌ Sesi ini digantikan koneksi lain yang memakai auth_session yang sama.", "   Pastikan hanya SATU bot yang berjalan, lalu jalankan ulang: npm start"]);
      }
      if (reason === R.forbidden) {
        return stopReconnect(["\n❌ WhatsApp menolak koneksi (forbidden). Nomor kemungkinan dibatasi/diblokir WhatsApp."]);
      }
      if (reason === R.multideviceMismatch) {
        return stopReconnect(["\n❌ Versi protokol WhatsApp tidak cocok. Jalankan: npm install @whiskeysockets/baileys@latest"]);
      }
      if (reason === R.restartRequired) {
        // Normal sesaat setelah kode pairing/QR diterima → langsung sambung tanpa menunggu.
        console.log("🔄 Perangkat tertaut, server meminta restart (normal). Menyambung...");
        conn.attempt = 0;
        return scheduleReconnect(authChoice, 500, "");
      }
      if (reason === R.badSession) {
        conn.badSessionStreak++;
        if (conn.badSessionStreak >= BAD_SESSION_LIMIT) {
          return stopReconnect(["\n❌ Session bermasalah (" + conn.badSessionStreak + "x berturut-turut).", "   Buat sesi baru: rm -rf auth_session lalu npm start"]);
        }
        conn.attempt++;
        return scheduleReconnect(authChoice, Math.min(RECONNECT_BASE_MS * 2 ** conn.attempt, RECONNECT_MAX_MS), "Sesi terbaca bermasalah (" + conn.badSessionStreak + "/" + BAD_SESSION_LIMIT + "), dicoba lagi.");
      }
      conn.badSessionStreak = 0;

      if (!isRegistered && authChoice.mode === "pairing") {
        // Socket pairing ditutup server = kode lama tidak berlaku lagi.
        conn.pairingCycles++;
        if (conn.pairingCycles > 5) {
          return stopReconnect(["\n❌ Kode pairing tidak dimasukkan setelah beberapa kali dibuat.", "   Jalankan ulang: npm start"]);
        }
        if (pairingCodeShown) console.log("\n⏳ Kode pairing sudah expired. JANGAN pakai kode lama.\n🔄 Membuat kode baru...");
        return scheduleReconnect(authChoice, RECONNECT_BASE_MS, "");
      }
      if (!isRegistered && authChoice.mode === "qr") {
        conn.attempt++;
        if (conn.attempt > MAX_RECONNECT_ATTEMPTS) return stopReconnect(["\n❌ QR tidak dipindai. Jalankan ulang: npm start"]);
        return scheduleReconnect(authChoice, RECONNECT_BASE_MS, qrShown ? "QR expired, membuat QR baru." : "QR belum tampil.");
      }

      // connectionClosed / connectionLost / timedOut / unavailableService / lainnya → backoff.
      conn.attempt++;
      const label = { [R.connectionClosed]: "Koneksi ditutup", [R.connectionLost]: "Koneksi hilang (cek internet)", [R.timedOut]: "Koneksi timeout", [R.unavailableService]: "Server WhatsApp sedang tidak tersedia" }[reason] || ("Koneksi terputus (kode " + (reason ?? "?") + ": " + message + ")");
      scheduleReconnect(authChoice, Math.min(RECONNECT_BASE_MS * 2 ** (conn.attempt - 1), RECONNECT_MAX_MS), label + ".");
    }
  });

  client.ev.on("contacts.upsert", (contacts) => {
    for (const contact of contacts || []) rememberContactPhone(contact);
  });

  client.ev.on("contacts.update", (contacts) => {
    for (const contact of contacts || []) rememberContactPhone(contact);
  });

  client.ev.on("lid-mapping.update", (mapping) => {
    rememberLidMapping(mapping);
  });

  client.ev.on("messaging-history.set", ({ contacts, lidPnMappings }) => {
    for (const contact of contacts || []) rememberContactPhone(contact);
    for (const mapping of lidPnMappings || []) rememberLidMapping(mapping);
  });

  if (authChoice.mode === "pairing" && !client.authState?.creds?.registered) {
    requestPairingCodeOnce().catch((error) => {
      console.error("❌ Gagal memulai pairing:", error?.stack || error?.message || error);
    });
  }

  // Batas error per pesan: perintah/tombol yang gagal hanya membalas pesan error, socket tetap hidup.
  const onUpsert = (fn) => client.ev.on("messages.upsert", async (arg) => {
    try { await fn(arg); } catch (error) {
      console.error("[COMMAND ERROR]", error?.stack || error);
      const jid = arg?.messages?.[0]?.key?.remoteJid;
      if (jid && !arg?.messages?.[0]?.key?.fromMe) client.sendMessage(jid, { text: "❌ Terjadi kesalahan saat memproses permintaan.\nSilakan coba lagi." }).catch(() => {});
    }
  });
  onUpsert(async ({ messages }) => {
    const msg = messages?.[0];
    const remoteJid = msg?.key?.remoteJid;

    if (!msg?.message || msg.key?.fromMe || !remoteJid || remoteJid === "status@broadcast") {
      return;
    }

    const content = getMessageContent(msg.message);
    // ID pesan yang dibalas (quote). Dipakai untuk mencocokkan balasan confess
    // ke thread yang benar walau nomor pengirim tidak terbaca (LID privat).
    const _ctxInfo =
      content.extendedTextMessage?.contextInfo ||
      content.imageMessage?.contextInfo ||
      content.videoMessage?.contextInfo ||
      content.audioMessage?.contextInfo ||
      content.documentMessage?.contextInfo ||
      null;
    const quotedWaId = _ctxInfo?.stanzaId || null;
    const text =
      content.conversation ||
      content.extendedTextMessage?.text ||
      content.imageMessage?.caption ||
      "";
    // UI interaktif: tombol/list mengirim ID yang berupa command existing.
    const uiPickedId = extractInteractiveId(content);
    let plainText = String(uiPickedId || text).trim();
    // Normalisasi prefix perintah: ".menu" / "/menu" → "!menu" (huruf setelah tanda)
    if (/^[./][a-zA-Z]/.test(plainText)) {
      plainText = "!" + plainText.slice(1);
    }
    // Fallback teks: balasan angka memilih opsi menu terakhir (10 menit), kecuali sedang di alur lain.
    if (!uiPickedId && /^\d{1,2}$/.test(plainText) && uiState[remoteJid] && Date.now() - uiState[remoteJid].at < 600000
      && !chatFlows[remoteJid] && !pinPending[remoteJid] && !(anonMode[remoteJid] && !anonMode[remoteJid].waiting) && !(galauMode[remoteJid] && Date.now() - galauMode[remoteJid].at < 30 * 60000)) {
      const picked = uiState[remoteJid].options[Number(plainText) - 1];
      if (picked) plainText = picked;
    }
    const lowerText = plainText.toLowerCase();

    // Prioritas: command global (diawali !) → batal → tombol → flow aktif → teks biasa.
    // Command global keluar dari flow aktif (tidak pernah dibaca sebagai password/nilai).
    if (/^!(menu|start|allmenu|help|bantuan)\b/i.test(plainText)) { delete chatFlows[remoteJid]; delete pinPending[remoteJid]; }
    // Batal universal: hapus semua status input sementara milik JID ini saja.
    if (/^[!./]?(batal|cancel)$/i.test(plainText)) {
      const had = Boolean(chatFlows[remoteJid] || pinPending[remoteJid] || adminPending[remoteJid]);
      const cfDraft = (String(chatFlows[remoteJid]?.type || "").startsWith("confess_") && chatFlows[remoteJid]) || (pinPending[remoteJid]?.endpoint === "confess_send" && pinPending[remoteJid]);
      if (cfDraft) {
        delete chatFlows[remoteJid]; delete pinPending[remoteJid];
        const sess = userSessions[remoteJid]; const u = sess ? await confessAccount(sess) : null; const now = fmtDT(new Date());
        await sendConfessCard(client, remoteJid, { color: "red", kicker: "CONFESS DIBATALKAN", headline: "PROSES DIBATALKAN",
          left: [["id", "ID", cfDraft.body?.trx_id || "Draft (belum ada ID)"], ["money", "Saldo", fmtRp(u?.balance ?? sess?.balance ?? 0), "#7de3ff"]],
          right: [["clock", "Tanggal", now.date], ["clock", "Waktu", now.time]], status: "DIBATALKAN", statusColor: "red", note: "Saldo tidak dipotong.", footer: ["Proses Confess dibatalkan.", "AGUNG ADI STORE • CONFESS"] }, "AGUNG ADI STORE • Confess dibatalkan", "❌ Confess dibatalkan.", msg);
        return;
      }
      delete chatFlows[remoteJid]; delete pinPending[remoteJid]; delete adminPending[remoteJid];
      if (typeof pendingDeposits === "object" && pendingDeposits) delete pendingDeposits[remoteJid];
      return sendUi(client, remoteJid, { body: had ? "❎ Proses dibatalkan." : "ℹ️ Tidak ada proses yang sedang berjalan.", quick: [BACK] }, msg);
    }
    // Flow kedaluwarsa: hapus dan beri tahu (hanya bila pesan bukan command).
    for (const [store, label] of [[chatFlows, "input"], [pinPending, "PIN"]]) {
      const f = store[remoteJid];
      if (f && f.expiresAt && Date.now() > f.expiresAt) {
        delete store[remoteJid];
        if (!plainText.startsWith("!")) return sendUi(client, remoteJid, { body: "🕐 Sesi " + label + " sudah berakhir.\n\nSilakan ulangi command.", quick: [BACK] }, msg);
      }
    }

    const session = userSessions[remoteJid] || null;
    rememberLidPhone(remoteJid, msg?.key?.remoteJidAlt || msg?.key?.participantAlt || msg?.key?.participant);
    const senderPhone = resolveKnownConfessPhone(msg, remoteJid, quotedWaId, content) || (await resolveSenderPhoneAsync(client, msg, remoteJid)) || resolveKnownConfessPhone(msg, remoteJid, quotedWaId, content);
    const displaySenderPhone = senderPhone || "belum terbaca (WhatsApp mengirim ID privat/LID)";
    const command = lowerText;
    const rawArgs = plainText.split(/\s+/).slice(1);
    const args = rawArgs;
    const _t0 = Date.now();
    let _statDone = false;
    const reply = async (t) => {
      if (!_statDone && plainText.startsWith("!")) { _statDone = true; botStat(plainText.split(/\s+/)[0].toLowerCase(), "user", !/^❌/.test(String(t)), senderPhone || remoteJid, Date.now() - _t0); }
      return sendLongMessage(client, remoteJid, t, msg);
    };

    // Helper: start purchase flow - ask for PIN (defined di scope handler agar
    // bisa dipakai oleh confess flow maupun command lain, di dalam/luar try block)
    const startPurchaseFlow = (endpoint, body, successMsgFn) => {
      pinPending[remoteJid] = { endpoint, body, successMsg: successMsgFn, session };
      return reply("🔐 *Masukkan PIN 6 digit untuk konfirmasi:*\n\n(Ketik PIN langsung, contoh: 123456)\n\n❌ PIN salah? Ketik !resetpin untuk reset\n🚫 Batal? Ketik !batal");
    };



    // ═══ ADMIN CENTER GATE (v11): identitas → role → permission → validasi → audit (di server) ═══
    try {
      const head = command.split(/\s+/)[0];
      const isCmd = head.startsWith("!");
      const actor = senderPhone && (isCmd || adminPending[remoteJid] || /^(konfirmasi|ya|batal)$/.test(lowerText)) ? await adminWhoami(senderPhone, remoteJid) : null;
      const amAdmin = Boolean(actor && actor.admin);

      // Konfirmasi aksi berbahaya
      if (adminPending[remoteJid] && /^(konfirmasi|ya|batal)$/.test(lowerText)) {
        const p = adminPending[remoteJid]; delete adminPending[remoteJid];
        if (lowerText === "batal") return reply("❎ Aksi dibatalkan.");
        if (Date.now() - p.at > 120000) return reply("⌛ Konfirmasi kedaluwarsa. Ulangi perintah.");
        const d = await adminApi({ op: "confirm", actor_phone: senderPhone, token: p.token });
        await sendAdminResult(client, remoteJid, d, msg);
        return;
      }

      // Maintenance / bot OFF: user biasa diblokir, admin tetap bisa.
      if (isCmd && !amAdmin && (botConfig.maintenance || botConfig.bot_enabled === false)) {
        return reply(botConfig.maintenance ? "🔧 Bot sedang dalam maintenance." : "🔴 Bot sedang nonaktif. Coba lagi nanti.");
      }

      // ═══ UI INTERAKTIF (v12.2): menu user & Admin Center berbasis role ═══
      if (head === "!menu" || head === "!start" || (head === "!ui" && (!args[0] || args[0] === "main"))) {
        // Data milik JID pengirim saja: sesi per JID, saldo realtime per visitor_id, foto profil per JID.
        const bu = await freshBalanceUser(session);
        if (bu && session) { session.balance = bu.balance; session.username = bu.username; }
        const shopName = String(botConfig.bot_name || "Agung Adi Store Super Bot").toUpperCase();
        const waName = (session && session.username) || msg.pushName || "Kak";
        const regName = (session && session.username) || "";
        const displayName = String(msg.pushName || regName || "").trim() || "Pengguna WhatsApp";
        const balText = session ? fmtRp(bu ? bu.balance : session.balance) : "Login untuk melihat";
        const welcome = [
          "🤖 *" + shopName + "*", "",
          "👋 Welcome, *" + displayName + "*",
          "📱 WhatsApp: " + (senderPhone || "-"),
          session ? "💰 Saldo: *" + balText + "* • 🔐 Terhubung" : "🔐 Belum login",
          "",
          "✨ Silakan pilih menu lewat tombol di bawah.",
          "🌐 " + WEB_HOST, "",
          "🛡️ Gunakan bot dengan bijak. Jangan spam & jangan salahgunakan fitur.",
          "🐞 Temukan bug? Laporkan ke owner.", "",
          "👑 Owner: " + OWNER_LOCAL,
          "© Agung Adi Store",
        ].join("\n");
        let photo = false;
        if (cardRender?.renderWelcomeV2) {
          const pp = await safePhoto(client, remoteJid);
          const features = Object.values(USER_UI).map((u) => String(u.title).replace(/^[^A-Za-z0-9]+/, "").trim()).filter(Boolean);
          const commands = [[".menu", "Menu utama"], [".profil", "Profil akun"], [".saldo", "Cek saldo"], [".deposit", "Isi saldo"], [".cekdeposit", "Status deposit"], [".riwayat", "Riwayat transaksi"], [".confess", "Kirim confess"], [".riwayatconfess", "Riwayat confess"], [".allmenu", "Semua fitur"]];
          photo = await sendRenderedCard(client, remoteJid, () => cardRender.renderWelcomeV2({ ...CARD_BASE(), version: BOT_VERSION, photo: pp, registered: Boolean(session), accountName: regName, waName: msg.pushName || "", phone: senderPhone, balance: balText, email: bu?.email || "", status: session ? "Akun aktif" : "Belum terdaftar", features, commands }), "AGUNG ADI STORE • " + (session ? "Akun aktif" : "Belum terdaftar"), null, msg);
        }
        if (!photo) photo = await sendUserCard(client, remoteJid, "welcome", { name: regName || displayName, phone: senderPhone, balanceText: balText, status: session ? "Terhubung" : "Belum login" }, welcome, msg);
        const R = (k, ids) => USER_UI[k].rows.filter(([id]) => !ids || ids.includes(id)).map(([id, title, desc]) => ({ id, title, desc }));
        const sections = [
          { title: "Menu Utama", rows: [
            { id: "!ui profil", title: "📱 Profil", desc: "Cek profil, PIN, nama, email" },
            { id: "!ui saldo", title: "💰 Saldo", desc: "Saldo, deposit, riwayat" },
            { id: "!ui belanja", title: "🛍️ Belanja", desc: "Produk, kategori, keranjang" },
            { id: "!pesanan", title: "📦 Pesanan", desc: "Pesanan saya" },
            { id: "!ui game", title: "🎮 Game" },
            { id: "!ui firepass", title: "🔥 Fire Pass" },
            { id: "!ui reward", title: "🎁 Reward" },
            { id: "!ui ai", title: "🤖 AI" },
            { id: "!ui anon", title: "👻 Anon Chat" },
            { id: "!ui confess", title: "💌 Confess" },
          ] },
          { title: "Lainnya", rows: [
            { id: "!ui musik", title: "🎵 Musik" },
            { id: "!ui support", title: "🎫 Tiket" },
            { id: "!ui akun", title: "⚙️ Akun" },
            { id: "!syarat", title: "📚 Syarat & Ketentuan" },
            { id: "!ui owner", title: "👑 Owner" },
            { id: "!allmenu", title: "📚 Semua Fitur" },
          ] },
        ];
        const btns = [];
        if (amAdmin) btns.push({ id: "!ui admin", title: "🛠️ Admin Center", desc: "Khusus admin" });
        const quick = session
          ? [{ id: "!profilku", title: "👤 Profil" }, { id: "!saldoku", title: "💰 Saldo" }, { id: "!ui belanja", title: "🛒 Belanja" }]
          : [{ id: "!login", title: "🔑 Login" }, { id: "!daftar", title: "📝 Daftar" }, { id: "!allmenu", title: "📚 Semua Menu" }];
        // Foto terkirim → pesan tombol cukup singkat; foto tidak ada → seluruh kartu ada di pesan tombol.
        return sendUi(client, remoteJid, { body: photo ? "👋 Hai " + waName + ", silakan pilih menu:" : welcome, listLabel: "☰ Pilih Menu", sections, buttons: btns, quick, links: [OWNER_LINK] }, msg);
      }
      if (head === "!ui" && args[0] === "all") {
        const rows = Object.entries(USER_UI).map(([k, c]) => ({ id: "!ui " + k, title: c.title }));
        return sendUi(client, remoteJid, { title: "☰ SEMUA KATEGORI", body: "Pilih kategori:", listLabel: "☰ Kategori", sections: [{ title: "Kategori", rows }], buttons: [BACK] }, msg);
      }
      // .allmenu = direktori command per kategori (berbeda dari .menu).
      if (head === "!allmenu" && args[0] !== "teks") {
        if (args[0] === "admin") return amAdmin ? sendUi(client, remoteJid, { body: "🛡️ Buka Admin Center untuk command sesuai role kamu.", quick: [{ id: "!ui admin", title: "🛡️ Admin Center" }, { id: "!allmenu", title: "🔙 Kembali" }, BACK] }, msg) : reply("❌ Akses ditolak. Menu ini khusus admin.");
        const cat = ALL_MENU[args[0]];
        if (!cat) {
          const rows = Object.entries(ALL_MENU).map(([k, c]) => ({ id: "!allmenu " + k, title: c[0], desc: c[1].length + " command" }));
          if (amAdmin) rows.push({ id: "!allmenu admin", title: "🛡️ Admin", desc: "Sesuai role" });
          return sendUi(client, remoteJid, { title: "📚 SEMUA MENU", body: "🤖 " + String(botConfig.bot_name || "Agung Adi Store Super Bot") + "\n\nPilih kategori untuk melihat command-nya.", listLabel: "☰ Pilih Kategori",
            sections: [{ title: "Kategori", rows: rows.slice(0, 8) }, { title: "Kategori Lain", rows: rows.slice(8) }], buttons: [BACK] }, msg);
        }
        const PER = 8, page = Math.max(1, Number(args[1]) || 1), pages = Math.ceil(cat[1].length / PER);
        const items = cat[1].slice((page - 1) * PER, page * PER);
        const body = items.map(([c, d]) => "`" + c + "`\n" + d).join("\n\n") + (pages > 1 ? "\n\nHalaman " + page + "/" + pages : "");
        const tap = items.filter(([c]) => !/^\.|teks$/.test(c)).map(([c, d]) => ({ id: c, title: c, desc: d }));
        const nav = [];
        if (page > 1) nav.push({ id: "!allmenu " + args[0] + " " + (page - 1), title: "⬅️ Sebelumnya" });
        if (page < pages) nav.push({ id: "!allmenu " + args[0] + " " + (page + 1), title: "➡️ Berikutnya" });
        nav.push({ id: "!allmenu", title: "🔙 Kembali" }, BACK);
        return sendUi(client, remoteJid, { title: cat[0].toUpperCase(), body, listLabel: "☰ Jalankan Command", sections: tap.length ? [{ title: "Jalankan", rows: tap }] : [], buttons: nav }, msg);
      }
      if (head === "!help") {
        return sendUi(client, remoteJid, { title: "🤖 BANTUAN AGUNG ADI STORE", body: [
          "Cara menggunakan bot:", "",
          "1️⃣ Ketik *.menu*", "2️⃣ Pilih kategori", "3️⃣ Pilih fitur", "4️⃣ Ikuti instruksi", "",
          "Contoh:", ".profilku", ".saldoku", ".produk", ".cari pulsa", ".allmenu", "",
          "Ada masalah? Hubungi owner: " + OWNER_WA,
        ].join("\n"), quick: [{ id: "!ui main", title: "☰ Menu Utama" }, { id: "!allmenu", title: "📚 Semua Menu" }, { id: "!syarat", title: "📜 Syarat" }], links: [OWNER_LINK] }, msg);
      }
      if (head === "!ui" && args[0] === "owner") {
        return sendUi(client, remoteJid, { title: "👑 OWNER AGUNG ADI STORE", body: "Jika kamu mengalami:\n\n• Bug\n• Kendala akun\n• Kendala transaksi\n• Kendala bot\n• Kendala fitur\n\nSilakan hubungi owner.\n\n📱 " + OWNER_LOCAL, quick: [{ id: "!buattiket", title: "🐞 Lapor Bug" }, BACK], links: [OWNER_LINK] }, msg);
      }
      if (head === "!ui" && USER_UI[args[0]]) return sendUi(client, remoteJid, userCategoryUi(args[0]), msg);
      if (head === "!ui" && args[0] === "admin" || (head === "!admin" && !args.length)) {
        // Server memfilter kategori/command sesuai role; user biasa selalu ditolak di server juga.
        if (!amAdmin) return reply("❌ Akses ditolak. Menu ini khusus admin.");
        const d = await adminApi({ op: "menu_ui", actor_phone: senderPhone });
        if (!d || d.denied || !Array.isArray(d.sections)) return reply(d?.text || "❌ Akses ditolak.");
        const sel = args[0] === "admin" ? args[1] : null;
        if (sel) {
          const s = d.sections.find((x) => x.id === sel);
          if (!s) return reply("❌ Kategori tidak tersedia untuk role kamu.");
          const rows = s.rows.map((r) => ({ id: r.id, title: r.title, desc: r.desc }));
          const secs = []; for (let i = 0; i < rows.length; i += 10) secs.push({ title: s.title + (i ? " (" + (i / 10 + 1) + ")" : ""), rows: rows.slice(i, i + 10) });
          return sendUi(client, remoteJid, { title: "🛡️ " + s.title + (s.feature_on ? "" : " [OFF]"), body: "Role: *" + d.role + "*\nCommand bertanda • butuh parameter — ketik manual sesuai format.", sections: secs.slice(0, 3), buttons: [{ id: "!ui admin", title: "↩️ Kembali" }] }, msg);
        }
        const quick = [["14", "📊 Dashboard", "!dashboard"], ["16", "⚙️ System", "!botstatus"]].filter(([id]) => d.sections.some((x) => x.id === id)).map(([, title, id]) => ({ id, title }));
        return sendUi(client, remoteJid, { title: "🛡️ ADMIN CENTER", body: "Status Bot: 🟢 ONLINE" + (d.maintenance ? " • 🔧 MAINTENANCE" : "") + "\nRole: *" + d.role + "*", listLabel: "☰ Kategori Admin",
          sections: [{ title: "Kategori", rows: d.sections.slice(0, 10).map((s) => ({ id: "!ui admin " + s.id, title: s.title, desc: s.rows.length + " command" })) }].concat(d.sections.length > 10 ? [{ title: "Lainnya", rows: d.sections.slice(10).map((s) => ({ id: "!ui admin " + s.id, title: s.title, desc: s.rows.length + " command" })) }] : []),
          buttons: [...quick, { id: "!ui admin", title: "🔄 Refresh" }, BACK] }, msg);
      }
      if (head === "!ui") return reply("❓ Menu tidak dikenal. Ketik !menu");


      // Rate limit per nomor & per command
      if (isCmd) {
        const max = amAdmin ? (actor.role === "super_admin" ? 90 : 40) : 20;
        if (rateLimited("n:" + remoteJid, max, 60000)) return;
        if (rateLimited("c:" + remoteJid + head, amAdmin ? 15 : 8, 60000)) return reply("⏳ Terlalu cepat. Tunggu sebentar sebelum mengulang " + head);
      }

      if (head === "!next" && adminLastList[remoteJid] && amAdmin) {
        const l = adminLastList[remoteJid];
        return runAdminAction(client, remoteJid, senderPhone, l.action, [...l.args, "hal", String(l.page + 1)], l.args.join(" "), msg);
      }

      const actionName = head.slice(1);
      // Command bersama: user biasa → versi user; admin → versi admin hanya jika memberi argumen target.
      const buyerOrderSub = actionName === "pesanan" && ["detail", "terima", "batal"].includes(String(args[0] || "").toLowerCase());
      const sharedToUser = buyerOrderSub || (SHARED_USER_COMMANDS.has(actionName) && (!amAdmin || (USER_FIRST_COMMANDS.has(actionName) && !args.length)));
      if (isCmd && ADMIN_ACTIONS.has(actionName) && !sharedToUser) {
        if (!amAdmin) return reply("❌ Akses ditolak. Perintah ini khusus admin.");
        const raw = plainText.slice(head.length).trim();
        return runAdminAction(client, remoteJid, senderPhone, actionName, args, raw, msg);
      }

      // Command admin lama tetap dijalankan kode lama, tapi harus lolos cek role di server.
      const legacyHead = head === "!stok" && command.startsWith("!stoksponsor") ? "!stoksponsor" : head;
      if (isCmd && LEGACY_ADMIN_COMMANDS.has(legacyHead) && !(legacyHead === "!game" && !args[0]) && !(legacyHead === "!notif" && !args.length)) {
        if (!amAdmin) return reply("❌ Akses ditolak.");
        const g = await adminApi({ op: "legacy", actor_phone: senderPhone, command: legacyHead, args: args.slice(0, 4) }, 15000);
        if (!g.allowed) return reply(g.text || "❌ Akses ditolak.");
      }
    } catch (gateErr) {
      botHealth.message_errors++;
      botHealth.last_error = String(gateErr?.message || gateErr).slice(0, 200);
      if (command.startsWith("!")) {
        const h = command.split(/\s+/)[0].slice(1);
        if (ADMIN_ACTIONS.has(h) || LEGACY_ADMIN_COMMANDS.has("!" + h)) return reply("❌ Sistem sedang mengalami gangguan. Silakan coba lagi.");
      }
    }

    // ── Reaksi / hapus dari WhatsApp → sinkron ke web ──
    if (content.reactionMessage?.key?.id) {
      await api("confess_save_wa_reaction", "POST", {
        wa_message_id: content.reactionMessage.key.id,
        emoji: content.reactionMessage.text || null,
      });
      return;
    }
    if (content.protocolMessage?.type === 0 && content.protocolMessage?.key?.id) {
      await api("confess_revoke_message", "POST", { wa_message_id: content.protocolMessage.key.id, deleted_by: "wa" });
      return;
    }

    // Handle pending PIN input (for purchases)
    if (pinPending[remoteJid] && !plainText.startsWith("!")) {
      const pending = pinPending[remoteJid];
      delete pinPending[remoteJid];
      const pinInput = plainText;
      if (!/^\d{6}$/.test(pinInput)) {
        return client.sendMessage(remoteJid, { text: "❌ PIN harus 6 digit angka.\n\n🔄 Ulangi perintah pembelian." }, { quoted: msg });
      }
      // Re-execute the purchase with PIN
      try {
        const res = await api(pending.endpoint, "POST", { ...pending.body, pin: pinInput });
        const errMsg = apiError(res);
        if (errMsg) return client.sendMessage(remoteJid, { text: "❌ " + errMsg + "\n\n💡 PIN salah? Ketik *!resetpin* untuk reset." }, { quoted: msg });
        if (apiNeedPin(res)) return client.sendMessage(remoteJid, { text: "🔐 PIN masih diperlukan. Ulangi perintah pembelian." }, { quoted: msg });
        const pd = apiData(res);
        let txt = pending.successMsg(pd);
        // Update session balance
        if (pending.session && pd.balance_remaining !== undefined) {
          pending.session.balance = pd.balance_remaining;
          userSessions[remoteJid] = pending.session;
        }
        return client.sendMessage(remoteJid, { text: txt }, { quoted: msg });
      } catch (err) {
        return client.sendMessage(remoteJid, { text: "❌ Error: " + (err.message || err) }, { quoted: msg });
      }
    }

    // ═══ SUPER BOT (v12): Fire Pass • Anon Chat • Store AI • Bot Galau • Pesanan ═══
    {
      const head = command.split(/\s+/)[0];
      const restText = plainText.replace(/^!\S+\s*/, "").trim();
      const vid = session?.visitor_id;
      const who = senderPhone || remoteJid;
      const needFeature = (f, label) => botConfig.features && botConfig.features[f] === false ? reply("⛔ Fitur " + label + " sedang dinonaktifkan admin.") : null;
      const simple = { "!firepass": "fp_status", "!fptier": "fp_tiers", "!fppremium": "fp_premium", "!fpriwayat": "fp_history", "!fpmisi": "fp_missions",
        "!anonstatus": "anon_status", "!anonfriends": "anon_friends", "!pesanan": "orders", "!order": "orders" };
      // ── v12.1: fitur website existing yang sebelumnya belum ada di WA ──
      const extraOps = { "!referral": "referral", "!ref": "referral", "!wishlist": "wishlist", "!rodadiskon": "rodadiskon", "!quest": "quest",
        "!lagaquest": "lagaquest", "!premium": "premium", "!ruangku": "ruangku", "!anonpremium": "anonpremium", "!keranjang": "cart",
        "!review": "review", "!dispute": "dispute", "!orderchat": "orderchat" };
      if (head === "!toko" && args.length) extraOps["!toko"] = "toko";
      if ((head === "!pesanan" || head === "!order") && ["detail", "terima", "batal"].includes(String(args[0] || "").toLowerCase())) extraOps[head] = "order_action";
      if (extraOps[head]) {
        if (head === "!anonpremium") { const b = needFeature("anon", "Anon Chat"); if (b) return b; }
        const argList = plainText.replace(/^!\S+\s*/, "").trim().split(/\s+/).filter(Boolean);
        const d = await superApi({ op: extraOps[head], visitor_id: vid, args: argList, actor: who });
        botStat(head, "user", !!d.text && !/^❌/.test(d.text), who, 0);
        return replyWithNav(client, remoteJid, d.text || "❌ Terjadi kesalahan. Coba lagi.", argList.length ? head + " " + argList[0] : head, d.buttons, msg);
      }
      if (simple[head]) {
        if (head.startsWith("!fp") || head === "!firepass") { const b = needFeature("firepass", "Fire Pass"); if (b) return b; }
        if (head.startsWith("!anon")) { const b = needFeature("anon", "Anon Chat"); if (b) return b; }
        const d = await superApi({ op: simple[head], visitor_id: vid, actor: who });
        botStat(head, "user", !!d.text && !/^❌/.test(d.text), who, 0);
        return replyWithNav(client, remoteJid, d.text || "❌ Terjadi kesalahan. Coba lagi.", head, d.buttons, msg);
      }
      if (head === "!fpclaim") {
        const b = needFeature("firepass", "Fire Pass"); if (b) return b;
        if (!args[0]) return reply("⚠️ Format: !fpclaim [ID misi] (lihat !fpmisi)");
        const d = await superApi({ op: "fp_claim", visitor_id: vid, mission_id: args[0], actor: who });
        return reply(d.text || "❌ Terjadi kesalahan. Coba lagi.");
      }
      if (head === "!anon") {
        const b = needFeature("anon", "Anon Chat"); if (b) return b;
        const st = await superApi({ op: "anon_status", visitor_id: vid, actor: who });
        if (st.active) { anonMode[remoteJid] = { since: new Date().toISOString(), visitor_id: vid }; return reply(st.text); }
        return reply(["🕵️ *ANON CHAT*", "", "1. 🔎 Cari pasangan — !anonmatch", "2. 👤 Profil anon — !anonprofile", "3. 💬 Chat aktif — !anonstatus", "4. 👥 Teman — !anonfriends", "5. 🚫 Block/Report — di website (Anon Chat)", "6. ⚙️ Pengaturan — !anonprofile [nickname]", "", "!anonstop — akhiri chat / batal cari", "🔒 Identitas kamu (nomor, email, nama akun) tidak pernah dibagikan."].join("\n"));
      }
      if (head === "!anonmatch") {
        const b = needFeature("anon", "Anon Chat"); if (b) return b;
        const d = await superApi({ op: "anon_match", visitor_id: vid, actor: who });
        if (d.matched || d.queued) anonMode[remoteJid] = { since: new Date().toISOString(), visitor_id: vid, waiting: !!d.queued };
        return reply(d.text || "❌ Terjadi kesalahan. Coba lagi.");
      }
      if (head === "!anonstop") {
        delete anonMode[remoteJid];
        const d = await superApi({ op: "anon_stop", visitor_id: vid, actor: who });
        return reply(d.text || "👋 Selesai.");
      }
      if (head === "!anonprofile") {
        const d = await superApi({ op: "anon_profile", visitor_id: vid, nickname: restText, actor: who });
        return reply(d.text || "❌ Terjadi kesalahan. Coba lagi.");
      }
      if (head === "!ai" || head === "!storeai") {
        const b = needFeature("ai", "Store AI"); if (b) return b;
        if (!restText) return reply("🤖 *Store AI*\nContoh:\n• !ai cari diamond 20 ribuan\n• !ai berapa saldo saya\n• !ai status fire pass saya\n• !ai ada voucher apa\n• !ai cek tiket saya");
        return runStoreAi(remoteJid, restText, reply, session, senderPhone);
      }
      if (head === "!galau" || head === "!curhat") {
        const b = needFeature("galau", "Bot Galau"); if (b) return b;
        galauMode[remoteJid] = galauMode[remoteJid] || { history: [], at: Date.now() };
        if (!restText) return reply("💔 *Bot Galau* aktif. Ceritakan saja apa yang kamu rasakan — pesan berikutnya langsung ke Bot Galau.\n\n!galaureset — mulai ulang • !galaustop — keluar • !galauhelp");
        return runGalau(remoteJid, restText, reply, senderPhone);
      }
      if (head === "!galaureset") { galauMode[remoteJid] = { history: [], at: Date.now() }; return reply("🔄 Percakapan Bot Galau dimulai ulang."); }
      if (head === "!galaustop") { delete galauMode[remoteJid]; return reply("👋 Keluar dari Bot Galau. Semoga harimu lebih baik 💙"); }
      if (head === "!galauhelp") return reply("💔 *Bot Galau*\n• !galau [cerita] — mulai curhat\n• Pesan biasa berikutnya otomatis ke Bot Galau (30 menit)\n• !galaureset — hapus konteks\n• !galaustop — keluar\n\nKonteks hanya untuk nomormu sendiri & tidak disimpan permanen.");
      if (head === "!confesshelp") return reply("💌 *Confess*\n• !confess — kirim confess anonim (login)\n• !confess 08xxx | pesan — cepat\n• !balas [pesan] — balas confess yang kamu terima\n• !stopconfess — hentikan chat confess\n• !confessstatus — status fitur\n\n🔒 Identitas pengirim tidak pernah ditampilkan.");
      if (head === "!confessstatus") { const d = await superApi({ op: "confess_status", actor: who }); return reply(d.text || "-"); }

      // Mode percakapan: pesan biasa diteruskan ke Anon Chat / Bot Galau
      if (!plainText.startsWith("!") && plainText && !chatFlows[remoteJid]) {
        if (anonMode[remoteJid] && !anonMode[remoteJid].waiting) {
          const d = await superApi({ op: "anon_send", visitor_id: vid, text: plainText, actor: who });
          if (!d.ok) { if (d.text) { delete anonMode[remoteJid]; return reply(d.text); } }
          return;
        }
        if (galauMode[remoteJid] && Date.now() - galauMode[remoteJid].at < 30 * 60000) return runGalau(remoteJid, plainText, reply, senderPhone);
      }
    }

    // ── CONFESS REPLY (publik, tanpa perlu login) ──
    if (lowerText.startsWith("!balas")) {
      const isi = plainText.slice(6).trim();
      if (!isi) return reply("⚠️ Format: *!balas isi balasanmu*\n\nContoh: *!balas halo siapa kamu?*");
      let wa_profile_pic_url = null, wa_display_name = null;
      try { wa_profile_pic_url = await client.profilePictureUrl(remoteJid, "image").catch(() => null); } catch {}
      try { wa_display_name = msg.pushName || null; } catch {}
      const r = await api("confess_reply", "POST", { from_phone: senderPhone, from_jid: remoteJid, peer_jids: collectMessagePeerJids(msg, remoteJid, content), reply_text: isi, wa_message_id: msg.key?.id || null, quoted_wa_message_id: quotedWaId, wa_profile_pic_url, wa_display_name });
      const d = r?.data || r;
      if (d?.stopped) return reply("ℹ️ Chat Confess sebelumnya sudah dihentikan. Kalau ada confess baru masuk, sekarang sistem akan membuka ulang otomatis.");
      if (!d?.matched) return reply("❌ Tidak ada confess aktif untuk nomor ini.\n(Balasan hanya bisa untuk confess yang baru kamu terima dalam 30 hari terakhir.)");
      return reply("✅ Balasan kamu terkirim ke pengirim confess (" + (d.sender_name || "Anonim") + ")\n🆔 " + d.trx_id);
    }

    // ── STOP CONFESS: penerima menghentikan chat confess ──
    if (lowerText === "stopconfess" || lowerText === "!stopconfess" || lowerText === "stop confess") {
      const r = await api("confess_stop", "POST", { from_phone: senderPhone, from_jid: remoteJid, peer_jids: collectMessagePeerJids(msg, remoteJid, content), quoted_wa_message_id: quotedWaId });
      const d = r?.data || r;
      if (d?.stopped > 0) return reply("🛑 Chat Confess dihentikan. Kamu tidak akan menerima pesan confess aktif lagi.\n\n💡 Kirim *!balas* jika ingin membalas confess baru nanti.");
      return reply("ℹ️ Tidak ada chat Confess aktif untuk dihentikan.");
    }

    // ── KIRIM CONFESS: user kirim pesan anonim ke nomor tujuan ──
    if (command === "!confess" || command === "!kirimconfess" || command.startsWith("!confess ") || command.startsWith("!kirimconfess ")) {
      if (!session) return reply("🔒 Login dulu untuk kirim Confess: !login [user] [password]");
      const rest = plainText.replace(/^!\S+\s*/, "").trim();
      // Inline: !confess 0812xxx, 0813xxx | isi pesan
      if (rest.includes("|")) {
        const [numPart, ...msgParts] = rest.split("|");
        const nums = numPart.split(/[\s,]+/).map((x) => x.replace(/\D/g, "")).filter((x) => x.length >= 9 && x.length <= 16);
        const isi = msgParts.join("|").trim();
        if (!nums.length) return reply("⚠️ Nomor tidak valid.\nFormat: *!confess 081234567890 | isi pesan*");
        if (isi.length < 3) return reply("⚠️ Isi pesan terlalu pendek.\nFormat: *!confess 081234567890 | isi pesan*");
        chatFlows[remoteJid] = { type: "confess_sender", phones: nums, message: isi };
        return reply("✍️ Mau pakai nama samaran? Ketik nama samaran kamu, atau ketik *skip* untuk tetap Anonim.");
      }
      let priceInfo = "";
      try {
        const pr = await api("confess_prices");
        const p = pr?.data || pr;
        if (p?.price1) priceInfo = "\n\n💰 Tarif: 1 nomor " + fmtRp(p.price1) + ", 2 nomor " + fmtRp(p.price2) + ", 3 nomor " + fmtRp(p.price3) + ".\n🎁 Percobaan pertama diskon Rp2.000. Chat lanjutan gratis 24 jam.";
      } catch {}
      chatFlows[remoteJid] = { type: "confess_target" };
      {
        const u = await confessAccount(session);
        await sendConfessCard(client, remoteJid, { color: "cyan", kicker: "CONFESS ANONIM", headline: "KIRIM PESAN ANONIM",
          left: [["user", "Akun", u?.username || session.username], ["wa", "WhatsApp", u?.phone || displaySenderPhone], ["money", "Saldo", fmtRp(u?.balance ?? session.balance), "#7de3ff"], ["mail", "Email", u?.email || "Belum tersedia"]],
          right: [["clock", "Waktu", dtText(new Date())], ["id", "ID Pengguna", "@" + (u?.username || session.username)]],
          status: "SIAP", statusColor: "cyan", note: "Gunakan dengan bijak.",
          footer: ["Dilarang spam, penipuan, ancaman & pelecehan. Penyalahgunaan dapat", "membatasi akses Confess atau menangguhkan akun. • AGUNG ADI STORE • CONFESS"] }, "AGUNG ADI STORE • CONFESS ANONIM", null, msg);
      }
      return reply("💌 *Silakan masukkan nomor WhatsApp penerima Confess.*\nContoh: 628xxxxxxxxxx\nBeberapa nomor: 628xxx, 628xxx" + priceInfo + "\n\n❌ Ketik *.batal* jika ingin membatalkan.");
    }





    // ── AUTO-FORWARD pesan WA → confess web (TANPA perlu !balas) ──
    // Backend akan otomatis return matched=false jika tidak ada thread aktif.
    {
      const audioMsg = content.audioMessage;
      const imageMsg = content.imageMessage;
      // Selalu coba teruskan ke web dulu (kecuali sedang input PIN). Kalau nomor ini
      // punya thread confess aktif → matched=true & pesan masuk web, lalu berhenti.
      // Kalau bukan penerima confess → matched=false, lanjut ke menu/flow toko seperti biasa.
      const inFlow = !!pinPending[remoteJid] || !!chatFlows[remoteJid];
      if (!inFlow && !plainText.startsWith("!") && !plainText.startsWith(".") && (plainText || audioMsg || imageMsg)) {
        try {
          // Ambil snapshot PP & nama WA pengirim agar disimpan per-pesan
          let wa_profile_pic_url = null, wa_display_name = null;
          try { wa_profile_pic_url = await client.profilePictureUrl(remoteJid, "image").catch(() => null); } catch {}
          try { wa_display_name = msg.pushName || null; } catch {}

          let media_url = null, media_type = null, media_mime = null, media_size = null, media_duration = null;
          if (audioMsg || imageMsg) {
            try {
              const { downloadMediaMessage } = require("@whiskeysockets/baileys");
              const buf = hasMediaKey(msg) ? await downloadMediaMessage(msg, "buffer", {}).catch((e) => { console.log("[media] unduh gagal:", e?.message); return null; }) : null;
              if (buf) {
                const isAudio = !!audioMsg;
                const mime = (isAudio ? audioMsg.mimetype : imageMsg.mimetype) || (isAudio ? "audio/ogg" : "image/jpeg");
                const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : mime.includes("png") ? "png" : isAudio ? "ogg" : "jpg";
                const up = await api("confess_media_upload", "POST", {
                  base64: buf.toString("base64"),
                  mime, ext, from_phone: senderPhone,
                });
                media_url = up?.data?.url || up?.url || null;
                media_type = isAudio ? "audio" : "image";
                media_mime = mime;
                media_size = buf.length;
                if (isAudio) media_duration = audioMsg.seconds || null;
              }
            } catch (e) { console.error("confess media download error:", e?.message || e); }
          }
          if (media_url || plainText) {
            const r = await api("confess_reply", "POST", {
              from_phone: senderPhone,
              from_jid: remoteJid,
              peer_jids: collectMessagePeerJids(msg, remoteJid, content),
              reply_text: plainText || "",
              wa_message_id: msg.key?.id || null,
              quoted_wa_message_id: quotedWaId,
              media_url, media_type, media_mime, media_size,
              media_duration_seconds: media_duration,
              wa_profile_pic_url, wa_display_name,
            });
            const d = r?.data || r;
            if (d?.matched) {
              if (_lastConfessByPhone[senderPhone]) _lastConfessByPhone[senderPhone].expires_at = Date.now() + 30 * 60 * 1000;
              return; // silent — pesan sampai web tanpa balasan apapun
            }
          }
        } catch (e) { console.error("confess auto-forward error:", e?.message || e); }
      }
    }




    if (chatFlows[remoteJid] && !plainText.startsWith("!")) {
      const flow = chatFlows[remoteJid];

      if (!session) {
        delete chatFlows[remoteJid];
        return reply("🔒 Sesi login tidak ditemukan. Silakan login lagi dengan !login [user] [password]");
      }

      if (flow.type === "gantinama_wait") {
        const value = plainText.trim();
        if (/^(batal|!batal)$/i.test(value)) { delete chatFlows[remoteJid]; return reply("❎ Ganti nama dibatalkan."); }
        if (!/^[A-Za-z0-9_.]{3,30}$/.test(value)) return reply("⚠️ Nama 3–30 karakter (huruf, angka, _ atau .), tanpa spasi.\nKirim lagi, atau ketik *batal*.");
        const res = await api("update_profile", "POST", { visitor_id: session.visitor_id, username: value });
        if (res.error) return reply("❌ " + res.error);
        delete chatFlows[remoteJid];
        session.username = value; userSessions[remoteJid] = session;
        await reply("✅ Nama berhasil diperbarui.");
        return renderProfile(client, remoteJid, session, displaySenderPhone, msg);
      }

      if (flow.type === "create_pin") {
        if (!/^\d{6}$/.test(plainText)) return reply("⚠️ PIN harus 6 digit angka.\nKirim lagi PIN baru kamu, contoh: 123456");
        const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
        if (apiHasPin(pinCheck)) {
          delete chatFlows[remoteJid];
          return reply("ℹ️ PIN kamu sudah pernah dibuat. Gunakan *!resetpin* kalau ingin ganti PIN.");
        }
        const res = await api("create_pin", "POST", { visitor_id: session.visitor_id, pin: plainText });
        const errMsg = apiError(res);
        if (errMsg) return reply("❌ " + errMsg);
        delete chatFlows[remoteJid];
        return reply("✅ *PIN Berhasil Dibuat!*\n\n🔐 PIN: " + plainText + "\n\n⚠️ Simpan PIN ini baik-baik.");
      }

      if (flow.type === "deposit_amount") {
        const amount = Number(plainText.replace(/[^\d]/g, ""));
        if (!amount || amount < 1000) return reply("⚠️ Nominal deposit minimal Rp 1.000.\nMasukkan nominal lagi, contoh: 50000");
        chatFlows[remoteJid] = { type: "deposit_method", amount };
        return reply("💳 *Pilih Metode Deposit*\n\nNominal: " + fmtRp(amount) + "\n\nKetik salah satu:\n• qris\n• dana");
      }

      if (flow.type === "deposit_method") {
        if (!["qris", "dana"].includes(lowerText)) return reply("⚠️ Metode tidak valid. Ketik *qris* atau *dana*.");
        const res = await api("create_deposit", "POST", { visitor_id: session.visitor_id, amount: flow.amount, payment_method: lowerText.toUpperCase(), username: session.username });
        if (res.error) return reply("❌ " + res.error);
        const dep = res.data || res;
        pendingDeposits[remoteJid] = dep;
        delete chatFlows[remoteJid];
        await sendDepositInstructions(client, remoteJid, msg, dep);
        return;
      }

      if (flow.type === "resetpin_wait_method") {
        const token = parseResetToken(plainText);
        if (lowerText === "lama") {
          chatFlows[remoteJid] = { type: "resetpin_wait_old" };
          return reply("🔐 Kirim PIN lama kamu sekarang (6 digit).");
        }
        if (lowerText === "wa" || lowerText === "kode" || lowerText === "kode wa") {
          const res = await api("request_wa_reset_code", "POST", { visitor_id: session.visitor_id, purpose: "pin" });
          if (res.error) return reply("❌ " + res.error);
          chatFlows[remoteJid] = { type: "resetpin_wait_wa_code" };
          return reply("📲 Kode reset PIN sudah dikirim ke WhatsApp terdaftar" + (res.data?.phoneMasked ? " (" + res.data.phoneMasked + ")" : "") + ".\n\nKirim *6 digit kode* itu di sini.");
        }
        if (!token) return reply("⚠️ Kirim token reset format *#12345* atau ketik *LAMA* untuk pakai PIN lama.");
        chatFlows[remoteJid] = { type: "resetpin_wait_new", token };
        return reply("🔐 Token diterima. Sekarang kirim PIN baru kamu (6 digit).");
      }

      if (flow.type === "resetpin_wait_wa_code") {
        const code = plainText.replace(/\D/g, "");
        if (!/^\d{6}$/.test(code)) return reply("⚠️ Kode WA harus 6 digit angka.");
        chatFlows[remoteJid] = { type: "resetpin_wait_wa_new", code };
        return reply("✅ Kode diterima. Sekarang kirim PIN baru kamu (6 digit).");
      }

      if (flow.type === "resetpin_wait_wa_new") {
        if (!/^\d{6}$/.test(plainText)) return reply("⚠️ PIN baru harus 6 digit angka.");
        const res = await api("apply_wa_reset_code", "POST", { visitor_id: session.visitor_id, purpose: "pin", code: flow.code, new_value: plainText });
        if (res.error) return reply("❌ " + res.error);
        delete chatFlows[remoteJid];
        return reply(PIN_OK);
      }

      if (flow.type === "resetpin_wait_old") {
        if (!/^\d{6}$/.test(plainText)) return reply("⚠️ PIN lama harus 6 digit angka.");
        chatFlows[remoteJid] = { type: "resetpin_wait_new", oldPin: plainText };
        return reply("🔐 PIN lama diterima. Sekarang kirim PIN baru kamu (6 digit).");
      }

      if (flow.type === "resetpin_wait_new") {
        if (!/^\d{6}$/.test(plainText)) return reply("⚠️ PIN baru harus 6 digit angka.");
        const body = { visitor_id: session.visitor_id, new_pin: plainText };
        if (flow.token) body.reset_token = flow.token;
        if (flow.oldPin) body.old_pin = flow.oldPin;
        const res = await api("reset_pin", "POST", body);
        if (res.error) return reply("❌ " + res.error);
        delete chatFlows[remoteJid];
        return reply(PIN_OK);
      }

      if (flow.type === "resetsandi_wait_method") {
        const token = parseResetToken(plainText);
        if (lowerText === "lama") {
          chatFlows[remoteJid] = { type: "resetsandi_wait_old" };
          return reply("🔑 Kirim password lama kamu sekarang.");
        }
        if (!token) return reply("⚠️ Kirim token reset format *#12345* atau ketik *LAMA* untuk pakai password lama.");
        chatFlows[remoteJid] = { type: "resetsandi_wait_new", token };
        return reply("🔑 Token diterima. Sekarang kirim password baru kamu.");
      }

      if (flow.type === "resetsandi_wait_old") {
        if (!plainText) return reply("⚠️ Password lama tidak boleh kosong.");
        if (rateLimited("pwold:" + remoteJid, 5, 15 * 60000)) { delete chatFlows[remoteJid]; return reply("🔒 Terlalu banyak percobaan.\n\nSilakan tunggu beberapa saat atau gunakan token reset."); }
        const chk = await api("login", "POST", { identifier: session.username, password: plainText });
        if (chk.error || !chk.data) return reply("❌ Password lama salah.\nKirim lagi, atau ketik *batal*.");
        chatFlows[remoteJid] = { type: "resetsandi_wait_new", oldPassword: plainText };
        return reply("🔑 Password lama benar. Sekarang kirim password baru kamu.\nKetik *batal* untuk membatalkan.");
      }

      if (flow.type === "resetsandi_wait_new") {
        if (!plainText) return reply("⚠️ Password baru tidak boleh kosong.");
        const body = { visitor_id: session.visitor_id, new_password: plainText };
        if (flow.token) body.reset_token = flow.token;
        if (flow.oldPassword) body.old_password = flow.oldPassword;
        const res = await api("reset_password", "POST", body);
        if (res.error) return reply("❌ " + res.error);
        delete chatFlows[remoteJid];
        return sendUi(client, remoteJid, { body: PW_OK, quick: [{ id: "!profilku", title: "👤 Profil" }, { id: "!login", title: "🔐 Login" }, BACK] }, msg);
      }

      // ═══ GANTI EMAIL VIA WA (kode 6 digit) ═══
      if (flow.type === "gantiemail_wait_email") {
        const newEmail = plainText.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return reply("⚠️ Format email tidak valid. Kirim email baru yang benar, contoh: nama@gmail.com");
        const res = await api("request_wa_reset_code", "POST", { visitor_id: session.visitor_id, purpose: "email" });
        if (res.error) return reply("❌ " + res.error);
        chatFlows[remoteJid] = { type: "gantiemail_wait_code", newEmail };
        return reply("📲 Kode ganti email sudah dikirim ke WhatsApp terdaftar" + (res.data?.phoneMasked ? " (" + res.data.phoneMasked + ")" : "") + ".\n\nKirim *6 digit kode* itu di sini untuk konfirmasi.");
      }

      if (flow.type === "gantiemail_wait_code") {
        const code = plainText.replace(/\D/g, "");
        if (!/^\d{6}$/.test(code)) return reply("⚠️ Kode harus 6 digit angka.");
        const res = await api("apply_wa_reset_code", "POST", { visitor_id: session.visitor_id, purpose: "email", code, new_value: flow.newEmail });
        if (res.error) return reply("❌ " + res.error);
        delete chatFlows[remoteJid];
        return reply("✅ *Email berhasil diganti!*\n\n📧 Email baru: " + flow.newEmail);
      }

      // ═══ KIRIM CONFESS VIA WA ═══
      if (flow.type === "confess_target") {
        const nums = plainText.split(/[\s,]+/).map((x) => x.replace(/\D/g, "")).filter((x) => x.length >= 9 && x.length <= 16);
        if (!nums.length) return reply("⚠️ Nomor tidak valid. Kirim nomor tujuan (boleh lebih dari 1, pisah spasi/koma).\nContoh: 081234567890");
        if (nums.length > 15) return reply("⚠️ Maksimal 15 nomor sekaligus.");
        const names = await confessRecipients(nums);
        chatFlows[remoteJid] = { type: "confess_message", phones: nums, names };
        const now = fmtDT(new Date());
        await sendConfessCard(client, remoteJid, { kicker: "CONFESS — PENERIMA", headline: "TUJUAN CONFESS",
          left: [["wa", "Nomor penerima", recipText(nums)], ["user", "Nama penerima", recipNameText(names, nums)], ["user", "Jumlah penerima", nums.length + " nomor"]],
          right: [["clock", "Tanggal", now.date], ["clock", "Waktu", now.time]], status: "MENUNGGU PESAN", statusColor: "amber" }, "AGUNG ADI STORE • Confess — Penerima", "💌 Kirim ke " + nums.length + " nomor.", msg);
        return reply("✍️ *Sekarang masukkan isi pesan Confess kamu.*\n\n❌ Ketik *.batal* untuk membatalkan.");
      }

      if (flow.type === "confess_message") {
        const isi = plainText.trim();
        if (isi.length < 3) return reply("⚠️ Pesan terlalu pendek (min 3 karakter). Ketik isi pesan confess kamu:");
        if (isi.length > 800) return reply("⚠️ Pesan terlalu panjang (maks 800 karakter). Kirim ulang isi pesan:");
        chatFlows[remoteJid] = { type: "confess_sender", phones: flow.phones, message: isi, names: flow.names || [] };
        {
          const u = await confessAccount(session); const names = flow.names || [];
          await sendConfessCard(client, remoteJid, { kicker: "PREVIEW CONFESS", headline: "PREVIEW PESAN",
            left: [["user", "Pengirim", u?.username || session.username], ["wa", "Nomor pengirim", u?.phone || displaySenderPhone], ["mail", "Email", u?.email || "Belum tersedia"], ["money", "Saldo", fmtRp(u?.balance ?? session.balance), "#7de3ff"]],
            right: [["wa", "Penerima", recipText(flow.phones)], ["user", "Nama penerima", recipNameText(names, flow.phones)], ["mail", "Pesan", isi], ["user", "Nama samaran", "Belum diisi"], ["clock", "Waktu", dtText(new Date())]],
            status: "BELUM DIKIRIM", statusColor: "amber", note: "Identitas kamu tidak ditampilkan.", footer: ["Nomor dan identitas pengirim tidak akan ditampilkan kepada penerima.", "AGUNG ADI STORE • CONFESS"] }, "AGUNG ADI STORE • Preview Confess", null, msg);
          await sendConfessCard(client, remoteJid, { kicker: "NAMA SAMARAN CONFESS", headline: "PILIH NAMA SAMARAN",
            left: [["user", "Nama akun", u?.username || session.username], ["wa", "Penerima", names[0] || recipText(flow.phones)]], right: [["mail", "Pesan", isi]],
            status: "MENUNGGU NAMA", statusColor: "amber", footer: ["Ketik nama samaran, atau ketik skip untuk tetap Anonim.", "AGUNG ADI STORE • CONFESS"] }, "AGUNG ADI STORE • Nama samaran", null);
        }
        return reply("✍️ Mau pakai nama samaran? Ketik nama samaran kamu, atau ketik *skip* untuk tetap Anonim.");
      }

      if (flow.type === "confess_sender") {
        const senderName = lowerText === "skip" ? "" : plainText.trim().slice(0, 40);
        const phones = flow.phones;
        const message = flow.message;
        delete chatFlows[remoteJid];
        // Cek PIN dulu
        const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
        if (!apiHasPin(pinCheck)) return reply("🔐 *PIN belum dibuat!*\n\nKetik !buatpin [6 digit] untuk buat PIN dulu, lalu ulangi *!confess*.");
        const tmpTrx = "CFS-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
        const rNames = flow.names || [];
        let u0 = null, est = null;
        try { u0 = await confessAccount(session); const pr = await api("confess_prices"); est = confessPriceFor(phones.length, pr?.data || pr); } catch {}
        const bal0 = Number(u0?.balance ?? session.balance ?? 0);
        {
          const now = fmtDT(new Date());
          await sendConfessCard(client, remoteJid, { color: "cyan", kicker: "KONFIRMASI CONFESS", headline: "KONFIRMASI FINAL",
            left: [["user", "Akun", u0?.username || session.username], ["mail", "Email", u0?.email || "Belum tersedia"], ["wa", "Nomor", u0?.phone || displaySenderPhone], ["wa", "Penerima", recipText(phones)], ["user", "Nama penerima", recipNameText(rNames, phones)]],
            right: [["user", "Nama samaran", senderName || "Anonim"], ["mail", "Catatan", message], ["money", "Harga (maks)", est != null ? fmtRp(est) : "Dihitung saat kirim"], ["wallet", "Saldo awal", fmtRp(bal0)], ["wallet", "Saldo setelah", est != null ? fmtRp(Math.max(0, bal0 - est)) : "-", "#7de3ff"], ["id", "ID sementara", tmpTrx], ["clock", "Tanggal", now.date], ["clock", "Waktu", now.time]],
            status: "MENUNGGU PIN", statusColor: "amber", note: "Gratis 24 jam otomatis.", footer: ["Harga final mengikuti sistem (gratis jika sesi 24 jam masih aktif).", "AGUNG ADI STORE • CONFESS"] }, "AGUNG ADI STORE • Konfirmasi Confess", null, msg);
        }
        return startPurchaseFlow("confess_send", {
          visitor_id: session.visitor_id,
          phones,
          message,
          sender_name: senderName,
          trx_id: tmpTrx,
        }, (cd) => {
          (async () => {
            try {
              const ac = await api("account_card&visitor_id=" + session.visitor_id);
              const mask = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length > 6 ? d.slice(0, 4) + "****" + d.slice(-3) : "****"; };
              const charged = Number(cd.charged || 0); const after = cd.balance_remaining !== undefined ? Number(cd.balance_remaining) : Number(ac?.user?.balance || 0);
              const nowS = fmtDT(new Date());
              await sendRenderedCard(client, remoteJid, () => cardRender?.renderInfoCard?.({ ...CARD_BASE(), color: "green", kicker: "CONFESS TERKIRIM", headline: "CONFESS BERHASIL DIBUAT",
                left: [["user", "Pengirim", ac?.user?.username || session.username], ["user", "Nama samaran", senderName || "Anonim"], ["user", "Penerima", recipNameText(rNames, phones)], ["wa", "Tujuan", recipText(phones)]],
                right: [["id", "ID Confess", cd.trx_id || "-"], ["money", "Harga", fmtRp(charged)], ["wallet", "Saldo awal", fmtRp(after + charged)], ["money", "Sisa saldo", fmtRp(after), "#7de3ff"], ["clock", "Tanggal", nowS.date], ["clock", "Waktu", nowS.time], ["clock", "Masa chat", "24 jam"]],
                status: "BERHASIL", statusColor: "green", note: "Balasan masuk ke chat Confess kamu.", footer: ["Selama masa Confess kamu bisa lanjut chat. Akhiri sesi: !stopconfess", "AGUNG ADI STORE • CONFESS BERHASIL"] }), "AGUNG ADI STORE • Confess berhasil", null);
            } catch (e) { console.log("[confess-card] gagal:", e?.message); }
          })();
          let txt = "✅ *Confess Terkirim!*\n\n💌 Ke: " + phones.length + " nomor\n👤 Nama: " + (senderName || "Anonim");
          if (cd.trx_id) txt += "\n🆔 " + cd.trx_id;
          if (cd.charged !== undefined) txt += "\n💰 Dibayar: " + fmtRp(cd.charged);
          if (cd.free_count) txt += "\n🎁 Gratis (window 24 jam): " + cd.free_count + " nomor";
          if (cd.trial_discount) txt += "\n🎉 Diskon percobaan: " + fmtRp(cd.trial_discount);
          if (cd.balance_remaining !== undefined) txt += "\n💳 Sisa Saldo: " + fmtRp(cd.balance_remaining);
          txt += "\n\n💬 Balasan penerima akan otomatis masuk ke web & chat confess kamu.";
          return txt;
        });
      }
    }


    if ((lowerText === "bukti" || lowerText === "!bukti") && !msg.message?.imageMessage) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const deposit = await getLatestPendingDeposit(session, remoteJid);
      if (!deposit) return reply("⚠️ Belum ada deposit pending. Ketik *!deposit* dulu untuk membuat deposit.");
      pendingDeposits[remoteJid] = deposit;
      return reply("📸 *Kirim Foto Bukti Bayar Sekarang*\n\n🆔 " + (deposit.trx_id || "-") + "\n💰 " + fmtRp(deposit.amount) + "\n💳 " + String(deposit.payment_method || "-").toUpperCase() + "\n\nSilakan kirim foto bukti pembayaran. Tidak perlu tulis ID transaksi lagi.");
    }

    if (msg.message?.imageMessage && session) {
      const captionText = (msg.message.imageMessage.caption || "").trim().toLowerCase();
      const isProofImage = !captionText || captionText === "bukti" || captionText === "!bukti" || captionText.startsWith("!bukti ");
      if (isProofImage) {
        let deposit = null;
        if (captionText.startsWith("!bukti ")) {
          const trxQuery = (msg.message.imageMessage.caption || "").trim().split(/\s+/).slice(1).join(" ").trim();
          const depRes = await api("deposits");
          deposit = (depRes.data || []).find((d) => d.visitor_id === session.visitor_id && (d.trx_id === trxQuery || String(d.trx_id || "").includes(trxQuery)));
        }
        if (!deposit) deposit = await getLatestPendingDeposit(session, remoteJid);
        if (deposit) {
          pendingDeposits[remoteJid] = deposit;
          try { await sendDepositProofToAdmin(client, remoteJid, msg, session, deposit); }
          catch (e) { console.log("[deposit-proof] gagal:", e?.message); return reply("⚠️ Bukti belum tersimpan: " + (e?.message || "error") + "\nStatus deposit tetap PENDING. Coba kirim ulang fotonya."); }
          return;
        }
      }
    }

    if (!plainText.startsWith("!") && !userSessions[remoteJid + "_game"]) return;

    try {
    // ═══════════════════════════════════════
    // ═══ USER COMMANDS ═══
    // ═══════════════════════════════════════
    if (command === "!ping") { return reply("🏓 Pong! Bot aktif v10.0.0"); }
    if (command === "!versi") { return reply("🤖 Bot WA Agung Adi Store v10.0.0\n📅 " + new Date().toLocaleString("id-ID")); }
    if (command === "!waktu") { return reply("🕐 Waktu server: " + new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB"); }

    // ═══ WEBAPP LINK ═══
    if (command === "!webapp" || command === "!web" || command === "!link") {
      return reply("🌐 *Buka Web App:*\n\n🔗 " + WEB_URL + "\n\n💡 Klik link di atas untuk langsung ke website.");
    }

    // ═══ AI COMMAND ROUTER (v12): teks bebas → command aman. Tidak pernah mengeksekusi transaksi. ═══
    if (!plainText.startsWith("!") && plainText && !chatFlows[remoteJid] && !pinPending[remoteJid] && botConfig.features?.router !== false) {
      const rr = apiData(await api("wa_user", "POST", { op: "route", text: plainText, actor: senderPhone || remoteJid })) || {};
      const route = rr.route;
      if (route) {
        botStat(route.intent, "router", true, remoteJid);
        if (route.sensitive) return reply("🔐 Untuk keamanan, aksi *" + route.intent + "* tidak dijalankan otomatis.\nGunakan perintah resmi: *" + route.command + "* (akan diminta PIN/konfirmasi).\nKetik !menu untuk daftar perintah.");
        if (route.intent === "saldoku") { if (!session) return reply("🔒 Login dulu: !login [user] [password]"); const u = (await api("balances")).data?.find?.((x) => x.visitor_id === session.visitor_id); return reply("💰 Saldo kamu: *" + fmtRp(u ? u.balance : session.balance) + "*"); }
        if (route.intent === "tickets") return reply("🎫 Ketik *!tiketku* untuk melihat tiket kamu.");
        if (route.intent === "flashsale") return reply("⚡ Ketik *!flashsale* untuk melihat flash sale aktif.");
        const map = { firepass_status: "fp_status", anon_match: "anon_match", orders: "orders", wishlist: "wishlist", referral: "referral", quest: "quest", cart: "cart", rodadiskon: "rodadiskon" };
        if (map[route.intent]) { const d = await superApi({ op: map[route.intent], visitor_id: session?.visitor_id, actor: senderPhone || remoteJid }); if (route.intent === "anon_match" && (d.matched || d.queued)) anonMode[remoteJid] = { since: new Date().toISOString(), visitor_id: session?.visitor_id }; return reply(d.text || "❌ Terjadi kesalahan. Coba lagi."); }
        if (route.intent === "bot_galau") { galauMode[remoteJid] = { history: [], at: Date.now() }; return runGalau(remoteJid, plainText, reply, senderPhone); }
        if (route.intent === "product_search") return runStoreAi(remoteJid, plainText, reply, session, senderPhone);
      }
    }

    if (command === "!allmenu teks") {
      return reply([
        "🤖 *" + (botConfig.bot_name || "AGUNG ADI STORE SUPER BOT") + " v" + BOT_VERSION + "*",
        "",
        "🤖 *AI:* !ai [tanya] • !storeai • !galau [cerita] • !galaureset • !galauhelp",
        "   💡 Bisa juga tanpa command, mis: \"saldo saya berapa?\"",
        "🔥 *FIRE PASS:* !firepass • !fpmisi • !fpclaim [id] • !fptier • !fppremium • !fpriwayat",
        "🕵️ *ANON CHAT:* !anon • !anonmatch • !anonstatus • !anonstop • !anonprofile • !anonfriends",
        "💌 *CONFESS:* !confess • !balas • !stopconfess • !confesshelp • !confessstatus",
        "🛒 *STORE:* !produk • !cari • !beli • !pesanan / !order • !saldoku",
        "📦 *PESANAN:* !pesanan • !pesanan detail|terima|batal KODE • !orderchat KODE [pesan] • !review KODE [1-5] [komentar] • !dispute KODE [buat|pesan] [teks]",
        "🛒 *BELANJA+:* !keranjang [tambah|hapus ID • kosong] • !toko ID_TOKO",
        "🎯 *QUEST:* !quest [harian|mingguan|bulanan|premium] • !quest klaim ID • !quest klaimsemua • !lagaquest [klaim]",
        "🎡 *EVENT & LUCK:* !rodadiskon [spin|hadiah|klaim N]",
        "🎁 *REWARD:* !ruangku [klaim KODE|box|box bonus]",
        "⭐ *PREMIUM:* !premium • !anonpremium [voucher KODE]",
        "👥 *REFERRAL:* !referral / !ref • !referral redeem KODE",
        "❤️ *WISHLIST:* !wishlist • !wishlist add|remove ID",
        "🎫 *SUPPORT:* !buattiket • !tiketku • !tiketpesan • !balastiket",
        "",
        "━━━━━━━━ Semua perintah ━━━━━━━━",
        "📱 Nomor kamu: " + displaySenderPhone,
        session ? "👤 Login: " + session.username : "🔒 Belum login",
        "",
        "🔑 *Akun Saldo:*",
        "• !daftar — Buat akun saldo baru",
        "• !login [user/email/hp] [password]",
        "• .logintoken — Minta token login WA (5 menit)",
        "• !logout — Logout akun",
        "• !saldoku — Cek saldo",
        "• !profilku — Lihat profil lengkap",
        "• !editprofil — Edit profil akun",
        "• !gantiemail — Ganti email akun (kode via WA)",
        "• !resetsandi — Bot akan minta sandi lama / token",
        "• !resetpin — Bot akan minta PIN lama / token",
        "• !riwayat [jumlah] — Riwayat transaksi",
        "• !download_riwayat [pdf/word/txt] [semua/1-20]",
        "• !detailtrx [trx_id] — Detail transaksi",
        "• !gameku — Stats game saya",
        "• !kreditku — Kredit game saya",
        "• !streakku — Status streak saya",
        "• !notifku — Notifikasi saya",
        "• !slotnotif — Daftar slot notif WA",

        "• !likeku — Daftar favorit saya",
        "• !nomorku — Tampilkan nomor WA",
        "• !fotoprofil — Kirim foto profil kamu",
        "",
        "🛒 *Belanja (perlu login + PIN 6 digit):*",
        "• !beli [#ID/nama produk] [jumlah]",
        "• !belistreak [nama paket]",
        "• !belikredit [nama paket]",
        "• !belistorage [nama paket]",
        "• !belibundle [nama paket]",
        "• ⚠️ PIN diminta setiap transaksi (tidak disimpan)",
        "",
        "💰 *Deposit:*",
        "• !deposit — Bot akan minta nominal & metode",
        "• bukti / !bukti — Lalu kirim foto bukti bayar",
        "• !cekdeposit [ID transaksi]",
        "",
        "🎫 *Voucher & Streak (perlu login):*",
        "• !klaim [kode1] [kode2] ... — Klaim voucher",
        "• !klaimstreak — Klaim streak harian",
        "",
        "🎮 *Game AI:*",
        "• !profil — Profil game lengkap",
        "• !tekateki [mudah/sedang/sulit]",
        "• !tebakkata [mudah/sedang/sulit]",
        "• !tebakangka [mudah/sedang/sulit]",
        "• !tebakgambar [mudah/sedang/sulit]",
        "• !tebakbarang [mudah/sedang/sulit]",
        "• !pilihlanganda [mudah/sedang/sulit]",
        "• !kuisyatidak [mudah/sedang/sulit]",
        "• !tekatekilanjut [mudah/sedang/sulit]",
        "• !lbgame — Leaderboard game",
        "• !jawab [jawaban] — Jawab game",
        "• !hint — Minta petunjuk (1 kredit)",
        "• !nyerah — Menyerah game",
        "",
        "❤️ *Like (perlu login):*",
        "• !likeproduk [nama/id]",
        "• !likelagu [judul]",
        "• !likesponsor [no]",
        "",
        "📦 *Produk & Toko:*",
        "• !produk — Daftar produk + Short ID",
        "• !cari [kata] — Cari produk",
        "• !kategori — Kategori produk",
        "• !harga [min] [max] — Filter harga",
        "• !random — Produk random",
        "• !top — Produk terpopuler",
        "• !detailproduk [#id/nama]",
        "• !grosir [nama] — Harga grosir",
        "",
        "🏪 *Sponsor:*",
        "• !sponsor — Sponsor aktif",
        "• !detailsponsor [no]",
        "",
        "🎵 *Musik:*",
        "• !lagu — Daftar lagu",
        "• !carilagu [kata] — Cari lagu",
        "• !download [judul] — Link download",
        "• !kirim [judul] — Kirim file audio",
        "• !artis — Daftar artis",
        "• !playlist — Daftar playlist",
        "",
        "🎫 *Support (perlu login):*",
        "• !buattiket [kategori] | [deskripsi]",
        "• !tiketku — Lihat tiket saya",
        "• !tiketpesan [no_tiket] — Lihat pesan tiket",
        "• !balastiket [no_tiket] [pesan]",
        "",
        "💌 *Confess Anonim (perlu login):*",
        "• !confess — Kirim pesan anonim ke nomor tujuan",
        "• !confess [nomor] | [pesan] — Kirim langsung",
        "• !balas [pesan] — Balas confess yang kamu terima",
        "• !stopconfess — Hentikan chat confess masuk",
        "",
        "📊 *Info:*",
        "• !info / !toko — Statistik toko",
        "• !paket — Paket tersedia",
        "• !flashsale — Flash sale",
        "• !sosmed — Social media",
        "• !webapp — Link web app",
        "• !bantuan — Pusat bantuan",
        "• !syarat — S&K",
        "",
        "🔐 Ketik *!admin* untuk perintah admin",
        "👨‍💼 Admin: !admin • !dashboard • !botstatus • !botstats • !boterrors • !botmaintenance on/off",
      ].join("\n"));
    }

    // ═══ DAFTAR AKUN SALDO ═══
    if (command === "!daftar") {
      return reply([
        "📝 *Daftar Akun Saldo Baru*",
        "",
        "Format: !daftar [username] [no_hp] [email] [password]",
        "",
        "Contoh:",
        "!daftar agung 08123456789 agung@gmail.com password123",
        "",
        "⚠️ Simpan password baik-baik, hanya ditampilkan di WA ini!",
      ].join("\n"));
    }

    if (command.startsWith("!daftar ")) {
      if (args.length < 4) return reply("⚠️ Format: !daftar [username] [no_hp] [email] [password]\n\nContoh: !daftar agung 08123456789 agung@gmail.com password123");
      const username = args[0];
      const phone = args[1];
      const email = args[2];
      const password = args.slice(3).join(" ");
      const res = await api("register", "POST", { username, phone, email, password });
      if (res.error) return reply("❌ " + res.error);
      const d = res.data || res;
      // Auto login after register
      const loginRes = await api("login", "POST", { identifier: username, password });
      if (loginRes.data) {
        userSessions[remoteJid] = loginRes.data;
      }
      return reply([
        "✅ *Akun Berhasil Dibuat!*",
        "",
        "👤 Username: " + username,
        "📞 No HP: " + phone,
        "📧 Email: " + email,
        "🔑 Password: " + password,
        "",
        "🔐 *PIN belum dibuat*",
        "Ketik !buatpin [6 digit] untuk buat PIN transaksi",
        "",
        "⚠️ *PENTING: Simpan password & PIN baik-baik!*",
        "Kredensial ini tidak tersimpan di web, hanya tampil di WA ini.",
        "",
        "💰 Saldo: " + fmtRp(0),
        session ? "" : "✅ Auto-login berhasil!",
      ].join("\n"));
    }

    // ═══ LOGIN / LOGOUT USER ═══
    if (command === "!logintoken" || command === "!logintken" || command === "!tokenlogin" || command === "!token") {
      if (session?.visitor_id) {
        return reply([
          "✅ WA ini sudah login akun saldo.",
          "",
          "👤 Username: " + (session.username || "-"),
          "💰 Saldo: " + fmtRp(session.balance || 0),
          "",
          "Mau ganti akun? Ketik *!logout* dulu, lalu ketik *.logintoken* dan verifikasi token dari web yang sudah login akun saldo.",
        ].join("\n"));
      }

      const res = await api("wa_login_token_create", "POST", { wa_jid: remoteJid, from_phone: senderPhone || remoteJid });
      if (res.error) return reply("❌ " + res.error);
      const d = res.data || res;
      await reply([
        "🔐 *Token Login WA Agung Adi Store*",
        "",
        "Salin token ini:",
        "```" + d.code + "```",
        "",
        "Berlaku: " + (d.expires_minutes || 5) + " menit (sekali pakai)",
        "",
        "Cara pakai:",
        "1. Buka web Agung Adi Store yang *sudah login akun saldo*",
        "2. Masuk menu Saldo → *Kode & Barcode Login*",
        "3. Tekan *Verifikasi Token WA*",
        "4. Masukkan token ini lalu tekan *Verifikasi*",
        "",
        "Setelah berhasil, WA ini otomatis login ke akun saldo yang sedang login di web.",
        "Tidak perlu !login, email, username, nomor HP, atau sandi di WA.",
        "Jika expired, ketik *.logintoken* lagi.",
      ].filter(Boolean).join("\n"));


      (async () => {
        const started = Date.now();
        while (Date.now() - started < 305000) {
          await wait(4000);
          const status = await api("wa_login_token_status", "POST", { code: d.code });
          if (status?.data?.confirmed || status?.confirmed) {
            const user = status.data?.user || status.user;
            if (user?.visitor_id) {
              userSessions[remoteJid] = user;
              await reply([
                "✅ *Berhasil login!*",
                "",
                "👤 Username: " + (user.username || "-") + " sudah bisa akses dari WA ini.",
                "💰 Saldo: " + fmtRp(user.balance || 0),
                "",
                "WA ini sudah masuk ke akun saldo via verifikasi web.",
              ].join("\n"));
            }
            return;
          }
          if (status?.data?.expired || status?.expired) {
            await reply("⏰ Token login WA kedaluwarsa. Ketik *.logintoken* lagi untuk token baru.");
            return;
          }
        }
      })().catch(() => {});
      return;
    }

    if (command.startsWith("!login") && !command.startsWith("!loginhistory")) {
      if (command === "!login") return reply("⚠️ Gunakan: !login [username/email/hp] [password]\n\nContoh:\n• !login agung password123\n• !login agung@gmail.com password123\n• !login 08123456789 password123\n\nBelum punya akun? Ketik !daftar");
      if (args.length < 2) return reply("⚠️ Gunakan: !login [username/email/hp] [password]");
      const identifier = args[0];
      const password = args.slice(1).join(" ");
      const res = await api("login", "POST", { identifier, password });
      if (res.error) return reply("❌ " + res.error);
      if (!res.data) return reply("❌ Gagal login.");
      userSessions[remoteJid] = res.data;
      // Check PIN status
      const pinCheck = await api("check_pin", "POST", { visitor_id: res.data.visitor_id });
      const hasPin = apiHasPin(pinCheck);
      return reply([
        "✅ *Login berhasil!*",
        "",
        "👤 Username: " + res.data.username,
        "📞 No HP: " + (res.data.phone || "-"),
        "📧 Email: " + (res.data.email || "-"),
        "💰 Saldo: " + fmtRp(res.data.balance),
        "🔐 PIN: " + (hasPin ? "✅ Sudah dibuat" : "❌ Belum dibuat — Ketik !buatpin"),
        "",
        "📱 Nomor WA: " + displaySenderPhone,
        "",
        "💡 Ketik !saldoku, !riwayat, !gameku, !profilku",
      ].join("\n"));
    }

    if (command === "!logout") {
      if (!session) return reply("ℹ️ Kamu belum login. Ketik !login [user] [password]");
      const uname = session.username;
      delete userSessions[remoteJid];
      delete pinPending[remoteJid];
      return reply("✅ Logout berhasil. Bye " + uname + "! 👋\n\n🔒 Semua data sesi dihapus.");
    }

    // ═══ BUAT PIN ═══
    if (command === "!buatpin") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
      if (apiHasPin(pinCheck)) return reply("ℹ️ PIN kamu sudah pernah dibuat. Gunakan *!resetpin* kalau ingin ganti PIN.");
      chatFlows[remoteJid] = { type: "create_pin" };
      return reply("🔐 *Buat PIN Baru*\n\nKirim 6 digit PIN transaksi kamu sekarang.\nContoh: 123456");
    }

    if (command.startsWith("!buatpin ")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
      if (apiHasPin(pinCheck)) return reply("ℹ️ PIN kamu sudah pernah dibuat. Gunakan *!resetpin* kalau ingin ganti PIN.");
      const pinVal = args[0];
      if (!pinVal || !/^\d{6}$/.test(pinVal)) return reply("⚠️ PIN harus *6 digit angka*.\nGunakan: !buatpin 123456");
      const res = await api("create_pin", "POST", { visitor_id: session.visitor_id, pin: pinVal });
      const errMsg = apiError(res);
      if (errMsg) return reply("❌ " + errMsg);
      return reply([
        "✅ *PIN Berhasil Dibuat!*",
        "",
        "🔐 PIN: " + pinVal,
        "",
        "⚠️ *SIMPAN PIN INI!*",
        "PIN diperlukan setiap transaksi pembelian.",
        "PIN tidak tersimpan di web, hanya tampil di WA ini.",
        "",
        "💡 Lupa PIN? Ketik !resetpin",
      ].join("\n"));
    }

    // ═══ RESET PIN ═══
    if (command === "!resetpin") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      chatFlows[remoteJid] = { type: "resetpin_wait_method" };
      return reply("🔐 *Reset PIN*\n\nPilih metode:\n• Ketik *WA* untuk kode reset lewat WhatsApp\n• Ketik *LAMA* untuk pakai PIN lama\n• Kirim token admin contoh *#12345*\n\nSetelah itu bot akan minta PIN baru.");
    }

    if (command === "!resetpin wa" || command === "!resetpin kode" || command === "!resetpin kodewa") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("request_wa_reset_code", "POST", { visitor_id: session.visitor_id, purpose: "pin" });
      if (res.error) return reply("❌ " + res.error);
      chatFlows[remoteJid] = { type: "resetpin_wait_wa_code" };
      return reply("📲 Kode reset PIN sudah dikirim ke WhatsApp terdaftar" + (res.data?.phoneMasked ? " (" + res.data.phoneMasked + ")" : "") + ".\n\nKirim *6 digit kode* itu di sini.");
    }

    if (command.startsWith("!resetpin lama")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      if (args.length < 3) return reply("⚠️ Format: !resetpin lama [pin_lama] [pin_baru]");
      const oldPin = args[1];
      const newPin = args[2];
      if (!/^\d{6}$/.test(newPin)) return reply("⚠️ PIN baru harus 6 digit angka.");
      const res = await api("reset_pin", "POST", { visitor_id: session.visitor_id, old_pin: oldPin, new_pin: newPin });
      if (res.error) return reply("❌ " + res.error);
      return reply(PIN_OK);
    }

    if (command.startsWith("!resetpin token")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      if (args.length < 3) return reply("⚠️ Format: !resetpin token [#token] [pin_baru]");
      const token = args[1].replace("#", "");
      const newPin = args[2];
      if (!/^\d{6}$/.test(newPin)) return reply("⚠️ PIN baru harus 6 digit angka.");
      const res = await api("reset_pin", "POST", { visitor_id: session.visitor_id, reset_token: token, new_pin: newPin });
      if (res.error) return reply("❌ " + res.error);
      return reply(PIN_OK);
    }

    // ═══ RESET SANDI ═══
    if (command === "!resetsandi") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      chatFlows[remoteJid] = { type: "resetsandi_wait_method" };
      return reply("🔑 *Reset Password*\n\nKirim token reset admin (contoh: #12345)\natau ketik *LAMA* untuk pakai password lama.\n\nSetelah itu bot akan minta password baru.");
    }

    if (command.startsWith("!resetsandi lama")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      if (args.length < 3) return reply("⚠️ Format: !resetsandi lama [password_lama] [password_baru]");
      const oldPw = args[1];
      const newPw = args[2];
      const res = await api("reset_password", "POST", { visitor_id: session.visitor_id, old_password: oldPw, new_password: newPw });
      if (res.error) return reply("❌ " + res.error);
      return reply(PW_OK);
    }

    if (command.startsWith("!resetsandi token")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      if (args.length < 3) return reply("⚠️ Format: !resetsandi token [#token] [password_baru]");
      const token = args[1].replace("#", "");
      const newPw = args[2];
      const res = await api("reset_password", "POST", { visitor_id: session.visitor_id, reset_token: token, new_password: newPw });
      if (res.error) return reply("❌ " + res.error);
      return reply(PW_OK);
    }

    // ═══ GANTI EMAIL ═══
    if (command === "!gantiemail" || command === "!ubahemail") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      chatFlows[remoteJid] = { type: "gantiemail_wait_email" };
      return reply("📧 *Ganti Email Akun*\n\nKirim *email baru* kamu di sini.\nBot akan mengirim kode 6 digit ke WhatsApp untuk konfirmasi.\n\nBatal? Ketik *!batal*");
    }
    if (command.startsWith("!gantiemail ") || command.startsWith("!ubahemail ")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const newEmail = (args[1] || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return reply("⚠️ Format email tidak valid. Contoh: !gantiemail nama@gmail.com");
      const res = await api("request_wa_reset_code", "POST", { visitor_id: session.visitor_id, purpose: "email" });
      if (res.error) return reply("❌ " + res.error);
      chatFlows[remoteJid] = { type: "gantiemail_wait_code", newEmail };
      return reply("📲 Kode ganti email dikirim ke WA terdaftar" + (res.data?.phoneMasked ? " (" + res.data.phoneMasked + ")" : "") + ".\n\nKirim *6 digit kode* itu di sini untuk konfirmasi email baru: " + newEmail);
    }

    // ═══ EDIT PROFIL ═══
    if (command === "!editprofil") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      return reply([
        "✏️ *Edit Profil Akun Saldo*",
        "",
        "Pilih yang mau diubah:",
        "",
        "• !editprofil username [username_baru]",
        "• !editprofil hp [nomor_hp_baru]",
        "• !editprofil email [email_baru]",
        "",
        "Contoh: !editprofil username agung_baru",
      ].join("\n"));
    }

    if (command.startsWith("!editprofil ")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const field = args[0];
      const value = args.slice(1).join(" ");
      if (!value && field === "username") {
        chatFlows[remoteJid] = { type: "gantinama_wait" };
        return replyWithNav(client, remoteJid, "✏️ *GANTI NAMA*\n\nNama saat ini:\n*" + (session.username || "-") + "*\n\nSilakan kirim nama baru.\nKetik *batal* untuk membatalkan.", null, [{ id: "!profilku", title: "↩️ Kembali" }], msg);
      }
      if (!value) return reply("⚠️ Masukkan nilai baru setelah field.");
      const body = { visitor_id: session.visitor_id };
      if (field === "username") body.username = value;
      else if (field === "hp" || field === "phone") body.phone = value;
      else if (field === "email") body.email = value;
      else return reply("⚠️ Field tidak valid. Gunakan: username, hp, atau email");
      const res = await api("update_profile", "POST", body);
      if (res.error) return reply("❌ " + res.error);
      // Update session
      if (body.username) session.username = body.username;
      if (body.phone) session.phone = body.phone;
      if (body.email) session.email = body.email;
      userSessions[remoteJid] = session;
      return reply("✅ Profil berhasil diubah!\n\n" + Object.entries(res.data?.updated || body).filter(([k]) => k !== "visitor_id").map(([k, v]) => "📝 " + k + ": " + v).join("\n"));
    }

    // ═══ USER LOGGED-IN COMMANDS ═══
    if (command === "!saldoku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("balances");
      const user = (res.data || []).find((u) => u.visitor_id === session.visitor_id);
      if (user) { session.balance = user.balance; userSessions[remoteJid] = session; }
      return sendUi(client, remoteJid, { title: "💰 SALDO ANDA", body: "Saldo tersedia:\n*" + fmtRp(user?.balance ?? session.balance) + "*",
        quick: [{ id: "!deposit", title: "➕ Deposit" }, { id: "!riwayat", title: "📜 Riwayat" }, { id: "!profilku", title: "👤 Profil" }], buttons: [{ id: "!ui saldo", title: "🔙 Kembali" }, BACK] }, msg);
    }

    if (command === "!profilku" || command === "!profil") {
      if (!session) return replyWithNav(client, remoteJid, "🔒 Login dulu untuk melihat profil.", null, [{ id: "!login", title: "🔑 Login" }, { id: "!daftar", title: "📝 Daftar" }], msg);
      return renderProfile(client, remoteJid, session, displaySenderPhone, msg);
    }

    // ═══ PROFIL GAME (public) ═══
    if (command === "!profilgame") {
      const vid = session?.visitor_id;
      if (!vid) return reply("🔒 Login dulu: !login [user] [password]");
      const [gpRes, gsRes, gcRes, gfRes1, gfRes2] = await Promise.all([
        api("game_profiles&visitor_id=" + vid),
        api("game_stats&visitor_id=" + vid),
        api("game_credits&visitor_id=" + vid),
        api("game_follows"),
        api("game_follows"),
      ]);
      const gp = gpRes.data?.[0];
      const gc = gcRes.data?.[0];
      const stats = gsRes.data || [];
      let totalW = 0, totalL = 0, totalP = 0, totalQ = 0;
      stats.forEach((g) => { totalW += g.wins; totalL += g.losses; totalP += g.points; totalQ += g.total_questions; });
      const level = getGameLevel(totalP);
      // Count follows
      const allFollows = gfRes1.data || [];
      const followers = allFollows.filter((f) => f.following_visitor_id === vid).length;
      const following = allFollows.filter((f) => f.follower_visitor_id === vid).length;

      let txt = "🎮 *Profil Game:*\n\n";
      txt += "📛 Nama: " + (gp?.display_name || session.username) + "\n";
      txt += "📝 Deskripsi: " + (gp?.description || "-") + "\n";
      txt += "⭐ Level: " + level + " (" + totalP + " pts)\n";
      txt += "💎 Kredit: " + (gc?.credits || 0) + (gc?.unlimited_until && new Date(gc.unlimited_until) > new Date() ? " (♾️ Unlimited)" : "") + "\n";
      txt += "👥 Followers: " + followers + " | Following: " + following + "\n";
      txt += "\n📊 *Statistik:*\n";
      txt += "🏆 Menang: " + totalW + " | 💀 Kalah: " + totalL + "\n";
      txt += "📝 Total soal: " + totalQ + "\n";
      if (stats.length) {
        txt += "\n📋 *Per Game:*\n";
        stats.forEach((g) => {
          txt += "• " + g.game_type + ": W" + g.wins + "/L" + g.losses + " | " + g.points + " pts\n";
        });
      }
      return reply(txt);
    }

    if (command.startsWith("!riwayat") && !command.startsWith("!riwayatadmin")) {
      if (command === "!riwayat" || command.startsWith("!riwayat ")) {
        if (!session) return reply("🔒 Login dulu: !login [user] [password]");
        const limit = Number(args[0]) || 10;
        const res = await api("transactions&visitor_id=" + session.visitor_id);
        if (!res.data?.length) return reply("📋 Belum ada transaksi.");
        try {
          const ac = await api("account_card&visitor_id=" + session.visitor_id);
          const all = res.data; const per = 8; const pages = Math.max(1, Math.ceil(all.length / per));
          const page = Math.min(Math.max(1, Number(args[0]) || 1), pages);
          const items = all.slice((page - 1) * per, page * per).map((t) => {
            const inc = /topup|deposit|refund|bonus|reward/i.test(t.type || "");
            return { tag: String(t.type || "-").toUpperCase(), tagColor: inc ? "green" : "pink", title: t.description || "-", amount: (inc ? "+" : "-") + fmtRp(Math.abs(t.amount)), date: dtText(t.created_at), status: t.trx_id || "SUCCESS" };
          });
          const ok = await sendRenderedCard(client, remoteJid, () => cardRender?.renderListCard?.({ ...CARD_BASE(), color: "cyan", kicker: "RIWAYAT TRANSAKSI", headline: session.username, page, pages,
            summary: [["Nomor", displaySenderPhone || "-"], ["Saldo", fmtRp(ac?.user?.balance ?? session.balance)], ["Total transaksi", String(ac?.tx_count ?? all.length)], ["Total deposit", fmtRp(ac?.total_deposit || 0)], ["Total pengeluaran", fmtRp(ac?.total_spent || 0)]],
            items, footer: ["Menampilkan 50 transaksi terbaru.", "Halaman lain: .riwayat [nomor halaman]"] }), "AGUNG ADI STORE • Riwayat " + page + "/" + pages, null, msg);
          if (ok) return sendUi(client, remoteJid, { body: "📊 Halaman " + page + "/" + pages, quick: [page < pages ? { id: "!riwayat " + (page + 1), title: "➡️ Berikutnya" } : null, page > 1 ? { id: "!riwayat " + (page - 1), title: "⬅️ Sebelumnya" } : null, BACK].filter(Boolean) }, msg);
        } catch (e) { console.log("[riwayat-card] gagal:", e?.message); }
        const txns = res.data.slice(0, Math.min(limit, 20));
        let txt = "📋 *Riwayat Transaksi " + session.username + ":*\n(" + txns.length + " dari " + res.data.length + " total)\n";
        txns.forEach((t, i) => {
          const date = new Date(t.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
          const icon = t.type === "topup" ? "💵" : t.type === "purchase" ? "🛒" : "💸";
          txt += "\n" + (i+1) + ". " + icon + " [" + t.type.toUpperCase() + "] " + fmtRp(t.amount);
          txt += "\n   📝 " + (t.description || "-");
          txt += "\n   📅 " + date;
          if (t.trx_id) txt += " | 🆔 " + t.trx_id;
          txt += "\n";
        });
        txt += "\n💡 Download: !download_riwayat [pdf/word/txt] [semua/1-20]";
        return reply(txt);
      }
    }

    // ═══ DOWNLOAD RIWAYAT TRANSAKSI (sebagai file) ═══
    if (command.startsWith("!download_riwayat") || command.startsWith("!exportriwayat")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const format = (args[0] || "txt").toLowerCase();
      const range = args[1] || "semua";
      if (!["pdf", "word", "txt"].includes(format)) return reply("⚠️ Format: !download_riwayat [pdf/word/txt] [semua/1-20]");
      const res = await api("transactions&visitor_id=" + session.visitor_id);
      if (!res.data?.length) return reply("📋 Belum ada transaksi.");
      let txns = res.data;
      if (range !== "semua" && range.includes("-")) {
        const [start, end] = range.split("-").map(Number);
        txns = txns.slice((start || 1) - 1, end || txns.length);
      } else if (range !== "semua") {
        const n = Number(range);
        if (n > 0) txns = txns.slice(0, n);
      }
      // Generate text content
      let content = "=== RIWAYAT TRANSAKSI ===\n";
      content += "Username: " + session.username + "\n";
      content += "Tanggal Export: " + new Date().toLocaleString("id-ID") + "\n";
      content += "Total: " + txns.length + " transaksi\n";
      content += "WA Support: 085769302532\n";
      content += "=".repeat(40) + "\n\n";
      txns.forEach((t, i) => {
        content += "--- Transaksi #" + (i+1) + " ---\n";
        content += "Tipe: " + (t.type || "-").toUpperCase() + "\n";
        content += "Jumlah: " + fmtRp(t.amount) + "\n";
        content += "Deskripsi: " + (t.description || "-") + "\n";
        content += "Tanggal: " + new Date(t.created_at).toLocaleString("id-ID") + "\n";
        if (t.trx_id) content += "ID: " + t.trx_id + "\n";
        content += "\n";
      });
      // Send as document
      const buf = Buffer.from(content, "utf-8");
      const ext = format === "word" ? "doc" : format;
      const mime = format === "pdf" ? "application/pdf" : format === "word" ? "application/msword" : "text/plain";
      await client.sendMessage(remoteJid, {
        document: buf,
        mimetype: mime,
        fileName: "riwayat_" + session.username + "_" + new Date().toISOString().slice(0,10) + "." + ext,
        caption: "📋 Riwayat transaksi " + session.username + " (" + txns.length + " transaksi)"
      }, { quoted: msg });
      return;
    }

    if (command === "!gameku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const [gs, gc] = await Promise.all([
        api("game_stats&visitor_id=" + session.visitor_id),
        api("game_credits&visitor_id=" + session.visitor_id),
      ]);
      let txt = "🎮 *Game Stats " + session.username + ":*\n";
      if (gc.data?.[0]) {
        const c = gc.data[0];
        txt += "\n💎 Kredit: " + c.credits;
        if (c.unlimited_until) txt += "\n♾️ Unlimited sampai: " + new Date(c.unlimited_until).toLocaleString("id-ID");
        txt += "\n";
      }
      if (!gs.data?.length) { txt += "\nBelum ada data game."; }
      else {
        let totalW = 0, totalL = 0, totalP = 0;
        gs.data.forEach((g) => { totalW += g.wins; totalL += g.losses; totalP += g.points; });
        txt += "\n📊 Total: W" + totalW + " / L" + totalL + " | " + totalP + " pts\n";
        gs.data.forEach((g) => {
          txt += "\n• " + g.game_type + ": W" + g.wins + "/L" + g.losses + " | " + g.points + " pts | " + g.total_questions + " soal";
        });
      }
      return reply(txt);
    }

    if (command === "!kreditku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("game_credits&visitor_id=" + session.visitor_id);
      if (!res.data?.length) return reply("💎 Kamu belum punya kredit game.\n\n💡 Beli kredit: !belikredit");
      const c = res.data[0];
      return reply("💎 *Kredit Game:*\n\nKredit: " + c.credits + (c.unlimited_until ? "\n♾️ Unlimited sampai: " + new Date(c.unlimited_until).toLocaleString("id-ID") : ""));
    }

    if (command === "!streakku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("streaks&visitor_id=" + session.visitor_id);
      if (!res.data?.length) return reply("🔥 Belum ada data streak.");
      const s = res.data[0];
      return reply("🔥 *Streak " + session.username + ":*\n\n🔥 Streak: " + s.current_streak + " hari\n🏆 Terpanjang: " + s.longest_streak + "\n📅 Total klaim: " + s.total_claims + "\n📆 Terakhir: " + s.last_claim_date);
    }

    if (command === "!notifku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("notifications&visitor_id=" + session.visitor_id);
      if (!res.data?.length) return reply("🔔 Tidak ada notifikasi.");
      const list = res.data.slice(0, 10).map((n, i) => {
        const date = new Date(n.created_at).toLocaleDateString("id-ID");
        const icon = n.type === "warning" ? "⚠️" : n.type === "success" ? "✅" : "ℹ️";
        return (i+1) + ". " + icon + " *" + n.title + "*\n   " + (n.message || "-") + " — " + date;
      }).join("\n");
      return reply("🔔 *Notifikasi " + session.username + ":*\n\n" + list);
    }

    if (command === "!slotnotif" || command === "!notifslot") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("wa_notif_slots&visitor_id=" + session.visitor_id);
      const list = res.data || [];
      if (!list.length) return reply("📭 *Slot Notifikasi WA*\n\nKamu belum menambahkan nomor.\nBuka aplikasi → menu *Plus* → *Notifikasi WA* untuk menambahkan.");
      const lines = list.map((n) => {
        const events = [];
        if (n.notify_purchase) events.push("Beli");
        if (n.notify_login) events.push("Login");
        if (n.notify_deposit) events.push("Deposit");
        const evt = events.length ? events.join(", ") : "(semua mati)";
        const paid = n.is_paid ? (n.paid_until ? "💳 Bayar s/d " + new Date(n.paid_until).toLocaleDateString("id-ID") : "💳 Bayar") : "🆓 Gratis";
        const label = n.label ? " — " + n.label : "";
        return "▸ *Slot " + n.slot_index + "*" + label + "\n   📱 " + n.wa_number + "\n   🔔 " + evt + "\n   " + paid;
      }).join("\n\n");
      return reply("📡 *Slot Notifikasi WA — " + session.username + "*\n" + "─────────────────────\n" + lines + "\n─────────────────────\n💡 Slot 1-2 gratis, slot 3-5 berbayar Rp 5.000/30 hari. Atur via menu *Plus → Notifikasi WA*.");
    }

    if (command === "!deposit" || command === "!buatdeposit") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      chatFlows[remoteJid] = { type: "deposit_amount" };
      return reply("💰 *Buat Deposit*\n\nMasukkan nominal deposit sekarang.\nContoh: 50000");
    }

    if (command.startsWith("!deposit ") || command.startsWith("!buatdeposit ")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      if (args.length < 2) return reply("⚠️ Cukup ketik *!deposit* lalu bot akan minta nominal dan metode pembayaran.");
      const amount = Number(args[0]);
      const method = (args[1] || "qris").toUpperCase();
      if (!amount || amount < 1000) return reply("⚠️ Minimal deposit Rp 1.000");
      const res = await api("create_deposit", "POST", { visitor_id: session.visitor_id, amount, payment_method: method, username: session.username });
      if (res.error) return reply("❌ " + res.error);
      const dep = res.data || res;
      pendingDeposits[remoteJid] = dep;
      await sendDepositInstructions(client, remoteJid, msg, dep);
      return;
    }

    // ═══ RIWAYAT CONFESS (kartu) ═══
    if (command === "!riwayatconfess" || command.startsWith("!riwayatconfess ")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const r = await api("confess_history&visitor_id=" + session.visitor_id);
      const list = Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : [];
      if (!list.length) return reply("💌 Belum ada riwayat confess.");
      const per = 8, pages = Math.max(1, Math.ceil(list.length / per)), page = Math.min(Math.max(1, Number(args[0]) || 1), pages);
      const items = list.slice((page - 1) * per, page * per).map((c, i) => {
        const active = c.session_until && new Date(c.session_until) > new Date() && !c.chat_stopped;
        return { tag: "#" + ((page - 1) * per + i + 1) + " " + (c.trx_id || "-"), tagColor: c.status === "sent" || c.status === "success" ? "green" : c.status === "failed" ? "red" : "amber", title: "Ke: " + (c.targets || []).map((t) => t.phone_masked).slice(0, 2).join(", ") + (c.num_targets > 2 ? " +" + (c.num_targets - 2) : ""), amount: fmtRp(c.total_price), date: dtText(c.created_at), status: String(c.status || "-").toUpperCase() + (active ? " • SESI AKTIF" : "") };
      });
      const ac = await api("account_card&visitor_id=" + session.visitor_id).catch(() => null);
      const ok = await sendRenderedCard(client, remoteJid, () => cardRender?.renderListCard?.({ ...CARD_BASE(), color: "pink", kicker: "RIWAYAT CONFESS", headline: session.username, page, pages,
        summary: [["Saldo", fmtRp(ac?.user?.balance ?? session.balance)], ["Total confess", String(list.length)], ["Total biaya", fmtRp(list.reduce((a, c) => a + Number(c.total_price || 0), 0))]],
        items, footer: ["Nomor penerima disamarkan demi privasi.", "Halaman lain: .riwayatconfess [halaman]"] }), "AGUNG ADI STORE • Riwayat confess " + page + "/" + pages, list.slice(0, 10).map((c) => "• " + c.trx_id + " — " + fmtRp(c.total_price) + " — " + String(c.status).toUpperCase() + " — " + dtText(c.created_at)).join("\n"), msg);
      return sendUi(client, remoteJid, { body: "💌 Halaman " + page + "/" + pages, quick: [page < pages ? { id: "!riwayatconfess " + (page + 1), title: "➡️ Berikutnya" } : null, { id: "!confess", title: "💌 Buat Confess" }, { id: "!ui confess", title: "↩️ Kembali" }].filter(Boolean) }, msg).then(() => ok);
    }

    // ═══ CEK DEPOSIT ═══
    if (command.startsWith("!cekdeposit")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const trxId = args[0];
      if (!trxId) return reply("⚠️ Gunakan: !cekdeposit [ID transaksi]\nContoh: !cekdeposit DEP-ABC123");
      const res = await api("deposits");
      const dep = (res.data || []).find((d) => d.visitor_id === session.visitor_id && (d.trx_id === trxId || d.trx_id.includes(trxId)));
      if (!dep) return reply("❌ Deposit tidak ditemukan: " + trxId);
      try {
        const det = await fetchDepositDetail(dep.trx_id); const D = det?.deposit || dep; const U = det?.user || {};
        const kind = D.status === "approved" ? ["🟢 SUCCESS", "green"] : D.status === "rejected" ? ["🔴 REJECTED", "red"] : D.status === "cancelled" ? ["DIBATALKAN", "red"] : D.proof_received_at ? ["🟠 MENUNGGU ADMIN", "orange"] : ["🟡 PENDING", "amber"];
        const label = kind[0].replace(/^\S+\s/, "");
        const ok = await sendRenderedCard(client, remoteJid, () => cardRender?.renderInfoCard?.({ ...CARD_BASE(), color: kind[1], kicker: "STATUS DEPOSIT", headline: D.trx_id,
          left: [["user", "Username", U.username || D.username || "Belum tersedia"], ["wa", "WhatsApp", U.phone || displaySenderPhone || "Belum tersedia"], ["mail", "Email", U.email || "Belum tersedia"], ["money", "Nominal", fmtRp(D.amount), "#7de3ff"], ["card", "Metode", String(D.payment_method || "-").toUpperCase()]],
          right: [["wallet", "Saldo awal", D.balance_before != null ? fmtRp(D.balance_before) : "Belum ada"], ["up", "Saldo setelah", D.balance_after != null ? fmtRp(D.balance_after) : "Belum ada"], ["clock", "Deposit", dtText(D.created_at)], ["clock", "Bukti", dtText(D.proof_received_at)], ["clock", "Konfirmasi", dtText(D.processed_at)], ["id", "Alasan", D.status === "rejected" ? (D.cancel_reason || "-") : "-"]],
          status: label, statusColor: kind[1], footer: ["AGUNG ADI STORE", "Saldo bertambah hanya setelah admin mengonfirmasi."] }), "AGUNG ADI STORE • " + label, null, msg);
        if (ok) return;
      } catch (e) { console.log("[cekdeposit-card] gagal:", e?.message); }
      const st = dep.status === "approved" ? "✅ SUCCESS" : dep.status === "rejected" ? "❌ REJECTED" + (dep.cancel_reason ? " (" + dep.cancel_reason + ")" : "") : dep.status === "cancelled" ? "🚫 DIBATALKAN" : dep.proof_received_at ? "🟡 WAITING_ADMIN (bukti diterima)" : "⏳ PENDING (belum kirim bukti)";
      return reply("🏦 *Status Deposit:*\n\n🆔 " + dep.trx_id + "\n💰 " + fmtRp(dep.amount) + "\n💳 " + dep.payment_method + "\n📌 Status: " + st + "\n📅 " + new Date(dep.created_at).toLocaleString("id-ID"));
    }

    // ═══ BUKTI BAYAR (foto) ═══
    if (command === "!bukti") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const deposit = await getLatestPendingDeposit(session, remoteJid);
      if (!deposit) return reply("⚠️ Belum ada deposit pending. Ketik *!deposit* dulu untuk membuat deposit.");
      pendingDeposits[remoteJid] = deposit;
      return reply("📸 *Kirim Foto Bukti Bayar*\n\n🆔 " + (deposit.trx_id || "-") + "\nSekarang kirim foto bukti pembayaran. Tidak perlu tulis ID transaksi lagi.");
    }

    // ═══ PURCHASE WITH PIN FLOW (TANPA SIMPAN SESI) ═══
    // startPurchaseFlow() didefinisikan di atas (scope handler)


    if (command === "!batal") {
      if (pinPending[remoteJid]) {
        delete pinPending[remoteJid];
        return reply("🚫 Pembelian dibatalkan.");
      }
      if (chatFlows[remoteJid]) {
        delete chatFlows[remoteJid];
        return reply("🚫 Proses dibatalkan.");
      }
      return reply("ℹ️ Tidak ada transaksi yang pending.");
    }

    // ═══ BELI PRODUK ═══
    if (command.startsWith("!beli ") && !command.startsWith("!belistreak") && !command.startsWith("!belikredit") && !command.startsWith("!belistorage") && !command.startsWith("!belibundle")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const lastArg = args[args.length - 1];
      const qty = args.length > 1 && /^\d+$/.test(lastArg) ? Number(lastArg) : 1;
      const nameParts = qty > 1 ? args.slice(0, -1) : args;
      const productQuery = nameParts.join(" ");
      if (!productQuery) return reply("⚠️ Gunakan:\n• !beli [#ID produk] [jumlah]\n• !beli [nama produk] [jumlah]\n\nContoh:\n• !beli #93100 1\n• !beli Netflix 1\n\n💡 Lihat ID produk di !produk");
      
      const product = await findProduct(productQuery);
      if (!product) return reply("❌ Produk '" + productQuery + "' tidak ditemukan.\n💡 Ketik !produk untuk lihat daftar.");
      
      // Check PIN exists first
      const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
      if (!apiHasPin(pinCheck)) return reply("🔐 *PIN belum dibuat!*\n\nKetik !buatpin [6 digit] untuk buat PIN.\nContoh: !buatpin 123456\n\n⚠️ PIN wajib untuk setiap transaksi.");

      return startPurchaseFlow("purchase_product", {
        visitor_id: session.visitor_id,
        product_id: product.id,
        quantity: qty,
      }, (pd) => {
        let txt = "✅ *Pembelian Berhasil!*\n\n📦 " + (pd.product?.title || product.title) + "\n🆔 " + shortId(product.id) + "\n🔢 Jumlah: " + (pd.quantity || qty) + "\n💰 Total: " + fmtRp(pd.total_price) + "\n💳 Sisa Saldo: " + fmtRp(pd.balance_remaining);
        if (pd.discount_amount > 0) txt += "\n🏷️ Diskon: " + fmtRp(pd.discount_amount);
        if (pd.tokens?.length) {
          txt += "\n\n🎫 *Voucher:*";
          pd.tokens.forEach((t, i) => {
            txt += "\n" + (i+1) + ". " + t.token_code;
            if (t.fields?.length) t.fields.forEach((f) => { txt += "\n   " + f.field_name + ": " + f.field_value; });
          });
        }
        return txt;
      });
    }

    if (command.startsWith("!belistreak")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const packageName = args.join(" ");
      if (!packageName) {
        const pkgs = await api("packages&type=streak");
        const list = (pkgs.data?.streak || []).map((p, i) => (i+1) + ". " + p.name + " — " + fmtRp(p.price) + " (" + p.days + " hari)").join("\n");
        return reply("🔥 *Paket Auto-Klaim Streak:*\n\n" + (list || "Tidak ada paket") + "\n\n💡 Gunakan: !belistreak [nama paket]");
      }
      const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
      if (!apiHasPin(pinCheck)) return reply("🔐 *PIN belum dibuat!*\nKetik !buatpin [6 digit] untuk buat PIN.");
      return startPurchaseFlow("purchase_streak", { visitor_id: session.visitor_id, package_name: packageName }, (sd) => {
        return "✅ *Paket Streak Berhasil!*\n\n🔥 Paket: " + (sd.plan || packageName) + "\n📅 Aktif sampai: " + (sd.expires_at ? new Date(sd.expires_at).toLocaleString("id-ID") : "-") + "\n💳 Sisa Saldo: " + fmtRp(sd.balance_remaining) + (sd.discount_amount > 0 ? "\n🏷️ Diskon: " + fmtRp(sd.discount_amount) : "") + (sd.auto_claimed ? "\n✅ Streak hari ini otomatis diklaim!" : "");
      });
    }

    if (command.startsWith("!belikredit")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const packageName = args.join(" ");
      if (!packageName) {
        const pkgs = await api("packages&type=credit");
        const list = (pkgs.data?.credit || []).map((p, i) => (i+1) + ". " + p.label + " — " + fmtRp(p.price) + " (" + (p.is_unlimited ? "Unlimited " + p.unlimited_days + " hari" : p.credits + " kredit") + ")").join("\n");
        return reply("💎 *Paket Kredit Game:*\n\n" + (list || "Tidak ada paket") + "\n\n💡 Gunakan: !belikredit [nama paket]");
      }
      const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
      if (!apiHasPin(pinCheck)) return reply("🔐 *PIN belum dibuat!*\nKetik !buatpin [6 digit] untuk buat PIN.");
      return startPurchaseFlow("purchase_credits", { visitor_id: session.visitor_id, package_name: packageName }, (cd) => {
        return "✅ *Kredit Game Berhasil!*\n\n💎 " + (cd.plan || cd.label || packageName) + "\n💳 Sisa Saldo: " + fmtRp(cd.balance_remaining) + (cd.discount_amount > 0 ? "\n🏷️ Diskon: " + fmtRp(cd.discount_amount) : "");
      });
    }

    if (command.startsWith("!belistorage")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const packageName = args.join(" ");
      if (!packageName) {
        const pkgs = await api("packages&type=storage");
        const list = (pkgs.data?.storage || []).map((p, i) => (i+1) + ". " + p.name + " — " + fmtRp(p.price) + " (" + p.storage_mb + " MB)").join("\n");
        return reply("💾 *Paket Storage Musik:*\n\n" + (list || "Tidak ada paket") + "\n\n💡 Gunakan: !belistorage [nama paket]");
      }
      const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
      if (!apiHasPin(pinCheck)) return reply("🔐 *PIN belum dibuat!*\nKetik !buatpin [6 digit] untuk buat PIN.");
      return startPurchaseFlow("purchase_storage", { visitor_id: session.visitor_id, package_name: packageName }, (std) => {
        return "✅ *Storage Berhasil!*\n\n💾 " + (std.plan || packageName) + "\n💳 Sisa Saldo: " + fmtRp(std.balance_remaining) + (std.discount_amount > 0 ? "\n🏷️ Diskon: " + fmtRp(std.discount_amount) : "");
      });
    }

    if (command.startsWith("!belibundle")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const packageName = args.join(" ");
      if (!packageName) {
        const pkgs = await api("packages&type=bundle");
        const list = (pkgs.data?.bundle || []).map((p, i) => (i+1) + ". " + p.name + " — " + fmtRp(p.price) + " (" + p.credits + " kredit + " + p.streak_days + " hari streak + " + p.storage_mb + " MB)").join("\n");
        return reply("🎁 *Paket Bundle:*\n\n" + (list || "Tidak ada paket") + "\n\n💡 Gunakan: !belibundle [nama paket]");
      }
      const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
      if (!apiHasPin(pinCheck)) return reply("🔐 *PIN belum dibuat!*\nKetik !buatpin [6 digit] untuk buat PIN.");
      return startPurchaseFlow("purchase_bundle", { visitor_id: session.visitor_id, package_name: packageName }, (bd) => {
        return "✅ *Bundle Berhasil!*\n\n🎁 " + (bd.plan || packageName) + "\n💳 Sisa Saldo: " + fmtRp(bd.balance_remaining) + (bd.discount_amount > 0 ? "\n🏷️ Diskon: " + fmtRp(bd.discount_amount) : "");
      });
    }

    // ── DETAIL TRANSAKSI ──
    if (command.startsWith("!detailtrx")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const trxId = args[0];
      if (!trxId) return reply("⚠️ Gunakan: !detailtrx [TRX-ID]");
      const res = await api("transaction_detail&trx_id=" + encodeURIComponent(trxId));
      if (res.error) return reply("❌ " + res.error);
      const t = res.data;
      if (!t) return reply("❌ Transaksi tidak ditemukan.");
      let txt = "📋 *Detail Transaksi:*\n\n🆔 " + (t.trx_id || "-");
      txt += "\n📌 Tipe: " + (t.type || "-").toUpperCase();
      txt += "\n💰 Jumlah: " + fmtRp(t.amount);
      txt += "\n📝 Deskripsi: " + (t.description || "-");
      txt += "\n📅 Tanggal: " + new Date(t.created_at).toLocaleString("id-ID");
      if (t.products) txt += "\n📦 Produk: " + t.products.title + " (" + fmtRp(t.products.price) + ")";
      return reply(txt);
    }

    // ── GROSIR / WHOLESALE ──
    if (command.startsWith("!grosir")) {
      const q = args.join(" ");
      if (!q) return reply("⚠️ Gunakan: !grosir [nama produk]");
      const p = await findProduct(q);
      if (!p) return reply("❌ Produk '" + q + "' tidak ditemukan.");
      const wRes = await api("wholesale&product_id=" + p.id);
      let txt = "📦 *Harga Grosir: " + p.title + "* " + shortId(p.id) + "\n\n💰 Harga satuan: " + fmtRp(p.price);
      if (!wRes.data?.length) {
        txt += "\n\nBelum ada harga grosir untuk produk ini.";
      } else {
        txt += "\n\n📊 *Tier Grosir:*";
        wRes.data.forEach((w) => { txt += "\n• Min " + w.min_quantity + " pcs → " + fmtRp(w.price_per_item) + "/pcs"; });
      }
      return reply(txt);
    }

    // ── FLASH SALE ──
    if (command === "!flashsale") {
      const res = await api("admin_settings");
      const settings = Object.fromEntries((res.data || []).map((r) => [r.setting_key, r.setting_value || ""]));
      const flashEnd = settings.flash_sale_end;
      const isActive = !!flashEnd && new Date(flashEnd) > new Date();
      if (!isActive) return reply("🔥 Tidak ada Flash Sale aktif saat ini.");
      const endDate = new Date(flashEnd).toLocaleString("id-ID");
      let txt = "🔥 *FLASH SALE AKTIF!*\n⏰ Berakhir: " + endDate + "\n";
      const categories = [
        { key: "promo_product_discount", label: "Produk" },
        { key: "promo_credit_discount", label: "Kredit Game" },
        { key: "promo_streak_discount", label: "Streak" },
        { key: "promo_storage_discount", label: "Storage" },
        { key: "promo_bundle_discount", label: "Bundle" },
      ];
      categories.forEach((c) => {
        const d = Number(settings[c.key] || 0);
        if (d > 0) txt += "\n🏷️ " + c.label + ": *" + d + "% OFF*";
      });
      return reply(txt);
    }

    // ── PRODUK (with short IDs) ──
    if (command === "!produk") {
      const res = await api("products");
      if (!res.data?.length) return reply("📦 Tidak ada produk.");
      const list = res.data.slice(0, 20).map((p, i) => (i+1) + ". " + shortId(p.id) + " " + p.title + " — " + fmtRp(p.price) + " (Stok: " + p.stock + ")").join("\n");
      return reply("📦 *Daftar Produk:*\n\n" + list + (res.data.length > 20 ? "\n\n...dan " + (res.data.length - 20) + " lainnya" : "") + "\n\n💡 Beli: !beli #[ID] atau !beli [nama]");
    }

    if (command.startsWith("!cari ")) {
      const q = args.join(" ").toLowerCase();
      const res = await api("products");
      const found = (res.data || []).filter((p) => p.title.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
      if (!found.length) return reply("🔍 Tidak ditemukan produk dengan kata: " + q);
      const list = found.slice(0, 15).map((p, i) => (i+1) + ". " + shortId(p.id) + " " + p.title + " — " + fmtRp(p.price)).join("\n");
      return reply("🔍 *Hasil Pencarian:* " + q + "\n\n" + list + "\n\n💡 Beli: !beli #[ID] atau !beli [nama]");
    }

    if (command === "!kategori") {
      const res = await api("products");
      const cats = [...new Set((res.data || []).map((p) => p.category || "Umum"))];
      return reply("📂 *Kategori Produk:*\n\n" + cats.map((c, i) => (i+1) + ". " + c).join("\n"));
    }

    if (command.startsWith("!harga")) {
      const min = Number(args[0]) || 0;
      const max = Number(args[1]) || 999999999;
      const res = await api("products");
      const found = (res.data || []).filter((p) => p.price >= min && p.price <= max);
      if (!found.length) return reply("💰 Tidak ada produk di range " + fmtRp(min) + " - " + fmtRp(max));
      const list = found.slice(0, 15).map((p, i) => (i+1) + ". " + shortId(p.id) + " " + p.title + " — " + fmtRp(p.price)).join("\n");
      return reply("💰 *Produk Range* " + fmtRp(min) + " - " + fmtRp(max) + ":\n\n" + list);
    }

    if (command === "!random") {
      const res = await api("products");
      if (!res.data?.length) return reply("📦 Tidak ada produk.");
      const p = res.data[Math.floor(Math.random() * res.data.length)];
      return reply("🎲 *Produk Random:*\n\n" + shortId(p.id) + " 📦 " + p.title + "\n💰 " + fmtRp(p.price) + "\n📊 Stok: " + p.stock + "\n📝 " + (p.description || "-"));
    }

    if (command === "!top") {
      const res = await api("products");
      const sorted = (res.data || []).sort((a, b) => b.stock - a.stock).slice(0, 10);
      if (!sorted.length) return reply("📦 Tidak ada produk.");
      const list = sorted.map((p, i) => (i+1) + ". " + shortId(p.id) + " " + p.title + " — " + fmtRp(p.price) + " (Stok: " + p.stock + ")").join("\n");
      return reply("🏆 *Top Produk:*\n\n" + list);
    }

    if (command.startsWith("!detailproduk")) {
      const id = args.join(" ");
      if (!id) return reply("⚠️ Gunakan: !detailproduk [#id/nama]");
      const p = await findProduct(id);
      if (!p) return reply("❌ Produk tidak ditemukan.");
      const _pBody = "🆔 *" + shortId(p.id) + "*\n📌 " + p.title + "\n💰 Harga: " + fmtRp(p.price) + "\n📊 Stok: " + p.stock + "\n🏷️ Kategori: " + (p.category || "Umum") + "\n🛡️ Garansi: " + (p.has_warranty ? "Ya" : "Tidak") + "\n📝 " + (p.description || "-") + "\n\n🔗 Bagikan: " + WEB_URL + "\n💡 Beli: !beli " + shortId(p.id);
      const _pBtns = [];
      if (Number(p.stock) > 0) _pBtns.push({ id: "!beli " + shortId(p.id), title: "🛒 Beli" });
      _pBtns.push({ id: "!wishlist add " + shortId(p.id), title: "❤️ Wishlist" }, { id: "!ui belanja", title: "⬅️ Kembali" });
      return sendUi(client, remoteJid, { title: "🛍️ DETAIL PRODUK", body: _pBody, buttons: _pBtns }, msg);
    }

    // ── DETAIL SPONSOR LENGKAP ──
    if (command.startsWith("!detailsponsor")) {
      const no = args[0];
      if (!no) return reply("⚠️ Gunakan: !detailsponsor [nomor]");
      const res = await api("sponsor_detail&sponsor_number=" + no);
      if (res.error) {
        const res2 = await api("sponsors");
        const s = (res2.data || []).find((x) => String(x.sponsor_number) === no);
        if (!s) return reply("❌ Sponsor #" + no + " tidak ditemukan.");
        return reply("🏪 *Sponsor #" + s.sponsor_number + "*\n\n📌 " + s.title + "\n💰 " + fmtRp(s.price) + "\n🏷️ Kategori: " + s.category + "\n📊 Stok: " + s.stock + "\n🏪 Penjual: " + s.seller_name + "\n📝 " + (s.description || "-"));
      }
      const s = res.data;
      let txt = "🏪 *Sponsor #" + s.sponsor_number + "*\n\n📌 " + s.title + "\n💰 " + fmtRp(s.price) + "\n🏷️ Kategori: " + s.category + "\n📊 Stok: " + s.stock + "\n🛡️ Garansi: " + (s.has_warranty ? s.warranty_duration_value + " " + s.warranty_duration_type : "Tidak") + "\n🏪 Penjual: " + s.seller_name + "\n📞 Kontak: " + s.seller_contact + "\n👁️ View: " + s.view_count + "\n📝 " + (s.description || "-");
      // Social media — always show section
      txt += "\n\n📱 *Sosmed Penjual:*";
      if (s.wa_number) txt += "\n• WhatsApp: " + s.wa_number;
      if (s.instagram) txt += "\n• Instagram: " + s.instagram;
      if (s.facebook) txt += "\n• Facebook: " + s.facebook;
      if (s.tiktok) txt += "\n• TikTok: " + s.tiktok;
      if (s.twitter) txt += "\n• Twitter: " + s.twitter;
      if (s.threads) txt += "\n• Threads: " + s.threads;
      if (!s.wa_number && !s.instagram && !s.facebook && !s.tiktok && !s.twitter && !s.threads) txt += "\n(Belum ada info sosmed)";
      if (s.images?.length) { txt += "\n\n📸 Foto: " + s.images.length + " gambar"; s.images.forEach((img, i) => { txt += "\n" + (i+1) + ". " + img.image_url; }); }
      return reply(txt);
    }

    // ── SPONSOR LIST ──
    if (command === "!sponsor") {
      const res = await api("sponsors");
      const active = (res.data || []).filter((s) => s.is_active);
      if (!active.length) return reply("🏪 Tidak ada sponsor aktif.");
      const list = active.slice(0, 15).map((s, i) => (i+1) + ". #" + s.sponsor_number + " " + s.title + " — " + fmtRp(s.price) + "\n   🏪 " + s.seller_name + " | Stok: " + s.stock).join("\n");
      return reply("🏪 *Sponsor Aktif:*\n\n" + list + "\n\n💡 Detail: !detailsponsor [nomor]");
    }

    // ── MUSIK ──
    if (command === "!lagu") {
      const res = await api("songs");
      if (!res.data?.length) return reply("🎵 Tidak ada lagu.");
      const list = res.data.slice(0, 20).map((s, i) => (i+1) + ". " + s.title + " — " + s.artist).join("\n");
      return reply("🎵 *Daftar Lagu:*\n\n" + list + (res.data.length > 20 ? "\n\n...dan " + (res.data.length - 20) + " lainnya" : "") + "\n\n💡 Download: !download [judul]\n🔊 Kirim audio: !kirim [judul]");
    }

    if (command.startsWith("!carilagu ")) {
      const q = args.join(" ").toLowerCase();
      const res = await api("songs");
      const found = (res.data || []).filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
      if (!found.length) return reply("🔍 Lagu tidak ditemukan: " + q);
      const list = found.slice(0, 15).map((s, i) => (i+1) + ". " + s.title + " — " + s.artist).join("\n");
      return reply("🔍 *Hasil Cari Lagu:*\n\n" + list);
    }

    if (command.startsWith("!download ")) {
      const q = args.join(" ");
      if (!q) return reply("⚠️ Gunakan: !download [judul lagu]");
      const res = await api("song_url&q=" + encodeURIComponent(q));
      if (!res.data?.length) return reply("🎵 Lagu tidak ditemukan: " + q);
      const list = res.data.map((s, i) => {
        const dur = s.duration ? Math.floor(s.duration / 60) + ":" + String(s.duration % 60).padStart(2, "0") : "-";
        return (i+1) + ". 🎵 *" + s.title + "* — " + s.artist + "\n   ⏱️ " + dur + "\n   🔗 " + s.file_url;
      }).join("\n\n");
      return reply("🎵 *Hasil Download:*\n\n" + list);
    }

    if (command === "!artis") {
      const res = await api("artists");
      if (!res.data?.length) return reply("🎤 Tidak ada artis.");
      const list = res.data.slice(0, 20).map((a, i) => (i+1) + ". " + a.name + (a.genre ? " (" + a.genre + ")" : "")).join("\n");
      return reply("🎤 *Daftar Artis:*\n\n" + list);
    }

    if (command === "!playlist") {
      const res = await api("playlists");
      if (!res.data?.length) return reply("🎵 Tidak ada playlist.");
      const list = res.data.slice(0, 15).map((p, i) => (i+1) + ". " + p.name + " (" + (p.playlist_items?.length || 0) + " lagu)").join("\n");
      return reply("📋 *Daftar Playlist:*\n\n" + list);
    }

    if (command === "!publik" || command === "!musikpublik") {
      const res = await api("public_songs");
      if (!res.data?.length) return reply("🎵 Tidak ada lagu publik.");
      const list = res.data.slice(0, 15).map((s, i) => (i+1) + ". " + s.title + " — " + s.artist + " [" + s.status + "]").join("\n");
      return reply("🎵 *Lagu Publik:*\n\n" + list);
    }

    // ═══ KIRIM FILE LAGU ═══
    if (command.startsWith("!kirim ")) {
      const q = args.join(" ");
      if (!q) return reply("⚠️ Gunakan: !kirim [judul lagu]");
      const res = await api("song_url&q=" + encodeURIComponent(q));
      if (!res.data?.length) return reply("🎵 Lagu tidak ditemukan: " + q);
      const song = res.data[0];
      try {
        await reply("⏳ Mengirim lagu *" + song.title + "* — " + song.artist + "...");
        const response = await fetch(song.file_url);
        if (!response.ok) throw new Error("Fetch failed");
        const arrayBuf = await response.arrayBuffer();
        const audioBuf = Buffer.from(arrayBuf);
        await client.sendMessage(remoteJid, { audio: audioBuf, mimetype: "audio/mpeg", fileName: song.title + " - " + song.artist + ".mp3", ptt: false }, { quoted: msg });
        return;
      } catch (e) {
        return reply("🎵 *" + song.title + "* — " + song.artist + "\n\n❌ Gagal kirim file. Download manual:\n🔗 " + song.file_url);
      }
    }

    // ── INFO & STATS ──
    if (command === "!info" || command === "!toko" || command === "!rangkuman") {
      const res = await api("dashboard");
      const d = res.data || {};
      return reply("📊 *Statistik Toko:*\n\n📦 Produk: " + d.products + "\n👥 User: " + d.users + "\n🎵 Lagu: " + d.songs + "\n🏪 Sponsor: " + d.sponsors + "\n🏦 Deposit: " + d.deposits + "\n🎫 Tiket: " + d.tickets + "\n💰 Total Saldo: " + fmtRp(d.total_balance));
    }

    if (command.startsWith("!ceksaldo")) {
      const nama = args.join(" ");
      if (!nama) return reply("⚠️ Gunakan: !ceksaldo [username]");
      // Non-admin can only check own balance
      if (!isAdmin(msg) && session && nama.toLowerCase() !== session.username.toLowerCase()) {
        return reply("🔒 Kamu hanya bisa cek saldo sendiri. Ketik !saldoku");
      }
      const res = await api("balances");
      const user = (res.data || []).find((u) => u.username.toLowerCase().includes(nama.toLowerCase()));
      if (!user) return reply("❌ User '" + nama + "' tidak ditemukan.");
      return reply("💰 *Saldo " + user.username + ":*\n\n" + fmtRp(user.balance));
    }

    if (command.startsWith("!cekgame")) {
      const nama = args.join(" ");
      if (!nama) return reply("⚠️ Gunakan: !cekgame [username]");
      const user = await resolveVid(nama);
      if (!user) return reply("❌ User tidak ditemukan.");
      const gs = await api("game_stats&visitor_id=" + user.visitor_id);
      if (!gs.data?.length) return reply("🎮 " + user.username + " belum punya stats game.");
      const list = gs.data.map((g) => "• " + g.game_type + ": W" + g.wins + "/L" + g.losses + " | Pts:" + g.points).join("\n");
      return reply("🎮 *Game Stats " + user.username + ":*\n\n" + list);
    }

    if (command === "!paket") {
      const res = await api("packages");
      const d = res.data || {};
      let txt = "📦 *Paket Tersedia:*\n";
      if (d.credit?.length) { txt += "\n💎 *Kredit Game:*\n" + d.credit.map((p) => "• " + p.label + " — " + fmtRp(p.price) + " (" + p.credits + " kredit)").join("\n"); }
      if (d.streak?.length) { txt += "\n\n🔥 *Streak:*\n" + d.streak.map((p) => "• " + p.name + " — " + fmtRp(p.price) + " (" + p.days + " hari)").join("\n"); }
      if (d.storage?.length) { txt += "\n\n💾 *Storage:*\n" + d.storage.map((p) => "• " + p.name + " — " + fmtRp(p.price) + " (" + p.storage_mb + " MB)").join("\n"); }
      if (d.bundle?.length) { txt += "\n\n🎁 *Bundle:*\n" + d.bundle.map((p) => "• " + p.name + " — " + fmtRp(p.price)).join("\n"); }
      return reply(txt);
    }

    if (command === "!cekvoucher" || command === "!promo") {
      const res = await api("vouchers");
      const d = res.data || {};
      let txt = "🎟️ *Voucher Aktif:*\n";
      const allV = [...(d.discount || []), ...(d.game || []), ...(d.streak || []), ...(d.music || []), ...(d.storage || [])].filter((v) => v.is_active);
      if (!allV.length) return reply("🎟️ Tidak ada voucher aktif saat ini.");
      allV.slice(0, 15).forEach((v) => { txt += "\n• " + v.code + " — Diskon " + fmtRp(v.discount_amount || v.storage_mb || 0) + " (Sisa: " + (v.max_uses - v.used_count) + "x)"; });
      return reply(txt);
    }

    if (command === "!lb") {
      const res = await api("balances");
      const sorted = (res.data || []).sort((a, b) => b.balance - a.balance).slice(0, 10);
      if (!sorted.length) return reply("🏆 Belum ada data leaderboard.");
      const list = sorted.map((u, i) => (i+1) + ". " + u.username + " — " + fmtRp(u.balance)).join("\n");
      return reply("🏆 *Leaderboard Saldo:*\n\n" + list);
    }

    // ═══ KLAIM VOUCHER ═══
    if (command.startsWith("!klaim ")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const codes = args.filter((c) => c.length > 0);
      if (!codes.length) return reply("⚠️ Gunakan: !klaim [kode1] [kode2] ...");
      const res = await api("claim_voucher", "POST", { visitor_id: session.visitor_id, codes, device_info: "WhatsApp Bot", browser: "Bot" });
      if (res.error) return reply("❌ " + res.error);
      if (res.data?.results) {
        const results = res.data.results;
        let txt = "🎫 *Hasil Klaim Voucher:*\n";
        results.forEach((r) => { txt += "\n" + (r.success ? "✅" : "❌") + " " + r.code + ": " + (r.message || r.error || "OK"); });
        return reply(txt);
      }
      return reply("✅ Voucher berhasil diklaim!");
    }

    // ═══ KLAIM STREAK ═══
    if (command === "!klaimstreak") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("claim_streak", "POST", { visitor_id: session.visitor_id });
      if (res.error) return reply("❌ " + res.error);
      const d = res.data || {};
      return reply("🔥 *Streak Harian:*\n\n" + (d.already_claimed ? "ℹ️ Sudah diklaim hari ini" : "✅ Berhasil diklaim!") + "\n🔥 Streak: " + (d.current_streak || 0) + " hari\n🏆 Terpanjang: " + (d.longest_streak || 0));
    }

    // ═══ LIKE/UNLIKE ═══
    if (command.startsWith("!likeproduk")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const q = args.join(" ");
      if (!q) return reply("⚠️ Gunakan: !likeproduk [nama/id produk]");
      const p = await findProduct(q);
      if (!p) return reply("❌ Produk tidak ditemukan.");
      const res = await api("like_product", "POST", { visitor_id: session.visitor_id, product_id: p.id });
      return reply((res.data?.action === "liked" ? "❤️" : "💔") + " " + p.title + " " + (res.data?.action === "liked" ? "di-like!" : "di-unlike!"));
    }

    if (command.startsWith("!likelagu")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const q = args.join(" ");
      if (!q) return reply("⚠️ Gunakan: !likelagu [judul lagu]");
      const sRes = await api("songs");
      const s = (sRes.data || []).find((x) => x.title.toLowerCase().includes(q.toLowerCase()));
      if (!s) return reply("❌ Lagu tidak ditemukan.");
      const res = await api("like_song", "POST", { visitor_id: session.visitor_id, song_id: s.id });
      return reply((res.data?.action === "liked" ? "❤️" : "💔") + " " + s.title + " " + (res.data?.action === "liked" ? "di-like!" : "di-unlike!"));
    }

    if (command.startsWith("!likesponsor")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const no = args[0];
      if (!no) return reply("⚠️ Gunakan: !likesponsor [nomor sponsor]");
      const sRes = await api("sponsors");
      const s = (sRes.data || []).find((x) => String(x.sponsor_number) === no);
      if (!s) return reply("❌ Sponsor #" + no + " tidak ditemukan.");
      const res = await api("like_sponsor", "POST", { visitor_id: session.visitor_id, sponsor_id: s.id });
      return reply((res.data?.action === "liked" ? "❤️" : "💔") + " Sponsor #" + no + " " + (res.data?.action === "liked" ? "di-like!" : "di-unlike!"));
    }

    if (command === "!likeku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("user_likes&visitor_id=" + session.visitor_id);
      const d = res.data || {};
      let txt = "❤️ *Favorit Saya:*\n";
      if (d.products?.length) { txt += "\n📦 *Produk:*\n" + d.products.map((p, i) => (i+1) + ". " + (p.products?.title || p.product_id) + " — " + fmtRp(p.products?.price || 0)).join("\n"); }
      if (d.songs?.length) { txt += "\n\n🎵 *Lagu:*\n" + d.songs.map((s, i) => (i+1) + ". " + (s.playlist_songs?.title || s.song_id) + " — " + (s.playlist_songs?.artist || "")).join("\n"); }
      if (d.sponsors?.length) { txt += "\n\n🏪 *Sponsor:*\n" + d.sponsors.map((s, i) => (i+1) + ". " + (s.sponsors?.title || s.sponsor_id) + " — " + fmtRp(s.sponsors?.price || 0)).join("\n"); }
      if (!d.products?.length && !d.songs?.length && !d.sponsors?.length) txt += "\nBelum ada favorit.";
      return reply(txt);
    }

    // ═══ TIKET SUPPORT ═══
    if (command.startsWith("!buattiket")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const parts = args.join(" ").split("|");
      const category = (parts[0] || "").trim() || "Umum";
      const description = (parts[1] || "").trim();
      if (!description) return reply("⚠️ Gunakan: !buattiket [kategori] | [deskripsi masalah]\n\nKategori: Akun/Login, Refund, Deposit, Produk/Token, Rekber, Game, Musik, Lainnya\n\nContoh: !buattiket Deposit | Saldo belum masuk sudah 2 jam");
      const res = await api("create_ticket", "POST", { name: session.username, phone: session.phone || senderPhone, category, description });
      if (res.error) return reply("❌ " + res.error);
      const t = res.data;
      return reply("✅ *Tiket Dibuat!*\n\n🆔 #" + (t.ticket_number || "-") + "\n📂 " + category + "\n📝 " + description + "\n\n💡 Cek: !tiketku\nBalas: !balastiket " + (t.ticket_number || "") + " [pesan]\nLihat pesan: !tiketpesan " + (t.ticket_number || ""));
    }

    if (command === "!tiketku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("user_tickets&name=" + encodeURIComponent(session.username));
      if (!res.data?.length) return reply("🎫 Belum ada tiket support.");
      const list = res.data.slice(0, 10).map((t, i) => (i+1) + ". #" + t.ticket_number + " [" + t.status + "] " + t.category + "\n   📝 " + (t.description || "-").slice(0, 50) + "\n   📅 " + new Date(t.created_at).toLocaleDateString("id-ID")).join("\n");
      return reply("🎫 *Tiket Saya:*\n\n" + list + "\n\n💡 Lihat pesan: !tiketpesan [no_tiket]");
    }

    // ═══ LIHAT PESAN TIKET ═══
    if (command.startsWith("!tiketpesan")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const ticketRef = args[0];
      if (!ticketRef) return reply("⚠️ Gunakan: !tiketpesan [no_tiket]\nContoh: !tiketpesan 5");
      // Find ticket
      const tRes = await api("user_tickets&name=" + encodeURIComponent(session.username));
      const ticket = (tRes.data || []).find((t) => String(t.ticket_number) === ticketRef || t.id === ticketRef);
      if (!ticket) return reply("❌ Tiket #" + ticketRef + " tidak ditemukan.");
      // Get messages
      const mRes = await api("ticket_messages&ticket_id=" + ticket.id);
      const messages = mRes.data || [];
      if (!messages.length) return reply("💬 Belum ada pesan di tiket #" + ticket.ticket_number);
      let txt = "💬 *Pesan Tiket #" + ticket.ticket_number + "* [" + ticket.status + "]\n📂 " + ticket.category + "\n" + "─".repeat(30) + "\n";
      messages.forEach((m) => {
        const time = new Date(m.created_at).toLocaleString("id-ID");
        const sender = m.sender_type === "admin" ? "👨‍💼 Admin" : "👤 Kamu";
        txt += "\n" + sender + " — " + time;
        if (m.message) txt += "\n💬 " + m.message;
        if (m.image_url) txt += "\n📸 " + m.image_url;
        txt += "\n";
      });
      txt += "\n💡 Balas: !balastiket " + ticket.ticket_number + " [pesan]";
      return reply(txt);
    }

    if (command.startsWith("!balastiket")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      if (args.length < 2) return reply("⚠️ Gunakan: !balastiket [no_tiket] [pesan]");
      const ticketRef = args[0];
      const message = args.slice(1).join(" ");
      const tRes = await api("user_tickets&name=" + encodeURIComponent(session.username));
      const ticket = (tRes.data || []).find((t) => String(t.ticket_number) === ticketRef || t.id === ticketRef);
      if (!ticket) return reply("❌ Tiket #" + ticketRef + " tidak ditemukan.");
      const res = await api("reply_ticket", "POST", { ticket_id: ticket.id, message, sender_type: "user" });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Balasan terkirim ke tiket #" + ticket.ticket_number);
    }

    // ═══ SOSMED ═══
    if (command === "!sosmed") {
      const res = await api("admin_posts");
      const posts = res.data || [];
      let txt = "📱 *Social Media Admin:*\n";
      let hasSocmed = false;
      posts.forEach((p) => {
        const links = [];
        if (p.whatsapp) links.push("📞 WA: " + p.whatsapp);
        if (p.instagram) links.push("📸 IG: " + p.instagram);
        if (p.facebook) links.push("👥 FB: " + p.facebook);
        if (p.tiktok) links.push("🎵 TT: " + p.tiktok);
        if (p.youtube) links.push("📺 YT: " + p.youtube);
        if (p.twitter) links.push("🐦 X: " + p.twitter);
        if (links.length) { hasSocmed = true; txt += "\n*" + p.title + "*\n" + links.join("\n") + "\n"; }
      });
      if (!hasSocmed) txt += "\nBelum ada info sosmed.\n\n🌐 Kunjungi: " + WEB_URL;
      return reply(txt);
    }

    // ═══ FOTO PROFIL ═══
    if (command === "!fotoprofil") {
      try {
        const ppUrl = await client.profilePictureUrl(remoteJid, "image").catch(() => null);
        if (ppUrl) {
          await client.sendMessage(remoteJid, { image: { url: ppUrl }, caption: "📸 Foto profil WhatsApp kamu" }, { quoted: msg });
          return;
        }
        return reply("📸 Kamu tidak punya foto profil WhatsApp atau privasi disetel privat.");
      } catch { return reply("📸 Gagal mengambil foto profil."); }
    }

    // ═══ NO HP PENGIRIM (fixed) ═══
    if (command === "!nomorku") {
      return reply("📱 *Nomor WA Kamu:*\n\n" + displaySenderPhone + "\n\n💡 Ini nomor WhatsApp yang mengirim pesan ini.");
    }

    // ═══ BANTUAN & SYARAT ═══
    if (command === "!bantuan") {
      return reply([
        "❓ *Pusat Bantuan Lengkap*",
        "",
        "🛒 *Cara Belanja:*",
        "1. Daftar akun: !daftar [user] [hp] [email] [pass]",
        "2. Login: !login [user] [pass]",
        "3. Buat PIN: !buatpin",
        "4. Top up via deposit: !deposit",
        "5. Lihat produk: !produk",
        "6. Beli: !beli #[ID] [jumlah]",
        "7. Masukkan PIN 6 digit saat diminta",
        "",
        "🔐 *PIN & Keamanan:*",
        "• PIN wajib 6 digit, diminta setiap transaksi",
        "• PIN TIDAK disimpan di sesi bot",
        "• Lupa PIN? Ketik !resetpin",
        "• Lupa password? Ketik !resetsandi",
        "",
        "💰 *Deposit:*",
        "• Ketik !deposit lalu masukkan nominal",
        "• Pilih metode: qris atau dana",
        "• Ketik bukti lalu kirim foto bukti bayar",
        "• Cek status: !cekdeposit [ID]",
        "",
        "🎫 *Support:*",
        "• !buattiket [kategori] | [deskripsi]",
        "• !tiketku — Lihat tiket",
        "• !tiketpesan [no] — Lihat semua pesan tiket",
        "",
        "🌐 *Web App:* " + WEB_URL,
      ].join("\n"));
    }

    if (command === "!syarat") {
      return sendUi(client, remoteJid, { title: "📚 SYARAT & KETENTUAN AGUNG ADI STORE", body: [
        "Gunakan bot dengan bijak.", "",
        "• Dilarang spam.", "• Dilarang menyalahgunakan layanan.", "• Dilarang melakukan aktivitas yang melanggar hukum.",
        "• Jangan menggunakan bot untuk mengganggu pengguna lain.", "• Jangan mencoba mengeksploitasi bug.", "• Jika menemukan bug, segera laporkan kepada owner.", "",
        "🛒 *Transaksi*", "• Cek deskripsi sebelum beli; garansi sesuai detail produk.", "• Harga & stok bisa berubah.", "• Komplain maks. 1x24 jam setelah transaksi.", "",
        "🐞 Bug report: " + OWNER_LOCAL,
        "🌐 Website: " + WEB_HOST, "",
        "Dengan menggunakan layanan, pengguna dianggap memahami dan menyetujui ketentuan yang berlaku.",
      ].join("\n"), quick: [{ id: "!buattiket", title: "🐞 Lapor Bug" }, { id: "!ui main", title: "↩️ Kembali" }], links: [{ title: "👑 Hubungi Owner", url: OWNER_LINK.url }] }, msg);
    }

    // ═══ GAME AI (with timer warnings) ═══
    const gameTypes = {
      "!tekateki": { fn: "teka-teki", name: "Teka-Teki Logika", cost: 0 },
      "!tebakkata": { fn: "tebak-kata", name: "Tebak Kata", cost: 0 },
      "!tebakangka": { fn: "tebak-angka", name: "Tebak Angka", cost: 0 },
      "!tebakgambar": { fn: "tebak-gambar", name: "Tebak Gambar", cost: 0 },
      "!tebakbarang": { fn: "tebak-barang", name: "Tebak Barang", cost: 0 },
      "!pilihlanganda": { fn: "pilihan-ganda", name: "Pilihan Ganda", cost: 0 },
      "!kuisyatidak": { fn: "kuis-yatidak", name: "Kuis Ya/Tidak", cost: 0 },
      "!tekatekilanjut": { fn: "teka-teki-v2", name: "Teka-Teki V2", cost: 0 },
    };

    const TIMER_SECONDS = { mudah: 120, sedang: 90, sulit: 60 };
    const POINTS_MAP = { mudah: 10, sedang: 20, sulit: 40 };

    function isGameExpired(game) {
      if (!game || !game.startedAt) return false;
      return (Date.now() - game.startedAt) / 1000 > (game.timerSeconds || 90);
    }

    function getRemainingTime(game) {
      if (!game || !game.startedAt) return "?";
      const elapsed = Math.floor((Date.now() - game.startedAt) / 1000);
      const remaining = Math.max(0, (game.timerSeconds || 90) - elapsed);
      return Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0");
    }

    async function endGameWithResult(jid, game, correct, userAnswer) {
      delete userSessions[jid + "_game"];
      clearGameTimerWarnings(jid);
      const pts = correct ? (POINTS_MAP[game.difficulty] || 20) : 0;
      let txt = "";
      if (correct) {
        txt = "✅ *BENAR!* 🎉 +" + pts + " poin\n\n🔑 Jawaban: *" + game.answer + "*";
      } else {
        const reason = isGameExpired(game) ? "⏰ Waktu habis!" : "❌ Salah! Nyawa habis! 💀";
        txt = reason + "\n\n🔑 Jawaban yang benar: *" + game.answer + "*";
      }
      if (game.explanation) txt += "\n\n📖 " + game.explanation;
      if (session) {
        const gRes = await api("game_credits&visitor_id=" + session.visitor_id);
        const credits = gRes.data?.[0]?.credits || 0;
        txt += "\n\n💎 Kredit: " + credits;
      }
      txt += "\n\n🔄 Ketik perintah game lagi untuk soal baru.";
      return txt;
    }

    const activeGame = userSessions[remoteJid + "_game"];
    
    if (activeGame && isGameExpired(activeGame)) {
      const resultTxt = await endGameWithResult(remoteJid, activeGame, false, "");
      return reply(resultTxt);
    }

    if (activeGame && !command.startsWith("!")) {
      const userAnswer = text.trim();
      const correctAnswer = activeGame.answer;
      const normalize = (s) => s.toUpperCase().trim().replace(/\s+/g, " ");
      const isCorrect = normalize(userAnswer) === normalize(correctAnswer);
      
      if (isCorrect) {
        const resultTxt = await endGameWithResult(remoteJid, activeGame, true, userAnswer);
        return reply(resultTxt);
      } else {
        activeGame.lives = (activeGame.lives || 3) - 1;
        if (activeGame.lives <= 0) {
          const resultTxt = await endGameWithResult(remoteJid, activeGame, false, userAnswer);
          return reply(resultTxt);
        }
        userSessions[remoteJid + "_game"] = activeGame;
        let hintTxt = "";
        if (activeGame.hints?.length) {
          const hintIdx = 3 - activeGame.lives;
          if (activeGame.hints[hintIdx - 1]) hintTxt = "\n💡 Petunjuk: " + activeGame.hints[hintIdx - 1];
        }
        return reply("❌ Salah! ❤️ Nyawa: " + activeGame.lives + "/3 | ⏱️ " + getRemainingTime(activeGame) + hintTxt + "\n\nCoba lagi!");
      }
    }

    if (command.startsWith("!jawab")) {
      if (!userSessions[remoteJid + "_game"]) return reply("ℹ️ Tidak ada game aktif. Mulai: !tekateki mudah");
      const ag = userSessions[remoteJid + "_game"];
      if (isGameExpired(ag)) {
        const resultTxt = await endGameWithResult(remoteJid, ag, false, "");
        return reply(resultTxt);
      }
      const userAnswer = args.join(" ");
      if (!userAnswer) return reply("⚠️ Gunakan: !jawab [jawabanmu]");
      const normalize = (s) => s.toUpperCase().trim().replace(/\s+/g, " ");
      const isCorrect = normalize(userAnswer) === normalize(ag.answer);
      if (isCorrect) return reply(await endGameWithResult(remoteJid, ag, true, userAnswer));
      ag.lives = (ag.lives || 3) - 1;
      if (ag.lives <= 0) return reply(await endGameWithResult(remoteJid, ag, false, userAnswer));
      userSessions[remoteJid + "_game"] = ag;
      let hintTxt = "";
      if (ag.hints?.length) {
        const hintIdx = 3 - ag.lives;
        if (ag.hints[hintIdx - 1]) hintTxt = "\n💡 Petunjuk: " + ag.hints[hintIdx - 1];
      }
      return reply("❌ Salah! ❤️ Nyawa: " + ag.lives + "/3 | ⏱️ " + getRemainingTime(ag) + hintTxt + "\n\nCoba lagi!");
    }

    if (command === "!hint" || command === "!petunjuk") {
      if (!userSessions[remoteJid + "_game"]) return reply("ℹ️ Tidak ada game aktif.");
      const ag = userSessions[remoteJid + "_game"];
      if (!ag.hints?.length) return reply("💡 Tidak ada petunjuk untuk game ini.");
      const usedHints = ag.usedHints || 0;
      if (usedHints >= ag.hints.length) return reply("💡 Semua petunjuk sudah digunakan.");
      if (session) {
        const gcRes = await api("game_credits&visitor_id=" + session.visitor_id);
        const credits = gcRes.data?.[0]?.credits || 0;
        if (credits <= 0) return reply("💎 Kredit habis! Beli di !belikredit");
        await api("deduct_credit", "POST", { visitor_id: session.visitor_id, amount: 1 });
      }
      const hint = ag.hints[usedHints];
      ag.usedHints = usedHints + 1;
      userSessions[remoteJid + "_game"] = ag;
      return reply("💡 *Petunjuk " + (usedHints + 1) + "/" + ag.hints.length + ":*\n" + hint + (session ? "\n💎 -1 kredit" : "") + "\n⏱️ Sisa: " + getRemainingTime(ag));
    }

    if (command === "!nyerah" || command === "!menyerah") {
      if (!userSessions[remoteJid + "_game"]) return reply("ℹ️ Tidak ada game aktif.");
      const ag = userSessions[remoteJid + "_game"];
      delete userSessions[remoteJid + "_game"];
      clearGameTimerWarnings(remoteJid);
      return reply("🏳️ *Menyerah!*\n\n🔑 Jawaban: *" + ag.answer + "*" + (ag.explanation ? "\n\n📖 " + ag.explanation : "") + "\n\n🔄 Ketik perintah game lagi.");
    }

    const gameCmd = Object.keys(gameTypes).find((k) => command.startsWith(k));
    if (gameCmd) {
      const gt = gameTypes[gameCmd];
      const difficulty = args[0] || "sedang";
      const timerSec = TIMER_SECONDS[difficulty] || 90;

      let creditInfo = "";
      if (session) {
        const gcRes = await api("game_credits&visitor_id=" + session.visitor_id);
        const credits = gcRes.data?.[0]?.credits || 0;
        const unlimited = gcRes.data?.[0]?.unlimited_until;
        const isUnlimited = unlimited && new Date(unlimited) > new Date();
        creditInfo = "\n💎 Kredit: " + (isUnlimited ? "♾️ Unlimited" : credits);
        const gsRes = await api("game_stats&visitor_id=" + session.visitor_id);
        let totalPts = 0;
        (gsRes.data || []).forEach((g) => totalPts += g.points);
        creditInfo += " | ⭐ Level " + getGameLevel(totalPts);
      }

      await reply("🎮 *" + gt.name + "* (Tingkat: " + difficulty + ")" + creditInfo + "\n⏱️ Waktu: " + Math.floor(timerSec / 60) + ":" + String(timerSec % 60).padStart(2, "0") + "\n⏳ Membuat soal...");
      const res = await api("play_game", "POST", { game_type: gt.fn, difficulty });
      if (res.error) return reply("❌ Gagal: " + res.error);
      const d = res.data || res;

      const gameSession = {
        type: gt.fn, name: gt.name, difficulty,
        answer: (d.answer || d.jawaban || "").toUpperCase(),
        explanation: d.explanation || d.penjelasan || "",
        hints: d.hints || [], lives: 3, startedAt: Date.now(),
        timerSeconds: timerSec, usedHints: 0,
      };
      userSessions[remoteJid + "_game"] = gameSession;

      // Setup timer warnings (30s, 20s, 10s)
      setupGameTimerWarnings(remoteJid, gameSession, reply);

      const timeStr = Math.floor(timerSec / 60) + ":" + String(timerSec % 60).padStart(2, "0");
      let txt = "🎮 *" + gt.name + "*\n❤️ Nyawa: 3/3 | ⏱️ " + timeStr + "\n\n";

      // Tebak gambar — send image as buffer
      if (gt.fn === "tebak-gambar" && d.image) {
        try {
          let imgData = d.image;
          if (imgData.startsWith("data:")) imgData = imgData.split(",")[1] || imgData;
          const imgBuffer = Buffer.from(imgData, "base64");
          if (imgBuffer.length < 100) throw new Error("Image too small");
          await client.sendMessage(remoteJid, {
            image: imgBuffer,
            caption: "🎮 *" + gt.name + "*\n❤️ Nyawa: 3/3 | ⏱️ " + timeStr + "\n🔤 Jumlah huruf: " + (d.letterCount || "?") + "\n\n❓ Tebak objek apa ini?\n✏️ Ketik jawabanmu langsung atau !jawab [jawaban]\n💡 Petunjuk: !hint (1 kredit)\n🏳️ Menyerah? !nyerah"
          }, { quoted: msg });
          return;
        } catch (e) {
          console.error("Failed to send tebak-gambar image:", e?.message || e);
          // Fallback: send as URL if available
          if (d.imageUrl) {
            try {
              await client.sendMessage(remoteJid, {
                image: { url: d.imageUrl },
                caption: "🎮 *" + gt.name + "*\n❤️ Nyawa: 3/3 | ⏱️ " + timeStr + "\n🔤 Jumlah huruf: " + (d.letterCount || "?") + "\n\n❓ Tebak objek apa ini?\n✏️ Ketik jawaban atau !jawab [jawaban]"
              }, { quoted: msg });
              return;
            } catch {}
          }
          txt += "🖼️ Gambar gagal dikirim.\n";
          if (d.letterCount) txt += "🔤 Jumlah huruf: " + d.letterCount + "\n";
          if (d.hints?.[0]) txt += "💡 Petunjuk: " + d.hints[0] + "\n";
        }
      }

      if (d.riddle || d.question || d.pertanyaan) {
        txt += "❓ *Soal:* " + (d.riddle || d.question || d.pertanyaan) + "\n";
        if (d.options) { d.options.forEach((o, i) => { txt += "\n" + ["A", "B", "C", "D"][i] + ". " + o; }); txt += "\n"; }
        if (d.hints?.length) { txt += "\n💡 *Petunjuk:*\n" + d.hints[0] + "\n"; }
      } else if (d.word || d.kata) {
        txt += "🔤 Kata: " + (d.word || d.kata) + "\n";
        if (d.hint || d.petunjuk) txt += "💡 Petunjuk: " + (d.hint || d.petunjuk) + "\n";
      } else if (d.letterCount) {
        txt += "🔤 Jumlah huruf: " + d.letterCount + "\n";
        if (d.hints?.[0]) txt += "💡 Petunjuk: " + d.hints[0] + "\n";
      } else {
        txt += JSON.stringify(d, null, 2).slice(0, 300);
      }
      txt += "\n\n✏️ Ketik jawaban langsung atau !jawab [jawaban]\n💡 !hint (1 kredit) | 🏳️ !nyerah";
      return reply(txt);
    }

    // ═══ LEADERBOARD GAME ═══
    if (command === "!lbgame") {
      const res = await api("game_leaderboard");
      if (!res.data?.length) return reply("🏆 Belum ada data leaderboard game.");
      const agg = {};
      res.data.forEach((s) => {
        if (!agg[s.visitor_id]) agg[s.visitor_id] = { username: s.username, points: 0, wins: 0, losses: 0 };
        agg[s.visitor_id].points += s.points;
        agg[s.visitor_id].wins += s.wins;
        agg[s.visitor_id].losses += s.losses;
      });
      const sorted = Object.values(agg).sort((a, b) => b.points - a.points).slice(0, 10);
      const list = sorted.map((u, i) => (i+1) + ". " + u.username + " — " + u.points + " pts (W" + u.wins + "/L" + u.losses + ")").join("\n");
      return reply("🏆 *Leaderboard Game:*\n\n" + list);
    }

    // ═══ TOPUP KREDIT INFO ═══
    if (command === "!topupkredit") {
      const pkgs = await api("packages&type=credit");
      const list = (pkgs.data?.credit || []).map((p, i) => (i+1) + ". " + p.label + " — " + fmtRp(p.price)).join("\n");
      return reply("💎 *Paket Kredit Game:*\n\n" + (list || "Tidak ada paket") + "\n\n💡 Beli: !belikredit [nama paket]");
    }

    // ═══════════════════════════════════════
    // ═══ ADMIN COMMANDS ═══
    // ═══════════════════════════════════════
    if (command === "!admin") {
      if (!isAdmin(msg)) return reply("❌ Hanya admin yang bisa akses.");
      return reply([
        "🔐 *Perintah Admin v10.0.0:*",
        "",
        "💰 *Saldo:*",
        "• !saldo — Semua saldo user",
        "• !tambahsaldo [username] [jumlah]",
        "• !kurangsaldo [username] [jumlah]",
        "• !setsaldo [username] [jumlah]",
        "• !resetsaldo [username]",
        "",
        "🏦 *Deposit:*",
        "• !deposit_admin — Semua deposit",
        "• !konfirmasi [trx_id] — Konfirmasi deposit",
        "• !tolakdeposit [trx_id] [alasan] — Tolak deposit",
        "• !rekapdeposit — Rekap",
        "",
        "🔐 *Token Reset:*",
        "• !buattoken [username] pin — Token reset PIN",
        "• !buattoken [username] sandi — Token reset sandi",
        "",
        "🎮 *Game:*",
        "• !game [username] — Stats game",
        "• !kredit [username] — Kredit game",
        "• !setkredit [username] [jumlah]",
        "• !resetkredit / !resetgame [username]",
        "",
        "🔥 *Streak:*",
        "• !streak [username] / !setstreak / !resetstreak",
        "",
        "📦 *Produk & Sponsor:*",
        "• !stok [#id] [jumlah]",
        "• !stoksponsor [no] [jumlah]",
        "",
        "👥 *User:*",
        "• !user [nama] / !alluser / !topuser",
        "• !detailuser [username]",
        "• !loginhistory [username]",
        "• !transaksi [username]",
        "",
        "🎫 *Tiket:*",
        "• !tiket — Semua tiket",
        "• !tiketdetail [no]",
        "• !lihatsemuatiket [no] — Semua chat admin/user",
        "• !settiket [no] [open/closed]",
        "• !adminbalas [no_tiket] [pesan]",
        "",
        "📊 *Lainnya:*",
        "• !notif [username] [isi]",
        "• !broadcast [judul] | [isi]",
        "• !dashboard / !report",
      ].join("\n"));
    }

    // ── ADMIN: BUAT TOKEN RESET ──
    if (command.startsWith("!buattoken")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !buattoken [username] [pin/sandi]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const tokenType = args[1].toLowerCase();
      const tokenNum = Math.floor(10000 + Math.random() * 90000).toString();
      const tokenTable = tokenType === "pin" ? "pin_reset_tokens" : "password_reset_tokens";
      
      // Invalidate old tokens
      const ivRes = await api("invalidate_tokens", "POST", { visitor_id: user.visitor_id, type: tokenType });
      
      // Create new token via direct insert
      const insertRes = await api("create_reset_token", "POST", { visitor_id: user.visitor_id, token: tokenNum, type: tokenType });
      if (insertRes.error) return reply("❌ " + insertRes.error);
      
      return reply([
        "✅ *Token Reset " + (tokenType === "pin" ? "PIN" : "Password") + " Dibuat!*",
        "",
        "👤 User: " + user.username,
        "🔑 Token: #" + tokenNum,
        "⏰ Berlaku: 24 jam",
        "",
        "📋 Kirim ke user:",
        tokenType === "pin" 
          ? "!resetpin token #" + tokenNum + " [pin_baru_6digit]"
          : "!resetsandi token #" + tokenNum + " [password_baru]",
      ].join("\n"));
    }

    // ── ADMIN: KONFIRMASI DEPOSIT ──
    if (command === "!konfirmasideposit" || command.startsWith("!konfirmasideposit ")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak. Perintah ini khusus admin.");
      const trxId = String(args[0] || "").trim().toUpperCase();
      if (!/^DEP-[A-Z0-9-]{4,}$/.test(trxId)) return reply("⚠️ Gunakan: .konfirmasideposit DEP-XXXXXX");
      const det = await fetchDepositDetail(trxId);
      if (!det) return reply("❌ Deposit tidak ditemukan: " + trxId);
      if (det.deposit.status === "approved") return reply("ℹ️ Deposit sudah dikonfirmasi sebelumnya. Saldo tidak ditambah lagi.");
      if (det.deposit.status !== "pending") return reply("ℹ️ Deposit berstatus " + String(det.deposit.status).toUpperCase() + ", tidak bisa dikonfirmasi.");
      if (!det.deposit.proof_received_at) return reply("⚠️ User belum mengirim bukti pembayaran untuk " + trxId + ".");
      const res = await api("confirm_deposit", "POST", { trx_id: trxId, action: "terima" });
      if (res.error) return reply("❌ " + res.error);
      if (res.already) return reply("ℹ️ Deposit sudah dikonfirmasi sebelumnya. Saldo tidak ditambah lagi.");
      const out = await notifyDepositResult(client, "success", res);
      if (out) await sendDepositCard(client, remoteJid, "success", out.data, out.cap + (out.jid ? "\n\n📨 Kartu terkirim ke user." : "\n\n⚠️ Nomor WA user tidak tersedia."), msg);
      return;
    }

    if (command.startsWith("!konfirmasi") && !command.startsWith("!konfirmasideposit")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const trxId = args[0];
      if (!trxId) return reply("⚠️ Gunakan: !konfirmasi [trx_id]");
      // Server memproses atomik: saldo hanya ditambah sekali walau perintah diulang.
      const res = await api("confirm_deposit", "POST", { trx_id: trxId, action: "terima" });
      if (res.error) return reply("❌ " + res.error);
      if (res.already) return reply("ℹ️ Deposit " + (res.deposit?.trx_id || trxId) + " sudah diproses sebelumnya (" + String(res.new_status || "").toUpperCase() + "). Saldo tidak ditambah lagi.");
      const out = await notifyDepositResult(client, "success", res);
      if (out) await sendDepositCard(client, remoteJid, "success", out.data, out.cap + (out.jid ? "\n\n📨 Kartu terkirim ke user." : "\n\n⚠️ Nomor WA user tidak tersedia, kartu hanya ke admin."), msg);
      return;
    }

    if (command.startsWith("!tolakdeposit")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const trxId = args[0];
      if (!trxId) return reply("⚠️ Gunakan: !tolakdeposit [trx_id] [alasan]");
      const reason = args.slice(1).join(" ").trim() || "Bukti pembayaran tidak valid";
      const res = await api("confirm_deposit", "POST", { trx_id: trxId, action: "tolak", reason });
      if (res.error) return reply("❌ " + res.error);
      if (res.already) return reply("ℹ️ Deposit " + (res.deposit?.trx_id || trxId) + " sudah diproses sebelumnya (" + String(res.new_status || "").toUpperCase() + ").");
      const out = await notifyDepositResult(client, "rejected", res, reason);
      if (out) await sendDepositCard(client, remoteJid, "rejected", out.data, out.cap, msg);
      return;
    }

    if (command === "!deposit_admin") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("deposits");
      if (!res.data?.length) return reply("🏦 Tidak ada deposit.");
      const list = res.data.slice(0, 15).map((d, i) => {
        const statusIcon = d.status === "approved" ? "✅" : d.status === "rejected" ? "❌" : "⏳";
        return (i+1) + ". " + statusIcon + " " + d.username + " — " + fmtRp(d.amount) + " [" + d.status + "] " + d.payment_method + "\n   🆔 " + d.trx_id;
      }).join("\n");
      return reply("🏦 *Semua Deposit:*\n\n" + list + "\n\n💡 Konfirmasi: !konfirmasi [trx_id]\n❌ Tolak: !tolakdeposit [trx_id]");
    }

    if (command === "!rekapdeposit") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("deposits");
      const deps = res.data || [];
      const pending = deps.filter((d) => d.status === "pending");
      const approved = deps.filter((d) => d.status === "approved");
      const totalAll = deps.reduce((s, d) => s + d.amount, 0);
      return reply("🏦 *Rekap Deposit:*\n\n📊 Total: " + deps.length + "\n⏳ Pending: " + pending.length + "\n✅ Approved: " + approved.length + "\n💰 Total Amount: " + fmtRp(totalAll));
    }

    // ── ADMIN: BALAS TIKET ──
    if (command.startsWith("!adminbalas")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !adminbalas [no_tiket] [pesan]");
      const ticketRef = args[0];
      const message = args.slice(1).join(" ");
      const tRes = await api("tickets");
      const ticket = (tRes.data || []).find((t) => String(t.ticket_number) === ticketRef || t.id === ticketRef);
      if (!ticket) return reply("❌ Tiket #" + ticketRef + " tidak ditemukan.");
      const res = await api("reply_ticket", "POST", { ticket_id: ticket.id, message, sender_type: "admin" });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Balasan admin terkirim ke tiket #" + ticket.ticket_number);
    }

    // ── ADMIN: SALDO ──
    if (command === "!saldo") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("balances");
      if (!res.data?.length) return reply("💰 Tidak ada data saldo.");
      const list = res.data.slice(0, 20).map((u, i) => (i+1) + ". " + u.username + " — " + fmtRp(u.balance)).join("\n");
      return reply("💰 *Semua Saldo:*\n\n" + list + (res.data.length > 20 ? "\n\n..." + (res.data.length - 20) + " lainnya" : ""));
    }

    if (command.startsWith("!tambahsaldo")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !tambahsaldo [username] [jumlah]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("add_balance", "POST", { visitor_id: user.visitor_id, amount: Number(args[1]), description: "Top up via bot admin" });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Saldo *" + user.username + "* ditambah " + fmtRp(args[1]) + "\nSaldo baru: " + fmtRp(res.data?.new_balance));
    }

    if (command.startsWith("!kurangsaldo")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !kurangsaldo [username] [jumlah]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("deduct_balance", "POST", { visitor_id: user.visitor_id, amount: Number(args[1]), description: "Potong via bot admin" });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Saldo *" + user.username + "* dikurangi " + fmtRp(args[1]) + "\nSaldo baru: " + fmtRp(res.data?.new_balance));
    }

    if (command.startsWith("!setsaldo")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !setsaldo [username] [jumlah]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("set_balance", "POST", { visitor_id: user.visitor_id, balance: Number(args[1]) });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Saldo *" + user.username + "* diset ke " + fmtRp(args[1]));
    }

    if (command.startsWith("!resetsaldo")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !resetsaldo [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("reset_balance", "POST", { visitor_id: user.visitor_id });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Saldo *" + user.username + "* direset ke Rp 0");
    }

    // ── ADMIN: TOKEN ──
    if (command === "!token") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("tokens");
      if (!res.data?.length) return reply("🎫 Tidak ada token.");
      const list = res.data.slice(0, 15).map((t, i) => (i+1) + ". " + t.token_code + " [" + (t.is_claimed ? "Claimed" : "Available") + "] — " + (t.products?.title || "?")).join("\n");
      return reply("🎫 *Daftar Token:*\n\n" + list);
    }

    // ── ADMIN: GAME ──
    if (command.startsWith("!game ") || (command === "!game" && args[0])) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !game [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("game_stats&visitor_id=" + user.visitor_id);
      if (!res.data?.length) return reply("🎮 " + user.username + " belum punya stats game.");
      const list = res.data.map((g) => "• " + g.game_type + ": W" + g.wins + "/L" + g.losses + " | Pts:" + g.points).join("\n");
      return reply("🎮 *Game Stats " + user.username + ":*\n\n" + list);
    }

    if (command.startsWith("!kredit") && !command.startsWith("!kreditku")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !kredit [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("game_credits&visitor_id=" + user.visitor_id);
      if (!res.data?.length) return reply("💎 " + user.username + " belum punya kredit.");
      const c = res.data[0];
      return reply("💎 *Kredit " + user.username + ":*\nKredit: " + c.credits + (c.unlimited_until ? "\n♾️ Unlimited: " + new Date(c.unlimited_until).toLocaleString("id-ID") : ""));
    }

    if (command.startsWith("!setkredit")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !setkredit [username] [jumlah]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("set_credits", "POST", { visitor_id: user.visitor_id, credits: Number(args[1]) });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Kredit *" + user.username + "* diset ke " + args[1]);
    }

    if (command.startsWith("!resetkredit")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !resetkredit [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("reset_credits", "POST", { visitor_id: user.visitor_id });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Kredit *" + user.username + "* direset ke 0");
    }

    if (command.startsWith("!resetgame")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !resetgame [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("reset_game_stats", "POST", { visitor_id: user.visitor_id });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Game stats *" + user.username + "* direset");
    }

    // ── ADMIN: STREAK ──
    if (command.startsWith("!streak") && !command.startsWith("!streaksub") && !command.startsWith("!streakku")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !streak [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("streaks&visitor_id=" + user.visitor_id);
      if (!res.data?.length) return reply("🔥 " + user.username + " belum punya streak.");
      const s = res.data[0];
      return reply("🔥 *Streak " + user.username + ":*\nStreak: " + s.current_streak + "\nTerpanjang: " + s.longest_streak + "\nTotal: " + s.total_claims + "\nTerakhir: " + s.last_claim_date);
    }

    if (command.startsWith("!setstreak")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !setstreak [username] [jumlah]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("set_streak", "POST", { visitor_id: user.visitor_id, current_streak: Number(args[1]) });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Streak *" + user.username + "* diset ke " + args[1]);
    }

    if (command.startsWith("!resetstreak")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !resetstreak [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("reset_streak", "POST", { visitor_id: user.visitor_id });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Streak *" + user.username + "* direset");
    }

    // ── ADMIN: STOK ──
    if (command.startsWith("!stok ") && !command.startsWith("!stoksponsor")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !stok [#id/product_id] [jumlah]");
      const p = await findProduct(args[0]);
      if (!p) return reply("❌ Produk tidak ditemukan.");
      const res = await api("update_stock", "POST", { product_id: p.id, stock: Number(args[1]) });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Stok " + p.title + " " + shortId(p.id) + " diubah ke " + args[1]);
    }

    // ── ADMIN: USER ──
    if (command.startsWith("!user ")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const q = args.join(" ").toLowerCase();
      const res = await api("balances");
      const found = (res.data || []).filter((u) => u.username.toLowerCase().includes(q) || (u.phone || "").includes(q) || (u.email || "").toLowerCase().includes(q));
      if (!found.length) return reply("❌ User '" + q + "' tidak ditemukan.");
      const list = found.slice(0, 10).map((u, i) => (i+1) + ". " + u.username + " — " + fmtRp(u.balance) + "\n   📞 " + u.phone + " | 📧 " + (u.email || "-")).join("\n");
      return reply("👥 *Hasil Cari:*\n\n" + list);
    }

    if (command === "!alluser") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("balances");
      if (!res.data?.length) return reply("👥 Belum ada user.");
      return reply("👥 *Total User: " + res.data.length + "*\n\n" + res.data.slice(0, 20).map((u, i) => (i+1) + ". " + u.username + " — " + fmtRp(u.balance)).join("\n"));
    }

    if (command === "!topuser") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("balances");
      const sorted = (res.data || []).sort((a, b) => b.balance - a.balance).slice(0, 10);
      return reply("🏆 *Top User:*\n\n" + sorted.map((u, i) => (i+1) + ". " + u.username + " — " + fmtRp(u.balance)).join("\n"));
    }

    if (command.startsWith("!detailuser")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !detailuser [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const vid = user.visitor_id;
      const [gs, gc, st, pinCheck] = await Promise.all([
        api("game_stats&visitor_id=" + vid), api("game_credits&visitor_id=" + vid),
        api("streaks&visitor_id=" + vid), api("check_pin", "POST", { visitor_id: vid }),
      ]);
      let txt = "👤 *Detail User:*\n\n📛 " + user.username + "\n📞 " + user.phone + "\n📧 " + (user.email || "-") + "\n💰 Saldo: " + fmtRp(user.balance) + "\n🔐 PIN: " + (apiHasPin(pinCheck) ? "✅" : "❌");
      if (gc.data?.[0]) txt += "\n💎 Kredit: " + gc.data[0].credits;
      if (st.data?.[0]) txt += "\n🔥 Streak: " + st.data[0].current_streak;
      if (gs.data?.length) {
        let totalP = 0; gs.data.forEach((g) => totalP += g.points);
        txt += "\n🎮 Game: " + totalP + " pts";
      }
      return reply(txt);
    }

    if (command.startsWith("!loginhistory")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      let ep = "login_history";
      if (args[0]) {
        const user = await resolveVid(args[0]);
        if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
        ep = "login_history&visitor_id=" + user.visitor_id;
      }
      const res = await api(ep);
      if (!res.data?.length) return reply("📋 Tidak ada riwayat login.");
      const list = res.data.slice(0, 10).map((l, i) => (i+1) + ". " + new Date(l.logged_in_at).toLocaleString("id-ID") + "\n   🌐 " + (l.browser || "?") + " | 📍 " + (l.ip_address || "?")).join("\n");
      return reply("📋 *Riwayat Login:*\n\n" + list);
    }

    if (command.startsWith("!transaksi")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      let ep = "transactions";
      if (args[0]) {
        const user = await resolveVid(args[0]);
        if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
        ep = "transactions&visitor_id=" + user.visitor_id;
      }
      const res = await api(ep);
      if (!res.data?.length) return reply("📋 Tidak ada transaksi.");
      const list = res.data.slice(0, 15).map((t, i) => {
        const date = new Date(t.created_at).toLocaleDateString("id-ID");
        return (i+1) + ". [" + t.type + "] " + fmtRp(t.amount) + " — " + (t.description || "-") + "\n   📅 " + date + (t.trx_id ? " | 🆔 " + t.trx_id : "");
      }).join("\n");
      return reply("📋 *Riwayat Transaksi:*\n\n" + list);
    }

    // ── ADMIN: TIKET ──
    if (command === "!tiket") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("tickets");
      if (!res.data?.length) return reply("🎫 Tidak ada tiket.");
      const list = res.data.slice(0, 10).map((t, i) => (i+1) + ". #" + t.ticket_number + " [" + t.status + "] " + t.name + " — " + t.category).join("\n");
      return reply("🎫 *Tiket Support:*\n\n" + list + "\n\n💡 Detail: !tiketdetail [no]\n👀 Semua chat: !lihatsemuatiket [no]\n✍️ Balas: !adminbalas [no] [pesan]\n📌 Status: !settiket [no] [open/closed]");
    }

    if (command.startsWith("!settiket")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !settiket [no_tiket] [open/in_progress/resolved/closed]");
      const tRes = await api("tickets");
      const ticket = (tRes.data || []).find((t) => String(t.ticket_number) === args[0] || t.id === args[0]);
      if (!ticket) return reply("❌ Tiket tidak ditemukan.");
      const res = await api("set_ticket_status", "POST", { ticket_id: ticket.id, status: args[1] });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Tiket #" + ticket.ticket_number + " diubah ke: " + args[1]);
    }

    if (command.startsWith("!tiketdetail")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !tiketdetail [no_tiket]");
      const tRes = await api("tickets");
      const t = (tRes.data || []).find((x) => String(x.ticket_number) === args[0] || x.id === args[0]);
      if (!t) return reply("❌ Tiket tidak ditemukan.");
      // Get messages too
      const mRes = await api("ticket_messages&ticket_id=" + t.id);
      const msgCount = mRes.data?.length || 0;
      let txt = "🎫 *Tiket #" + t.ticket_number + "*\n\n📛 " + t.name + "\n📞 " + t.phone + "\n📂 " + t.category + "\n📌 Status: " + t.status + "\n📝 " + t.description + "\n📅 " + new Date(t.created_at).toLocaleString("id-ID") + "\n💬 Pesan: " + msgCount;
      if (mRes.data?.length) {
        txt += "\n\n📋 *Pesan Terakhir:*";
        mRes.data.slice(-3).forEach((m) => {
          txt += "\n" + (m.sender_type === "admin" ? "👨‍💼" : "👤") + " " + (m.message || "(foto)") + " — " + new Date(m.created_at).toLocaleString("id-ID");
        });
      }
      return reply(txt);
    }

    if (command.startsWith("!lihatsemuatiket")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !lihatsemuatiket [no_tiket]");
      const tRes = await api("tickets");
      const ticket = (tRes.data || []).find((x) => String(x.ticket_number) === args[0] || x.id === args[0]);
      if (!ticket) return reply("❌ Tiket tidak ditemukan.");
      const mRes = await api("ticket_messages&ticket_id=" + ticket.id);
      const messages = mRes.data || [];
      if (!messages.length) return reply("💬 Belum ada pesan di tiket #" + ticket.ticket_number);
      let txt = "💬 *Semua Pesan Tiket #" + ticket.ticket_number + "*\n\n📛 " + ticket.name + "\n📂 " + ticket.category + "\n📌 Status: " + ticket.status + "\n" + "─".repeat(28);
      messages.forEach((m, i) => {
        txt += "\n\n" + (i + 1) + ". " + (m.sender_type === "admin" ? "👨‍💼 *Admin*" : "👤 *User*");
        txt += "\n🕒 " + new Date(m.created_at).toLocaleString("id-ID");
        txt += "\n💬 " + (m.message || "(foto)");
      });
      return reply(txt);
    }

    // ── ADMIN: NOTIF & BROADCAST ──
    if (command.startsWith("!notif ") && !command.startsWith("!notifku")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !notif [username] [pesan]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const isi = args.slice(1).join(" ");
      const res = await api("notifications", "POST", { visitor_id: user.visitor_id, title: "Notif Admin", message: isi, type: "info" });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Notifikasi terkirim ke *" + user.username + "*");
    }

    if (command.startsWith("!broadcast")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const parts = args.join(" ").split("|");
      const title = (parts[0] || "").trim() || "Broadcast";
      const message = (parts[1] || "").trim() || "";
      const res = await api("broadcast", "POST", { title, message, type: "info" });
      if (res.error) return reply("❌ " + res.error);
      return reply("📢 Broadcast terkirim ke " + (res.data?.sent_to || 0) + " user");
    }

    // ── ADMIN: DASHBOARD & REPORT ──
    if (command === "!dashboard") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("dashboard");
      const d = res.data || {};
      const up = Math.floor((Date.now() - new Date(BOT_STARTED_AT).getTime()) / 60000);
      const n = (v) => (v === undefined || v === null ? "-" : v);
      const body = [
        "🤖 *SYSTEM*", "• Bot: 🟢 Online" + (botConfig.maintenance ? " (maintenance)" : ""), "• Versi: v" + BOT_VERSION, "• Uptime: " + Math.floor(up / 60) + " jam " + (up % 60) + " mnt", "• Database: " + (res.error ? "🔴 " + res.error : "🟢 Terhubung"), "",
        "👥 *USER*", "• Total: " + n(d.users), "",
        "💰 *FINANCE*", "• Saldo beredar: " + fmtRp(d.total_balance || 0), "• Deposit: " + n(d.deposits), "",
        "🛒 *STORE*", "• Produk: " + n(d.products), "• Sponsor: " + n(d.sponsors), "",
        "🎫 *TICKET*", "• Total: " + n(d.tickets), "",
        "🎵 *MUSIK*", "• Lagu: " + n(d.songs), "",
        "_Detail per bagian ada di Admin Center._",
      ].join("\n");
      return sendUi(client, remoteJid, { title: "📊 ADMIN DASHBOARD", body, listLabel: "☰ Admin Center", buttons: [{ id: "!ui admin", title: "🛠️ Admin Center", desc: "Kategori sesuai role" }, { id: "!report", title: "📋 Laporan", desc: "Deposit & tiket terbaru" }, { id: "!botstatus", title: "⚙️ System", desc: "Status bot" }, { id: "!dashboard", title: "🔄 Refresh" }, BACK] }, msg);
    }

    if (command === "!report" || command === "!aktivitas") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const [dash, deps, tix] = await Promise.all([api("dashboard"), api("deposits"), api("tickets")]);
      const d = dash.data || {};
      const recentDeps = (deps.data || []).slice(0, 5);
      const recentTix = (tix.data || []).slice(0, 5);
      let txt = "📋 *Laporan:*\n\n📊 " + d.products + " produk, " + d.users + " user\n💰 Total saldo: " + fmtRp(d.total_balance);
      if (recentDeps.length) { txt += "\n\n🏦 *Deposit Terbaru:*\n" + recentDeps.map((d) => "• " + d.username + " " + fmtRp(d.amount) + " [" + d.status + "]").join("\n"); }
      if (recentTix.length) { txt += "\n\n🎫 *Tiket Terbaru:*\n" + recentTix.map((t) => "• #" + t.ticket_number + " " + t.name + " [" + t.status + "]").join("\n"); }
      return reply(txt);
    }

    } catch (err) {
      botHealth.command_errors++;
      botStat(command.split(" ")[0], "user", false, senderPhone || remoteJid, 0, err?.message || err);
      botHealth.last_error = String(err?.message || err).slice(0, 200);
      console.error("[cmd error]", command.split(" ")[0], botHealth.last_error);
      await reply("❌ Sistem sedang mengalami gangguan. Silakan coba lagi.").catch(() => {});
    }
  });

  return client;
}

// Error di handler perintah/tombol tidak boleh mematikan proses (yang membuat bot terlihat reconnect).
process.on("unhandledRejection", (reason) => { console.error("[COMMAND ERROR] (unhandledRejection)", reason?.stack || reason); });
process.on("uncaughtException", (error) => { console.error("[COMMAND ERROR] (uncaughtException)", error?.stack || error); });

async function startBot() {
  const authChoice = await askAuthMethod();
  await connectToWhatsApp(authChoice, 0);
}

startBot().catch((error) => {
  console.error("❌ Bot gagal dijalankan:", error?.stack || error?.message || error);
  process.exit(1);
});
