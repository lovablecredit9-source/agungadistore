// lib/cardRender.js — kartu Welcome & Profil (PNG) untuk Bot Agung Adi Store.
// Memakai @resvg/resvg-js (sudah ada di package.json) + font & latar yang ikut di folder assets/.
// Semua data user dikirim per pemanggilan (tanpa cache global); gagal render → null, bot lanjut teks.
const fs = require("fs");
const path = require("path");

const ASSETS = path.join(__dirname, "..", "assets");
const FONTS = ["Rajdhani-Bold.ttf", "Rajdhani-SemiBold.ttf"].map((f) => path.join(ASSETS, f));
let _bg = null;
function bgDataUri() {
  if (_bg === null) {
    try { _bg = "data:image/jpeg;base64," + fs.readFileSync(path.join(ASSETS, "welcome-bg.jpg")).toString("base64"); } catch { _bg = ""; }
  }
  return _bg;
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const cut = (s, n) => { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

// Format nomor 628xxxxxxxxxx → +62 857-6930-2532
function prettyPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (!/^62\d{8,13}$/.test(d)) return d || "-";
  const r = d.slice(2);
  return "+62 " + r.slice(0, 3) + "-" + r.slice(3, 7) + "-" + r.slice(7);
}

function sniffMime(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.slice(0, 4).toString() === "RIFF") return "image/webp";
  return null;
}

// Ambil foto profil WhatsApp milik JID ini saja. Tidak ada / privat / gagal → null.
async function fetchProfilePhoto(client, jid) {
  try {
    const url = await client.profilePictureUrl(jid, "image");
    if (!url || typeof fetch !== "function") return null;
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3 * 1024 * 1024) return null;
    return sniffMime(buf) && sniffMime(buf) !== "image/webp" ? buf : null;
  } catch { return null; }
}

