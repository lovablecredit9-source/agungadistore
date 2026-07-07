// =============================================
// 🤖 BOT WHATSAPP - Agung Adi Store v10.0.0
// =============================================
// Library: @whiskeysockets/baileys (QR / Pairing Code)
// Cara pakai:
//   1. npm install
//   2. node index.js
//   3. Pilih 1 = Scan QR / 2 = Pairing nomor
// =============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
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

function normalizePhoneNumber(value) {
  return String(value || "").replace(/[^0-9]/g, "");
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
const pinPending = {};

// === FLOW CHAT INTERAKTIF ===
const chatFlows = {};
const pendingDeposits = {};
const MAX_TEXT_CHUNK = 3500;

// === GAME TIMER WARNINGS ===
const gameTimerWarnings = {};

async function askAuthMethod() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log("\n========================================");
    console.log(" PILIH METODE LOGIN WHATSAPP");
    console.log("========================================");
    console.log("1. Scan QR");
    console.log("2. Pairing nomor WhatsApp");

    const method = String(await rl.question("Pilih 1 atau 2: ")).trim();

    if (method === "1") {
      console.log("\n📲 Mode QR dipilih.");
      console.log("✅ Buka WhatsApp > Perangkat tertaut > Tautkan perangkat lalu scan QR dari terminal.\n");
      return { mode: "qr", phoneNum: "" };
    }

    const promptPhone = DEFAULT_PAIRING_PHONE
      ? "Masukkan nomor WhatsApp [" + DEFAULT_PAIRING_PHONE + "]: "
      : "Masukkan nomor WhatsApp: ";
    const rawPhone = await rl.question(promptPhone);
    const phoneNum = normalizePhoneNumber(rawPhone || DEFAULT_PAIRING_PHONE);

    if (!phoneNum) {
      throw new Error("Nomor WhatsApp wajib diisi untuk pairing.");
    }

    console.log("\n📱 Nomor diterima: " + phoneNum);
    console.log("📢 Kode login akan muncul di terminal/panel untuk dimasukkan manual ke WhatsApp > Perangkat tertaut.");
    console.log("ℹ️ Pairing code tidak dikirim sebagai chat / notif WhatsApp.");
    console.log("⏳ Jika kode habis, bot akan coba sambung ulang lalu keluarkan kode baru.\n");

    return { mode: "pairing", phoneNum };
  } finally {
    rl.close();
  }
}

// === KONFIGURASI ADMIN ===
const ADMIN_NUMBERS = __BOT_ADMIN_NUMBERS__;

