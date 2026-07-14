import { createClient } from "npm:@supabase/supabase-js@2";

const WEB_URL = "https://agungadistore.lovable.app";
const WA_NUMBER = "6285769302532";

async function tgApi(token: string, method: string, payload: unknown): Promise<Response> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const body = JSON.stringify(payload);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      // Retry on Telegram's transient 5xx / 429 as well
      if ((res.status >= 500 || res.status === 429) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      // Network error (e.g. connection reset) — wait & retry
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  console.error("tgApi failed after retries:", method, lastErr);
  throw lastErr;
}

// Send a photo (raw bytes) via multipart upload with a caption.
async function tgSendPhotoBytes(
  token: string,
  chatId: string,
  bytes: Uint8Array,
  caption: string,
  replyMarkup?: unknown,
  mimeType = "image/png",
  filename = "welcome.png",
) {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));
  form.append("photo", new Blob([bytes], { type: mimeType }), filename);
  return fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
}

// Kirim video/animated sticker (.webm) dengan cara upload multipart (URL tidak didukung Telegram utk video sticker)
async function tgSendStickerUrl(token: string, chatId: string, url: string) {
  try {
    const dl = await fetch(url);
    if (!dl.ok) return null;
    const bytes = new Uint8Array(await dl.arrayBuffer());
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("sticker", new Blob([bytes], { type: "video/webm" }), "halo.webm");
    return fetch(`https://api.telegram.org/bot${token}/sendSticker`, { method: "POST", body: form });
  } catch (e) {
    console.error("tgSendStickerUrl error", e);
    return null;
  }
}

// Kirim stiker bawaan Telegram (animasi keren) yang dipilih acak dari beberapa set populer resmi Telegram.
// Lebih andal daripada upload file custom karena stiker sudah ada di server Telegram.
const STICKER_SETS = ["HotCherry", "UtyaDuck", "AnimatedEmojies", "TelegramGreetings", "Cat"];
async function tgSendRandomSticker(token: string, chatId: string) {
  try {
    const sets = [...STICKER_SETS].sort(() => Math.random() - 0.5);
    for (const name of sets) {
      const res = await tgApi(token, "getStickerSet", { name });
      const j = await res.json().catch(() => null);
      const stickers = j?.result?.stickers;
      if (!Array.isArray(stickers) || stickers.length === 0) continue;
      const pick = stickers[Math.floor(Math.random() * stickers.length)];
      if (!pick?.file_id) continue;
      const sendRes = await tgApi(token, "sendSticker", { chat_id: chatId, sticker: pick.file_id });
      const sendJson = await sendRes.json().catch(() => null);
      if (sendJson?.ok) return sendJson;
    }
    return null;
  } catch (e) {
    console.error("tgSendRandomSticker error", e);
    return null;
  }
}

// Fetch the user's Telegram profile photo as base64 data URL (largest size). Null if none.
async function fetchTelegramProfilePhoto(token: string, userId: number | string): Promise<string | null> {
  try {
    const res = await tgApi(token, "getUserProfilePhotos", { user_id: userId, limit: 1 });
    const j = await res.json();
    const sizes = j?.result?.photos?.[0];
    console.log("profilePhotos", userId, "total=", j?.result?.total_count, "ok=", j?.ok, "desc=", j?.description || "");
    if (!Array.isArray(sizes) || !sizes.length) return null;
    const fileId = sizes[sizes.length - 1].file_id;
    const fRes = await tgApi(token, "getFile", { file_id: fileId });
    const fj = await fRes.json();
    const filePath = fj?.result?.file_path;
    if (!filePath) { console.log("getFile no path", JSON.stringify(fj)); return null; }
    const dl = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!dl.ok) { console.log("file dl failed", dl.status); return null; }
    const buf = new Uint8Array(await dl.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    console.log("profile photo bytes=", buf.length);
    return `data:image/jpeg;base64,${btoa(bin)}`;
  } catch (e) {
    console.error("fetchTelegramProfilePhoto error", e);
    return null;
  }
}

// Send an automatic welcome (profile photo + caption) on /start. No AI. Falls back gracefully.
// Lazy-init the SVG rasterizer (resvg WASM). No AI — pure vector rendering.
let _resvgReady: Promise<any> | null = null;
let _fontBuf: Uint8Array | null = null;
async function ensureResvg() {
  const mod = await import("npm:@resvg/resvg-wasm@2.6.2");
  if (!_resvgReady) {
    _resvgReady = fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm")
      .then((r) => r.arrayBuffer())
      .then((buf) => mod.initWasm(buf))
      .catch((e) => { _resvgReady = null; throw e; });
  }
  await _resvgReady;
  // resvg-wasm has NO built-in fonts; without one, all <text> is dropped.
  if (!_fontBuf) {
    try {
      const fr = await fetch("https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Bold.ttf");
      if (fr.ok) _fontBuf = new Uint8Array(await fr.arrayBuffer());
    } catch (e) {
      console.error("font load error", e);
    }
  }
  return mod;
}

function xmlEsc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function fitText(s: string, max = 34): string {
  const clean = String(s ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, Math.max(0, max - 1))}…` : clean;
}

function fitFontSize(text: string, base: number, min: number, maxCharsAtBase: number): number {
  const len = Math.max(1, String(text ?? "").length);
  if (len <= maxCharsAtBase) return base;
  return Math.max(min, Math.floor(base * (maxCharsAtBase / len)));
}

function splitFitText(text: string, maxChars = 25, maxLines = 2): string[] {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines[lines.length - 1] || "";
    if (!current) {
      lines.push(word);
    } else if (`${current} ${word}`.length <= maxChars) {
      lines[lines.length - 1] = `${current} ${word}`;
    } else if (lines.length < maxLines) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${lines[lines.length - 1]} ${word}`;
    }
  }
  if (!lines.length) return ["Pengguna Telegram"];
  const last = lines[maxLines - 1];
  if (last && last.length > maxChars) lines[maxLines - 1] = `${last.slice(0, Math.max(0, maxChars - 1))}…`;
  return lines.slice(0, maxLines);
}