function avatarSvg(photo, cx, cy, r, initial) {
  const ring = `<circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="none" stroke="#22d3ee" stroke-width="4" filter="url(#glow)"/>`;
  if (photo) {
    const uri = "data:" + sniffMime(photo) + ";base64," + photo.toString("base64");
    return `<clipPath id="av"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
      <image href="${uri}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#av)"/>${ring}`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#0b2540"/><text x="${cx}" y="${cy + r * 0.36}" text-anchor="middle" font-family="Rajdhani" font-weight="700" font-size="${r}" fill="#9fe9ff">${esc(initial || "?")}</text>${ring}`;
}

// rows: [[label, value, accent?]]
function buildSvg({ kicker, title, subtitle, rows, photo, name, web, owner, version }) {
  const W = 1280, H = 720;
  const initial = (String(name || "?").trim()[0] || "?").toUpperCase();
  const rowSvg = rows.map(([label, value, accent], i) => {
    const y = 438 + i * 50;
    return `<text x="96" y="${y}" font-family="Rajdhani" font-weight="600" font-size="20" letter-spacing="3" fill="#5fb7d4">${esc(label.toUpperCase())}</text>
      <text x="300" y="${y}" font-family="Rajdhani" font-weight="700" font-size="30" fill="${accent || "#ffffff"}">${esc(cut(value, 30))}</text>`;
  }).join("");
  const bg = bgDataUri();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#030812" stop-opacity="0.92"/><stop offset="0.62" stop-color="#030812" stop-opacity="0.55"/><stop offset="1" stop-color="#030812" stop-opacity="0"/></linearGradient>
    <linearGradient id="title" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#7de3ff"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#040a16"/>
  ${bg ? `<image href="${bg}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : ""}
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <rect x="56" y="56" width="760" height="608" rx="22" fill="#061224" fill-opacity="0.62" stroke="#22d3ee" stroke-opacity="0.55" stroke-width="2"/>
  ${avatarSvg(photo, 158, 160, 66, initial)}
  <text x="252" y="146" font-family="Rajdhani" font-weight="700" font-size="34" letter-spacing="2" fill="#22d3ee">AGUNG ADI STORE</text>
  <text x="252" y="184" font-family="Rajdhani" font-weight="600" font-size="22" letter-spacing="6" fill="#cfefff">SUPER BOT${version ? "  •  v" + esc(version) : ""}</text>
  <text x="96" y="290" font-family="Rajdhani" font-weight="600" font-size="28" letter-spacing="8" fill="#7de3ff">${esc(kicker)}</text>
  <text x="96" y="352" font-family="Rajdhani" font-weight="700" font-size="62" fill="url(#title)">${esc(cut(title, 22))}</text>
  ${subtitle ? `<text x="96" y="388" font-family="Rajdhani" font-weight="600" font-size="22" fill="#9fb8c9">${esc(cut(subtitle, 52))}</text>` : ""}
  <line x1="96" y1="404" x2="776" y2="404" stroke="#22d3ee" stroke-opacity="0.35" stroke-width="2"/>
  ${rowSvg}
  <text x="96" y="640" font-family="Rajdhani" font-weight="600" font-size="20" letter-spacing="3" fill="#7d93a6">MADE WITH  <tspan fill="#22d3ee" font-weight="700">AGUNG ADI STORE</tspan></text>
  <rect x="884" y="604" width="340" height="60" rx="16" fill="#061224" fill-opacity="0.78" stroke="#25d366" stroke-opacity="0.8" stroke-width="2"/>
  <circle cx="914" cy="634" r="12" fill="#25d366"/>
  <text x="938" y="628" font-family="Rajdhani" font-weight="600" font-size="16" letter-spacing="2" fill="#a7f3c4">OWNER / SUPPORT</text>
  <text x="938" y="652" font-family="Rajdhani" font-weight="700" font-size="24" fill="#ffffff">${esc(owner)}</text>
  ${web ? `<text x="1224" y="586" text-anchor="end" font-family="Rajdhani" font-weight="600" font-size="20" fill="#cfefff">${esc(web)}</text>` : ""}
</svg>`;
}

function renderPng(svg) {
  let Resvg;
  try { ({ Resvg } = require("@resvg/resvg-js")); } catch { return null; }
  try {
    const r = new Resvg(svg, { fitTo: { mode: "width", value: 1280 }, font: { fontFiles: FONTS.filter((f) => fs.existsSync(f)), loadSystemFonts: false, defaultFontFamily: "Rajdhani" } });
    return r.render().asPng();
  } catch { return null; }
}

// data: { name, phone, balanceText, status, web, owner, version, photo }
function renderWelcomeCard(d) {
  return renderPng(buildSvg({
    kicker: "WELCOME TO", title: "AGUNG ADI STORE", subtitle: "Solusi transaksi digital kamu",
    name: d.name, photo: d.photo, web: d.web, owner: d.owner, version: d.version,
    rows: [["Nama", d.name], ["WhatsApp", prettyPhone(d.phone)], ["Saldo", d.balanceText, "#7de3ff"], ["Status", d.status, d.status === "Terhubung" ? "#4ade80" : "#fbbf24"]],
  }));
}
// data: { name, username, phone, balanceText, level, credits, status, web, owner, version, photo }
function renderProfileCard(d) {
  return renderPng(buildSvg({
    kicker: "PROFIL PENGGUNA", title: cut(d.name, 22), subtitle: "@" + (d.username || "-"),
    name: d.name, photo: d.photo, web: d.web, owner: d.owner, version: d.version,
    rows: [["WhatsApp", prettyPhone(d.phone)], ["Saldo", d.balanceText, "#7de3ff"], ["Level • Kredit", d.level + "  •  " + d.credits + " kredit"], ["Status", d.status, "#4ade80"]],
  }));
}


// ════════ KARTU DEPOSIT (renderer yang sama → satu tema dengan Welcome) ════════
// kind: pending | proof | admin | success | rejected | payment
const DEP_THEME = {
  pending:  { accent: "#22d3ee", pill: "#fbbf24", kicker: "DEPOSIT / PAYMENT" },
  proof:    { accent: "#22d3ee", pill: "#fbbf24", kicker: "BUKTI PEMBAYARAN DITERIMA" },
  admin:    { accent: "#f472b6", pill: "#fbbf24", kicker: "DEPOSIT — BUKTI BARU" },
  success:  { accent: "#34d399", pill: "#4ade80", kicker: "DEPOSIT BERHASIL" },
  rejected: { accent: "#f87171", pill: "#f87171", kicker: "DEPOSIT DITOLAK" },
  payment:  { accent: "#22d3ee", pill: "#22d3ee", kicker: "PEMBAYARAN DEPOSIT" },
};
// Ikon kecil vektor (tanpa emoji agar tidak bergantung font emoji).
function icon(kind, x, y, color) {
  const c = color || "#22d3ee";
  const box = `<rect x="${x}" y="${y}" width="30" height="30" rx="9" fill="${c}" fill-opacity="0.14" stroke="${c}" stroke-opacity="0.6" stroke-width="1.5"/>`;
  const cx = x + 15, cy = y + 15;
  const g = {
    user: `<circle cx="${cx}" cy="${cy - 4}" r="4.5" fill="${c}"/><path d="M${cx - 8} ${cy + 9} q8 -10 16 0" fill="${c}"/>`,
    wa: `<rect x="${cx - 5}" y="${cy - 9}" width="10" height="18" rx="2.5" fill="none" stroke="${c}" stroke-width="2"/><circle cx="${cx}" cy="${cy + 5}" r="1.4" fill="${c}"/>`,
    mail: `<rect x="${cx - 8}" y="${cy - 6}" width="16" height="12" rx="2" fill="none" stroke="${c}" stroke-width="2"/><path d="M${cx - 8} ${cy - 5} l8 6 l8 -6" fill="none" stroke="${c}" stroke-width="2"/>`,
    id: `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="Rajdhani" font-weight="700" font-size="14" fill="${c}">ID</text>`,
    money: `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="Rajdhani" font-weight="700" font-size="17" fill="${c}">Rp</text>`,
    card: `<rect x="${cx - 9}" y="${cy - 6}" width="18" height="12" rx="2" fill="none" stroke="${c}" stroke-width="2"/><rect x="${cx - 9}" y="${cy - 3}" width="18" height="3" fill="${c}"/>`,
    wallet: `<rect x="${cx - 9}" y="${cy - 6}" width="18" height="13" rx="3" fill="none" stroke="${c}" stroke-width="2"/><circle cx="${cx + 4}" cy="${cy + 1}" r="2" fill="${c}"/>`,
    up: `<path d="M${cx - 8} ${cy + 6} l6 -6 l4 3 l6 -8" fill="none" stroke="${c}" stroke-width="2.2"/>`,
    clock: `<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${c}" stroke-width="2"/><path d="M${cx} ${cy - 4} v4 l3 2" fill="none" stroke="${c}" stroke-width="2"/>`,
    plus: `<path d="M${cx} ${cy - 7} v14 M${cx - 7} ${cy} h14" stroke="${c}" stroke-width="2.6"/>`,
  }[kind] || "";
  return box + g;
}
function rowsBlock(rows, x, y, gap, labelW, valMax, color) {
  return rows.map(([ic, label, value, accent], i) => {
    const yy = y + i * gap;
    return `${icon(ic, x, yy - 22, color)}
      <text x="${x + 42}" y="${yy - 9}" font-family="Rajdhani" font-weight="600" font-size="15" letter-spacing="2.5" fill="#5fb7d4">${esc(String(label).toUpperCase())}</text>
      <text x="${x + 42}" y="${yy + 14}" font-family="Rajdhani" font-weight="700" font-size="25" fill="${accent || "#ffffff"}">${esc(cut(value, valMax))}</text>`;
  }).join("");
}
function depFrame(t, inner, footerLines, web, owner) {
  const W = 1280, H = 720, bg = bgDataUri();
  const foot = (footerLines || []).map((l, i) => `<text x="96" y="${600 + i * 26}" font-family="Rajdhani" font-weight="600" font-size="19" fill="${i === 0 ? "#e2f6ff" : "#9fb8c9"}">${esc(cut(l, 70))}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#030812" stop-opacity="0.95"/><stop offset="1" stop-color="#030812" stop-opacity="0.7"/></linearGradient>
    <linearGradient id="title" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${t.accent}"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#040a16"/>
  ${bg ? `<image href="${bg}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity="0.55"/>` : ""}
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <rect x="40" y="36" width="1200" height="648" rx="26" fill="#061224" fill-opacity="0.72" stroke="${t.accent}" stroke-opacity="0.6" stroke-width="2" filter="url(#glow)"/>
  <circle cx="104" cy="96" r="26" fill="none" stroke="${t.accent}" stroke-width="3" filter="url(#glow)"/>
  <text x="104" y="105" text-anchor="middle" font-family="Rajdhani" font-weight="700" font-size="24" fill="${t.accent}">AA</text>
  <text x="146" y="92" font-family="Rajdhani" font-weight="700" font-size="30" letter-spacing="2" fill="#ffffff">AGUNG ADI STORE</text>
  <text x="146" y="118" font-family="Rajdhani" font-weight="600" font-size="18" letter-spacing="6" fill="${t.accent}">${esc(t.kicker)}</text>
  ${inner}
  <line x1="80" y1="568" x2="1200" y2="568" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="2"/>
  ${foot}
  <text x="1200" y="604" text-anchor="end" font-family="Rajdhani" font-weight="700" font-size="20" fill="#cfefff">${esc(web || "")}</text>
  <text x="1200" y="632" text-anchor="end" font-family="Rajdhani" font-weight="600" font-size="18" fill="#a7f3c4">Owner: ${esc(owner || "")}</text>
</svg>`;
}
function pill(x, y, text, color) {
  const w = Math.max(160, String(text).length * 15 + 56);
  return `<rect x="${x}" y="${y}" width="${w}" height="44" rx="22" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="2"/>
    <circle cx="${x + 24}" cy="${y + 22}" r="7" fill="${color}" filter="url(#glow)"/>
    <text x="${x + 42}" y="${y + 30}" font-family="Rajdhani" font-weight="700" font-size="22" letter-spacing="2" fill="${color}">${esc(text)}</text>`;
}
const NA = "Belum tersedia";
const v = (x) => (x == null || String(x).trim() === "" ? NA : String(x));

// d: { username, phone, email, trxId, amount, method, balanceBefore, balanceAfter, date, time, reason, web, owner }
function buildDepositSvg(kind, d) {
  const t = DEP_THEME[kind] || DEP_THEME.pending;
  const userRows = [["user", "Username", v(d.username)], ["wa", "WhatsApp", d.phone ? prettyPhone(d.phone) : NA], ["mail", "Email", v(d.email)]];
  let trxRows, status, note, footer, headline;
  if (kind === "success") {
    headline = "PEMBAYARAN DIKONFIRMASI";
    trxRows = [["id", "ID Transaksi", v(d.trxId)], ["wallet", "Saldo Sebelum", d.balanceBefore], ["plus", "Deposit", d.amount, "#34d399"], ["money", "Saldo Sekarang", d.balanceAfter, "#7dffcf"], ["card", "Metode", v(d.method)]];
    status = "BERHASIL / CONFIRMED"; note = (d.date || "") + "  •  " + (d.time || "");
    footer = ["Saldo telah berhasil ditambahkan.", "Terima kasih telah menggunakan Agung Adi Store."];
  } else if (kind === "rejected") {
    headline = "DEPOSIT DITOLAK";
    trxRows = [["id", "ID Transaksi", v(d.trxId)], ["money", "Nominal", d.amount], ["card", "Metode", v(d.method)], ["clock", "Alasan", v(d.reason), "#fca5a5"]];
    status = "DITOLAK"; note = "Silakan hubungi admin apabila membutuhkan bantuan.";
    footer = ["AGUNG ADI STORE", "Hubungi owner jika ada kendala."];
  } else if (kind === "proof" || kind === "admin") {
    headline = kind === "admin" ? "BUKTI BARU — PERLU CEK" : "MENUNGGU KONFIRMASI";
    trxRows = [["id", "ID Transaksi", v(d.trxId)], ["money", "Nominal", d.amount, "#7de3ff"], ["wallet", "Saldo Awal", d.balanceBefore], ["card", "Metode", v(d.method)], ["clock", "Waktu", (d.date || "") + "  " + (d.time || "")]];
    status = kind === "admin" ? "PENDING" : "MENUNGGU KONFIRMASI ADMIN"; note = kind === "admin" ? "!konfirmasi " + d.trxId + "   /   !tolakdeposit " + d.trxId + " [alasan]" : "Admin sedang memeriksa bukti pembayaran.";
    footer = kind === "admin" ? ["Foto bukti dikirim terpisah di atas kartu ini.", "Periksa mutasi sebelum konfirmasi."] : ["Bukti pembayaran telah diterima.", "Mohon tunggu admin melakukan pengecekan."];
  } else {
    headline = "MENUNGGU PEMBAYARAN";
    trxRows = [["id", "ID Deposit", v(d.trxId)], ["money", "Nominal", d.amount, "#7de3ff"], ["card", "Metode", v(d.method)], ["wallet", "Saldo Awal", d.balanceBefore], ["up", "Saldo Setelah Deposit", d.balanceAfter, "#7dffcf"], ["clock", "Dibuat", (d.date || "") + "  " + (d.time || "")]];
    status = "PENDING"; note = "Menunggu pembayaran dan bukti transfer.";
    footer = ["Silakan lakukan pembayaran sesuai metode yang dipilih.", "Setelah bayar, kirim bukti pembayaran melalui chat ini."];
  }
  const inner = `
  <text x="80" y="186" font-family="Rajdhani" font-weight="700" font-size="34" fill="url(#title)">${esc(cut(headline, 24))}</text>
  <text x="80" y="226" font-family="Rajdhani" font-weight="600" font-size="16" letter-spacing="4" fill="#7d93a6">INFORMASI USER</text>
  ${rowsBlock(userRows, 80, 282, 86, 0, 26, t.accent)}
  <rect x="520" y="150" width="680" height="396" rx="20" fill="#020814" fill-opacity="0.6" stroke="${t.accent}" stroke-opacity="0.35" stroke-width="1.5"/>
  <text x="552" y="186" font-family="Rajdhani" font-weight="600" font-size="16" letter-spacing="4" fill="#7d93a6">INFORMASI TRANSAKSI</text>
  ${rowsBlock(trxRows.slice(0, 3), 552, 244, 72, 0, 22, t.accent)}
  ${rowsBlock(trxRows.slice(3), 880, 244, 72, 0, 18, t.accent)}
  ${pill(552, 456, status, t.pill)}
  <text x="552" y="530" font-family="Rajdhani" font-weight="600" font-size="19" fill="#cfe3ee">${esc(cut(note, 62))}</text>`;
  return depFrame(t, inner, footer, d.web, d.owner);
}
// Kartu pembayaran: QRIS asli dari sistem (buffer) ditempel apa adanya di panel putih.
function buildPaymentSvg(d, qrBuf) {
  const t = DEP_THEME.payment;
  const mime = qrBuf ? sniffMime(qrBuf) : null;
  const qr = qrBuf && mime ? `<rect x="760" y="70" width="420" height="480" rx="20" fill="#ffffff"/>
    <image href="data:${mime};base64,${qrBuf.toString("base64")}" x="776" y="86" width="388" height="448" preserveAspectRatio="xMidYMid meet"/>` : "";
  const inner = `
  <text x="80" y="200" font-family="Rajdhani" font-weight="600" font-size="18" letter-spacing="5" fill="#7d93a6">NOMINAL</text>
  <text x="80" y="272" font-family="Rajdhani" font-weight="700" font-size="76" fill="url(#title)" filter="url(#glow)">${esc(d.amount)}</text>
  ${rowsBlock([["user", "User", v(d.username)], ["id", "ID Deposit", v(d.trxId)], ["card", "Metode", v(d.method)]], 80, 340, 70, 0, 30, t.accent)}
  ${qr}`;
  return depFrame(t, inner, ["Scan QRIS untuk melakukan pembayaran.", "Setelah pembayaran selesai, kirim bukti pembayaran."], d.web, d.owner);
}
function renderDepositCard(kind, d) { try { return renderPng(buildDepositSvg(kind, d)); } catch { return null; } }
function renderPaymentCard(d, qrBuf) { try { return renderPng(buildPaymentSvg(d, qrBuf)); } catch { return null; } }
async function fetchImageBuffer(url) {
  try {
    if (!url || typeof fetch !== "function") return null;
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 6 * 1024 * 1024) return null;
    const m = sniffMime(buf); return m && m !== "image/webp" ? buf : null;
  } catch { return null; }
}

module.exports = { renderWelcomeCard, renderProfileCard, fetchProfilePhoto, prettyPhone, buildSvg, renderDepositCard, renderPaymentCard, buildDepositSvg, buildPaymentSvg, fetchImageBuffer };

// ════════ BotWaCardRenderer: kartu generik (info / list / welcome v2) — tema sama dengan kartu deposit ════════
const THEMES = { cyan: "#22d3ee", green: "#34d399", red: "#f87171", amber: "#fbbf24", orange: "#fb923c", pink: "#f472b6" };
function photoCircle(photo, cx, cy, r, initial, color) {
  const ring = `<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="none" stroke="${color}" stroke-width="3" filter="url(#glow)"/>`;
  const m = photo ? sniffMime(photo) : null;
  if (photo && m && m !== "image/webp") return `<clipPath id="pc"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><image href="data:${m};base64,${photo.toString("base64")}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>${ring}`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#0b2540"/><text x="${cx}" y="${cy + r * 0.36}" text-anchor="middle" font-family="Rajdhani" font-weight="700" font-size="${r}" fill="#9fe9ff">${esc(initial || "?")}</text>${ring}`;
}
// o: { color, kicker, headline, photo, name, left:[[icon,label,value,accent]], right:[...], status, statusColor, note, footer:[], web, owner }
function buildInfoSvg(o) {
  const c = THEMES[o.color] || o.color || THEMES.cyan;
  const t = { accent: c, kicker: o.kicker || "" };
  const left = o.left || [], right = o.right || [];
  const half = Math.ceil(right.length / 2);
  const ph = o.photo !== undefined ? photoCircle(o.photo, 1140, 96, 34, (String(o.name || "?").trim()[0] || "?").toUpperCase(), c) : "";
  const gapL = left.length > 4 ? 64 : 80;
  const gapR = right.length > 6 ? 62 : 72;
  const inner = `${ph}
  <text x="80" y="186" font-family="Rajdhani" font-weight="700" font-size="34" fill="url(#title)">${esc(cut(o.headline || "", 26))}</text>
  ${rowsBlock(left, 80, 250, gapL, 0, 24, c)}
  <rect x="520" y="150" width="680" height="396" rx="20" fill="#020814" fill-opacity="0.6" stroke="${c}" stroke-opacity="0.35" stroke-width="1.5"/>
  ${rowsBlock(right.slice(0, half), 552, 210, gapR, 0, 20, c)}
  ${rowsBlock(right.slice(half), 880, 210, gapR, 0, 17, c)}
  ${o.status ? pill(552, 466, o.status, THEMES[o.statusColor] || o.statusColor || c) : ""}
  ${o.note ? `<text x="${o.status ? 552 + Math.max(160, String(o.status).length * 15 + 56) + 18 : 552}" y="495" font-family="Rajdhani" font-weight="600" font-size="17" fill="#cfe3ee">${esc(cut(o.note, o.status ? 34 : 64))}</text>` : ""}`;
  return depFrame(t, inner, o.footer || [], o.web, o.owner);
}
// o: { color, kicker, headline, summary:[[label,value]], items:[{tag,tagColor,title,amount,date,status}], page, pages, footer, web, owner }
function buildListSvg(o) {
  const c = THEMES[o.color] || THEMES.cyan;
  const t = { accent: c, kicker: o.kicker || "" };
  const sum = (o.summary || []).map(([l, v], i) => `<text x="80" y="${236 + i * 54}" font-family="Rajdhani" font-weight="600" font-size="14" letter-spacing="2.5" fill="#5fb7d4">${esc(String(l).toUpperCase())}</text><text x="80" y="${258 + i * 54}" font-family="Rajdhani" font-weight="700" font-size="22" fill="#ffffff">${esc(cut(v, 24))}</text>`).join("");
  const items = (o.items || []).slice(0, 8);
  const rows = items.map((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 440 + col * 390, y = 156 + row * 98;
    const tc = THEMES[it.tagColor] || c;
    return `<rect x="${x}" y="${y}" width="370" height="86" rx="14" fill="#020814" fill-opacity="0.65" stroke="${tc}" stroke-opacity="0.45"/>
      <circle cx="${x + 20}" cy="${y + 22}" r="6" fill="${tc}" filter="url(#glow)"/>
      <text x="${x + 34}" y="${y + 28}" font-family="Rajdhani" font-weight="700" font-size="17" letter-spacing="1.5" fill="${tc}">${esc(cut(it.tag, 18))}</text>
      <text x="${x + 356}" y="${y + 28}" text-anchor="end" font-family="Rajdhani" font-weight="700" font-size="19" fill="#ffffff">${esc(cut(it.amount, 16))}</text>
      <text x="${x + 16}" y="${y + 52}" font-family="Rajdhani" font-weight="600" font-size="16" fill="#cfe3ee">${esc(cut(it.title, 40))}</text>
      <text x="${x + 16}" y="${y + 74}" font-family="Rajdhani" font-weight="600" font-size="14" fill="#7d93a6">${esc(cut(it.date, 28))}</text>
      <text x="${x + 356}" y="${y + 74}" text-anchor="end" font-family="Rajdhani" font-weight="700" font-size="14" letter-spacing="1" fill="${tc}">${esc(cut(it.status, 18))}</text>`;
  }).join("");
  const empty = items.length ? "" : `<text x="820" y="350" text-anchor="middle" font-family="Rajdhani" font-weight="600" font-size="26" fill="#7d93a6">Belum ada data</text>`;
  const pg = o.pages > 1 ? `<text x="1200" y="140" text-anchor="end" font-family="Rajdhani" font-weight="700" font-size="18" fill="${c}">Halaman ${o.page}/${o.pages}</text>` : "";
  const inner = `<text x="80" y="186" font-family="Rajdhani" font-weight="700" font-size="32" fill="url(#title)">${esc(cut(o.headline || "", 20))}</text>${sum}${rows}${empty}${pg}`;
  return depFrame(t, inner, o.footer || [], o.web, o.owner);
}
// o: { photo, registered, accountName, waName, phone, balance, email, status, features:[label], commands:[[cmd,desc]], web, owner, version }
function buildWelcomeV2(o) {
  const c = THEMES.cyan, t = { accent: c, kicker: "SUPER BOT" + (o.version ? "  •  v" + o.version : "") };
  const ident = o.registered
    ? [["user", "Nama Akun", o.accountName], ["wa", "Nama WhatsApp", o.waName || NA], ["wa", "Nomor", o.phone ? prettyPhone(o.phone) : NA], ["money", "Saldo", o.balance, "#7de3ff"], ["mail", "Email", o.email || NA]]
    : [["user", "Nama WhatsApp", o.waName || NA], ["wa", "Nomor WhatsApp", o.phone ? prettyPhone(o.phone) : NA]];
  const feats = (o.features || []).slice(0, 18);
  const fcol = feats.map((f, i) => { const col = i % 2, row = Math.floor(i / 2); const x = 470 + col * 175, y = 236 + row * 30; return `<circle cx="${x}" cy="${y - 6}" r="4" fill="${c}"/><text x="${x + 12}" y="${y}" font-family="Rajdhani" font-weight="600" font-size="18" fill="#e2f6ff">${esc(cut(f, 16))}</text>`; }).join("");
  const cmds = (o.commands || []).slice(0, 9).map(([k, d], i) => `<text x="868" y="${236 + i * 30}" font-family="Rajdhani" font-weight="700" font-size="17" fill="${c}">${esc(k)}</text><text x="980" y="${236 + i * 30}" font-family="Rajdhani" font-weight="600" font-size="16" fill="#cfe3ee">${esc(cut(d, 22))}</text>`).join("");
  const badges = ["AMAN", "CEPAT", "TERPERCAYA", "SUPPORT"].map((b, i) => `<rect x="${470 + i * 180}" y="510" width="166" height="40" rx="20" fill="${c}" fill-opacity="0.1" stroke="${c}" stroke-opacity="0.6"/><text x="${553 + i * 180}" y="537" text-anchor="middle" font-family="Rajdhani" font-weight="700" font-size="18" letter-spacing="3" fill="${c}">${b}</text>`).join("");
  const inner = `
  ${photoCircle(o.photo, 128, 214, 44, (String(o.accountName || o.waName || "?").trim()[0] || "?").toUpperCase(), c)}
  <text x="190" y="206" font-family="Rajdhani" font-weight="600" font-size="16" letter-spacing="4" fill="#7d93a6">WELCOME TO</text>
  <text x="190" y="236" font-family="Rajdhani" font-weight="700" font-size="28" fill="url(#title)">AGUNG ADI STORE</text>
  ${rowsBlock(ident, 80, o.registered ? 302 : 318, o.registered ? 44 : 70, 0, 22, c)}
  ${o.registered ? "" : `<text x="80" y="480" font-family="Rajdhani" font-weight="600" font-size="17" fill="#fbbf24">Silakan daftar akun untuk</text><text x="80" y="502" font-family="Rajdhani" font-weight="600" font-size="17" fill="#fbbf24">menggunakan seluruh fitur.</text>`}
  ${pill(80, o.registered ? 506 : 516, o.status, o.registered ? THEMES.green : THEMES.amber)}
  <rect x="440" y="150" width="400" height="345" rx="18" fill="#020814" fill-opacity="0.6" stroke="${c}" stroke-opacity="0.35"/>
  <text x="466" y="196" font-family="Rajdhani" font-weight="700" font-size="18" letter-spacing="4" fill="${c}">FITUR BOT</text>${fcol}
  <rect x="852" y="150" width="348" height="345" rx="18" fill="#020814" fill-opacity="0.6" stroke="${c}" stroke-opacity="0.35"/>
  <text x="868" y="196" font-family="Rajdhani" font-weight="700" font-size="18" letter-spacing="4" fill="${c}">COMMAND</text>${cmds}
  ${badges}`;
  return depFrame(t, inner, ["Gunakan fitur dengan bijak. Kendala? Hubungi Owner.", "Made with AGUNG ADI STORE"], o.web, o.owner);
}
function renderInfoCard(o) { try { return renderPng(buildInfoSvg(o)); } catch { return null; } }
function renderListCard(o) { try { return renderPng(buildListSvg(o)); } catch { return null; } }
function renderWelcomeV2(o) { try { return renderPng(buildWelcomeV2(o)); } catch { return null; } }
module.exports.renderInfoCard = renderInfoCard;
module.exports.renderListCard = renderListCard;
module.exports.renderWelcomeV2 = renderWelcomeV2;
module.exports.buildInfoSvg = buildInfoSvg;