function isAdmin(msg) {
  if (ADMIN_NUMBERS.length === 0) return true;
  return ADMIN_NUMBERS.includes(msg.key.remoteJid);
}

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
  return r.json();
};

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
  try { pic = await client.profilePictureUrl(jid, "image"); } catch {}
  try {
    const onWa = await client.onWhatsApp(jid);
    displayName = onWa?.[0]?.notify || null;
  } catch {}
  try { await client.presenceSubscribe(jid); } catch {}
  await api("confess_presence_save", "POST", {
    phone: phoneDigits,
    profile_pic_url: pic,
    display_name: displayName,
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
          const sent = await sendConfessToWa(client, jid, text, { url: t.media_url, type: t.media_type, name: t.media_name, mime: t.media_mime });
          // Simpan ke cache untuk auto-reply tanpa !balas (TTL 30 menit)
          _lastConfessByPhone[phoneDigits] = {
            trx_id: conf.trx_id,
            expires_at: Date.now() + 30 * 60 * 1000,
          };
          // Track key untuk revoke
          cacheWaMessageKey(jid, sent);
          await api("confess_mark_sent", "POST", { target_id: t.id, success: true, wa_message_id: extractWaMessageId(sent) });
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
          const body = String(m.text || "").slice(0, 4000);
          const sent = await sendConfessToWa(client, jid, body, { url: m.media_url, type: m.media_type, name: m.media_name, mime: m.media_mime });
          const waId = extractWaMessageId(sent);
          cacheWaMessageKey(jid, sent);
          await api("confess_chat_mark_sent", "POST", { message_id: m.id, success: true, wa_message_id: waId });
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

async function sendDepositInstructions(client, remoteJid, quotedMsg, deposit) {
  const settings = await fetchPaymentSettings();
  const method = String(deposit.payment_method || "").trim().toUpperCase();
  const lines = [
    "✅ *Deposit Dibuat!*",
    "",
    "🆔 ID: " + (deposit.trx_id || "-"),
    "💰 Nominal: " + fmtRp(deposit.amount),
    "💳 Metode: " + method,
    "📌 Status: PENDING",
    "",
  ];

  if (method === "QRIS") {
    lines.push("📱 *Pembayaran QRIS*", "Scan QRIS di bawah ini. Ini sama seperti QRIS yang tampil di web.");
    if (settings.qrisUrl) {
      lines.push("", "📸 Setelah bayar ketik *bukti* lalu kirim foto bukti transfer.", "📋 Cek status: !cekdeposit " + (deposit.trx_id || ""));
      await client.sendMessage(remoteJid, {
        image: { url: settings.qrisUrl },
        caption: lines.join("\n"),
      }, { quoted: quotedMsg });
      return;
    }
    lines.push("QRIS belum diatur admin. Sementara buka web: " + WEB_URL);
  } else {
    lines.push(
      "📱 *Pembayaran " + method + "*",
      "Transfer ke akun berikut:",
      "👤 Nama: " + settings.danaName,
      "📞 Nomor: " + settings.danaNumber,
      "",
      "📸 Setelah bayar ketik *bukti* lalu kirim foto bukti transfer.",
      "📋 Cek status: !cekdeposit " + (deposit.trx_id || "")
    );
  }

  await sendLongMessage(client, remoteJid, lines.join("\n"), quotedMsg);
}

async function sendDepositProofToAdmin(client, remoteJid, msg, session, deposit) {
  const buffer = await client.downloadMediaMessage(msg);
  if (!buffer) throw new Error("Bukti pembayaran kosong");

  const caption = [
    "📥 *BUKTI BAYAR DEPOSIT*",
    "",
    "👤 Username: " + (session?.username || deposit.username || "-"),
    "📞 WA User: " + remoteJid.replace("@s.whatsapp.net", ""),
    "🆔 ID Deposit: " + (deposit.trx_id || "-"),
    "💰 Nominal: " + fmtRp(deposit.amount),
    "💳 Metode: " + String(deposit.payment_method || "-").toUpperCase(),
    "",
    "Admin: !konfirmasi " + (deposit.trx_id || "") + " / !tolakdeposit " + (deposit.trx_id || ""),
  ].join("\n");

  for (const adminJid of ADMIN_NUMBERS) {
    await client.sendMessage(adminJid, { image: buffer, caption });
  }

  await api("notifications", "POST", {
    visitor_id: deposit.visitor_id,
    title: "Bukti deposit dikirim",
    message: "Bukti pembayaran untuk deposit " + (deposit.trx_id || "-") + " sudah dikirim via WhatsApp.",
    type: "info"
  });
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

async function connectToWhatsApp(authChoice, attempt = 0) {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_session");
  const { version } = await fetchLatestBaileysVersion();
  const client = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: ["Agung Adi Store Bot", "Chrome", "1.0.0"],
    markOnlineOnConnect: false,
    syncFullHistory: false,
    defaultQueryTimeoutMs: 60_000,
  });

  const phoneNum = normalizePhoneNumber(authChoice.phoneNum);
  let pairingRequested = false;
  let reconnectScheduled = false;
  let qrShown = false;
  let connectingLogged = false;

  async function requestPairingCodeOnce() {
    if (authChoice.mode !== "pairing" || pairingRequested || client.authState?.creds?.registered) return;
    if (!phoneNum) throw new Error("Nomor WhatsApp untuk pairing belum diisi!");
    pairingRequested = true;
    console.log("\n📱 Meminta kode pairing untuk: " + phoneNum);
    try {
      await wait(2500);
      const code = await client.requestPairingCode(phoneNum);
      console.log("\n" + "=".repeat(40));
      console.log("  📲 KODE PAIRING (8 DIGIT):");
      console.log("  ➡️  " + formatPairingCode(code));
      console.log("=".repeat(40));
      console.log("\n✅ Buka WhatsApp > Perangkat tertaut / Linked Devices");
      console.log("   Pilih 'Tautkan dengan nomor telepon / Link with phone number'");
      console.log("   Lalu masukkan kode di atas");
      console.log("ℹ️ Kode tampil di terminal/panel, bukan dikirim sebagai chat WhatsApp.");
      console.log("⏳ Kalau kode expired, bot akan reconnect dan menampilkan kode baru.\n");
    } catch (error) {
      pairingRequested = false;
      console.error("❌ Gagal meminta pairing code:", error?.message || error);
    }
  }

  client.ev.on("creds.update", saveCreds);

  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    const isRegistered = Boolean(client.authState?.creds?.registered);

    if (connection === "connecting" && !connectingLogged) {
      connectingLogged = true;
      console.log(attempt === 0 ? "🔌 Menghubungkan ke server WhatsApp..." : "🔌 Menghubungkan ulang ke server WhatsApp...");
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
      _activeClient = client;
      resetConfessPollers();
      console.log("\n✅ Bot WhatsApp sudah siap! (v10.0.0)");
      console.log("📋 Kirim !help di chat untuk lihat perintah\n");
      startConfessOutbox(client);
      startConfessChatOutbox(client);
      startConfessRevokePoller(client);
      startConfessReactionPoller(client);
      startConfessEditPoller(client);
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
      const reason = lastDisconnect?.error?.output?.statusCode;
      const message = getDisconnectMessage(lastDisconnect);
      if (_activeClient === client) {
        _activeClient = null;
        resetConfessPollers();
      }

      if (reason === DisconnectReason.loggedOut) {
        console.log("❌ Session logout / expired. Hapus folder auth_session lalu jalankan ulang bot.");
        return;
      }

      if (reconnectScheduled) return;

      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        console.log("❌ Gagal terhubung setelah " + MAX_RECONNECT_ATTEMPTS + " percobaan.");
        console.log("ℹ️ Hapus folder auth_session lalu jalankan ulang bot untuk sesi baru.");
        return;
      }

      reconnectScheduled = true;

      if (!isRegistered) {
        if (authChoice.mode === "qr" && !qrShown) {
          console.log("ℹ️ QR belum sempat tampil. Saya akan coba sambung ulang supaya QR baru muncul.");
        }
        console.log("⚠️ Koneksi awal terputus sebelum login selesai: " + message);
      } else {
        console.log("⚠️ Koneksi putus: " + message);
      }
      console.log("ℹ️ Bot akan reconnect otomatis.");

      const nextAttempt = attempt + 1;
      console.log("🔄 Reconnect " + nextAttempt + "/" + MAX_RECONNECT_ATTEMPTS + " dalam " + (RECONNECT_DELAY_MS / 1000) + " detik...\n");

      setTimeout(() => {
        connectToWhatsApp(authChoice, nextAttempt).catch((error) => {
          console.error("❌ Gagal reconnect:", error?.stack || error?.message || error);
        });
      }, RECONNECT_DELAY_MS);
    }
  });

  if (authChoice.mode === "pairing" && !client.authState?.creds?.registered) {
    requestPairingCodeOnce().catch((error) => {
      console.error("❌ Gagal memulai pairing:", error?.stack || error?.message || error);
    });
  }

  client.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0];
    const remoteJid = msg?.key?.remoteJid;

    if (!msg?.message || msg.key?.fromMe || !remoteJid || remoteJid === "status@broadcast") {
      return;
    }

    const content = getMessageContent(msg.message);
    const text =
      content.conversation ||
      content.extendedTextMessage?.text ||
      content.imageMessage?.caption ||
      "";
    let plainText = text.trim();
    // Normalisasi prefix perintah: ".menu" / "/menu" → "!menu" (huruf setelah tanda)
    if (/^[./][a-zA-Z]/.test(plainText)) {
      plainText = "!" + plainText.slice(1);
    }
    const lowerText = plainText.toLowerCase();

    const session = userSessions[remoteJid] || null;
    const senderPhone = remoteJid.replace("@s.whatsapp.net", "");
    const command = lowerText;
    const rawArgs = plainText.split(/\s+/).slice(1);
    const args = rawArgs;
    const reply = async (t) => sendLongMessage(client, remoteJid, t, msg);

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
        if (res.error) return client.sendMessage(remoteJid, { text: "❌ " + res.error + "\n\n💡 PIN salah? Ketik *!resetpin* untuk reset." }, { quoted: msg });
        if (res.needPin) return client.sendMessage(remoteJid, { text: "🔐 PIN masih diperlukan. Ulangi perintah pembelian." }, { quoted: msg });
        const pd = res.data || res;
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

    // ── CONFESS REPLY (publik, tanpa perlu login) ──
    if (lowerText.startsWith("!balas")) {
      const isi = plainText.slice(6).trim();
      if (!isi) return reply("⚠️ Format: *!balas isi balasanmu*\n\nContoh: *!balas halo siapa kamu?*");
      const r = await api("confess_reply", "POST", { from_phone: senderPhone, reply_text: isi, wa_message_id: msg.key?.id || null });
      const d = r?.data || r;
      if (!d?.matched) return reply("❌ Tidak ada confess aktif untuk nomor ini.\n(Balasan hanya bisa untuk confess yang baru kamu terima dalam 30 hari terakhir.)");
      return reply("✅ Balasan kamu terkirim ke pengirim confess (" + (d.sender_name || "Anonim") + ")\n🆔 " + d.trx_id);
    }

    // ── STOP CONFESS: penerima menghentikan chat confess ──
    if (lowerText === "stopconfess" || lowerText === "!stopconfess" || lowerText === "stop confess") {
      const r = await api("confess_stop", "POST", { from_phone: senderPhone });
      const d = r?.data || r;
      if (d?.stopped > 0) return reply("🛑 Chat Confess dihentikan. Kamu tidak akan menerima pesan confess aktif lagi.\n\n💡 Kirim *!balas* jika ingin membalas confess baru nanti.");
      return reply("ℹ️ Tidak ada chat Confess aktif untuk dihentikan.");
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
              const buf = await downloadMediaMessage(msg, "buffer", {});
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
              reply_text: plainText || "",
              wa_message_id: msg.key?.id || null,
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

      if (flow.type === "create_pin") {
        if (!/^\d{6}$/.test(plainText)) return reply("⚠️ PIN harus 6 digit angka.\nKirim lagi PIN baru kamu, contoh: 123456");
        const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
        if (pinCheck.hasPin) {
          delete chatFlows[remoteJid];
          return reply("ℹ️ PIN kamu sudah pernah dibuat. Gunakan *!resetpin* kalau ingin ganti PIN.");
        }
        const res = await api("create_pin", "POST", { visitor_id: session.visitor_id, pin: plainText });
        if (res.error) return reply("❌ " + res.error);
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
        return reply("✅ *PIN berhasil direset via kode WhatsApp!*\n\n🔐 PIN baru: " + plainText + "\n\n⚠️ Simpan PIN baru ini.");
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
        return reply("✅ *PIN berhasil diperbarui!*\n\n🔐 PIN baru: " + plainText);
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
        chatFlows[remoteJid] = { type: "resetsandi_wait_new", oldPassword: plainText };
        return reply("🔑 Password lama diterima. Sekarang kirim password baru kamu.");
      }

      if (flow.type === "resetsandi_wait_new") {
        if (!plainText) return reply("⚠️ Password baru tidak boleh kosong.");
        const body = { visitor_id: session.visitor_id, new_password: plainText };
        if (flow.token) body.reset_token = flow.token;
        if (flow.oldPassword) body.old_password = flow.oldPassword;
        const res = await api("reset_password", "POST", body);
        if (res.error) return reply("❌ " + res.error);
        delete chatFlows[remoteJid];
        return reply("✅ *Password berhasil diperbarui!*\n\n🔑 Password baru: " + plainText);
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
          await sendDepositProofToAdmin(client, remoteJid, msg, session, deposit);
          return reply("✅ Bukti pembayaran untuk *" + (deposit.trx_id || "-") + "* berhasil dikirim ke admin.\n\n⏳ Silakan tunggu verifikasi admin.");
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

    if (command === "!help" || command === "!menu") {
      return reply([
        "🤖 *Bot WhatsApp Agung Adi Store v10.0.0*",
        "📱 Nomor kamu: " + senderPhone,
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
      if (!session || !session.visitor_id) {
        return reply([
          "🔒 Kamu belum login akun saldo di WA.",
          "",
          "Login dulu: *!login [user/email/hp] [password]*",
          "Lalu ketik *.logintoken* untuk minta token.",
          "",
          "💡 Nomor WA mana pun boleh dipakai — token mengikuti akun yang kamu login-kan, bukan nomor WA.",
        ].join("\n"));
      }
      const res = await api("wa_login_token_create", "POST", { account_visitor_id: session.visitor_id });
      if (res.error) return reply("❌ " + res.error);
      const d = res.data || res;
      await reply([
        "🔐 *Token Login WA Agung Adi Store*",
        "👤 Akun: " + (d.username || session.username || "-"),
        "",
        "Salin token ini ke web:",
        "```" + d.code + "```",
        "",
        "Berlaku: " + (d.expires_minutes || 5) + " menit (sekali pakai)",
        "",
        "Cara pakai:",
        "1. Buka web Agung Adi Store (tidak perlu login dulu)",
        "2. Saldo → *Login via Token WhatsApp*",
        "3. Masukkan token ini lalu tekan *Verifikasi / Masuk dengan Token*",
        "",
        "Web langsung masuk ke akun *" + (d.username || session.username || "-") + "* tanpa email/username/sandi.",
        "Mau ganti akun? Ketik *!logout* dulu, lalu *!login* akun lain.",
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
                "👤 Username: " + (user.username || "-") + " sudah bisa akses di web.",
                "💰 Saldo: " + fmtRp(user.balance || 0),
                "",
                "Web sudah masuk ke akun ini via token WhatsApp.",
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
      const hasPin = pinCheck.hasPin || false;
      return reply([
        "✅ *Login berhasil!*",
        "",
        "👤 Username: " + res.data.username,
        "📞 No HP: " + (res.data.phone || "-"),
        "📧 Email: " + (res.data.email || "-"),
        "💰 Saldo: " + fmtRp(res.data.balance),
        "🔐 PIN: " + (hasPin ? "✅ Sudah dibuat" : "❌ Belum dibuat — Ketik !buatpin"),
        "",
        "📱 Nomor WA: " + senderPhone,
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
      if (pinCheck.hasPin) return reply("ℹ️ PIN kamu sudah pernah dibuat. Gunakan *!resetpin* kalau ingin ganti PIN.");
      chatFlows[remoteJid] = { type: "create_pin" };
      return reply("🔐 *Buat PIN Baru*\n\nKirim 6 digit PIN transaksi kamu sekarang.\nContoh: 123456");
    }

    if (command.startsWith("!buatpin ")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
      if (pinCheck.hasPin) return reply("ℹ️ PIN kamu sudah pernah dibuat. Gunakan *!resetpin* kalau ingin ganti PIN.");
      const pinVal = args[0];
      if (!pinVal || !/^\d{6}$/.test(pinVal)) return reply("⚠️ PIN harus *6 digit angka*.\nGunakan: !buatpin 123456");
      const res = await api("create_pin", "POST", { visitor_id: session.visitor_id, pin: pinVal });
      if (res.error) return reply("❌ " + res.error);
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
      return reply("✅ *PIN berhasil diubah!*\n\n🔐 PIN lama: " + oldPin + "\n🔐 PIN baru: " + newPin + "\n\n⚠️ *Simpan PIN baru ini!*");
    }

    if (command.startsWith("!resetpin token")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      if (args.length < 3) return reply("⚠️ Format: !resetpin token [#token] [pin_baru]");
      const token = args[1].replace("#", "");
      const newPin = args[2];
      if (!/^\d{6}$/.test(newPin)) return reply("⚠️ PIN baru harus 6 digit angka.");
      const res = await api("reset_pin", "POST", { visitor_id: session.visitor_id, reset_token: token, new_pin: newPin });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ *PIN berhasil direset!*\n\n🔐 PIN baru: " + newPin + "\n\n⚠️ *Simpan PIN baru ini!*");
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
      return reply("✅ *Password berhasil diubah!*\n\n👤 Username: " + session.username + "\n🔑 Password lama: " + oldPw + "\n🔑 Password baru: " + newPw + "\n\n⚠️ *Simpan password baru! Hanya tampil di WA ini.*");
    }

    if (command.startsWith("!resetsandi token")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      if (args.length < 3) return reply("⚠️ Format: !resetsandi token [#token] [password_baru]");
      const token = args[1].replace("#", "");
      const newPw = args[2];
      const res = await api("reset_password", "POST", { visitor_id: session.visitor_id, reset_token: token, new_password: newPw });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ *Password berhasil direset!*\n\n👤 Username: " + session.username + "\n🔑 Password baru: " + newPw + "\n\n⚠️ *Simpan password baru! Hanya tampil di WA ini.*");
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
      return reply("💰 *Saldo " + session.username + ":*\n\n" + fmtRp(user?.balance ?? session.balance));
    }

    if (command === "!profilku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("balances");
      const user = (res.data || []).find((u) => u.visitor_id === session.visitor_id);
      if (!user) return reply("❌ Profil tidak ditemukan.");
      // Check PIN
      const pinCheck = await api("check_pin", "POST", { visitor_id: session.visitor_id });
      let txt = "👤 *Profil Saya:*\n\n📛 Username: " + user.username + "\n📞 No HP: " + user.phone + "\n📧 Email: " + (user.email || "-") + "\n💰 Saldo: " + fmtRp(user.balance) + "\n🔐 PIN: " + (pinCheck.hasPin ? "✅ Sudah dibuat" : "❌ Belum — Ketik !buatpin") + "\n📱 WA: " + senderPhone;
      // Game profile
      const gp = await api("game_profiles&visitor_id=" + session.visitor_id);
      if (gp.data?.[0]) {
        const p = gp.data[0];
        txt += "\n\n🎮 *Profil Game:*\n📛 " + p.display_name + "\n📝 " + (p.description || "-") + "\n👻 Guest: " + (p.is_guest ? "Ya" : "Tidak");
      }
      return reply(txt);
    }

    // ═══ PROFIL GAME (public) ═══
    if (command === "!profil" || command === "!profilgame") {
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

    // ═══ CEK DEPOSIT ═══
    if (command.startsWith("!cekdeposit")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const trxId = args[0];
      if (!trxId) return reply("⚠️ Gunakan: !cekdeposit [ID transaksi]\nContoh: !cekdeposit DEP-ABC123");
      const res = await api("deposits");
      const dep = (res.data || []).find((d) => d.visitor_id === session.visitor_id && (d.trx_id === trxId || d.trx_id.includes(trxId)));
      if (!dep) return reply("❌ Deposit tidak ditemukan: " + trxId);
      const statusIcon = dep.status === "approved" ? "✅" : dep.status === "rejected" ? "❌" : "⏳";
      return reply("🏦 *Status Deposit:*\n\n🆔 " + dep.trx_id + "\n💰 " + fmtRp(dep.amount) + "\n💳 " + dep.payment_method + "\n📌 Status: " + statusIcon + " " + dep.status.toUpperCase() + "\n📅 " + new Date(dep.created_at).toLocaleString("id-ID"));
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

    // Helper: start purchase flow - ask for PIN
    function startPurchaseFlow(endpoint, body, successMsgFn) {
      // Check if user has PIN first
      pinPending[remoteJid] = { endpoint, body, successMsg: successMsgFn, session };
      return reply("🔐 *Masukkan PIN 6 digit untuk konfirmasi:*\n\n(Ketik PIN langsung, contoh: 123456)\n\n❌ PIN salah? Ketik !resetpin untuk reset\n🚫 Batal? Ketik !batal");
    }

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
      if (!pinCheck.hasPin) return reply("🔐 *PIN belum dibuat!*\n\nKetik !buatpin [6 digit] untuk buat PIN.\nContoh: !buatpin 123456\n\n⚠️ PIN wajib untuk setiap transaksi.");

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
      if (!pinCheck.hasPin) return reply("🔐 *PIN belum dibuat!*\nKetik !buatpin [6 digit] untuk buat PIN.");
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
      if (!pinCheck.hasPin) return reply("🔐 *PIN belum dibuat!*\nKetik !buatpin [6 digit] untuk buat PIN.");
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
      if (!pinCheck.hasPin) return reply("🔐 *PIN belum dibuat!*\nKetik !buatpin [6 digit] untuk buat PIN.");
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
      if (!pinCheck.hasPin) return reply("🔐 *PIN belum dibuat!*\nKetik !buatpin [6 digit] untuk buat PIN.");
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
      return reply("📦 *Detail Produk:*\n\n🆔 *" + shortId(p.id) + "*\n📌 " + p.title + "\n💰 " + fmtRp(p.price) + "\n📊 Stok: " + p.stock + "\n🏷️ Kategori: " + (p.category || "Umum") + "\n🛡️ Garansi: " + (p.has_warranty ? "Ya" : "Tidak") + "\n📝 " + (p.description || "-") + "\n\n💡 Beli: !beli " + shortId(p.id));
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
      return reply("📱 *Nomor WA Kamu:*\n\n" + senderPhone + "\n\n💡 Ini nomor WhatsApp yang mengirim pesan ini.");
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
      return reply("📋 *Syarat & Ketentuan:*\n\n1. Produk sponsor bukan tanggung jawab admin platform\n2. Penjual wajib kirim produk sesuai deskripsi\n3. Pembeli wajib cek deskripsi sebelum beli\n4. Garansi sesuai detail produk\n5. Penipuan = akun diblokir\n6. Tanpa rekber = risiko ditanggung pembeli\n7. Dilarang jual produk ilegal\n8. Admin berhak hapus sponsor melanggar\n9. Harga & stok bisa berubah\n10. Komplain max 1x24 jam\n11. Batas komplain max 1x24 jam setelah transaksi");
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

    function getGameLevel(points) {
      const thresholds = [0, 90, 250, 500, 1000, 2000, 4000, 8000];
      let level = 1;
      for (let i = 1; i < thresholds.length; i++) {
        if (points >= thresholds[i]) level = i + 1; else break;
      }
      return level;
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
        "• !tolakdeposit [trx_id] — Tolak deposit",
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
    if (command.startsWith("!konfirmasi")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const trxId = args[0];
      if (!trxId) return reply("⚠️ Gunakan: !konfirmasi [trx_id]");
      // Show deposit details first for confirmation
      const dRes = await api("deposits");
      const dep = (dRes.data || []).find((d) => d.trx_id === trxId || d.trx_id.includes(trxId));
      if (!dep) return reply("❌ Deposit tidak ditemukan: " + trxId);
      if (dep.status === "approved") return reply("ℹ️ Deposit sudah dikonfirmasi sebelumnya.");
      const res = await api("confirm_deposit", "POST", { trx_id: dep.trx_id, action: "terima" });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ *Deposit Dikonfirmasi!*\n\n👤 " + dep.username + "\n💰 " + fmtRp(dep.amount) + "\n💳 " + dep.payment_method + "\n🆔 " + dep.trx_id + "\n\n💰 Saldo user sudah ditambah otomatis.");
    }

    if (command.startsWith("!tolakdeposit")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const trxId = args[0];
      if (!trxId) return reply("⚠️ Gunakan: !tolakdeposit [trx_id]");
      const res = await api("confirm_deposit", "POST", { trx_id: trxId, action: "tolak" });
      if (res.error) return reply("❌ " + res.error);
      return reply("❌ Deposit " + trxId + " ditolak.");
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
      let txt = "👤 *Detail User:*\n\n📛 " + user.username + "\n📞 " + user.phone + "\n📧 " + (user.email || "-") + "\n💰 Saldo: " + fmtRp(user.balance) + "\n🔐 PIN: " + (pinCheck.hasPin ? "✅" : "❌");
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
      return reply("📊 *Dashboard Admin:*\n\n📦 Produk: " + d.products + "\n👥 User: " + d.users + "\n🎵 Lagu: " + d.songs + "\n🏪 Sponsor: " + d.sponsors + "\n🏦 Deposit: " + d.deposits + "\n🎫 Tiket: " + d.tickets + "\n💰 Total Saldo: " + fmtRp(d.total_balance));
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
      await reply("❌ Error: " + (err.message || err));
    }
  });

  return client;
}

async function startBot() {
  const authChoice = await askAuthMethod();
  await connectToWhatsApp(authChoice, 0);
}

startBot().catch((error) => {
  console.error("❌ Bot gagal dijalankan:", error?.stack || error?.message || error);
  process.exit(1);
});