function telegramIdentity(chat: any, from?: any) {
  const src = from && !from.is_bot ? from : chat;
  const firstName = String(src?.first_name || chat?.first_name || "").trim();
  const lastName = String(src?.last_name || chat?.last_name || "").trim();
  const username = String(src?.username || chat?.username || "").replace(/^@/, "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
    || String(chat?.title || "").trim()
    || username
    || "Pengguna Telegram";
  const userId = src?.id || chat?.id;
  return { firstName: fullName, lastName, username, userId };
}

// Build a branded welcome CARD (PNG bytes) with the user's profile photo composited in.
async function buildWelcomeCard(
  displayName: string,
  username: string,
  uid: string | number,
  photoDataUrl: string | null,
): Promise<Uint8Array | null> {
  try {
    const mod = await ensureResvg();
    const W = 1000, H = 560;
    const rawName = String(displayName || "Pengguna Telegram").trim();
    const rawUsername = String(username || "Tidak ada username").trim();
    const titleLines = splitFitText(rawName, 25, 2);
    const titleFont = titleLines.length > 1 ? 39 : fitFontSize(rawName, 54, 34, 19);
    const titleSvg = titleLines.map((line, idx) =>
      `<tspan x="350" dy="${idx === 0 ? 0 : titleFont + 8}">${xmlEsc(line)}</tspan>`
    ).join("");
    const infoName = fitText(rawName, 30);
    const infoUsername = fitText(rawUsername, 32);
    const nameFont = fitFontSize(infoName, 26, 20, 22);
    const usernameFont = fitFontSize(infoUsername, 26, 18, 22);
    const photoTag = photoDataUrl
      ? `<image x="90" y="170" width="210" height="210" href="${photoDataUrl}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>`
      : `<circle cx="195" cy="275" r="105" fill="#0ea5e9"/><text x="195" y="313" font-family="Roboto" font-size="100" font-weight="800" fill="#fff" text-anchor="middle">${xmlEsc((displayName[0] || "?").toUpperCase())}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/><stop offset="0.55" stop-color="#164e63"/><stop offset="1" stop-color="#059669"/>
    </linearGradient>
    <clipPath id="pc"><circle cx="195" cy="275" r="105"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" rx="40" fill="url(#bg)"/>
  <circle cx="850" cy="90" r="180" fill="#ffffff" opacity="0.06"/>
  <circle cx="130" cy="520" r="140" fill="#ffffff" opacity="0.06"/>
  <circle cx="195" cy="275" r="118" fill="none" stroke="#ffffff" stroke-width="8" opacity="0.9"/>
  ${photoTag}
  <text x="350" y="120" font-family="Roboto" font-size="32" font-weight="800" fill="#a7f3d0">SELAMAT DATANG</text>
  <text x="350" y="172" font-family="Roboto" font-size="${titleFont}" font-weight="800" fill="#ffffff">${titleSvg}</text>
  <rect x="330" y="250" width="610" height="170" rx="24" fill="#ffffff" opacity="0.14"/>
  <text x="355" y="294" font-family="Roboto" font-size="25" font-weight="700" fill="#d1fae5">Nama Telegram</text>
  <text x="565" y="294" font-family="Roboto" font-size="${nameFont}" font-weight="800" fill="#ffffff">${xmlEsc(infoName)}</text>
  <text x="355" y="348" font-family="Roboto" font-size="25" font-weight="700" fill="#d1fae5">Username</text>
  <text x="565" y="348" font-family="Roboto" font-size="${usernameFont}" font-weight="800" fill="#ffffff">${xmlEsc(infoUsername)}</text>
  <text x="355" y="402" font-family="Roboto" font-size="25" font-weight="700" fill="#d1fae5">ID Telegram</text>
  <text x="565" y="402" font-family="Roboto" font-size="26" font-weight="800" fill="#ffffff">${xmlEsc(String(uid))}</text>
  <rect x="90" y="430" width="830" height="78" rx="20" fill="#ffffff" opacity="0.12"/>
  <text x="120" y="465" font-family="Roboto" font-size="29" font-weight="800" fill="#ffffff">Agung Adi Store</text>
  <text x="120" y="494" font-family="Roboto" font-size="22" font-weight="600" fill="#d1fae5">Murah &amp; Terpercaya</text>
</svg>`;
    const r = new mod.Resvg(svg, {
      font: {
        fontBuffers: _fontBuf ? [_fontBuf] : [],
        loadSystemFonts: false,
        defaultFontFamily: "Roboto",
      },
    });
    const png = r.render().asPng();
    return new Uint8Array(png);
  } catch (e) {
    console.error("buildWelcomeCard error", e);
    return null;
  }
}

// Send an automatic welcome CARD (profile photo + designed card) on /start. No AI.
async function sendWelcomeImage(token: string, chatId: string, from: any) {
  try {
    const uid = from?.id;
    if (!uid) return;
    const username = from?.username ? `@${from.username}` : "Tidak ada username";
    const displayName = from?.first_name
      ? `${from.first_name}${from.last_name ? " " + from.last_name : ""}`
      : (from?.username || "Teman");
    const photoDataUrl = await fetchTelegramProfilePhoto(token, uid);
    const caption = `🎉 <b>Selamat Datang, ${esc(displayName)}!</b>\n\n`
      + `🆔 ID Telegram: <code>${uid}</code>\n`
      + `👤 Username: ${esc(username)}\n\n`
      + `Terima kasih sudah bergabung di <b>Agung Adi Store</b> — Murah &amp; Terpercaya. 💜`;
    // 1) Coba kirim KARTU sambutan (foto profil di-compose ke desain kartu)
    const card = await buildWelcomeCard(displayName, username, uid, photoDataUrl);
    if (card) {
      const r = await tgSendPhotoBytes(token, chatId, card, caption);
      if (r.ok) return;
    }
    // 2) Fallback: kirim foto profil apa adanya
    if (photoDataUrl) {
      const bin = atob(photoDataUrl.split(",")[1]);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const r = await tgSendPhotoBytes(token, chatId, buf, caption, undefined, "image/jpeg", "profile.jpg");
      if (r.ok) return;
    }
    // 3) Fallback: teks saja
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
    [{ text: "🛍️ Belanja (Beli via TG)", callback_data: "belanja" }],
    [{ text: "🎮 Game", callback_data: "game" }, { text: "🎵 Musik", callback_data: "musik" }],
    [{ text: "🎯 Quest", callback_data: "quest" }, { text: "💬 Confess", callback_data: "confess" }],
    [{ text: "🏆 Peringkat", callback_data: "peringkat" }, { text: "🔥 Streak", callback_data: "streak" }],
    [{ text: "🏪 Streak Shop", callback_data: "shop" }, { text: "🎡 Roda Diskon", callback_data: "roda" }],
    [{ text: "📜 Riwayat", callback_data: "riwayat" }, { text: "🎫 Voucher", callback_data: "voucher" }],
    [{ text: "📢 Info Toko", callback_data: "info_toko" }, { text: "🤝 Sponsor", callback_data: "sponsor" }],
    [{ text: "👑 Membership", callback_data: "membership" }, { text: "🌐 Sosmed", callback_data: "sosmed" }],
    [{ text: "🎫 Tiket", callback_data: "tiket" }, { text: "❤️ Suka", callback_data: "like" }],
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

function greetingByHour(): string {
  const hour = Number(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }));
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 18) return "Selamat sore";
  return "Selamat malam";
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

// ===================== Quest Mission via Telegram =====================
const LOGIN_KB = () => backKb([[{ text: "🔑 Login", callback_data: "login" }]]);
const QUEST_MENU_KB = () => backKb([[{ text: "🎯 Menu Quest", callback_data: "quest" }]]);

function wibDateObj(): Date { return new Date(Date.now() + 7 * 3600 * 1000); }
function getWibToday2(): string { return wibDateObj().toISOString().split("T")[0]; }

function fmtCountdown(ms: number): string {
  if (!ms || ms <= 0) return "segera";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}h ${h}j ${m}m`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}
function msToNextDailyWIB(): number {
  const wib = wibDateObj();
  const next = new Date(wib); next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - wib.getTime();
}
function msToNextWeeklyWIB(): number {
  const wib = wibDateObj();
  const day = wib.getUTCDay();
  const daysUntilMon = day === 0 ? 1 : 8 - day;
  const next = new Date(wib); next.setUTCHours(0, 0, 0, 0); next.setUTCDate(next.getUTCDate() + daysUntilMon);
  return next.getTime() - wib.getTime();
}
function msToNextMonthlyWIB(): number {
  const wib = wibDateObj();
  const next = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return next.getTime() - wib.getTime();
}
function questRewardText(q: any): string {
  return [
    q.reward_coins ? `🪙${q.reward_coins}` : null,
    q.reward_gems ? `💎${q.reward_gems}` : null,
    q.reward_xp ? `✨${q.reward_xp}xp` : null,
    q.reward_saldo_in ? `💵${q.reward_saldo_in}` : null,
  ].filter(Boolean).join(" ") || "reward";
}

const QUEST_PAGE_SIZE = 8;

function clampQuestPage(page: number, totalItems: number): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / QUEST_PAGE_SIZE));
  if (!Number.isFinite(page) || page < 0) return 0;
  return Math.min(Math.floor(page), totalPages - 1);
}

async function getPremiumInfo(admin: any, visitorId: string): Promise<any> {
  try {
    const { data } = await admin.functions.invoke("premium-quest", { body: { action: "status", visitorId } });
    return data || {};
  } catch (_) { return {}; }
}

async function renderQuestHub(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🎯 <b>Quest Mission</b>\n\n🔒 Login dulu untuk lihat & klaim quest kamu.", parse_mode: "HTML", reply_markup: LOGIN_KB() });
    return;
  }
  let premLine = "👑 Premium: belum aktif";
  const pd = await getPremiumInfo(admin, visitorId);
  const info = (pd as any)?.info;
  if (info?.is_active) {
    premLine = info.is_permanent ? "👑 Premium: <b>Permanen</b>" : `👑 Premium aktif: <b>${fmtCountdown((info.seconds_left || 0) * 1000)}</b>`;
  }
  const text = `🎯 <b>Quest Mission</b>\n\n☀️ Reset Harian: <b>${fmtCountdown(msToNextDailyWIB())}</b>\n📅 Reset Mingguan: <b>${fmtCountdown(msToNextWeeklyWIB())}</b>\n🗓️ Reset Bulanan: <b>${fmtCountdown(msToNextMonthlyWIB())}</b>\n${premLine}\n\nPilih kategori quest 👇`;
  const kb = backKb([
    [{ text: "☀️ Harian", callback_data: "quest_d" }, { text: "📅 Mingguan", callback_data: "quest_w" }],
    [{ text: "🗓️ Bulanan", callback_data: "quest_m" }, { text: "👑 Premium", callback_data: "quest_p" }],
  ]);
  await sendOrEdit(token, chatId, editMsgId, { text, parse_mode: "HTML", reply_markup: kb });
}

async function renderQuestPeriod(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null, period: "d" | "w" | "m", page = 0) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🎯 <b>Quest</b>\n\n🔒 Login dulu untuk lihat quest.", parse_mode: "HTML", reply_markup: LOGIN_KB() });
    return;
  }
  let quests: any[] = [], progress: any[] = [], resetMs = 0, icon = "🎯", label = "Quest", resetLabel = "Reset";
  try {
    if (period === "d") {
      const today = getWibToday2();
      const { data: rows } = await admin.from("daily_challenges").select("*").eq("is_active", true).order("sort_order", { ascending: true });
      quests = rows || [];
      const ids = quests.map((q: any) => q.id);
      if (ids.length) {
        const { data: pr } = await admin.from("daily_challenge_progress").select("challenge_id,current_value,is_completed,claimed_at").eq("visitor_id", visitorId).eq("challenge_date", today).in("challenge_id", ids);
        progress = (pr || []).map((p: any) => ({ quest_id: p.challenge_id, ...p }));
      }
      resetMs = msToNextDailyWIB(); icon = "☀️"; label = "Quest Harian"; resetLabel = "Reset harian";
    } else {
      const fn = period === "w" ? "weekly-quest" : "monthly-quest";
      const { data } = await admin.functions.invoke(fn, { body: { action: "status", visitorId } });
      quests = (data as any)?.quests || [];
      progress = (data as any)?.progress || [];
      if (period === "w") { resetMs = msToNextWeeklyWIB(); icon = "📅"; label = "Quest Mingguan"; resetLabel = "Reset mingguan"; }
      else { resetMs = msToNextMonthlyWIB(); icon = "🗓️"; label = "Quest Bulanan"; resetLabel = "Reset bulanan"; }
    }
  } catch (_) {
    await sendOrEdit(token, chatId, editMsgId, { text: `${icon} <b>${label}</b>\n\nGagal memuat quest. Coba lagi nanti.`, parse_mode: "HTML", reply_markup: QUEST_MENU_KB() });
    return;
  }
  const safePage = clampQuestPage(page, quests.length);
  const totalPages = Math.max(1, Math.ceil(quests.length / QUEST_PAGE_SIZE));
  const visibleQuests = quests.slice(safePage * QUEST_PAGE_SIZE, (safePage + 1) * QUEST_PAGE_SIZE);
  const allReady = quests.reduce((count: number, q: any) => {
    const p = progress.find((x: any) => x.quest_id === q.id);
    return count + ((p?.is_completed && !p?.claimed_at) ? 1 : 0);
  }, 0);
  let t = `${icon} <b>${label}</b>${totalPages > 1 ? ` (${safePage + 1}/${totalPages})` : ""}\n⏳ ${resetLabel} dalam <b>${fmtCountdown(resetMs)}</b>\n\n`;
  const claimRows: any[] = [];
  let ready = 0;
  for (const q of visibleQuests) {
    const p = progress.find((x: any) => x.quest_id === q.id);
    const cur = p?.current_value ?? 0;
    const done = p?.is_completed ?? false;
    const claimed = !!p?.claimed_at;
    const status = claimed ? "✅ Diklaim" : done ? "🎁 Siap klaim!" : `⏳ ${cur}/${q.target_value}`;
    t += `${q.icon || "🎯"} <b>${esc(q.title)}</b>\n   ${esc(q.description || "")}\n   ${status} • ${questRewardText(q)}\n\n`;
    if (done && !claimed) { ready++; claimRows.push([{ text: `🎁 ${String(q.title).slice(0, 22)}`, callback_data: `qk${period}_${q.id}` }]); }
  }
  if (!quests.length) t += "Belum ada quest aktif saat ini.";
  const kbRows: any[] = [...claimRows];
  if (allReady > 1) kbRows.unshift([{ text: `🎁 Klaim Semua (${allReady})`, callback_data: `qka_${period}` }]);
  const navRow = [];
  if (safePage > 0) navRow.push({ text: "⬅️", callback_data: `qpg_${period}_${safePage - 1}` });
  if (safePage < totalPages - 1) navRow.push({ text: "➡️", callback_data: `qpg_${period}_${safePage + 1}` });
  if (navRow.length) kbRows.push(navRow);
  kbRows.push([{ text: "🎯 Menu Quest", callback_data: "quest" }]);
  await sendOrEdit(token, chatId, editMsgId, { text: t, parse_mode: "HTML", reply_markup: backKb(kbRows) });
}

async function renderPremiumQuest(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "👑 <b>Premium Quest</b>\n\n🔒 Login dulu untuk akses premium quest.", parse_mode: "HTML", reply_markup: LOGIN_KB() });
    return;
  }
  const pd = await getPremiumInfo(admin, visitorId);
  const info = (pd as any)?.info || { is_active: false, can_trial: false };
  const quests: any[] = (pd as any)?.quests || [];
  const progress: any[] = (pd as any)?.progress || [];
  const plans: any[] = (pd as any)?.plans || [];
  let t = "👑 <b>Premium Quest</b>\n\n";
  if (info.is_active) {
    t += info.is_permanent ? "✅ Status: <b>Permanen</b>\n\n" : `✅ Aktif • sisa masa aktif <b>${fmtCountdown((info.seconds_left || 0) * 1000)}</b>\n\n`;
    const claimRows: any[] = [];
    let ready = 0;
    const now = Date.now();
    for (const q of quests) {
      const p = progress.find((x: any) => x.quest_id === q.id);
      const cur = p?.current_value ?? 0;
      const done = p?.is_completed ?? false;
      const claimed = !!p?.claimed_at;
      const startsAt = q.starts_at ? new Date(q.starts_at).getTime() : 0;
      const endsAt = q.ends_at ? new Date(q.ends_at).getTime() : Number.MAX_SAFE_INTEGER;
      const locked = startsAt > now || endsAt < now;
      const status = locked ? "🔒 Terkunci" : claimed ? "✅ Diklaim" : done ? "🎁 Siap klaim!" : `⏳ ${cur}/${q.target_value}`;
      t += `${q.icon || "👑"} <b>${esc(q.title)}</b>\n   ${status} • ${questRewardText(q)}\n\n`;
      if (done && !claimed && !locked) { ready++; claimRows.push([{ text: `🎁 ${String(q.title).slice(0, 22)}`, callback_data: `qkp_${q.id}` }]); }
    }
    if (!quests.length) t += "Belum ada premium quest aktif.";
    const kbRows: any[] = [...claimRows];
    if (ready > 1) kbRows.unshift([{ text: `🎁 Klaim Semua (${ready})`, callback_data: "qka_p" }]);
    kbRows.push([{ text: "🎯 Menu Quest", callback_data: "quest" }]);
    await sendOrEdit(token, chatId, editMsgId, { text: t, parse_mode: "HTML", reply_markup: backKb(kbRows) });
  } else {
    t += "❌ Premium belum aktif.\n\nBeli paket untuk buka quest eksklusif dengan hadiah lebih besar.\n\n";
    const kbRows: any[] = [];
    if (info.can_trial) kbRows.push([{ text: "🎁 Coba Gratis 1 Hari", callback_data: "qbt" }]);
    for (const pl of plans) {
      if (pl.code === "TRIAL_1D") continue;
      const price = Number(pl.price_balance || 0) + Number(pl.price_saldo_in || 0);
      const dur = pl.is_permanent ? "Permanen" : `${Math.round((pl.duration_seconds || 0) / 86400)} hari`;
      t += `👑 <b>${esc(pl.name)}</b> • ${dur}\n   💵 ${fmtRp(price)}\n`;
      kbRows.push([{ text: `🛒 ${String(pl.name).slice(0, 16)} — ${fmtRp(price)}`, callback_data: `qbp_${pl.id}` }]);
    }
    kbRows.push([{ text: "🎯 Menu Quest", callback_data: "quest" }]);
    await sendOrEdit(token, chatId, editMsgId, { text: t, parse_mode: "HTML", reply_markup: backKb(kbRows) });
  }
}

async function claimOneQuest(admin: any, visitorId: string, period: string, questId: string): Promise<{ ok: boolean; reward?: string; error?: string }> {
  try {
    let data: any = null;
    if (period === "d") {
      const r = await admin.functions.invoke("check-daily-challenge", { body: { visitorId, claimChallengeId: questId } });
      data = r.data;
    } else if (period === "w") {
      const r = await admin.functions.invoke("weekly-quest", { body: { action: "claim", visitorId, questId } });
      data = r.data;
    } else if (period === "m") {
      const r = await admin.functions.invoke("monthly-quest", { body: { action: "claim", visitorId, questId } });
      data = r.data;
    } else {
      const r = await admin.functions.invoke("premium-quest", { body: { action: "claim", visitorId, questId } });
      data = r.data;
    }
    if ((data as any)?.error) return { ok: false, error: (data as any).error };
    const coins = (data as any)?.coins ?? (data as any)?.reward_coins ?? 0;
    const gems = (data as any)?.gems ?? (data as any)?.reward_gems ?? 0;
    const saldo = (data as any)?.saldo_in ?? (data as any)?.reward_saldo_in ?? 0;
    const xp = (data as any)?.xp ?? 0;
    const reward = [coins ? `🪙${coins}` : null, gems ? `💎${gems}` : null, saldo ? `💵${saldo}` : null, xp ? `✨${xp}xp` : null].filter(Boolean).join(" ") || "berhasil";
    return { ok: true, reward };
  } catch (_) {
    return { ok: false, error: "Gagal klaim" };
  }
}

async function claimAllQuests(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null, period: "d" | "w" | "m" | "p") {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk klaim quest.", reply_markup: LOGIN_KB() });
    return;
  }
  let ids: string[] = [];
  try {
    if (period === "d") {
      const today = getWibToday2();
      const { data: rows } = await admin.from("daily_challenges").select("id").eq("is_active", true);
      const cids = (rows || []).map((r: any) => r.id);
      if (cids.length) {
        const { data: pr } = await admin.from("daily_challenge_progress").select("challenge_id,is_completed,claimed_at").eq("visitor_id", visitorId).eq("challenge_date", today).in("challenge_id", cids);
        ids = (pr || []).filter((p: any) => p.is_completed && !p.claimed_at).map((p: any) => p.challenge_id);
      }
    } else {
      const fn = period === "w" ? "weekly-quest" : period === "m" ? "monthly-quest" : "premium-quest";
      const { data } = await admin.functions.invoke(fn, { body: { action: "status", visitorId } });
      const progress: any[] = (data as any)?.progress || [];
      ids = progress.filter((p: any) => p.is_completed && !p.claimed_at).map((p: any) => p.quest_id);
    }
  } catch (_) { /* ignore */ }
  if (!ids.length) {
    await renderAfterClaim(admin, token, chatId, visitorId, editMsgId, period);
    return;
  }
  let claimed = 0;
  for (const id of ids) {
    const r = await claimOneQuest(admin, visitorId, period, id);
    if (r.ok) claimed++;
  }
  await tgApi(token, "sendMessage", { chat_id: chatId, text: `🎉 <b>${claimed} quest diklaim!</b>`, parse_mode: "HTML" });
  await renderAfterClaim(admin, token, chatId, visitorId, null, period);
}

async function renderAfterClaim(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null, period: string) {
  if (period === "p") await renderPremiumQuest(admin, token, chatId, visitorId, editMsgId);
  else await renderQuestPeriod(admin, token, chatId, visitorId, editMsgId, period as "d" | "w" | "m");
}

async function startPremiumBuy(admin: any, token: string, chatId: string, planId: string, visitorId: string | null, editMsgId: number | null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk beli premium quest.", reply_markup: LOGIN_KB() });
    return;
  }
  const { data: plan } = await admin.from("premium_quest_plans").select("*").eq("id", planId).eq("is_active", true).maybeSingle();
  if (!plan || plan.code === "TRIAL_1D") {
    await sendOrEdit(token, chatId, editMsgId, { text: "⚠️ Paket tidak tersedia lagi.", reply_markup: QUEST_MENU_KB() });
    return;
  }
  const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
  if (!pinRow?.pin_hash) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔐 Kamu belum punya PIN. Buat PIN dulu untuk transaksi saldo.", reply_markup: backKb([[{ text: "🔐 Buat PIN", callback_data: "pin_change" }]]) });
    return;
  }
  const price = Number(plan.price_balance || 0) + Number(plan.price_saldo_in || 0);
  await setState(admin, chatId, "qpremium_pin", { planId, name: plan.name, price });
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: `👑 <b>Konfirmasi Premium Quest</b>\n\n<b>${esc(plan.name)}</b>\n💵 Harga: <b>${fmtRp(price)}</b>\n\nMasukkan <b>PIN 6 digit</b> untuk bayar pakai saldo:`,
    parse_mode: "HTML", reply_markup: CANCEL_KB,
  });
}

async function handlePremiumBuyStep(admin: any, token: string, chatId: string, data: any, text: string, visitorId: string | null) {
  if (!visitorId) { await clearState(admin, chatId); await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Sesi habis, login dulu.", reply_markup: LOGIN_KB() }); return; }
  const val = text.trim();
  if (!/^\d{6}$/.test(val)) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ PIN harus 6 digit angka. Ketik ulang, atau /batal:", reply_markup: CANCEL_KB }); return; }
  await tgApi(token, "sendChatAction", { chat_id: chatId, action: "typing" });
  try {
    const { data: res } = await admin.functions.invoke("premium-quest", { body: { action: "purchase", visitorId, planId: data.planId, pin: val, deviceKey: `tg-${chatId}` } });
    const r: any = res || {};
    if (r.error) {
      if (r.needPin) { await tgApi(token, "sendMessage", { chat_id: chatId, text: `❌ ${r.error}\n\nKetik ulang PIN, atau /batal:`, reply_markup: CANCEL_KB }); return; }
      await clearState(admin, chatId);
      await tgApi(token, "sendMessage", { chat_id: chatId, text: `❌ ${r.error}`, parse_mode: "HTML", reply_markup: QUEST_MENU_KB() });
      return;
    }
    await clearState(admin, chatId);
    const exp = r.expires_at ? new Date(r.expires_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "Permanen";
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: `✅ <b>Premium Quest Aktif!</b>\n\n👑 <b>${esc(data.name)}</b>\n💵 Dibayar: <b>${fmtRp(data.price)}</b>\n⏳ Masa aktif s/d: <b>${exp}</b>`,
      parse_mode: "HTML", reply_markup: backKb([[{ text: "👑 Premium Quest", callback_data: "quest_p" }]]),
    });
  } catch (_) {
    await clearState(admin, chatId);
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Gagal memproses pembelian. Coba lagi nanti.", reply_markup: QUEST_MENU_KB() });
  }
}

async function handlePremiumTrial(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null) {
  if (!visitorId) { await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk klaim trial.", reply_markup: LOGIN_KB() }); return; }
  try {
    const { data: res } = await admin.functions.invoke("premium-quest", { body: { action: "trial", visitorId, deviceKey: `tg-${chatId}` } });
    const r: any = res || {};
    if (r.error) { await sendOrEdit(token, chatId, editMsgId, { text: `⚠️ ${r.error}`, parse_mode: "HTML", reply_markup: QUEST_MENU_KB() }); return; }
    await renderPremiumQuest(admin, token, chatId, visitorId, editMsgId);
  } catch (_) {
    await sendOrEdit(token, chatId, editMsgId, { text: "❌ Gagal klaim trial. Coba lagi nanti.", reply_markup: QUEST_MENU_KB() });
  }
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
    const { data: rows } = await admin.from("playlist_songs").select("id, title, artist, file_url").order("created_at", { ascending: false });
    const list = rows || [];
    if (!list.length) { await send("🎵 <b>Musik</b>\n\nBelum ada lagu."); return true; }

    // Kirim daftar lengkap tanpa dipotong — pecah jadi beberapa halaman.
    // Telegram: max 4096 char/pesan, max ~100 tombol/keyboard.
    const PER_PAGE = 30; // 30 lagu per pesan (60 tombol) aman di bawah limit
    const total = list.length;
    const pages = Math.ceil(total / PER_PAGE);

    for (let p = 0; p < pages; p++) {
      const chunk = list.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
      let t = pages > 1
        ? `🎵 <b>Musik Toko</b> (${p + 1}/${pages}) — total ${total} lagu\n\n`
        : `🎵 <b>Musik Toko</b> — total ${total} lagu, putar / download 👇\n\n`;
      const musicRows: any[] = [];
      for (const s of chunk) {
        t += `🎧 <b>${esc(s.title)}</b> — ${esc(s.artist || "Unknown")}\n`;
        if (s.file_url) {
          musicRows.push([
            { text: `▶️ ${s.title.slice(0, 18)}`, url: `${WEB_URL}/playlist?play=${s.id}` },
            { text: "⬇️ Download", callback_data: `dl_${s.id}` },
          ]);
        }
      }
      const isLast = p === pages - 1;
      if (isLast) {
        t += `\n▶️ = putar di website (otomatis main) • ⬇️ = kirim file lewat Telegram.`;
        musicRows.push([{ text: "🌐 Semua Lagu", url: WEB_URL + "/musik" }]);
        await send(t, backKb(musicRows));
      } else {
        await tgApi(token, "sendMessage", { chat_id: chatId, text: t, parse_mode: "HTML", reply_markup: { inline_keyboard: musicRows } });
      }
    }
    return true;
  }



  if (key === "quest") { await renderQuestHub(admin, token, chatId, visitorId, editMsgId); return true; }
  if (key === "quest_d") { await renderQuestPeriod(admin, token, chatId, visitorId, editMsgId, "d"); return true; }
  if (key === "quest_w") { await renderQuestPeriod(admin, token, chatId, visitorId, editMsgId, "w"); return true; }
  if (key === "quest_m") { await renderQuestPeriod(admin, token, chatId, visitorId, editMsgId, "m"); return true; }
  if (key === "quest_p") { await renderPremiumQuest(admin, token, chatId, visitorId, editMsgId); return true; }
  if (/^qpg_[dwm]_\d+$/.test(key)) {
    const [, period, pageRaw] = key.split("_");
    await renderQuestPeriod(admin, token, chatId, visitorId, editMsgId, period as "d" | "w" | "m", Number(pageRaw || 0));
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
    const redeemBtn = [{ text: "🎟️ Tukar Kode Voucher", callback_data: "voucher_redeem" }];
    const { data: rows } = await admin.from("discount_vouchers").select("code, discount_amount, expires_at, used_count, max_uses, is_active").eq("visitor_id", visitorId).eq("is_active", true).order("created_at", { ascending: false }).limit(10);
    const list = (rows || []).filter((v: any) => (v.used_count || 0) < (v.max_uses || 1) && (!v.expires_at || new Date(v.expires_at) > new Date()));
    if (!list.length) { await send("🎫 <b>Voucher</b>\n\nBelum ada voucher aktif. Punya kode? Tukar sekarang, atau ikuti toko/event untuk dapat voucher!", backKb([redeemBtn])); return true; }
    let t = "🎫 <b>Voucher Diskon Kamu</b>\n\n";
    for (const v of list) t += `🏷️ <code>${v.code}</code> — diskon ${fmtRp(v.discount_amount)}\n`;
    t += `\nPakai saat checkout: ${WEB_URL}/`;
    await send(t, backKb([redeemBtn]));
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

  if (key === "game") {
    const playRows = [
      [{ text: "🤖 Game AI", url: WEB_URL + "/game" }, { text: "🎰 Slot", url: WEB_URL + "/game" }],
      [{ text: "🎯 Lucky Draw", url: WEB_URL + "/game" }, { text: "💎 Lucky Royale", url: WEB_URL + "/luck-royale-nyawa" }],
      [{ text: "🏆 Peringkat", callback_data: "peringkat" }, { text: "🎮 Kredit Game", callback_data: "belanja" }],
    ];
    if (!visitorId) {
      await send(sectionText("game"), backKb([...playRows, [{ text: "🔑 Login untuk lihat profil", callback_data: "login" }]]));
      return true;
    }
    const [{ data: prof }, { data: cred }, { data: stats }] = await Promise.all([
      admin.from("game_profiles").select("display_name, gems, is_guest").eq("visitor_id", visitorId).maybeSingle(),
      admin.from("user_game_credits").select("credits, unlimited_until").eq("visitor_id", visitorId).maybeSingle(),
      admin.from("game_stats").select("game_type, wins, losses, points").eq("visitor_id", visitorId).order("points", { ascending: false }).limit(5),
    ]);
    let t = "🎮 <b>Game Center</b>\n\n";
    t += `👤 <b>${esc(prof?.display_name || "Pemain")}</b>${prof?.is_guest ? " (tamu)" : ""}\n`;
    t += `💎 Gem: <b>${Number(prof?.gems || 0).toLocaleString("id-ID")}</b>\n`;
    const unlim = cred?.unlimited_until && new Date(cred.unlimited_until) > new Date();
    t += `🎟️ Kredit: <b>${unlim ? "♾️ Unlimited" : (cred?.credits || 0)}</b>`;
    if (unlim) t += ` (s/d ${new Date(cred.unlimited_until).toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" })})`;
    t += "\n";
    const sList = stats || [];
    if (sList.length) {
      t += `\n📊 <b>Statistik Game Kamu</b>\n`;
      for (const s of sList) t += `• ${esc(s.game_type)}: 🏆${s.wins || 0}W / ${s.losses || 0}L • ⭐${s.points || 0}\n`;
    } else {
      t += `\nBelum ada statistik. Mainkan game & kumpulkan poin!\n`;
    }
    t += `\nMain sekarang di tombol bawah 👇`;
    await send(t, backKb(playRows));
    return true;
  }

  if (key === "confess_wall") {
    const { data: rows } = await admin.from("confess_public_wall").select("id, sender_name, message, mood_tag, reaction_counts, total_reactions, created_at").eq("is_hidden", false).order("created_at", { ascending: false }).limit(6);
    const list = rows || [];
    if (!list.length) { await send("💬 <b>Confess Wall</b>\n\nBelum ada confess. Jadilah yang pertama!", backKb([[{ text: "✍️ Kirim Confess", callback_data: "confess" }]])); return true; }
    let t = "💬 <b>Confess Wall Terbaru</b>\n\n";
    const kbRows: any[] = [];
    list.forEach((w: any, i: number) => {
      const rc = w.reaction_counts || {};
      const d = new Date(w.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" });
      t += `${i + 1}. <b>${esc(w.sender_name || "Anonim")}</b> ${w.mood_tag ? "• " + esc(w.mood_tag) : ""} <i>(${d})</i>\n`;
      t += `   ${esc(String(w.message).slice(0, 140))}\n`;
      t += `   ❤️${rc.heart || 0} 🔥${rc.fire || 0} 😂${rc.laugh || 0} 😢${rc.cry || 0}\n\n`;
      kbRows.push([
        { text: `❤️ ${i + 1}`, callback_data: `wreact_heart_${w.id}` },
        { text: `🔥 ${i + 1}`, callback_data: `wreact_fire_${w.id}` },
        { text: `😂 ${i + 1}`, callback_data: `wreact_laugh_${w.id}` },
        { text: `😢 ${i + 1}`, callback_data: `wreact_cry_${w.id}` },
      ]);
    });
    kbRows.push([{ text: "✍️ Kirim Confess", callback_data: "confess" }, { text: "🔄 Refresh", callback_data: "confess_wall" }]);
    await send(t, backKb(kbRows));
    return true;
  }

  return false;
}



// ===================== BATCH 1: Saldo lengkap, 2FA, Deposit, Download, Banned =====================

// Cek status banned untuk visitor. Return info ban atau null.
async function getBanInfo(admin: any, visitorId: string | null): Promise<any | null> {
  if (!visitorId) return null;
  try {
    const { data } = await admin.rpc("get_account_ban_info", { p_visitor_id: visitorId });
    const row = Array.isArray(data) ? data[0] : data;
    return row || null;
  } catch (_) { return null; }
}

function banText(ban: any): string {
  let sisa = "Permanen";
  if (!ban.is_permanent && ban.banned_until) {
    const ms = new Date(ban.banned_until).getTime() - Date.now();
    if (ms > 0) {
      const totalMin = Math.floor(ms / 60000);
      const hari = Math.floor(totalMin / 1440);
      const jam = Math.floor((totalMin % 1440) / 60);
      const menit = totalMin % 60;
      sisa = [hari ? `${hari} hari` : null, jam ? `${jam} jam` : null, `${menit} menit`].filter(Boolean).join(" ");
    } else sisa = "segera berakhir";
  }
  const until = ban.is_permanent ? "Permanen (tidak ada batas waktu)" :
    (ban.banned_until ? new Date(ban.banned_until).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB" : "-");
  return `🚫 <b>Akun Kamu Diblokir</b>\n\nSemua fitur bot dinonaktifkan sementara.\n\n📝 Alasan: <b>${esc(ban.reason || "Pelanggaran ketentuan")}</b>\n⏳ Sisa waktu banned: <b>${sisa}</b>\n📅 Berakhir: ${until}\n\nUntuk banding / unban, hubungi admin di WhatsApp.`;
}

const BAN_KB = { inline_keyboard: [[{ text: "🎧 Hubungi Admin (WA)", url: `https://wa.me/${WA_NUMBER}` }]] };

// ===== 2FA status =====
async function show2FA(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk lihat 2FA.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  const { data: u } = await admin.from("user_balances").select("totp_enabled").eq("visitor_id", visitorId).maybeSingle();
  const on = !!u?.totp_enabled;
  const txt = on
    ? "🛡️ <b>Autentikasi 2 Faktor (2FA)</b>\n\n✅ Status: <b>AKTIF</b>\n\nAkun kamu dilindungi kode 2FA (Google Authenticator). Saat login lewat perangkat baru, kamu wajib memasukkan kode 6 digit dari aplikasi authenticator.\n\n🔧 Untuk menonaktifkan / atur ulang 2FA, buka website."
    : "🛡️ <b>Autentikasi 2 Faktor (2FA)</b>\n\n❌ Status: <b>BELUM AKTIF</b>\n\n2FA menambahkan lapisan keamanan ekstra pada akun saldo kamu. Aktifkan lewat website (scan QR di Google Authenticator).";
  await sendOrEdit(token, chatId, editMsgId, {
    text: txt, parse_mode: "HTML",
    reply_markup: backKb([[{ text: on ? "🔧 Atur 2FA di Web" : "➕ Aktifkan 2FA di Web", url: WEB_URL + "/saldo" }], [{ text: "💰 Saldo", callback_data: "saldo" }]]),
  });
}

// ===== Riwayat login =====
async function showLoginHistory(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk lihat riwayat login.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  const { data: hist } = await admin.from("balance_login_history").select("logged_in_at, device_info, user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(10);
  const list = hist || [];
  let t = "🕘 <b>Riwayat Login Akun</b>\n\n";
  if (!list.length) t += "Belum ada riwayat login tercatat.";
  else {
    list.forEach((h: any, i: number) => {
      const d = new Date(h.logged_in_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
      let dev = "";
      const di = h.device_info;
      if (di) { try { const o = typeof di === "string" ? JSON.parse(di) : di; dev = o.platform || o.device || o.browser || o.os || ""; } catch (_) { dev = String(di).slice(0, 30); } }
      t += `${i + 1}. 📅 ${d} WIB${dev ? `\n   📱 ${esc(String(dev).slice(0, 40))}` : ""}\n`;
    });
  }
  await sendOrEdit(token, chatId, editMsgId, { text: t, parse_mode: "HTML", reply_markup: backKb([[{ text: "💰 Saldo", callback_data: "saldo" }]]) });
}

// ===== Reset PIN (pilih token admin / WA) =====
async function startPinReset(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk reset PIN.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  await sendOrEdit(token, chatId, editMsgId, {
    text: "🔁 <b>Reset PIN</b>\n\nPilih cara verifikasi untuk reset PIN kamu:\n\n📲 <b>Via WhatsApp</b> — kode reset dikirim ke nomor WA terdaftar.\n🎧 <b>Via Admin</b> — permintaan diteruskan ke admin untuk verifikasi manual.",
    parse_mode: "HTML",
    reply_markup: backKb([
      [{ text: "📲 Kirim Kode ke WA", callback_data: "pinreset_wa" }],
      [{ text: "🎧 Minta ke Admin", callback_data: "pinreset_admin" }],
      [{ text: "💰 Saldo", callback_data: "saldo" }],
    ]),
  });
}

async function doPinResetWa(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) return;
  const { data: u } = await admin.from("user_balances").select("username, phone").eq("visitor_id", visitorId).maybeSingle();
  if (!u?.phone) {
    await sendOrEdit(token, chatId, editMsgId, { text: "⚠️ Nomor WhatsApp belum terdaftar di akun. Reset PIN lewat website.", reply_markup: backKb([[{ text: "🌐 Reset di Web", url: WEB_URL + "/saldo" }]]) });
    return;
  }
  // Bersihkan token lama & buat kode unik 5 digit
  try { await admin.from("pin_reset_tokens").delete().eq("visitor_id", visitorId); } catch (_) { /* ignore */ }
  let code = "";
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  for (let i = 0; i < 8; i++) {
    code = String(Math.floor(10000 + Math.random() * 90000));
    const { error: insErr } = await admin.from("pin_reset_tokens").insert({ visitor_id: visitorId, token: code, expires_at: expires });
    if (!insErr) break;
    code = "";
  }
  if (code) {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-wa-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ event_type: "pin_reset", vars: { username: u.username, code, phone: u.phone }, notify_visitor_id: visitorId }),
    }).catch(() => {});
  }

  await setState(admin, chatId, "pinreset_code", {});
  await sendOrEdit(token, chatId, editMsgId, {
    text: `📲 <b>Kode Reset Dikirim</b>\n\nKode reset PIN 5 digit sudah dikirim ke WhatsApp <b>${maskPhone(u.phone)}</b> (berlaku 15 menit).\n\nKetik kode tersebut di sini 👇`,
    parse_mode: "HTML", reply_markup: CANCEL_KB,
  });
}

// ===== Deposit flow =====
async function startDeposit(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk deposit saldo.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  await sendOrEdit(token, chatId, editMsgId, {
    text: "💳 <b>Deposit Saldo</b>\n\nPilih metode pembayaran:\n\n🟦 <b>QRIS</b> — scan QR, semua e-wallet & m-banking.\n💜 <b>E-Wallet</b> — Dana, GoPay, OVO, ShopeePay.\n\nSetelah transfer, kamu kirim <b>bukti (foto)</b> + nominal. Deposit diproses admin.",
    parse_mode: "HTML",
    reply_markup: backKb([
      [{ text: "🟦 QRIS", callback_data: "dep_qris" }],
      [{ text: "💜 E-Wallet", callback_data: "dep_ewallet" }],
      [{ text: "💰 Saldo", callback_data: "saldo" }],
    ]),
  });
}

async function depositChooseEwallet(admin: any, token: string, chatId: string, editMsgId: number | null = null) {
  await sendOrEdit(token, chatId, editMsgId, {
    text: "💜 <b>Deposit E-Wallet</b>\n\nPilih e-wallet yang kamu pakai:",
    parse_mode: "HTML",
    reply_markup: backKb([
      [{ text: "Dana", callback_data: "depw_Dana" }, { text: "GoPay", callback_data: "depw_GoPay" }],
      [{ text: "OVO", callback_data: "depw_OVO" }, { text: "ShopeePay", callback_data: "depw_ShopeePay" }],
    ]),
  });
}

async function depositAskAmount(admin: any, token: string, chatId: string, method: string, editMsgId: number | null = null) {
  // Kirim gambar QRIS admin dulu kalau metode QRIS & sudah diatur
  if (String(method).toUpperCase() === "QRIS") {
    const { data: qcfg } = await admin.from("telegram_bot_config").select("qris_image_url, qris_caption").limit(1).maybeSingle();
    if (qcfg?.qris_image_url) {
      await tgApi(token, "sendPhoto", {
        chat_id: chatId,
        photo: qcfg.qris_image_url,
        caption: qcfg.qris_caption
          ? esc(qcfg.qris_caption)
          : "🟦 <b>Scan QRIS di atas</b> untuk membayar. Semua e-wallet & m-banking didukung.\n\nSetelah transfer, lanjut ketik nominal & kirim bukti. 👇",
        parse_mode: "HTML",
        reply_markup: CANCEL_KB,
      }).catch(() => {});
    }
  }
  await setState(admin, chatId, "dep_amount", { method });
  await sendOrEdit(token, chatId, editMsgId, {
    text: `💳 <b>Deposit ${esc(method)}</b>\n\nKetik <b>nominal deposit</b> (angka saja, min. Rp 1.000).\n\nContoh: <code>50000</code>`,
    parse_mode: "HTML", reply_markup: CANCEL_KB,
  });
}

async function handleDepositStep(admin: any, token: string, chatId: string, state: string, data: any, message: any, visitorId: string | null) {
  if (!visitorId) { await clearState(admin, chatId); await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Sesi habis, login dulu.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) }); return; }

  if (state === "dep_amount") {
    const raw = String(message.text || "").replace(/\D/g, "");
    const amount = Number(raw);
    if (!amount || amount < 1000) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Nominal minimal Rp 1.000. Ketik ulang angkanya:", reply_markup: CANCEL_KB });
      return;
    }
    await setState(admin, chatId, "dep_proof", { method: data.method, amount });
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: `📸 <b>Kirim Bukti Transfer</b>\n\nMetode: <b>${esc(data.method)}</b>\nNominal: <b>${fmtRp(amount)}</b>\n\nSekarang <b>kirim FOTO bukti pembayaran</b> kamu di sini 👇`,
      parse_mode: "HTML", reply_markup: CANCEL_KB,
    });
    return;
  }

  if (state === "dep_proof") {
    const photos = message.photo;
    if (!Array.isArray(photos) || !photos.length) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Mohon kirim <b>foto</b> bukti transfer (bukan teks). Coba lagi:", parse_mode: "HTML", reply_markup: CANCEL_KB });
      return;
    }
    const fileId = photos[photos.length - 1].file_id;
    const { data: u } = await admin.from("user_balances").select("username").eq("visitor_id", visitorId).maybeSingle();
    const trxId = `DEP-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const method = String(data.method || "QRIS").toUpperCase() === "QRIS" ? "QRIS" : data.method;
    const { error } = await admin.from("deposits").insert({
      visitor_id: visitorId, username: u?.username || "-", amount: data.amount, payment_method: method, trx_id: trxId,
    });
    await clearState(admin, chatId);
    if (error) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Gagal membuat deposit. Coba lagi nanti.", reply_markup: MENU });
      return;
    }
    const { data: cfg } = await admin.from("telegram_bot_config").select("owner_id").limit(1).maybeSingle();
    if (cfg?.owner_id) {
      await tgApi(token, "sendPhoto", {
        chat_id: cfg.owner_id, photo: fileId,
        caption: `💳 <b>Deposit Baru</b>\n👤 ${esc(u?.username || "-")}\n💰 ${fmtRp(data.amount)}\n🏦 ${esc(method)}\n🧾 ${trxId}\n\nSetujui/tolak di dashboard admin.`,
        parse_mode: "HTML",
      }).catch(() => {});
    }
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: `✅ <b>Deposit Terkirim!</b>\n\n🧾 TRX: <code>${trxId}</code>\n💰 Nominal: <b>${fmtRp(data.amount)}</b>\n🏦 Metode: <b>${esc(method)}</b>\n\nStatus: ⏳ <b>Menunggu konfirmasi admin</b>. Kamu akan dapat notifikasi otomatis di sini saat disetujui. 🙏`,
      parse_mode: "HTML", reply_markup: backKb([[{ text: "💰 Cek Saldo", callback_data: "saldo" }]]),
    });
    return;
  }
}

// ===== Download riwayat transaksi (Excel/Word/PDF) =====
async function fetchAllTrx(admin: any, visitorId: string) {
  const { data } = await admin.from("balance_transactions").select("type, amount, description, created_at, trx_id").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(500);
  return data || [];
}

function buildSimplePdf(title: string, lines: string[]): Uint8Array {
  const pesc = (s: string) => String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const clean = (s: string) => String(s).replace(/[^\x20-\x7E]/g, "?");
  let body = "BT\n/F1 14 Tf\n50 790 Td\n14 TL\n";
  body += `(${pesc(clean(title))}) Tj\n`;
  body += "/F1 9 Tf\n";
  let y = 0;
  for (const ln of lines) {
    body += "T*\n";
    body += `(${pesc(clean(ln)).slice(0, 300)}) Tj\n`;
    y++;
    if (y > 55) break;
  }
  body += "ET";
  const objs: string[] = [];
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>");
  objs.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { pdf += String(off).padStart(10, "0") + " 00000 n \n"; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

async function sendTrxDownload(admin: any, token: string, chatId: string, visitorId: string | null, fmt: string, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk download riwayat.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  await tgApi(token, "sendChatAction", { chat_id: chatId, action: "upload_document" });
  const rows = await fetchAllTrx(admin, visitorId);
  if (!rows.length) {
    await sendOrEdit(token, chatId, editMsgId, { text: "📭 Belum ada transaksi untuk diunduh.", reply_markup: backKb([[{ text: "💰 Saldo", callback_data: "saldo" }]]) });
    return;
  }
  const { data: u } = await admin.from("user_balances").select("username").eq("visitor_id", visitorId).maybeSingle();
  const uname = u?.username || "-";
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const fmtRow = (tr: any) => {
    const d = new Date(tr.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const sign = tr.type === "topup" || tr.type === "deposit" ? "+" : "-";
    return { d, tipe: tr.type || "-", nom: `${sign}${fmtRp(tr.amount)}`, trx: tr.trx_id || "-", ket: (tr.description || "").replace(/\s+/g, " ").slice(0, 80) };
  };
  let bytes: Uint8Array; let filename: string; let mime: string;
  if (fmt === "excel") {
    let html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><h3>Riwayat Transaksi - ${xmlEsc(uname)} (${xmlEsc(now)})</h3><table border="1"><tr><th>No</th><th>Tanggal</th><th>Tipe</th><th>Nominal</th><th>TRX ID</th><th>Keterangan</th></tr>`;
    rows.forEach((tr: any, i: number) => { const r = fmtRow(tr); html += `<tr><td>${i + 1}</td><td>${xmlEsc(r.d)}</td><td>${xmlEsc(r.tipe)}</td><td>${xmlEsc(r.nom)}</td><td>${xmlEsc(r.trx)}</td><td>${xmlEsc(r.ket)}</td></tr>`; });
    html += "</table></body></html>";
    bytes = new TextEncoder().encode(html); filename = "riwayat-transaksi.xls"; mime = "application/vnd.ms-excel";
  } else if (fmt === "word") {
    let html = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head><body><h2>Agung Adi Store</h2><h3>Riwayat Transaksi - ${xmlEsc(uname)}</h3><p>Dibuat: ${xmlEsc(now)}</p><table border="1" cellpadding="4" style="border-collapse:collapse"><tr><th>No</th><th>Tanggal</th><th>Tipe</th><th>Nominal</th><th>TRX ID</th><th>Keterangan</th></tr>`;
    rows.forEach((tr: any, i: number) => { const r = fmtRow(tr); html += `<tr><td>${i + 1}</td><td>${xmlEsc(r.d)}</td><td>${xmlEsc(r.tipe)}</td><td>${xmlEsc(r.nom)}</td><td>${xmlEsc(r.trx)}</td><td>${xmlEsc(r.ket)}</td></tr>`; });
    html += "</table></body></html>";
    bytes = new TextEncoder().encode(html); filename = "riwayat-transaksi.doc"; mime = "application/msword";
  } else {
    const lines = [`Akun: ${uname}    Dibuat: ${now}`, `Total transaksi: ${rows.length}`, ""];
    rows.forEach((tr: any, i: number) => { const r = fmtRow(tr); lines.push(`${i + 1}. ${r.d} | ${r.tipe} | ${r.nom} | ${r.trx}`); if (r.ket) lines.push(`    ${r.ket}`); });
    bytes = buildSimplePdf("Riwayat Transaksi - Agung Adi Store", lines); filename = "riwayat-transaksi.pdf"; mime = "application/pdf";
  }
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", `📥 Riwayat transaksi (${rows.length} data) — format ${fmt.toUpperCase()}`);
  form.append("document", new Blob([bytes], { type: mime }), filename);
  await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
}





async function ensureChat(admin: any, token: string, chat: any, from?: any, refreshPhoto = true) {
  const chatId = String(chat.id);
  const identity = telegramIdentity(chat, from);
  const { data: existing } = await admin
    .from("telegram_chats")
    .select("photo_url")
    .eq("chat_id", chatId)
    .maybeSingle();
  const photoUrl = existing?.photo_url || (refreshPhoto && identity.userId ? await fetchTelegramProfilePhoto(token, identity.userId) : null) || "";
  await admin.from("telegram_chats").upsert(
    {
      chat_id: chatId,
      first_name: identity.firstName,
      last_name: identity.lastName,
      username: identity.username,
      photo_url: photoUrl,
    },
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
  await clearState(admin, chatId);
  await sendOrEdit(token, chatId, editMsgId, {
    text: `💬 <b>Confess WA</b>\n\nKirim pesan anonim langsung ke nomor WhatsApp seseorang. Penerima tidak tahu siapa kamu.\n\n• Masukkan nomor tujuan (bisa lebih dari satu)\n• Pakai nama samaran / anonim\n• Tulis pesan lalu bayar dengan PIN\n• Bisa lihat riwayat & balas chat di sini\n\nPilih menu 👇`,
    parse_mode: "HTML",
    reply_markup: backKb([
      [{ text: "✍️ Kirim Confess Baru", callback_data: "confess_new" }],
      [{ text: "💬 Riwayat Chat Confess", callback_data: "confess_hist" }],
    ]),
  });
}

async function startConfessNew(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, {
      text: `💬 <b>Kirim Confess</b>\n\n🔒 Kamu wajib <b>login akun saldo</b> dulu untuk kirim confess.\n\nLogin atau daftar dulu ya 👇`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "🔑 Login", callback_data: "login" }], [{ text: "📝 Daftar", callback_data: "daftar" }]] },
    });
    return;
  }
  await setState(admin, chatId, "confess_phones", {});
  await sendOrEdit(token, chatId, editMsgId, {
    text: `📱 <b>Confess WA — Langkah 1/4</b>\n\nMasukkan <b>nomor tujuan</b> (WhatsApp).\nBisa lebih dari satu, pisahkan dengan koma / baris baru.\n\nContoh:\n<code>08123456789, 08987654321</code>\n\nMaksimal 15 nomor.`,
    parse_mode: "HTML",
    reply_markup: CANCEL_KB,
  });
}

async function showConfessHistory(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk melihat riwayat chat confess.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  let vids = [visitorId];
  const { data: hist } = await admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
  const ubId = hist?.user_balance_id || null;
  if (ubId) {
    const { data: sib } = await admin.from("balance_login_history").select("visitor_id").eq("user_balance_id", ubId);
    if (sib?.length) vids = Array.from(new Set(sib.map((s: any) => s.visitor_id)));
  }
  let q = admin.from("confess_threads").select("id, target_phone, sender_name, last_message_preview, last_message_at, free_until").order("last_message_at", { ascending: false }).limit(10);
  q = ubId ? q.or(`user_balance_id.eq.${ubId},visitor_id.in.(${vids.join(",")})`) : q.in("visitor_id", vids);
  const { data: threads } = await q;
  if (!threads?.length) {
    await sendOrEdit(token, chatId, editMsgId, { text: "💬 <b>Riwayat Chat Confess</b>\n\nBelum ada chat confess. Kirim confess dulu yuk!", parse_mode: "HTML", reply_markup: backKb([[{ text: "✍️ Kirim Confess Baru", callback_data: "confess_new" }]]) });
    return;
  }
  const now = Date.now();
  const rows: any[] = threads.map((t: any) => {
    const active = new Date(t.free_until).getTime() > now;
    const label = `${active ? "🟢" : "⚪"} ${maskPhone(t.target_phone)} — ${(t.last_message_preview || "").slice(0, 20)}`;
    return [{ text: label, callback_data: `cfthr_${t.id}` }];
  });
  rows.push([{ text: "✍️ Kirim Confess Baru", callback_data: "confess_new" }]);
  await sendOrEdit(token, chatId, editMsgId, {
    text: `💬 <b>Riwayat Chat Confess</b>\n\n🟢 = masih bisa balas gratis (window 24 jam)\n⚪ = window habis, perlu kirim confess baru\n\nPilih chat untuk lihat & balas 👇`,
    parse_mode: "HTML",
    reply_markup: backKb(rows),
  });
}

async function showConfessThread(admin: any, token: string, chatId: string, visitorId: string | null, threadId: string, editMsgId: number | null = null) {
  if (!visitorId) { await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) }); return; }
  const { data: thread } = await admin.from("confess_threads").select("id, target_phone, sender_name, free_until").eq("id", threadId).maybeSingle();
  if (!thread) { await sendOrEdit(token, chatId, editMsgId, { text: "⚠️ Thread tidak ditemukan.", reply_markup: backKb([[{ text: "💬 Riwayat", callback_data: "confess_hist" }]]) }); return; }
  const { data: msgs } = await admin.from("confess_thread_messages").select("direction, text, media_type, created_at").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(20);
  const lines = (msgs || []).map((m: any) => {
    const who = m.direction === "out" ? "➡️ Kamu" : "⬅️ Dia";
    const body = m.text ? esc(m.text.slice(0, 120)) : (m.media_type ? `[${m.media_type}]` : "-");
    return `${who}: ${body}`;
  });
  const active = new Date(thread.free_until).getTime() > Date.now();
  const kb: any[] = [];
  if (active) kb.push([{ text: "↩️ Balas Chat", callback_data: `cfreply_${threadId}` }]);
  else kb.push([{ text: "✍️ Kirim Confess Baru", callback_data: "confess_new" }]);
  kb.push([{ text: "💬 Riwayat", callback_data: "confess_hist" }]);
  await sendOrEdit(token, chatId, editMsgId, {
    text: `💬 <b>Chat ke ${maskPhone(thread.target_phone)}</b>\nSamaran: <b>${esc(thread.sender_name || "Anonim")}</b>\n${active ? "🟢 Bisa balas gratis" : "⚪ Window 24 jam habis"}\n\n${lines.join("\n") || "Belum ada pesan."}`,
    parse_mode: "HTML",
    reply_markup: backKb(kb),
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
    [{ text: "💳 Deposit Saldo", callback_data: "deposit" }, { text: "🛡️ 2FA", callback_data: "twofa" }],
    [{ text: "🔐 Ganti PIN", callback_data: "pin_change" }, { text: "🔁 Reset PIN", callback_data: "pin_reset" }],
    [{ text: "🔎 Status PIN", callback_data: "pin_status" }, { text: "🕘 Riwayat Login", callback_data: "login_history" }],
    [{ text: "📜 History Transaksi", callback_data: "riwayat" }, { text: "📥 Download Riwayat", callback_data: "dl_hist" }],
    [{ text: "🎫 Voucher", callback_data: "voucher" }, { text: "✏️ Ganti Nama", callback_data: "name_change" }],
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

function confessPriceForN(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 2000;
  if (n === 2) return 4000;
  if (n === 3) return 5000;
  if (n <= 5) return 6000;
  if (n <= 10) return 7000;
  if (n <= 15) return 8000;
  return 0;
}

function svgWrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length >= maxLines && (words.join(" ").length > lines.join(" ").length)) {
    lines[maxLines - 1] = (lines[maxLines - 1] || "").slice(0, maxChars - 1) + "…";
  }
  return lines;
}

async function generateConfessCard(admin: any, visitorId: string, message: string, senderName: string, recipients: string, trxId: string): Promise<{ url: string; name: string; size: number } | null> {
  try {
    const resvg = await ensureResvg();
    const sender = esc(senderName || "Anonim");
    const rcpt = esc(recipients || "Tujuan rahasia");
    const msgLines = svgWrap(message, 34, 8);
    const dateStr = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
    const msgTspans = msgLines.map((ln, i) => `<tspan x="130" dy="${i === 0 ? 0 : 58}">${esc(ln)}</tspan>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" font-family="'Segoe UI', Arial, sans-serif">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#190b2f"/><stop offset="0.34" stop-color="#be123c"/><stop offset="0.68" stop-color="#fb7185"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs>
<rect width="1080" height="1440" fill="url(#bg)"/>
<rect x="42" y="42" width="996" height="1356" rx="54" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.34)" stroke-width="3"/>
<rect x="76" y="98" width="928" height="116" rx="36" fill="rgba(255,255,255,0.96)"/>
<text x="110" y="150" font-size="30" font-weight="800" fill="#be123c">AGUNG ADI STORE</text>
<text x="110" y="192" font-size="24" font-weight="600" fill="#6b7280">Confess anonim · pesan rahasia</text>
<text x="960" y="180" font-size="52" text-anchor="end">💌</text>
<text x="76" y="330" font-size="74" font-weight="900" fill="#ffffff">Pesan Rahasia</text>
<text x="76" y="382" font-size="26" font-weight="600" fill="rgba(255,255,255,0.82)">ID: ${esc(trxId)}</text>
<rect x="76" y="420" width="450" height="150" rx="30" fill="rgba(255,255,255,0.92)"/>
<text x="110" y="470" font-size="24" font-weight="800" fill="#be123c">DARI</text>
<text x="110" y="520" font-size="34" font-weight="800" fill="#111827">${sender.slice(0, 18)}</text>
<rect x="554" y="420" width="450" height="150" rx="30" fill="rgba(255,255,255,0.92)"/>
<text x="588" y="470" font-size="24" font-weight="800" fill="#be123c">UNTUK</text>
<text x="588" y="520" font-size="30" font-weight="800" fill="#111827">${rcpt.slice(0, 20)}</text>
<rect x="76" y="620" width="928" height="620" rx="42" fill="rgba(255,255,255,0.97)"/>
<text x="120" y="700" font-size="90" font-weight="900" fill="#fb7185">“</text>
<text x="130" y="760" font-size="42" font-weight="700" fill="#111827">${msgTspans}</text>
<text x="130" y="1180" font-size="30" font-weight="800" fill="#9f1239">— ${sender.slice(0, 18)}</text>
<text x="130" y="1220" font-size="24" font-weight="600" fill="#6b7280">${dateStr}</text>
</svg>`;
    const r = new resvg.Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
    const png = r.render().asPng();
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    const fileName = `surat-confess-${Date.now()}.png`;
    const path = `auto-letter/${visitorId}/${fileName}`;
    const { error: upErr } = await admin.storage.from("confess-media").upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) return null;
    const { data: pub } = admin.storage.from("confess-media").getPublicUrl(path);
    return { url: pub.publicUrl, name: fileName, size: bytes.byteLength };
  } catch (_) {
    return null;
  }
}



async function handleConfessStep(admin: any, token: string, chatId: string, state: string, data: any, text: string, chat: any) {
  const val = text.trim();
  const { data: chatRow } = await admin.from("telegram_chats").select("tg_visitor_id").eq("chat_id", chatId).maybeSingle();
  const visitorId = chatRow?.tg_visitor_id || null;

  if (state === "confess_phones") {
    const parts = val.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean);
    const phones: string[] = [];
    for (const p of parts) {
      const n = normPhone(p);
      if (!n) { await tgApi(token, "sendMessage", { chat_id: chatId, text: `⚠️ Nomor tidak valid: <code>${esc(p)}</code>. Ketik ulang semua nomor:`, parse_mode: "HTML", reply_markup: CANCEL_KB }); return; }
      if (!phones.includes(n)) phones.push(n);
    }
    if (phones.length < 1 || phones.length > 15) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Masukkan 1-15 nomor. Ketik ulang:", reply_markup: CANCEL_KB }); return; }
    await setState(admin, chatId, "confess_cname", { phones });
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: `✅ ${phones.length} nomor: ${phones.map(maskPhone).join(", ")}\n\n<b>Langkah 2/4</b> — Ketik <b>nama samaran</b>, atau ketik <b>-</b> untuk anonim penuh:`,
      parse_mode: "HTML",
      reply_markup: CANCEL_KB,
    });
    return;
  }

  if (state === "confess_cname") {
    const senderName = val === "-" ? "" : val.slice(0, 40);
    await setState(admin, chatId, "confess_cmsg", { ...data, senderName });
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: `<b>Langkah 3/4</b> — Tulis <b>pesan anonim</b> kamu (maks. 800 karakter):`,
      parse_mode: "HTML",
      reply_markup: CANCEL_KB,
    });
    return;
  }

  if (state === "confess_cmsg") {
    if (val.length < 3) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Pesan terlalu pendek. Tulis lagi:", reply_markup: CANCEL_KB }); return; }
    await setState(admin, chatId, "confess_card", { ...data, message: val.slice(0, 800) });
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: `🖼️ <b>Pakai Kartu Confess?</b>\n\n• <b>Pakai Kartu</b> — pesan dikirim sebagai kartu gambar cantik (berisi nama web + logo).\n• <b>Tanpa Kartu</b> — cuma teks pesan saja.\n\nPilih 👇`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [
        [{ text: "🖼️ Pakai Kartu", callback_data: "confess_card_yes" }, { text: "✉️ Tanpa Kartu", callback_data: "confess_card_no" }],
        [{ text: "❌ Batal", callback_data: "cancel" }],
      ] },
    });
    return;
  }

  if (state === "confess_card") {
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: "🖼️ Pilih dulu ya: pakai kartu atau tanpa kartu 👇",
      reply_markup: { inline_keyboard: [
        [{ text: "🖼️ Pakai Kartu", callback_data: "confess_card_yes" }, { text: "✉️ Tanpa Kartu", callback_data: "confess_card_no" }],
        [{ text: "❌ Batal", callback_data: "cancel" }],
      ] },
    });
    return;
  }


  if (state === "confess_cpin") {
    if (!/^\d{6}$/.test(val)) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ PIN harus 6 digit angka. Ketik ulang PIN:", reply_markup: CANCEL_KB }); return; }
    if (!visitorId) { await clearState(admin, chatId); await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Sesi habis, login dulu.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) }); return; }
    await tgApi(token, "sendChatAction", { chat_id: chatId, action: "typing" });
    try {
      const trxId = `CFS-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
      let media: any = {};
      if (data.useCard) {
        const card = await generateConfessCard(admin, visitorId, data.message, data.senderName || "", (data.phones || []).map(maskPhone).join(", "), trxId);
        if (card) media = { mediaUrl: card.url, mediaType: "image", mediaName: card.name, mediaMime: "image/png", mediaSize: card.size };
      }
      const { data: res, error } = await admin.functions.invoke("send-confession", {
        body: { visitorId, trxId, senderName: data.senderName || "", message: data.message, phones: data.phones, pin: val, ...media },
      });

      const r: any = res || {};
      if (error || r.error) {
        await clearState(admin, chatId);
        await tgApi(token, "sendMessage", { chat_id: chatId, text: `❌ ${r.error || "Gagal mengirim confess."}`, reply_markup: backKb([[{ text: "🔁 Coba Lagi", callback_data: "confess_new" }]]) });
        return;
      }
      await clearState(admin, chatId);
      await tgApi(token, "sendMessage", {
        chat_id: chatId,
        text: `✅ <b>Confess terkirim!</b>\n\n🆔 TRX: <code>${esc(r.trx_id || "-")}</code>\n📤 ${r.paid_count || 0} nomor berbayar, ${r.free_count || 0} gratis\n💰 Dipotong: <b>${fmtRp(r.charged || 0)}</b>\n💳 Sisa saldo: <b>${fmtRp(r.balance_remaining || 0)}</b>\n\nBalasan dari penerima bisa kamu lihat & balas di <b>Riwayat Chat Confess</b>.`,
        parse_mode: "HTML",
        reply_markup: backKb([[{ text: "💬 Riwayat Chat", callback_data: "confess_hist" }], [{ text: "✍️ Kirim Lagi", callback_data: "confess_new" }]]),
      });
    } catch (_) {
      await clearState(admin, chatId);
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Gagal mengirim confess. Coba lagi nanti.", reply_markup: MENU });
    }
    return;
  }

  if (state === "confess_reply") {
    if (val.length < 1) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Pesan kosong. Ketik balasan:", reply_markup: CANCEL_KB }); return; }
    if (!visitorId) { await clearState(admin, chatId); await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Sesi habis, login dulu.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) }); return; }
    try {
      const { data: res, error } = await admin.functions.invoke("confess-chat-send", {
        body: { visitorId, threadId: data.threadId, text: val.slice(0, 800) },
      });
      const r: any = res || {};
      await clearState(admin, chatId);
      if (error || r.error) {
        await tgApi(token, "sendMessage", { chat_id: chatId, text: `❌ ${r.error || "Gagal mengirim balasan."}`, reply_markup: backKb([[{ text: "💬 Riwayat", callback_data: "confess_hist" }]]) });
        return;
      }
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "✅ Balasan terkirim (gratis).", reply_markup: backKb([[{ text: "💬 Lihat Chat", callback_data: `cfthr_${data.threadId}` }]]) });
    } catch (_) {
      await clearState(admin, chatId);
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Gagal mengirim balasan. Coba lagi nanti.", reply_markup: MENU });
    }
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


// ===================== BATCH 2: Belanja & beli paket/membership via Saldo + PIN =====================

const BUY_CFG: Record<string, { table: string; name: string; price: string; label: string; icon: string; cbuy: string }> = {
  m: { table: "streak_membership_plans", name: "name", price: "price_idr", label: "Membership", icon: "👑", cbuy: "buym_" },
  c: { table: "credit_packages", name: "label", price: "price", label: "Kredit Game", icon: "🎮", cbuy: "buyc_" },
  g: { table: "gem_packages", name: "name", price: "price", label: "Paket Gem", icon: "💎", cbuy: "buyg_" },
  k: { table: "streak_coin_packages", name: "name", price: "price", label: "Koin Streak", icon: "🪙", cbuy: "buyk_" },
};

async function showBelanja(token: string, chatId: string, editMsgId: number | null = null) {
  const kb = backKb([
    [{ text: "👑 Membership", callback_data: "buylist_m" }, { text: "🎮 Kredit Game", callback_data: "buylist_c" }],
    [{ text: "💎 Paket Gem", callback_data: "buylist_g" }, { text: "🪙 Koin Streak", callback_data: "buylist_k" }],
    [{ text: "📦 Paket Aktif", callback_data: "paket_aktif" }],
    [{ text: "🛒 Produk Toko", callback_data: "produk" }, { text: "💰 Saldo", callback_data: "saldo" }],
  ]);
  await sendOrEdit(token, chatId, editMsgId, {
    text: "🛍️ <b>Belanja via Telegram</b>\n\nBeli membership, kredit game, gem, & koin streak langsung pakai <b>Saldo + PIN</b> tanpa keluar dari chat.\n\nPilih kategori 👇",
    parse_mode: "HTML", reply_markup: kb,
  });
}

async function listBuy(admin: any, token: string, chatId: string, t: string, editMsgId: number | null = null) {
  const cfg = BUY_CFG[t];
  if (!cfg) return;
  const { data: rows } = await admin.from(cfg.table).select("*").eq("is_active", true).order("sort_order").limit(20);
  const list = rows || [];
  if (!list.length) {
    await sendOrEdit(token, chatId, editMsgId, { text: `${cfg.icon} <b>${cfg.label}</b>\n\nBelum ada paket tersedia.`, parse_mode: "HTML", reply_markup: backKb([[{ text: "🛍️ Belanja", callback_data: "belanja" }]]) });
    return;
  }
  let text = `${cfg.icon} <b>${cfg.label}</b>\n\n`;
  const kbRows: any[] = [];
  for (const it of list) {
    const nm = it[cfg.name] || "Paket";
    const price = Number(it[cfg.price] || 0);
    let detail = "";
    if (t === "m") detail = ` • ${it.duration_days || "?"} hari${it.daily_reward_coins ? ` • 🪙${it.daily_reward_coins}/hari` : ""}`;
    else if (t === "c") detail = it.is_unlimited ? ` • ♾️ Unlimited ${it.unlimited_days || 0}h` : ` • ${it.credits} kredit`;
    else if (t === "g") detail = ` • ${it.gems}${it.bonus_gems ? `+${it.bonus_gems} bonus` : ""} 💎`;
    else if (t === "k") detail = ` • ${it.coins} 🪙`;
    text += `${cfg.icon} <b>${esc(String(nm))}</b>${detail}\n   💵 ${fmtRp(price)}\n`;
    kbRows.push([{ text: `🛒 ${String(nm).slice(0, 20)} — ${fmtRp(price)}`, callback_data: `${cfg.cbuy}${it.id}` }]);
  }
  text += `\nKlik paket untuk bayar pakai Saldo + PIN.`;
  kbRows.push([{ text: "🛍️ Kembali", callback_data: "belanja" }]);
  await sendOrEdit(token, chatId, editMsgId, { text, parse_mode: "HTML", reply_markup: backKb(kbRows) });
}

async function buyConfirm(admin: any, token: string, chatId: string, t: string, id: string, visitorId: string | null, editMsgId: number | null = null) {
  const cfg = BUY_CFG[t];
  if (!cfg) return;
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk belanja pakai saldo.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  const { data: it } = await admin.from(cfg.table).select("*").eq("id", id).eq("is_active", true).maybeSingle();
  if (!it) {
    await sendOrEdit(token, chatId, editMsgId, { text: "⚠️ Paket tidak tersedia lagi.", reply_markup: backKb([[{ text: "🛍️ Belanja", callback_data: "belanja" }]]) });
    return;
  }
  const price = Number(it[cfg.price] || 0);
  const nm = it[cfg.name] || "Paket";
  const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
  if (!pinRow?.pin_hash) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔐 Kamu belum punya PIN. Buat PIN dulu untuk transaksi saldo.", reply_markup: backKb([[{ text: "🔐 Buat PIN", callback_data: "pin_change" }]]) });
    return;
  }
  await setState(admin, chatId, "buy_pin", { t, id, price, nm: String(nm) });
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: `🛒 <b>Konfirmasi Pembelian</b>\n\n${cfg.icon} <b>${esc(String(nm))}</b>\n💵 Harga: <b>${fmtRp(price)}</b>\n\nMasukkan <b>PIN 6 digit</b> kamu untuk membayar pakai saldo:`,
    parse_mode: "HTML", reply_markup: CANCEL_KB,
  });
}

async function grantPurchase(admin: any, visitorId: string, t: string, it: any, username: string, price: number): Promise<string> {
  try {
    if (t === "m") {
      const days = it.duration_days || 30;
      const expires = new Date(Date.now() + days * 86400000).toISOString();
      await admin.from("streak_user_memberships").insert({
        visitor_id: visitorId, plan_id: it.id, plan_name: it.name, duration_days: days,
        expires_at: expires, payment_method: "saldo", amount_paid: price,
        bonus_multiplier: it.bonus_multiplier || 1, is_active: true,
      });
      let extra = "";
      if (it.bonus_gems) {
        const { data: gp } = await admin.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
        if (gp) await admin.from("game_profiles").update({ gems: (gp.gems || 0) + it.bonus_gems, updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
        extra += ` +${it.bonus_gems}💎`;
      }
      return `🎁 Membership aktif s/d ${new Date(expires).toLocaleDateString("id-ID")}${extra}`;
    }
    if (t === "c") {
      const { data: cur } = await admin.from("user_game_credits").select("credits, unlimited_until").eq("visitor_id", visitorId).maybeSingle();
      if (it.is_unlimited) {
        const base = cur?.unlimited_until && new Date(cur.unlimited_until) > new Date() ? new Date(cur.unlimited_until).getTime() : Date.now();
        const until = new Date(base + (it.unlimited_days || 0) * 86400000).toISOString();
        if (cur) await admin.from("user_game_credits").update({ unlimited_until: until, updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
        else await admin.from("user_game_credits").insert({ visitor_id: visitorId, credits: 0, unlimited_until: until });
        return `🎮 Unlimited game aktif s/d ${new Date(until).toLocaleDateString("id-ID")}`;
      }
      const nc = (cur?.credits || 0) + (it.credits || 0);
      if (cur) await admin.from("user_game_credits").update({ credits: nc, updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
      else await admin.from("user_game_credits").insert({ visitor_id: visitorId, credits: nc });
      return `🎮 +${it.credits} kredit game (total ${nc})`;
    }
    if (t === "g") {
      const add = (it.gems || 0) + (it.bonus_gems || 0);
      const { data: gp } = await admin.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
      if (gp) await admin.from("game_profiles").update({ gems: (gp.gems || 0) + add, updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
      else await admin.from("game_profiles").insert({ visitor_id: visitorId, display_name: username, gems: add });
      return `💎 +${add} gem`;
    }
    if (t === "k") {
      const { data: ds } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
      if (ds) await admin.from("daily_streaks").update({ streak_coins: (ds.streak_coins || 0) + (it.coins || 0), updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
      else await admin.from("daily_streaks").insert({ visitor_id: visitorId, streak_coins: it.coins || 0 });
      return `🪙 +${it.coins} koin streak`;
    }
  } catch (_) {
    return "⚠️ Pembayaran tercatat. Jika item belum masuk, hubungi admin.";
  }
  return "";
}

async function handleBuyStep(admin: any, token: string, chatId: string, data: any, text: string, visitorId: string | null) {
  if (!visitorId) { await clearState(admin, chatId); await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Sesi habis, login dulu.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) }); return; }
  const val = text.trim();
  if (!/^\d{6}$/.test(val)) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ PIN harus 6 digit angka. Ketik ulang PIN, atau /batal:", reply_markup: CANCEL_KB }); return; }
  const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
  const hash = await sha256Hex(val);
  if (!pinRow || hash !== pinRow.pin_hash) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ PIN salah. Ketik ulang, atau /batal:", reply_markup: CANCEL_KB }); return; }

  const { t, id } = data;
  const cfg = BUY_CFG[t];
  const { data: it } = await admin.from(cfg.table).select("*").eq("id", id).eq("is_active", true).maybeSingle();
  if (!cfg || !it) { await clearState(admin, chatId); await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Paket sudah tidak tersedia. Transaksi dibatalkan.", reply_markup: backKb([[{ text: "🛍️ Belanja", callback_data: "belanja" }]]) }); return; }
  const price = Number(it[cfg.price] || 0);
  const nm = it[cfg.name] || "Paket";

  const { data: u } = await admin.from("user_balances").select("username, balance, bonus_balance").eq("visitor_id", visitorId).maybeSingle();
  const bal = Number(u?.balance || 0), bonus = Number(u?.bonus_balance || 0), total = bal + bonus;
  if (total < price) {
    await clearState(admin, chatId);
    await tgApi(token, "sendMessage", { chat_id: chatId, text: `❌ <b>Saldo tidak cukup</b>\n\n💵 Harga: ${fmtRp(price)}\n💰 Saldo kamu: ${fmtRp(total)}\n\nSilakan top up dulu.`, parse_mode: "HTML", reply_markup: backKb([[{ text: "💳 Deposit Saldo", callback_data: "deposit" }]]) });
    return;
  }
  const useBonus = Math.min(bonus, price);
  const useBal = price - useBonus;
  await admin.from("user_balances").update({ bonus_balance: bonus - useBonus, balance: bal - useBal, updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
  const trxId = String(Math.floor(10000 + Math.random() * 89999));
  await admin.from("balance_transactions").insert({ visitor_id: visitorId, type: "purchase", amount: price, description: `Beli ${cfg.label}: ${nm}`, trx_id: trxId });
  const grantMsg = await grantPurchase(admin, visitorId, t, it, u?.username || "-", price);
  await clearState(admin, chatId);
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: `✅ <b>Pembelian Berhasil!</b>\n\n${cfg.icon} <b>${esc(String(nm))}</b>\n💵 Dibayar: <b>${fmtRp(price)}</b>\n🧾 TRX: <code>#${trxId}</code>\n${grantMsg}\n\n💰 Sisa saldo: <b>${fmtRp(total - price)}</b>`,
    parse_mode: "HTML", reply_markup: backKb([[{ text: "📦 Paket Aktif", callback_data: "paket_aktif" }, { text: "💰 Saldo", callback_data: "saldo" }]]),
  });
  const { data: c } = await admin.from("telegram_bot_config").select("owner_id").limit(1).maybeSingle();
  if (c?.owner_id) {
    await tgApi(token, "sendMessage", { chat_id: c.owner_id, text: `🛍️ <b>Pembelian via TG</b>\n👤 ${esc(u?.username || "-")}\n${cfg.icon} ${esc(String(nm))}\n💵 ${fmtRp(price)}\n🧾 #${trxId}`, parse_mode: "HTML" }).catch(() => {});
  }
}

async function showPaketAktif(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk lihat paket aktif.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  const now = new Date();
  let t = "📦 <b>Paket Aktif Kamu</b>\n\n";
  let any = false;
  const { data: mem } = await admin.from("streak_user_memberships").select("plan_name, expires_at").eq("visitor_id", visitorId).eq("is_active", true).order("expires_at", { ascending: false });
  const activeMem = (mem || []).filter((m: any) => !m.expires_at || new Date(m.expires_at) > now);
  if (activeMem.length) {
    any = true;
    t += "👑 <b>Membership</b>\n";
    for (const m of activeMem) t += `• ${esc(m.plan_name)} — s/d ${m.expires_at ? new Date(m.expires_at).toLocaleDateString("id-ID") : "∞"}\n`;
    t += "\n";
  }
  const { data: cr } = await admin.from("user_game_credits").select("credits, unlimited_until").eq("visitor_id", visitorId).maybeSingle();
  if (cr) {
    any = true;
    const unl = cr.unlimited_until && new Date(cr.unlimited_until) > now;
    t += `🎮 <b>Kredit Game:</b> ${cr.credits || 0}${unl ? ` • ♾️ Unlimited s/d ${new Date(cr.unlimited_until).toLocaleDateString("id-ID")}` : ""}\n`;
  }
  const { data: gp } = await admin.from("game_profiles").select("gems").eq("visitor_id", visitorId).maybeSingle();
  if (gp) { any = true; t += `💎 <b>Gem:</b> ${Number(gp.gems || 0).toLocaleString("id-ID")}\n`; }
  const { data: ds } = await admin.from("daily_streaks").select("streak_coins").eq("visitor_id", visitorId).maybeSingle();
  if (ds) { any = true; t += `🪙 <b>Koin Streak:</b> ${Number(ds.streak_coins || 0).toLocaleString("id-ID")}\n`; }
  if (!any) t += "Belum ada paket aktif. Yuk beli di menu Belanja!";
  await sendOrEdit(token, chatId, editMsgId, { text: t, parse_mode: "HTML", reply_markup: backKb([[{ text: "🛍️ Belanja", callback_data: "belanja" }]]) });
}


// ===================== BATCH 3: Quest, Tiket, Voucher redeem, Like via Telegram =====================

async function startVoucherRedeem(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk tukar kode voucher.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  await setState(admin, chatId, "voucher_code", {});
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: "🎟️ <b>Tukar Kode Voucher</b>\n\nKetik kode voucher kamu (mis. <code>STR-XXXX</code>) untuk klaim hadiah (gem, koin, saldo, freeze, hint, dll):",
    parse_mode: "HTML", reply_markup: CANCEL_KB,
  });
}

async function handleVoucherRedeem(admin: any, token: string, chatId: string, code: string, visitorId: string | null) {
  if (!visitorId) { await clearState(admin, chatId); await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Sesi habis, login dulu.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) }); return; }
  const clean = code.trim();
  if (clean.length < 3) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Kode terlalu pendek. Ketik ulang, atau /batal:", reply_markup: CANCEL_KB }); return; }
  await clearState(admin, chatId);
  try {
    const { data: res } = await admin.functions.invoke("claim-streak-voucher", { body: { visitorId, code: clean } });
    if ((res as any)?.success) {
      await tgApi(token, "sendMessage", {
        chat_id: chatId,
        text: `🎉 <b>Voucher Berhasil Diklaim!</b>\n\n🎁 ${esc((res as any).voucher_name || "Voucher")}\n✅ Hadiah: <b>${esc((res as any).reward_label || "-")}</b>\n📦 Sisa kuota: ${(res as any).remaining_quota ?? "-"}`,
        parse_mode: "HTML", reply_markup: backKb([[{ text: "🎫 Voucher", callback_data: "voucher" }, { text: "💰 Saldo", callback_data: "saldo" }]]),
      });
    } else {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: `❌ ${esc((res as any)?.error || "Kode voucher tidak valid.")}`, reply_markup: backKb([[{ text: "🎟️ Coba Lagi", callback_data: "voucher_redeem" }]]) });
    }
  } catch (_) {
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Gagal memproses voucher. Coba lagi nanti.", reply_markup: backKb([[{ text: "🎟️ Coba Lagi", callback_data: "voucher_redeem" }]]) });
  }
}

// ---- Like / Suka ----
async function showLike(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk lihat produk & lagu yang kamu suka.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  let t = "❤️ <b>Suka Kamu</b>\n\n";
  const { data: lp } = await admin.from("liked_products").select("product_id, products(title, price)").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(15);
  const prods = (lp || []).filter((x: any) => x.products);
  if (prods.length) {
    t += "🛒 <b>Produk Disuka</b>\n";
    for (const p of prods) t += `• ${esc(p.products.title)} — ${fmtRp(p.products.price)}\n`;
    t += "\n";
  }
  const { data: ls } = await admin.from("liked_songs").select("song_id, public_songs(title, artist)").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(15);
  const songs = (ls || []).filter((x: any) => x.public_songs);
  if (songs.length) {
    t += "🎵 <b>Lagu Disuka</b>\n";
    for (const s of songs) t += `• ${esc(s.public_songs.title)} — ${esc(s.public_songs.artist || "-")}\n`;
    t += "\n";
  }
  if (!prods.length && !songs.length) t += "Belum ada produk/lagu yang kamu suka. Tekan ❤️ di website untuk menyimpannya!";
  await sendOrEdit(token, chatId, editMsgId, { text: t, parse_mode: "HTML", reply_markup: backKb([[{ text: "🛒 Produk", callback_data: "produk" }, { text: "🎵 Musik", callback_data: "musik" }]]) });
}

// ---- Tiket / Support ----
async function getAccountContact(admin: any, visitorId: string): Promise<{ name: string; phone: string } | null> {
  const { data: u } = await admin.from("user_balances").select("username, phone").eq("visitor_id", visitorId).maybeSingle();
  if (!u) return null;
  return { name: u.username || "-", phone: u.phone || "" };
}

async function showTiket(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) {
    await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk pakai tiket bantuan.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
    return;
  }
  const kb = backKb([
    [{ text: "📋 Tiket Saya", callback_data: "tkt_list" }, { text: "➕ Buat Tiket", callback_data: "tkt_new" }],
    [{ text: "🎧 Live CS", callback_data: "cs" }],
  ]);
  await sendOrEdit(token, chatId, editMsgId, { text: "🎫 <b>Tiket Bantuan</b>\n\nBuat tiket keluhan/pertanyaan, balas chat admin, dan kirim foto/audio bukti — semua lewat Telegram.\n\nPilih 👇", parse_mode: "HTML", reply_markup: kb });
}

async function listTiket(admin: any, token: string, chatId: string, visitorId: string | null, editMsgId: number | null = null) {
  if (!visitorId) return;
  const contact = await getAccountContact(admin, visitorId);
  const phone = contact?.phone || "";
  const { data: rows } = await admin.from("support_tickets").select("id, ticket_number, description, status, category, created_at").eq("phone", phone).order("created_at", { ascending: false }).limit(15);
  const list = rows || [];
  if (!list.length) {
    await sendOrEdit(token, chatId, editMsgId, { text: "📭 Kamu belum punya tiket. Buat tiket baru yuk!", reply_markup: backKb([[{ text: "➕ Buat Tiket", callback_data: "tkt_new" }]]) });
    return;
  }
  let t = "📋 <b>Tiket Saya</b>\n\nBalas dengan <b>ketik nomor</b> tiket untuk membukanya (mis. ketik <code>1</code>).\n\n";
  const idMap: Record<string, string> = {};
  const kbRows: any[] = [];
  list.forEach((tk: any, i: number) => {
    const n = i + 1;
    idMap[String(n)] = tk.id;
    const st = tk.status === "open" ? "🟢 Terbuka" : tk.status === "closed" ? "🔴 Ditutup" : `⚪ ${tk.status}`;
    const d = new Date(tk.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" });
    t += `<b>${n}.</b> #${tk.ticket_number} • ${st}\n   ${esc((tk.description || "").slice(0, 50))}\n   🗂️ ${esc(tk.category || "umum")} • ${d}\n\n`;
    kbRows.push([{ text: `${n}. Buka #${tk.ticket_number}`, callback_data: `tkt_open_${tk.id}` }]);
  });
  await setState(admin, chatId, "tkt_pick", { idMap });
  await sendOrEdit(token, chatId, editMsgId, { text: t, parse_mode: "HTML", reply_markup: backKb(kbRows) });
}

async function openTiket(admin: any, token: string, chatId: string, ticketId: string, visitorId: string | null, editMsgId: number | null = null) {
  await clearState(admin, chatId);
  const { data: tk } = await admin.from("support_tickets").select("id, ticket_number, description, status, category").eq("id", ticketId).maybeSingle();
  if (!tk) { await sendOrEdit(token, chatId, editMsgId, { text: "⚠️ Tiket tidak ditemukan.", reply_markup: backKb([[{ text: "📋 Tiket Saya", callback_data: "tkt_list" }]]) }); return; }
  const { data: msgs } = await admin.from("ticket_messages").select("sender_type, message, image_url, created_at, is_deleted").eq("ticket_id", ticketId).order("created_at", { ascending: true }).limit(40);
  const list = (msgs || []).filter((m: any) => !m.is_deleted);
  let t = `🎫 <b>Tiket #${tk.ticket_number}</b> — ${tk.status === "open" ? "🟢 Terbuka" : tk.status === "closed" ? "🔴 Ditutup" : tk.status}\n🗂️ ${esc(tk.category || "umum")}\n📝 ${esc(tk.description || "")}\n\n💬 <b>Percakapan</b>\n`;
  if (!list.length) t += "<i>Belum ada balasan.</i>\n";
  for (const m of list) {
    const who = m.sender_type === "admin" ? "🛡️ Admin" : "👤 Kamu";
    const d = new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
    const body = m.image_url ? (m.message ? esc(m.message) : "") + " 📎 [lampiran]" : esc(m.message || "");
    t += `\n${who} <i>${d}</i>\n${body}\n`;
  }
  const kb = tk.status === "closed"
    ? backKb([[{ text: "📋 Tiket Saya", callback_data: "tkt_list" }]])
    : backKb([[{ text: "💬 Balas Tiket", callback_data: `tkt_reply_${ticketId}` }], [{ text: "📋 Tiket Saya", callback_data: "tkt_list" }]]);
  await sendOrEdit(token, chatId, editMsgId, { text: t.slice(0, 4000), parse_mode: "HTML", reply_markup: kb });
}

async function startTiketReply(admin: any, token: string, chatId: string, ticketId: string) {
  await setState(admin, chatId, "tkt_reply", { ticketId });
  await tgApi(token, "sendMessage", { chat_id: chatId, text: "💬 Ketik balasan kamu, atau kirim <b>foto/audio/file</b> sebagai lampiran. /batal untuk keluar.", parse_mode: "HTML", reply_markup: CANCEL_KB });
}

async function startTiketNew(admin: any, token: string, chatId: string, visitorId: string | null) {
  if (!visitorId) return;
  await setState(admin, chatId, "tkt_new_desc", {});
  await tgApi(token, "sendMessage", { chat_id: chatId, text: "➕ <b>Buat Tiket Baru</b>\n\nCeritakan keluhan / pertanyaan kamu (kirim teks). Kamu bisa lampirkan foto setelahnya di dalam tiket.", parse_mode: "HTML", reply_markup: CANCEL_KB });
}

async function forwardMediaToAdmin(admin: any, token: string, message: any, caption: string) {
  const { data: cfg } = await admin.from("telegram_bot_config").select("owner_id").limit(1).maybeSingle();
  if (!cfg?.owner_id) return;
  try {
    if (Array.isArray(message.photo) && message.photo.length) {
      await tgApi(token, "sendPhoto", { chat_id: cfg.owner_id, photo: message.photo[message.photo.length - 1].file_id, caption, parse_mode: "HTML" });
    } else if (message.voice) {
      await tgApi(token, "sendVoice", { chat_id: cfg.owner_id, voice: message.voice.file_id, caption, parse_mode: "HTML" });
    } else if (message.audio) {
      await tgApi(token, "sendAudio", { chat_id: cfg.owner_id, audio: message.audio.file_id, caption, parse_mode: "HTML" });
    } else if (message.document) {
      await tgApi(token, "sendDocument", { chat_id: cfg.owner_id, document: message.document.file_id, caption, parse_mode: "HTML" });
    } else {
      await tgApi(token, "sendMessage", { chat_id: cfg.owner_id, text: caption, parse_mode: "HTML" });
    }
  } catch (_) { /* ignore */ }
}

async function handleTiketStep(admin: any, token: string, chatId: string, state: string, data: any, message: any, text: string, visitorId: string | null) {
  if (!visitorId) { await clearState(admin, chatId); await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Sesi habis, login dulu.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) }); return; }

  if (state === "tkt_pick") {
    const pick = text.trim();
    const id = (data.idMap || {})[pick];
    if (!id) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Nomor tidak valid. Ketik nomor tiket dari daftar, atau /batal:", reply_markup: CANCEL_KB }); return; }
    await openTiket(admin, token, chatId, id, visitorId, null);
    return;
  }

  if (state === "tkt_new_desc") {
    const desc = (text || "").trim();
    if (desc.length < 5) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Deskripsi terlalu pendek (min. 5 karakter). Ketik ulang:", reply_markup: CANCEL_KB }); return; }
    const contact = await getAccountContact(admin, visitorId);
    const { data: tk, error } = await admin.from("support_tickets").insert({
      name: contact?.name || "-", phone: contact?.phone || "", description: desc, category: "umum", status: "open",
    }).select("id, ticket_number").maybeSingle();
    await clearState(admin, chatId);
    if (error || !tk) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Gagal membuat tiket. Coba lagi.", reply_markup: backKb() }); return; }
    const { data: cfg } = await admin.from("telegram_bot_config").select("owner_id").limit(1).maybeSingle();
    if (cfg?.owner_id) await tgApi(token, "sendMessage", { chat_id: cfg.owner_id, text: `🎫 <b>Tiket Baru #${tk.ticket_number}</b>\n👤 ${esc(contact?.name || "-")}\n📱 ${esc(contact?.phone || "-")}\n📝 ${esc(desc)}`, parse_mode: "HTML" }).catch(() => {});
    await tgApi(token, "sendMessage", { chat_id: chatId, text: `✅ <b>Tiket #${tk.ticket_number} dibuat!</b>\n\nAdmin akan segera membalas. Buka tiket untuk balas / kirim lampiran.`, parse_mode: "HTML", reply_markup: backKb([[{ text: "💬 Buka Tiket", callback_data: `tkt_open_${tk.id}` }], [{ text: "📋 Tiket Saya", callback_data: "tkt_list" }]]) });
    return;
  }

  if (state === "tkt_reply") {
    const ticketId = data.ticketId;
    const { data: tk } = await admin.from("support_tickets").select("id, ticket_number, status").eq("id", ticketId).maybeSingle();
    if (!tk || tk.status === "closed") { await clearState(admin, chatId); await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Tiket sudah ditutup / tidak ditemukan.", reply_markup: backKb([[{ text: "📋 Tiket Saya", callback_data: "tkt_list" }]]) }); return; }
    const hasMedia = !!(message.photo || message.voice || message.audio || message.document);
    const cap = (message.caption || text || "").trim();
    let msgBody = cap;
    let imageMark: string | null = null;
    if (hasMedia) {
      const kind = message.photo ? "Foto" : message.voice ? "Pesan Audio" : message.audio ? "Audio" : "File";
      msgBody = (cap ? cap + " " : "") + `[${kind} dikirim via Telegram]`;
      imageMark = "telegram-media";
      const contact = await getAccountContact(admin, visitorId);
      await forwardMediaToAdmin(admin, token, message, `📎 <b>Lampiran Tiket #${tk.ticket_number}</b>\n👤 ${esc(contact?.name || "-")}${cap ? `\n💬 ${esc(cap)}` : ""}`);
    }
    if (!msgBody) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Kirim teks atau lampiran. Coba lagi, atau /batal:", reply_markup: CANCEL_KB }); return; }
    await admin.from("ticket_messages").insert({ ticket_id: ticketId, sender_type: "user", message: msgBody, image_url: imageMark });
    await admin.from("support_tickets").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", ticketId);
    await clearState(admin, chatId);
    const { data: cfg } = await admin.from("telegram_bot_config").select("owner_id").limit(1).maybeSingle();
    if (cfg?.owner_id && !hasMedia) await tgApi(token, "sendMessage", { chat_id: cfg.owner_id, text: `💬 <b>Balasan Tiket #${tk.ticket_number}</b>\n${esc(msgBody)}`, parse_mode: "HTML" }).catch(() => {});
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "✅ Balasan terkirim ke admin!", reply_markup: backKb([[{ text: "💬 Lihat Tiket", callback_data: `tkt_open_${ticketId}` }], [{ text: "📋 Tiket Saya", callback_data: "tkt_list" }]]) });
    return;
  }
}


Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const reqStart = Date.now();
  const serverRegion = Deno.env.get("SB_REGION") || Deno.env.get("DENO_REGION") || "Supabase Edge (Lovable Cloud)";

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
      const callbackChat = cq.message?.chat || cq.from;
      if (!callbackChat?.id) return new Response(JSON.stringify({ ok: true }));
      const chatId = String(callbackChat.id);
      const key = String(cq.data || "");
      const editMsgId: number | null = cq.message?.message_id ?? null;
      await tgApi(token, "answerCallbackQuery", { callback_query_id: cq.id }).catch((e) => console.error("answerCallbackQuery error:", e));
      await ensureChat(admin, token, callbackChat, cq.from, false);
      if (!cfg.enabled) {
        await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔴 Bot sedang tidak aktif. Coba lagi nanti." });
        return new Response(JSON.stringify({ ok: true }));
      }
      const row = await getChatRow(admin, chatId);

      // ===== Banned gate: blokir semua fitur kecuali menu/batal/CS =====
      if (row.tg_visitor_id && !["menu", "start", "batal", "cs", "logout"].includes(key)) {
        const ban = await getBanInfo(admin, row.tg_visitor_id);
        if (ban) { await sendOrEdit(token, chatId, editMsgId, { text: banText(ban), parse_mode: "HTML", reply_markup: BAN_KB }); return new Response(JSON.stringify({ ok: true })); }
      }

      if (key === "belanja") { await showBelanja(token, chatId, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("buylist_")) { await listBuy(admin, token, chatId, key.slice(8), editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("buym_")) { await buyConfirm(admin, token, chatId, "m", key.slice(5), row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("buyc_")) { await buyConfirm(admin, token, chatId, "c", key.slice(5), row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("buyg_")) { await buyConfirm(admin, token, chatId, "g", key.slice(5), row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("buyk_")) { await buyConfirm(admin, token, chatId, "k", key.slice(5), row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "paket_aktif") { await showPaketAktif(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "voucher_redeem") { await startVoucherRedeem(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "like") { await showLike(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "tiket") { await showTiket(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "tkt_list") { await listTiket(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "tkt_new") { await startTiketNew(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("tkt_open_")) { await openTiket(admin, token, chatId, key.slice(9), row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("tkt_reply_")) { await startTiketReply(admin, token, chatId, key.slice(10)); return new Response(JSON.stringify({ ok: true })); }
      if (key === "deposit") { await startDeposit(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "dep_qris") { await depositAskAmount(admin, token, chatId, "QRIS", editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "dep_ewallet") { await depositChooseEwallet(admin, token, chatId, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("depw_")) { await depositAskAmount(admin, token, chatId, key.slice(5), editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "twofa") { await show2FA(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "login_history") { await showLoginHistory(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "pin_reset") { await startPinReset(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "pinreset_wa") { await doPinResetWa(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "pinreset_admin") {
        const { data: u } = await admin.from("user_balances").select("username").eq("visitor_id", row.tg_visitor_id).maybeSingle();
        if (cfg.owner_id) await tgApi(token, "sendMessage", { chat_id: cfg.owner_id, text: `🔁 <b>Permintaan Reset PIN</b>\n👤 ${esc(u?.username || "-")}\n🆔 <code>${chatId}</code>`, parse_mode: "HTML" }).catch(() => {});
        await sendOrEdit(token, chatId, editMsgId, { text: "✅ Permintaan reset PIN dikirim ke admin. Tunggu admin menghubungi kamu untuk verifikasi. 🙏", reply_markup: backKb([[{ text: "💰 Saldo", callback_data: "saldo" }]]) });
        return new Response(JSON.stringify({ ok: true }));
      }
      if (key === "dl_hist") {
        await sendOrEdit(token, chatId, editMsgId, { text: "📥 <b>Download Riwayat Transaksi</b>\n\nPilih format file yang kamu mau:", parse_mode: "HTML", reply_markup: backKb([
          [{ text: "📊 Excel", callback_data: "dlh_excel" }, { text: "📄 Word", callback_data: "dlh_word" }, { text: "📕 PDF", callback_data: "dlh_pdf" }],
          [{ text: "💰 Saldo", callback_data: "saldo" }],
        ]) });
        return new Response(JSON.stringify({ ok: true }));
      }
      if (key.startsWith("dlh_")) { await sendTrxDownload(admin, token, chatId, row.tg_visitor_id, key.slice(4), editMsgId); return new Response(JSON.stringify({ ok: true })); }


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
      if (key === "confess_new") { await startConfessNew(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "confess_card_yes" || key === "confess_card_no") {
        if (row.tg_state !== "confess_card") { await sendOrEdit(token, chatId, editMsgId, { text: "⚠️ Sesi confess tidak aktif. Mulai lagi ya.", reply_markup: backKb([[{ text: "✍️ Kirim Confess Baru", callback_data: "confess_new" }]]) }); return new Response(JSON.stringify({ ok: true })); }
        const cdata = (row.tg_data as any) || {};
        const useCard = key === "confess_card_yes";
        await setState(admin, chatId, "confess_cpin", { ...cdata, useCard });
        const price = confessPriceForN((cdata.phones || []).length);
        await sendOrEdit(token, chatId, editMsgId, {
          text: `<b>Konfirmasi</b>\n\n📱 Ke: ${(cdata.phones || []).map(maskPhone).join(", ")}\n🕶️ Nama: <b>${esc(cdata.senderName || "Anonim")}</b>\n💬 Pesan: ${esc((cdata.message || "").slice(0, 100))}\n🖼️ Kartu: <b>${useCard ? "Pakai Kartu" : "Tanpa Kartu"}</b>\n💰 Harga: <b>${fmtRp(price)}</b>\n\nMasukkan <b>PIN 6 digit</b> untuk membayar & mengirim:`,
          parse_mode: "HTML",
          reply_markup: CANCEL_KB,
        });
        return new Response(JSON.stringify({ ok: true }));
      }
      if (key === "confess_hist") { await showConfessHistory(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("cfthr_")) { await showConfessThread(admin, token, chatId, row.tg_visitor_id, key.slice(6), editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("cfreply_")) {
        if (!row.tg_visitor_id) { await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) }); return new Response(JSON.stringify({ ok: true })); }
        await setState(admin, chatId, "confess_reply", { threadId: key.slice(8) });
        await sendOrEdit(token, chatId, editMsgId, { text: "↩️ <b>Balas Chat Confess</b>\n\nKetik balasan kamu (gratis selama window 24 jam):", parse_mode: "HTML", reply_markup: CANCEL_KB });
        return new Response(JSON.stringify({ ok: true }));
      }
      if (key === "saldo") { await showSaldo(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "pin_change") { await startPinChange(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "pin_status") { await showPinStatus(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "name_change") { await startNameChange(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("dl_")) {
        const songId = key.slice(3);
        const { data: song } = await admin.from("playlist_songs").select("title, artist, file_url").eq("id", songId).maybeSingle();
        if (!song?.file_url) {
          await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ File lagu tidak ditemukan." });
          return new Response(JSON.stringify({ ok: true }));
        }
        await tgApi(token, "sendChatAction", { chat_id: chatId, action: "upload_document" });
        const title = String(song.title || "Lagu");
        const performer = String(song.artist || "Unknown");
        // Coba kirim langsung via URL (Telegram fetch sendiri, limit 20MB)
        let res = await tgApi(token, "sendAudio", { chat_id: chatId, audio: song.file_url, title, performer, caption: `🎵 <b>${esc(title)}</b> — ${esc(performer)}`, parse_mode: "HTML" });
        let ok = false;
        try { ok = (await res.clone().json())?.ok === true; } catch (_) { /* ignore */ }
        if (!ok) {
          // Fallback: unduh file lalu upload sebagai multipart
          try {
            const fileRes = await fetch(song.file_url);
            if (fileRes.ok) {
              const bytes = new Uint8Array(await fileRes.arrayBuffer());
              const form = new FormData();
              form.append("chat_id", chatId);
              form.append("title", title);
              form.append("performer", performer);
              form.append("caption", `🎵 ${title} — ${performer}`);
              form.append("audio", new Blob([bytes], { type: fileRes.headers.get("content-type") || "audio/mpeg" }), `${title}.mp3`);
              const up = await fetch(`https://api.telegram.org/bot${token}/sendAudio`, { method: "POST", body: form });
              ok = (await up.json())?.ok === true;
            }
          } catch (_) { /* ignore */ }
        }
        if (!ok) {
          await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Gagal mengirim file (mungkin terlalu besar). Buka lewat website.", reply_markup: backKb([[{ text: "▶️ Buka File", url: song.file_url }]]) });
        }
        return new Response(JSON.stringify({ ok: true }));
      }
      if (key === "qbt") { await handlePremiumTrial(admin, token, chatId, row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("qbp_")) { await startPremiumBuy(admin, token, chatId, key.slice(4), row.tg_visitor_id, editMsgId); return new Response(JSON.stringify({ ok: true })); }
      if (key.startsWith("qka_")) { await claimAllQuests(admin, token, chatId, row.tg_visitor_id, editMsgId, key.slice(4) as "d" | "w" | "m" | "p"); return new Response(JSON.stringify({ ok: true })); }
      if (/^qk[dwmp]_/.test(key)) {
        const period = key.charAt(2);
        const questId = key.slice(4);
        if (!row.tg_visitor_id) {
          await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk klaim quest.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
          return new Response(JSON.stringify({ ok: true }));
        }
        const r = await claimOneQuest(admin, row.tg_visitor_id, period, questId);
        if (!r.ok) {
          await tgApi(token, "sendMessage", { chat_id: chatId, text: `⚠️ ${r.error || "Gagal klaim quest."}`, parse_mode: "HTML" });
        } else {
          await tgApi(token, "sendMessage", { chat_id: chatId, text: `🎉 <b>Quest diklaim!</b>\n\nReward: ${r.reward}`, parse_mode: "HTML" });
        }
        await renderAfterClaim(admin, token, chatId, row.tg_visitor_id, null, period);
        return new Response(JSON.stringify({ ok: true }));
      }
      // legacy alias
      if (key.startsWith("qclaim_")) {
        const questId = key.slice(7);
        if (!row.tg_visitor_id) {
          await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk klaim quest.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
          return new Response(JSON.stringify({ ok: true }));
        }
        const r = await claimOneQuest(admin, row.tg_visitor_id, "w", questId);
        await tgApi(token, "sendMessage", { chat_id: chatId, text: r.ok ? `🎉 <b>Quest diklaim!</b>\n\nReward: ${r.reward}` : `⚠️ ${r.error || "Gagal klaim."}`, parse_mode: "HTML" });
        await renderQuestPeriod(admin, token, chatId, row.tg_visitor_id, null, "w");
        return new Response(JSON.stringify({ ok: true }));
      }


      if (key.startsWith("wreact_")) {
        if (!row.tg_visitor_id) {
          await sendOrEdit(token, chatId, editMsgId, { text: "🔒 Login dulu untuk beri reaksi confess.", reply_markup: backKb([[{ text: "🔑 Login", callback_data: "login" }]]) });
          return new Response(JSON.stringify({ ok: true }));
        }
        const rest = key.slice(7);
        const usc = rest.indexOf("_");
        const emoji = rest.slice(0, usc);
        const wallId = rest.slice(usc + 1);
        const valid = ["heart", "fire", "laugh", "cry"];
        if (valid.includes(emoji)) {
          const { error: rErr } = await admin.from("confess_wall_reactions").insert({ wall_id: wallId, visitor_id: row.tg_visitor_id, emoji });
          if (!rErr) {
            const { data: w } = await admin.from("confess_public_wall").select("reaction_counts, total_reactions").eq("id", wallId).maybeSingle();
            const rc = (w?.reaction_counts as any) || { heart: 0, fire: 0, laugh: 0, cry: 0 };
            rc[emoji] = (rc[emoji] || 0) + 1;
            await admin.from("confess_public_wall").update({ reaction_counts: rc, total_reactions: (w?.total_reactions || 0) + 1 }).eq("id", wallId);
          }
        }
        await renderSection(admin, token, chatId, "confess_wall", row.tg_visitor_id, editMsgId);
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

    const chatId = await ensureChat(admin, token, message.chat, message.from);
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
      if (st.startsWith("dep_")) { await handleDepositStep(admin, token, chatId, st, data, message, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
      if (st === "pinreset_code") {
        const code = text.trim();
        if (!/^\d{5}$/.test(code)) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Kode reset harus 5 digit. Ketik ulang:", reply_markup: CANCEL_KB }); return new Response(JSON.stringify({ ok: true })); }
        const { data: tok } = await admin.from("pin_reset_tokens").select("id, expires_at").eq("visitor_id", row.tg_visitor_id).eq("token", code).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!tok || (tok.expires_at && new Date(tok.expires_at).getTime() < Date.now())) { await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Kode salah atau kadaluarsa. Ketik ulang atau /batal:", reply_markup: CANCEL_KB }); return new Response(JSON.stringify({ ok: true })); }
        await admin.from("pin_reset_tokens").delete().eq("id", tok.id);
        await setState(admin, chatId, "pin_new", { setup: true });
        await tgApi(token, "sendMessage", { chat_id: chatId, text: "✅ Kode benar!\n\nKetik <b>PIN baru</b> (6 digit):", parse_mode: "HTML", reply_markup: CANCEL_KB });
        return new Response(JSON.stringify({ ok: true }));
      }
      if (st === "buy_pin") { await handleBuyStep(admin, token, chatId, data, text, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
      if (st === "qpremium_pin") { await handlePremiumBuyStep(admin, token, chatId, data, text, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
      if (st === "voucher_code") { await handleVoucherRedeem(admin, token, chatId, text, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
      if (st.startsWith("tkt_")) { await handleTiketStep(admin, token, chatId, st, data, message, text, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
      if (st.startsWith("pin_") || st.startsWith("name_")) { await handleProfileStep(admin, token, chatId, st, data, text, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
    }

    // ===== Banned gate (pengguna login) untuk command shortcut =====
    if (row.tg_visitor_id && cmd.startsWith("/") && !["/batal", "/cancel", "/start", "/menu", "/help", "/bantuan", "/info", "/status", "/logout"].includes(cmd)) {
      const ban = await getBanInfo(admin, row.tg_visitor_id);
      if (ban) { await tgApi(token, "sendMessage", { chat_id: chatId, text: banText(ban), parse_mode: "HTML", reply_markup: BAN_KB }); return new Response(JSON.stringify({ ok: true })); }
    }


    if (cmd === "/start" || cmd === "/menu") {
      await clearState(admin, chatId);
      // Kartu sambutan bergambar otomatis (foto profil + ID + username) hanya saat /start
      if (cmd === "/start") {
        // 1) Stiker bawaan Telegram acak (animasi keren) — tampil sebentar lalu dihapus
        const stRes = await tgSendRandomSticker(token, chatId);
        const stickerMsgId = stRes?.result?.message_id;
        if (stickerMsgId) {
          await new Promise((r) => setTimeout(r, 2200)); // biarkan animasi bermain
          await tgApi(token, "deleteMessage", { chat_id: chatId, message_id: stickerMsgId }).catch(() => {});
        }
        // 2) Kartu welcome muncul setelah stiker dihapus
        await sendWelcomeImage(token, chatId, message.from);
      }
      const now = wibNow();
      const uptime = uptimeText((cfg as any).activated_at ?? null);
      const greeting = greetingByHour();
      const custom = (cfg.welcome_message && cfg.welcome_message.trim())
        ? cfg.welcome_message
        : "Selamat datang di <b>Agung Adi Store</b> — Murah & Terpercaya. Pilih menu di bawah atau ketik pesan untuk chat admin (Live CS).";
      const speedMs = Date.now() - reqStart;
      const { data: socRows } = await admin.from("social_links").select("label, url").eq("is_active", true).order("sort_order");
      let sosmedBlock = "";
      const socList = socRows || [];
      if (socList.length) {
        sosmedBlock = "\n\n🌐 <b>Sosmed Admin:</b>\n" + socList.map((s: any) => `• <b>${esc(s.label)}</b>: ${s.url}`).join("\n");
      } else {
        sosmedBlock = "\n\n🌐 <b>Sosmed Admin:</b>\n• YouTube: https://youtube.com/@channelmodagungadi\n• Instagram: https://instagram.com/agungadi57\n• TikTok: https://tiktok.com/@pphitampro9\n• WhatsApp: https://wa.me/6285769302532";
      }
      const welcome = `👋 <b>${greeting}!</b>\n\n${custom}\n\n🟢 Bot aktif selama: <b>${uptime}</b>\n⚡ Kecepatan bot: <b>${speedMs} ms</b>\n🖥️ Server: <b>${serverRegion}</b>\n👑 Owner: <b>@agungadi80</b>\n🕒 <b>${now.hari}</b>, ${now.tanggal}\n⏰ ${now.jam} WIB${sosmedBlock}`;
      // Animasi loading keren + persentase (progress bar) sampai menu muncul
      const spinner = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
      const barFor = (pct: number) => {
        const total = 10;
        const filled = Math.round((pct / 100) * total);
        return "▰".repeat(filled) + "▱".repeat(total - filled);
      };
      const stageText = (pct: number) => {
        if (pct < 30) return "Menghubungkan ke server";
        if (pct < 60) return "Memuat data toko";
        if (pct < 90) return "Menyiapkan menu";
        return "Hampir selesai";
      };
      const loadFrame = (pct: number, i: number) =>
        `${spinner[i % spinner.length]} <b>Memuat menu...</b>\n\n${barFor(pct)}  <b>${pct}%</b>\n<i>${stageText(pct)}...</i>`;
      const steps = [0, 15, 35, 55, 75, 90, 100];
      const loadRes = await tgApi(token, "sendMessage", { chat_id: chatId, text: loadFrame(steps[0], 0), parse_mode: "HTML" });
      const loadJson = await loadRes.json().catch(() => null);
      const loadMsgId = loadJson?.result?.message_id;
      if (loadMsgId) {
        for (let i = 1; i < steps.length; i++) {
          await new Promise((r) => setTimeout(r, 350));
          await tgApi(token, "editMessageText", { chat_id: chatId, message_id: loadMsgId, text: loadFrame(steps[i], i), parse_mode: "HTML" }).catch(() => {});
        }
        await new Promise((r) => setTimeout(r, 350));
        await tgApi(token, "editMessageText", { chat_id: chatId, message_id: loadMsgId, text: welcome, parse_mode: "HTML", reply_markup: MENU }).catch(async () => {
          await tgApi(token, "sendMessage", { chat_id: chatId, text: welcome, parse_mode: "HTML", reply_markup: MENU });
        });
      } else {
        await tgApi(token, "sendMessage", { chat_id: chatId, text: welcome, parse_mode: "HTML", reply_markup: MENU });
      }
      return new Response(JSON.stringify({ ok: true }));
    }

    if (cmd === "/info" || cmd === "/status") {
      const now = wibNow();
      const uname = cfg.bot_username ? `@${cfg.bot_username}` : "Bot Telegram";
      const uptime = uptimeText((cfg as any).activated_at ?? null);
      const infoSpeed = Date.now() - reqStart;
      await tgApi(token, "sendMessage", {
        chat_id: chatId,
        text: `🤖 <b>Info Bot</b>\n\nStatus: 🟢 <b>AKTIF</b>\nNama: ${uname}\nToko: <b>Agung Adi Store</b>\n👑 Owner: <b>@agungadi80</b>\n⏱️ Aktif selama: <b>${uptime}</b>\n⚡ Kecepatan bot: <b>${infoSpeed} ms</b>\n🖥️ Server: <b>${serverRegion}</b>\n\n📅 Hari: <b>${now.hari}</b>\n🗓️ Tanggal: ${now.tanggal}\n⏰ Jam: <b>${now.jam} WIB</b>\n\nKetik /start untuk membuka menu.`,
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
    if (cmd === "/belanja" || cmd === "/beli") { await showBelanja(token, chatId); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/paket") { await showPaketAktif(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/tiket" || cmd === "/ticket") { await showTiket(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/voucher") { await startVoucherRedeem(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/suka" || cmd === "/like") { await showLike(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }
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
      const identity = telegramIdentity(message.chat, message.from);
      const uname = identity.username ? `@${identity.username}` : identity.firstName;
      await tgApi(token, "sendMessage", {
        chat_id: cfg.owner_id,
        text: `📩 <b>Pesan Live CS baru</b>\nDari: ${esc(uname)}\nNama: ${esc(identity.firstName)}\nID Telegram: <code>${chatId}</code>\n\n${esc(text)}`,
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
