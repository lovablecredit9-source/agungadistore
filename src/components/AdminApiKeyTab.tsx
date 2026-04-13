import { useState, useEffect } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, Trash2, Check, Eye, EyeOff, Plus, Clock, BookOpen, Download, Bot, ChevronDown, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ApiKey {
  id: string;
  key_name: string;
  api_key: string;
  is_active: boolean;
  permissions: string;
  created_at: string;
  last_used_at: string | null;
}

export default function AdminApiKeyTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keyName, setKeyName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showUsage, setShowUsage] = useState(false);
  const [downloadKeyId, setDownloadKeyId] = useState<string>("");
  const [pairingPhone, setPairingPhone] = useState("");
  const { toast } = useToast();

  useEffect(() => { fetchKeys(); }, []);

  useEffect(() => {
    const activeKeyIds = keys.filter((key) => key.is_active).map((key) => key.id);

    if (activeKeyIds.length === 0) {
      if (downloadKeyId) setDownloadKeyId("");
      return;
    }

    if (!activeKeyIds.includes(downloadKeyId)) {
      setDownloadKeyId(activeKeyIds[0]);
    }
  }, [keys, downloadKeyId]);

  async function fetchKeys() {
    const { data } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
    if (data) setKeys(data as unknown as ApiKey[]);
  }

  function generateKey(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "ak_";
    for (let i = 0; i < 40; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
  }

  async function createKey() {
    if (!keyName.trim()) { toast({ title: "Masukkan nama API Key", variant: "destructive" }); return; }
    const apiKey = generateKey();
    const { error } = await supabase.from("api_keys").insert({
      key_name: keyName.trim(),
      api_key: apiKey,
    } as any);
    if (error) { toast({ title: "Gagal membuat API Key", variant: "destructive" }); return; }
    toast({ title: "API Key berhasil dibuat! 🔑" });
    setKeyName("");
    fetchKeys();
  }

  async function toggleKey(k: ApiKey) {
    await supabase.from("api_keys").update({ is_active: !k.is_active } as any).eq("id", k.id);
    toast({ title: k.is_active ? "API Key dinonaktifkan" : "API Key diaktifkan" });
    fetchKeys();
  }

  async function deleteKey(id: string) {
    await supabase.from("api_keys").delete().eq("id", id);
    toast({ title: "API Key dihapus" });
    fetchKeys();
  }

  function copyKey(key: string, id: string) {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleVisibility(id: string) {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function maskKey(key: string) {
    return key.substring(0, 6) + "•".repeat(20) + key.substring(key.length - 4);
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} tersalin!` });
  }

  async function downloadBotFile(apiKey: string, keyName: string) {
    try {
      const zip = new JSZip();
      const safeName = keyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "bot-wa";

      zip.file("index.js", generateBotCode(apiKey, pairingPhone.trim() || undefined));
      zip.file("package.json", generatePackageJson());
      zip.file("README.md", generateReadmeMd());

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}-bot-wa.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "ZIP 3 file berhasil didownload! 📦" });
    } catch {
      toast({ title: "Gagal membuat ZIP bot", variant: "destructive" });
    }
  }

  function generateBotCode(apiKey: string, phoneNumber?: string) {
    const phoneConfig = phoneNumber
      ? `
const DEFAULT_PAIRING_PHONE = "${phoneNumber.replace(/[^0-9]/g, "")}";`
      : `
const DEFAULT_PAIRING_PHONE = ""; // Opsional: nomor default pairing, format: 628xxxxxxxxxx`;

    return `// =============================================
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_RECONNECT_ATTEMPTS = 8;
const RECONNECT_DELAY_MS = 4000;

function normalizePhoneNumber(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function formatPairingCode(code) {
  const cleaned = String(code || "").replace(/\\s+/g, "").trim();
  if (!cleaned) return "-";
  return cleaned.match(/.{1,4}/g)?.join("-") || cleaned;
}

function getDisconnectMessage(lastDisconnect) {
  return lastDisconnect?.error?.message || lastDisconnect?.error?.data?.reason || "Connection Closed";
}

// ✅ API Key sudah otomatis terisi!
const API_KEY = "${apiKey}";
const BASE = "${baseUrl}";
${phoneConfig}

// Short ID helper: UUID → #XXXXX
const shortId = (uuid) => {
  if (!uuid) return "#00000";
  return "#" + String(parseInt(uuid.replace(/-/g, "").slice(0, 10), 16) % 100000).padStart(5, "0");
};

// Hash PIN helper (SHA-256)
async function hashPin(pin) {
  const { createHash } = require("crypto");
  return createHash("sha256").update(pin).digest("hex");
}


// === SESSION LOGIN USER (per nomor WA) ===
// PIN TIDAK disimpan di sesi - harus input tiap transaksi
const userSessions = {};

async function askAuthMethod() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log("\\n========================================");
    console.log(" PILIH METODE LOGIN WHATSAPP");
    console.log("========================================");
    console.log("1. Scan QR");
    console.log("2. Pairing nomor WhatsApp");

    const method = String(await rl.question("Pilih 1 atau 2: ")).trim();

    if (method === "1") {
      console.log("\\n📲 Mode QR dipilih.");
      console.log("✅ Buka WhatsApp > Perangkat tertaut > Tautkan perangkat lalu scan QR dari terminal.\\n");
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

    console.log("\\n📱 Nomor diterima: " + phoneNum);
    console.log("📢 Kode login akan muncul di terminal/panel untuk dimasukkan manual ke WhatsApp > Perangkat tertaut.");
    console.log("ℹ️ Pairing code tidak dikirim sebagai chat / notif WhatsApp.");
    console.log("⏳ Jika kode habis, bot akan coba sambung ulang lalu keluarkan kode baru.\\n");

    return { mode: "pairing", phoneNum };
  } finally {
    rl.close();
  }
}

// === KONFIGURASI ADMIN ===
const ADMIN_NUMBERS = [
  // "6285769302532@s.whatsapp.net",
];

function isAdmin(msg) {
  if (ADMIN_NUMBERS.length === 0) return true;
  return ADMIN_NUMBERS.includes(msg.key.remoteJid);
}

const fmtRp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const api = async (ep, method, body) => {
  const opt = { method: method || "GET", headers: { "x-api-key": API_KEY, "Content-Type": "application/json" } };
  if (body) opt.body = JSON.stringify(body);
  const r = await fetch(BASE + "?endpoint=" + ep, opt);
  return r.json();
};

// Helper: resolve username/identifier to visitor_id
async function resolveVid(identifier) {
  if (!identifier) return null;
  // Try exact username first
  const res = await api("balances");
  const users = res.data || [];
  const exact = users.find((u) => u.username.toLowerCase() === identifier.toLowerCase());
  if (exact) return exact;
  // Try partial match
  const partial = users.find((u) => u.username.toLowerCase().includes(identifier.toLowerCase()));
  if (partial) return partial;
  // Try if it's a visitor_id directly
  const byVid = users.find((u) => u.visitor_id === identifier);
  return byVid || null;
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

    if (!phoneNum) {
      throw new Error("Nomor WhatsApp untuk pairing belum diisi!");
    }

    pairingRequested = true;
    console.log("\\n📱 Meminta kode pairing untuk: " + phoneNum);

    try {
      await wait(2500);
      const code = await client.requestPairingCode(phoneNum);
      console.log("\\n" + "=".repeat(40));
      console.log("  📲 KODE PAIRING (8 DIGIT):");
      console.log("  ➡️  " + formatPairingCode(code));
      console.log("=".repeat(40));
      console.log("\\n✅ Buka WhatsApp > Perangkat tertaut / Linked Devices");
      console.log("   Pilih 'Tautkan dengan nomor telepon / Link with phone number'");
      console.log("   Lalu masukkan kode di atas");
      console.log("ℹ️ Kode tampil di terminal/panel, bukan dikirim sebagai chat WhatsApp.");
      console.log("⏳ Kalau kode expired, bot akan reconnect dan menampilkan kode baru.\\n");
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
      console.log("\\n" + "=".repeat(40));
      console.log("  📷 SCAN QR DI BAWAH INI");
      console.log("=".repeat(40));
      qrcode.generate(qr, { small: true });
      console.log("✅ Buka WhatsApp > Perangkat tertaut > Tautkan perangkat");
      console.log("⏳ Jika QR expired, bot akan tunggu QR baru otomatis.\\n");
    }

    if (connection === "open") {
      console.log("\\n✅ Bot WhatsApp sudah siap! (v10.0.0)");
      console.log("📋 Kirim !help di chat untuk lihat perintah\\n");
      return;
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      const message = getDisconnectMessage(lastDisconnect);

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
        console.log(authChoice.mode === "pairing"
          ? "ℹ️ Bot akan reconnect otomatis dan minta kode pairing baru."
          : "ℹ️ Bot akan reconnect otomatis dan menunggu QR baru.");
      } else {
        console.log("⚠️ Koneksi putus: " + message);
        console.log("ℹ️ Bot akan reconnect otomatis.");
      }

      const nextAttempt = attempt + 1;
      console.log("🔄 Reconnect " + nextAttempt + "/" + MAX_RECONNECT_ATTEMPTS + " dalam " + (RECONNECT_DELAY_MS / 1000) + " detik...\\n");

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

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      "";

    if (!text.startsWith("!") && !userSessions[remoteJid + "_game"]) return;

    const command = text.trim().toLowerCase();
    const rawArgs = text.trim().split(/\\s+/).slice(1);
    const args = rawArgs;
    const reply = async (t) => client.sendMessage(remoteJid, { text: t }, { quoted: msg });
    const session = userSessions[remoteJid] || null;

    try {
    // ═══════════════════════════════════════
    // ═══ USER COMMANDS ═══
    // ═══════════════════════════════════════
    if (command === "!ping") { return reply("🏓 Pong! Bot aktif v10.0.0"); }
    if (command === "!versi") { return reply("🤖 Bot WA Agung Adi Store v10.0.0\\n📅 " + new Date().toLocaleString("id-ID")); }
    if (command === "!waktu") { return reply("🕐 Waktu server: " + new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB"); }

    if (command === "!help" || command === "!menu") {
      const senderPhone = remoteJid.replace("@s.whatsapp.net", "");
      return reply([
        "🤖 *Bot WhatsApp Agung Adi Store v8.0.0*",
        "📱 Nomor kamu: " + senderPhone,
        session ? "👤 Login: " + session.username : "🔒 Belum login",
        "",
        "🔑 *Akun Saldo:*",
        "• !login [user/email/hp] [password]",
        "• !logout — Logout akun",
        "• !saldoku — Cek saldo",
        "• !profilku — Lihat profil lengkap",
        "• !riwayat [jumlah] — Riwayat transaksi",
        "• !detailtrx [trx_id] — Detail transaksi",
        "• !gameku — Stats game saya",
        "• !kreditku — Kredit game saya",
        "• !streakku — Status streak saya",
        "• !notifku — Notifikasi saya",
        "• !likeku — Daftar favorit saya",
        "• !nomorku — Tampilkan nomor WA",
        "• !fotoprofil — Kirim foto profil kamu",
        "",
        "🛒 *Belanja (perlu login):*",
        "• !beli [ID/nama produk] [jumlah]",
        "• !belistreak [nama paket]",
        "• !belikredit [nama paket]",
        "• !belistorage [nama paket]",
        "• !belibundle [nama paket]",
        "• !setpin [pin 6 digit]",
        "",
        "🎫 *Voucher & Streak (perlu login):*",
        "• !klaim [kode1] [kode2] ... — Klaim voucher",
        "• !klaimstreak — Klaim streak harian",
        "",
        "❤️ *Like (perlu login):*",
        "• !likeproduk [nama/id] — Like produk",
        "• !likelagu [judul] — Like lagu",
        "• !likesponsor [no] — Like sponsor",
        "",
        "🎮 *Game AI (pakai kredit):*",
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
        "• !topupkredit — Info beli kredit",
        "",
        "📦 *Produk & Toko:*",
        "• !produk — Daftar produk + ID",
        "• !cari [kata] — Cari produk",
        "• !kategori — Kategori produk",
        "• !harga [min] [max] — Filter harga",
        "• !random — Produk random",
        "• !top — Produk terpopuler",
        "• !detailproduk [id/nama]",
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
        "• !kirim [judul] — Kirim file audio langsung",
        "• !artis — Daftar artis",
        "• !detailartis [nama]",
        "• !playlist — Daftar playlist",
        "• !publik — Lagu publik",
        "",
        "🎫 *Support (perlu login):*",
        "• !buattiket [kategori] | [deskripsi]",
        "• !tiketku — Lihat tiket saya",
        "• !balastiket [no_tiket] [pesan]",
        "",
        "📊 *Info & Lainnya:*",
        "• !info — Statistik toko",
        "• !ceksaldo [username]",
        "• !cekgame [username]",
        "• !paket — Paket tersedia",
        "• !cekvoucher — Voucher aktif",
        "• !flashsale — Flash sale",
        "• !promo — Promo aktif",
        "• !lb — Leaderboard saldo",
        "• !bantuan — Pusat bantuan lengkap",
        "• !syarat — S&K",
        "• !sosmed — Social media admin",
        "• !rangkuman — Rangkuman toko",
        "• !toko — Info toko",
        "• !waktu — Waktu server",
        "• !versi — Info bot",
        "",
        "🔐 Ketik *!admin* untuk perintah admin",
      ].join("\\n"));
    }

    // ═══ LOGIN / LOGOUT USER ═══
    if (command.startsWith("!login")) {
      if (args.length < 2) return reply("⚠️ Gunakan: !login [username/email/hp] [password]\\n\\nContoh:\\n• !login agung password123\\n• !login agung@gmail.com password123\\n• !login 08123456789 password123");
      const identifier = args[0];
      const password = args.slice(1).join(" ");
      const res = await api("login", "POST", { identifier, password });
      if (res.error) return reply("❌ " + res.error);
      if (!res.data) return reply("❌ Gagal login.");
      userSessions[remoteJid] = res.data;
      return reply("✅ *Login berhasil!*\\n\\n👤 " + res.data.username + "\\n💰 Saldo: " + fmtRp(res.data.balance) + "\\n\\nKetik !saldoku, !riwayat, !gameku untuk akses fitur akun.");
    }

    if (command === "!logout") {
      if (!session) return reply("ℹ️ Kamu belum login. Ketik !login [user] [password]");
      delete userSessions[remoteJid];
      return reply("✅ Logout berhasil.");
    }

    // ═══ USER LOGGED-IN COMMANDS ═══
    if (command === "!saldoku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      // Refresh balance
      const res = await api("balances");
      const user = (res.data || []).find((u) => u.visitor_id === session.visitor_id);
      if (user) { session.balance = user.balance; userSessions[remoteJid] = session; }
      return reply("💰 *Saldo " + session.username + ":*\\n\\n" + fmtRp(user?.balance ?? session.balance));
    }

    if (command === "!profilku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("balances");
      const user = (res.data || []).find((u) => u.visitor_id === session.visitor_id);
      if (!user) return reply("❌ Profil tidak ditemukan.");
      let txt = "👤 *Profil Saya:*\\n\\n📛 Username: " + user.username + "\\n📞 No HP: " + user.phone + "\\n📧 Email: " + (user.email || "-") + "\\n💰 Saldo: " + fmtRp(user.balance);
      // Game profile
      const gp = await api("game_profiles&visitor_id=" + session.visitor_id);
      if (gp.data?.[0]) {
        const p = gp.data[0];
        txt += "\\n\\n🎮 *Profil Game:*\\n📛 " + p.display_name + "\\n📝 " + (p.description || "-") + "\\n👻 Guest: " + (p.is_guest ? "Ya" : "Tidak");
      }
      // Music profile
      const mp = await api("music_profiles&visitor_id=" + session.visitor_id);
      if (mp.data?.[0]) {
        txt += "\\n\\n🎵 *Profil Musik:*\\n📛 " + mp.data[0].username + "\\n📝 " + (mp.data[0].description || "-");
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
        let txt = "📋 *Riwayat Transaksi " + session.username + ":*\\n(" + txns.length + " dari " + res.data.length + " total)\\n";
        txns.forEach((t, i) => {
          const date = new Date(t.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
          const icon = t.type === "topup" ? "💵" : t.type === "purchase" ? "🛒" : "💸";
          txt += "\\n" + (i+1) + ". " + icon + " [" + t.type.toUpperCase() + "] " + fmtRp(t.amount);
          txt += "\\n   📝 " + (t.description || "-");
          txt += "\\n   📅 " + date;
          if (t.trx_id) txt += " | 🆔 " + t.trx_id;
          txt += "\\n";
        });
        return reply(txt);
      }
    }

    if (command === "!gameku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const [gs, gc] = await Promise.all([
        api("game_stats&visitor_id=" + session.visitor_id),
        api("game_credits&visitor_id=" + session.visitor_id),
      ]);
      let txt = "🎮 *Game Stats " + session.username + ":*\\n";
      if (gc.data?.[0]) {
        const c = gc.data[0];
        txt += "\\n💎 Kredit: " + c.credits;
        if (c.unlimited_until) txt += "\\n♾️ Unlimited sampai: " + new Date(c.unlimited_until).toLocaleString("id-ID");
        txt += "\\n";
      }
      if (!gs.data?.length) { txt += "\\nBelum ada data game."; }
      else {
        let totalW = 0, totalL = 0, totalP = 0;
        gs.data.forEach((g) => { totalW += g.wins; totalL += g.losses; totalP += g.points; });
        txt += "\\n📊 Total: W" + totalW + " / L" + totalL + " | " + totalP + " pts\\n";
        gs.data.forEach((g) => {
          txt += "\\n• " + g.game_type + ": W" + g.wins + "/L" + g.losses + " | " + g.points + " pts | " + g.total_questions + " soal";
        });
      }
      return reply(txt);
    }

    if (command === "!kreditku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("game_credits&visitor_id=" + session.visitor_id);
      if (!res.data?.length) return reply("💎 Kamu belum punya kredit game.");
      const c = res.data[0];
      return reply("💎 *Kredit Game:*\\n\\nKredit: " + c.credits + (c.unlimited_until ? "\\n♾️ Unlimited sampai: " + new Date(c.unlimited_until).toLocaleString("id-ID") : ""));
    }

    if (command === "!streakku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("streaks&visitor_id=" + session.visitor_id);
      if (!res.data?.length) return reply("🔥 Belum ada data streak.");
      const s = res.data[0];
      return reply("🔥 *Streak " + session.username + ":*\\n\\n🔥 Streak: " + s.current_streak + " hari\\n🏆 Terpanjang: " + s.longest_streak + "\\n📅 Total klaim: " + s.total_claims + "\\n📆 Terakhir: " + s.last_claim_date);
    }

    if (command === "!notifku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("notifications&visitor_id=" + session.visitor_id);
      if (!res.data?.length) return reply("🔔 Tidak ada notifikasi.");
      const list = res.data.slice(0, 10).map((n, i) => {
        const date = new Date(n.created_at).toLocaleDateString("id-ID");
        const icon = n.type === "warning" ? "⚠️" : n.type === "success" ? "✅" : "ℹ️";
        return (i+1) + ". " + icon + " *" + n.title + "*\\n   " + (n.message || "-") + " — " + date;
      }).join("\\n");
      return reply("🔔 *Notifikasi " + session.username + ":*\\n\\n" + list);
    }

    // ═══ DOWNLOAD LAGU ═══
    if (command.startsWith("!download ")) {
      const q = args.join(" ");
      if (!q) return reply("⚠️ Gunakan: !download [judul lagu]");
      const res = await api("song_url&q=" + encodeURIComponent(q));
      if (!res.data?.length) return reply("🎵 Lagu tidak ditemukan: " + q);
      const list = res.data.map((s, i) => {
        const dur = s.duration ? Math.floor(s.duration / 60) + ":" + String(s.duration % 60).padStart(2, "0") : "-";
        return (i+1) + ". 🎵 *" + s.title + "* — " + s.artist + "\\n   ⏱️ " + dur + "\\n   🔗 " + s.file_url;
      }).join("\\n\\n");
      return reply("🎵 *Hasil Download:*\\n\\n" + list + "\\n\\n💡 Klik/salin link untuk download.");
    }

    // ═══ PURCHASE COMMANDS (perlu login) ═══
    if (command.startsWith("!beli ") && !command.startsWith("!belistreak") && !command.startsWith("!belikredit") && !command.startsWith("!belistorage") && !command.startsWith("!belibundle")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const lastArg = args[args.length - 1];
      const qty = args.length > 1 && /^\\d+$/.test(lastArg) ? Number(lastArg) : 1;
      const nameParts = qty > 1 ? args.slice(0, -1) : args;
      const productQuery = nameParts.join(" ");
      if (!productQuery) return reply("⚠️ Gunakan:\\n• !beli [ID produk] [jumlah]\\n• !beli [nama produk] [jumlah]\\n\\nContoh:\\n• !beli abc123-def456 1\\n• !beli Netflix 1\\n• !beli Spotify Premium\\n\\n💡 Lihat ID produk di !produk atau !detailproduk");
      // Check if it looks like a UUID (product ID)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(productQuery.toLowerCase());
      const res = await api("purchase_product", "POST", { visitor_id: session.visitor_id, ...(isUuid ? { product_id: productQuery } : { product_name: productQuery }), quantity: qty, pin: session.pin || undefined });
      if (res.needPin) {
        return reply("🔐 *PIN diperlukan!*\\n\\nKirim: !setpin [6 digit] untuk set PIN sesi\\nLalu ulangi perintah !beli");
      }
      if (res.error) return reply("❌ " + res.error);
      const pd = res.data || res;
      let txt = "✅ *Pembelian Berhasil!*\\n\\n📦 " + (pd.product?.title || productQuery) + "\\n🔢 Jumlah: " + (pd.quantity || qty) + "\\n💰 Total: " + fmtRp(pd.total_price) + "\\n💳 Sisa Saldo: " + fmtRp(pd.balance_remaining);
      if (pd.discount_amount > 0) txt += "\\n🏷️ Diskon: " + fmtRp(pd.discount_amount);
      if (pd.tokens?.length) {
        txt += "\\n\\n🎫 *Voucher:*";
        pd.tokens.forEach((t, i) => {
          txt += "\\n" + (i+1) + ". " + t.token_code;
          if (t.fields?.length) t.fields.forEach((f) => { txt += "\\n   " + f.field_name + ": " + f.field_value; });
        });
        txt += "\\n\\n💡 Salin kode voucher untuk klaim di menu Voucher.";
      }
      session.balance = pd.balance_remaining;
      userSessions[remoteJid] = session;
      return reply(txt);
    }

    if (command.startsWith("!belistreak")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const packageName = args.join(" ");
      if (!packageName) {
        const pkgs = await api("packages&type=streak");
        const list = (pkgs.data?.streak || []).map((p, i) => (i+1) + ". " + p.name + " — " + fmtRp(p.price) + " (" + p.days + " hari)").join("\\n");
        return reply("🔥 *Paket Auto-Klaim Streak:*\\n\\n" + (list || "Tidak ada paket") + "\\n\\n💡 Gunakan: !belistreak [nama paket]");
      }
      const res = await api("purchase_streak", "POST", { visitor_id: session.visitor_id, package_name: packageName, pin: session.pin || undefined });
      if (res.needPin) return reply("🔐 *PIN diperlukan!*\\nKirim: !setpin [6 digit] lalu ulangi");
      if (res.error) return reply("❌ " + res.error);
      const sd = res.data || res;
      session.balance = sd.balance_remaining;
      userSessions[remoteJid] = session;
      return reply("✅ *Paket Streak Berhasil!*\\n\\n🔥 Paket: " + (sd.plan || packageName) + "\\n📅 Aktif sampai: " + (sd.expires_at ? new Date(sd.expires_at).toLocaleString("id-ID") : "-") + "\\n💳 Sisa Saldo: " + fmtRp(sd.balance_remaining) + (sd.discount_amount > 0 ? "\\n🏷️ Diskon: " + fmtRp(sd.discount_amount) : "") + (sd.auto_claimed ? "\\n✅ Streak hari ini otomatis diklaim!" : ""));
    }

    if (command.startsWith("!belikredit")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const packageName = args.join(" ");
      if (!packageName) {
        const pkgs = await api("packages&type=credit");
        const list = (pkgs.data?.credit || []).map((p, i) => (i+1) + ". " + p.label + " — " + fmtRp(p.price) + " (" + (p.is_unlimited ? "Unlimited " + p.unlimited_days + " hari" : p.credits + " kredit") + ")").join("\\n");
        return reply("💎 *Paket Kredit Game:*\\n\\n" + (list || "Tidak ada paket") + "\\n\\n💡 Gunakan: !belikredit [nama paket]");
      }
      const res = await api("purchase_credits", "POST", { visitor_id: session.visitor_id, package_name: packageName, pin: session.pin || undefined });
      if (res.needPin) return reply("🔐 *PIN diperlukan!*\\nKirim: !setpin [6 digit] lalu ulangi");
      if (res.error) return reply("❌ " + res.error);
      const cd = res.data || res;
      session.balance = cd.balance_remaining;
      userSessions[remoteJid] = session;
      return reply("✅ *Kredit Game Berhasil!*\\n\\n💎 " + (cd.plan || cd.label || packageName) + "\\n💳 Sisa Saldo: " + fmtRp(cd.balance_remaining) + (cd.discount_amount > 0 ? "\\n🏷️ Diskon: " + fmtRp(cd.discount_amount) : ""));
    }

    if (command.startsWith("!belistorage")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const packageName = args.join(" ");
      if (!packageName) {
        const pkgs = await api("packages&type=storage");
        const list = (pkgs.data?.storage || []).map((p, i) => (i+1) + ". " + p.name + " — " + fmtRp(p.price) + " (" + p.storage_mb + " MB)").join("\\n");
        return reply("💾 *Paket Storage Musik:*\\n\\n" + (list || "Tidak ada paket") + "\\n\\n💡 Gunakan: !belistorage [nama paket]");
      }
      const res = await api("purchase_storage", "POST", { visitor_id: session.visitor_id, package_name: packageName, pin: session.pin || undefined });
      if (res.needPin) return reply("🔐 *PIN diperlukan!*\\nKirim: !setpin [6 digit] lalu ulangi");
      if (res.error) return reply("❌ " + res.error);
      const std = res.data || res;
      session.balance = std.balance_remaining;
      userSessions[remoteJid] = session;
      return reply("✅ *Storage Berhasil!*\\n\\n💾 " + (std.plan || packageName) + "\\n💳 Sisa Saldo: " + fmtRp(std.balance_remaining) + (std.discount_amount > 0 ? "\\n🏷️ Diskon: " + fmtRp(std.discount_amount) : ""));
    }

    if (command.startsWith("!belibundle")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const packageName = args.join(" ");
      if (!packageName) {
        const pkgs = await api("packages&type=bundle");
        const list = (pkgs.data?.bundle || []).map((p, i) => (i+1) + ". " + p.name + " — " + fmtRp(p.price) + " (" + p.credits + " kredit + " + p.streak_days + " hari streak + " + p.storage_mb + " MB)").join("\\n");
        return reply("🎁 *Paket Bundle:*\\n\\n" + (list || "Tidak ada paket") + "\\n\\n💡 Gunakan: !belibundle [nama paket]");
      }
      const res = await api("purchase_bundle", "POST", { visitor_id: session.visitor_id, package_name: packageName, pin: session.pin || undefined });
      if (res.needPin) return reply("🔐 *PIN diperlukan!*\\nKirim: !setpin [6 digit] lalu ulangi");
      if (res.error) return reply("❌ " + res.error);
      const bd = res.data || res;
      session.balance = bd.balance_remaining;
      userSessions[remoteJid] = session;
      return reply("✅ *Bundle Berhasil!*\\n\\n🎁 " + (bd.plan || packageName) + "\\n💳 Sisa Saldo: " + fmtRp(bd.balance_remaining) + (bd.discount_amount > 0 ? "\\n🏷️ Diskon: " + fmtRp(bd.discount_amount) : ""));
    }

    // ── SET PIN SESSION ──
    if (command.startsWith("!setpin")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const pinVal = args[0];
      if (!pinVal || pinVal.length !== 6 || !/^\\d{6}$/.test(pinVal)) return reply("⚠️ PIN harus 6 digit angka.\\nGunakan: !setpin 123456");
      session.pin = pinVal;
      userSessions[remoteJid] = session;
      return reply("✅ PIN sesi berhasil disimpan.\\n🔒 PIN ini digunakan untuk verifikasi pembelian di sesi ini.");
    }

    // ── DETAIL TRANSAKSI ──
    if (command.startsWith("!detailtrx")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const trxId = args[0];
      if (!trxId) return reply("⚠️ Gunakan: !detailtrx [TRX-ID]\\nContoh: !detailtrx TRX-20260412-A1B2C3");
      const res = await api("transaction_detail&trx_id=" + encodeURIComponent(trxId));
      if (res.error) return reply("❌ " + res.error);
      const t = res.data;
      if (!t) return reply("❌ Transaksi tidak ditemukan.");
      let txt = "📋 *Detail Transaksi:*\\n\\n🆔 " + (t.trx_id || "-");
      txt += "\\n📌 Tipe: " + (t.type || "-").toUpperCase();
      txt += "\\n💰 Jumlah: " + fmtRp(t.amount);
      txt += "\\n📝 Deskripsi: " + (t.description || "-");
      txt += "\\n📅 Tanggal: " + new Date(t.created_at).toLocaleString("id-ID");
      if (t.products) txt += "\\n📦 Produk: " + t.products.title + " (" + fmtRp(t.products.price) + ")";
      if (t.token_id) txt += "\\n🎫 Token ID: " + t.token_id;
      return reply(txt);
    }

    // ── GROSIR / WHOLESALE ──
    if (command.startsWith("!grosir")) {
      const q = args.join(" ");
      if (!q) return reply("⚠️ Gunakan: !grosir [nama produk]");
      const pRes = await api("products");
      const p = (pRes.data || []).find((x) => x.title.toLowerCase().includes(q.toLowerCase()));
      if (!p) return reply("❌ Produk '" + q + "' tidak ditemukan.");
      const wRes = await api("wholesale&product_id=" + p.id);
      let txt = "📦 *Harga Grosir: " + p.title + "*\\n\\n💰 Harga satuan: " + fmtRp(p.price);
      if (!wRes.data?.length) {
        txt += "\\n\\nBelum ada harga grosir untuk produk ini.";
      } else {
        txt += "\\n\\n📊 *Tier Grosir:*";
        wRes.data.forEach((w) => { txt += "\\n• Min " + w.min_quantity + " pcs → " + fmtRp(w.price_per_item) + "/pcs"; });
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
      let txt = "🔥 *FLASH SALE AKTIF!*\\n⏰ Berakhir: " + endDate + "\\n";
      const categories = [
        { key: "promo_product_discount", label: "Produk" },
        { key: "promo_credit_discount", label: "Kredit Game" },
        { key: "promo_streak_discount", label: "Streak" },
        { key: "promo_storage_discount", label: "Storage" },
        { key: "promo_bundle_discount", label: "Bundle" },
      ];
      categories.forEach((c) => {
        const d = Number(settings[c.key] || 0);
        if (d > 0) txt += "\\n🏷️ " + c.label + ": *" + d + "% OFF*";
      });
      return reply(txt);
    }

    // ── PRODUK ──
    if (command === "!produk") {
      const res = await api("products");
      if (!res.data?.length) return reply("📦 Tidak ada produk.");
      const list = res.data.slice(0, 20).map((p, i) => (i+1) + ". " + p.title + " — " + fmtRp(p.price) + " (Stok: " + p.stock + ")\\n   🆔 " + p.id).join("\\n");
      return reply("📦 *Daftar Produk:*\\n\\n" + list + (res.data.length > 20 ? "\\n\\n...dan " + (res.data.length - 20) + " lainnya" : "") + "\\n\\n💡 Beli: !beli [ID] atau !beli [nama]");
    }

    if (command.startsWith("!cari ")) {
      const q = args.join(" ").toLowerCase();
      const res = await api("products");
      const found = (res.data || []).filter((p) => p.title.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
      if (!found.length) return reply("🔍 Tidak ditemukan produk dengan kata: " + q);
      const list = found.slice(0, 15).map((p, i) => (i+1) + ".  #" + p.id.slice(0, 8) + " " + p.title + " — " + fmtRp(p.price)).join("\\n");
      return reply("🔍 *Hasil Pencarian:* " + q + "\\n\\n" + list + "\\n\\nJika ingin beli !beli [nama] atau !beli #[id produk]");
    }

    if (command === "!kategori") {
      const res = await api("products");
      const cats = [...new Set((res.data || []).map((p) => p.category || "Umum"))];
      return reply("📂 *Kategori Produk:*\\n\\n" + cats.map((c, i) => (i+1) + ". " + c).join("\\n"));
    }

    if (command.startsWith("!harga")) {
      const min = Number(args[0]) || 0;
      const max = Number(args[1]) || 999999999;
      const res = await api("products");
      const found = (res.data || []).filter((p) => p.price >= min && p.price <= max);
      if (!found.length) return reply("💰 Tidak ada produk di range " + fmtRp(min) + " - " + fmtRp(max));
      const list = found.slice(0, 15).map((p, i) => (i+1) + ". " + p.title + " — " + fmtRp(p.price)).join("\\n");
      return reply("💰 *Produk Range* " + fmtRp(min) + " - " + fmtRp(max) + ":\\n\\n" + list);
    }

    if (command === "!random") {
      const res = await api("products");
      if (!res.data?.length) return reply("📦 Tidak ada produk.");
      const p = res.data[Math.floor(Math.random() * res.data.length)];
      return reply("🎲 *Produk Random:*\\n\\n📦 " + p.title + "\\n💰 " + fmtRp(p.price) + "\\n📊 Stok: " + p.stock + "\\n📝 " + (p.description || "-"));
    }

    if (command === "!top") {
      const res = await api("products");
      const sorted = (res.data || []).sort((a, b) => b.stock - a.stock).slice(0, 10);
      if (!sorted.length) return reply("📦 Tidak ada produk.");
      const list = sorted.map((p, i) => (i+1) + ". " + p.title + " — " + fmtRp(p.price) + " (Stok: " + p.stock + ")").join("\\n");
      return reply("🏆 *Top Produk:*\\n\\n" + list);
    }

    if (command.startsWith("!detailproduk")) {
      const id = args.join(" ");
      if (!id) return reply("⚠️ Gunakan: !detailproduk [id/nama]");
      const res = await api("products");
      const p = (res.data || []).find((x) => x.id === id || x.title.toLowerCase().includes(id.toLowerCase()));
      if (!p) return reply("❌ Produk tidak ditemukan.");
      return reply("📦 *Detail Produk:*\\n\\n🆔 *ID: " + p.id + "*\\n📌 " + p.title + "\\n💰 " + fmtRp(p.price) + "\\n📊 Stok: " + p.stock + "\\n🏷️ Kategori: " + (p.category || "Umum") + "\\n🛡️ Garansi: " + (p.has_warranty ? "Ya" : "Tidak") + "\\n📝 " + (p.description || "-") + "\\n\\n💡 Beli: !beli " + p.id);
    }

    // ── DETAIL SPONSOR LENGKAP ──
    if (command.startsWith("!detailsponsor")) {
      const no = args[0];
      if (!no) return reply("⚠️ Gunakan: !detailsponsor [nomor]");
      const res = await api("sponsor_detail&sponsor_number=" + no);
      if (res.error) {
        // fallback
        const res2 = await api("sponsors");
        const s = (res2.data || []).find((x) => String(x.sponsor_number) === no);
        if (!s) return reply("❌ Sponsor #" + no + " tidak ditemukan.");
        return reply("🏪 *Sponsor #" + s.sponsor_number + "*\\n\\n📌 " + s.title + "\\n💰 " + fmtRp(s.price) + "\\n🏷️ Kategori: " + s.category + "\\n📊 Stok: " + s.stock + "\\n🏪 Penjual: " + s.seller_name + "\\n📝 " + (s.description || "-"));
      }
      const s = res.data;
      let txt = "🏪 *Sponsor #" + s.sponsor_number + "*\\n\\n📌 " + s.title + "\\n💰 " + fmtRp(s.price) + "\\n🏷️ Kategori: " + s.category + "\\n📊 Stok: " + s.stock + "\\n🛡️ Garansi: " + (s.has_warranty ? s.warranty_duration_value + " " + s.warranty_duration_type : "Tidak") + "\\n🏪 Penjual: " + s.seller_name + "\\n📞 Kontak: " + s.seller_contact + "\\n👁️ View: " + s.view_count + "\\n📝 " + (s.description || "-");
      // Social media
      if (s.wa_number) txt += "\\n\\n📱 *Sosmed Penjual:*";
      if (s.wa_number) txt += "\\n• WhatsApp: " + s.wa_number;
      if (s.instagram) txt += "\\n• Instagram: " + s.instagram;
      if (s.facebook) txt += "\\n• Facebook: " + s.facebook;
      if (s.tiktok) txt += "\\n• TikTok: " + s.tiktok;
      if (s.twitter) txt += "\\n• Twitter: " + s.twitter;
      if (s.threads) txt += "\\n• Threads: " + s.threads;
      if (s.images?.length) { txt += "\\n\\n📸 Foto: " + s.images.length + " gambar"; s.images.forEach((img, i) => { txt += "\\n" + (i+1) + ". " + img.image_url; }); }
      return reply(txt);
    }

    // ── MUSIK ──
    if (command === "!lagu") {
      const res = await api("songs");
      if (!res.data?.length) return reply("🎵 Tidak ada lagu.");
      const list = res.data.slice(0, 20).map((s, i) => (i+1) + ". " + s.title + " — " + s.artist).join("\\n");
      return reply("🎵 *Daftar Lagu:*\\n\\n" + list + (res.data.length > 20 ? "\\n\\n...dan " + (res.data.length - 20) + " lainnya" : "") + "\\n\\n💡 Ketik !download [judul] untuk link download");
    }

    if (command.startsWith("!carilagu ")) {
      const q = args.join(" ").toLowerCase();
      const res = await api("songs");
      const found = (res.data || []).filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
      if (!found.length) return reply("🔍 Lagu tidak ditemukan: " + q);
      const list = found.slice(0, 15).map((s, i) => (i+1) + ". " + s.title + " — " + s.artist).join("\\n");
      return reply("🔍 *Hasil Cari Lagu:*\\n\\n" + list + "\\n\\n💡 Ketik !download [judul] untuk link download");
    }

    if (command === "!artis") {
      const res = await api("artists");
      if (!res.data?.length) return reply("🎤 Tidak ada artis.");
      const list = res.data.slice(0, 20).map((a, i) => (i+1) + ". " + a.name + (a.genre ? " (" + a.genre + ")" : "")).join("\\n");
      return reply("🎤 *Daftar Artis:*\\n\\n" + list);
    }

    if (command.startsWith("!detailartis")) {
      const q = args.join(" ").toLowerCase();
      if (!q) return reply("⚠️ Gunakan: !detailartis [nama]");
      const res = await api("artists");
      const a = (res.data || []).find((x) => x.name.toLowerCase().includes(q));
      if (!a) return reply("❌ Artis tidak ditemukan.");
      return reply("🎤 *" + a.name + "*\\n\\n🎵 Genre: " + (a.genre || "-") + "\\n📝 Bio: " + (a.bio || "-"));
    }

    if (command === "!playlist") {
      const res = await api("playlists");
      if (!res.data?.length) return reply("📋 Tidak ada playlist.");
      const list = res.data.slice(0, 15).map((p, i) => (i+1) + ". " + p.name + " (" + (p.playlist_items?.length || 0) + " lagu)").join("\\n");
      return reply("📋 *Daftar Playlist:*\\n\\n" + list);
    }

    if (command === "!publik" || command === "!musikpublik") {
      const res = await api("public_songs");
      if (!res.data?.length) return reply("🎵 Tidak ada lagu publik.");
      const list = res.data.slice(0, 15).map((s, i) => (i+1) + ". " + s.title + " — " + s.artist + " [" + s.status + "]").join("\\n");
      return reply("🎵 *Lagu Publik:*\\n\\n" + list);
    }

    // ── INFO & STATS ──
    if (command === "!info" || command === "!toko" || command === "!rangkuman") {
      const res = await api("dashboard");
      const d = res.data || {};
      return reply("📊 *Statistik Toko:*\\n\\n📦 Produk: " + d.products + "\\n👥 User: " + d.users + "\\n🎵 Lagu: " + d.songs + "\\n🏪 Sponsor: " + d.sponsors + "\\n🏦 Deposit: " + d.deposits + "\\n🎫 Tiket: " + d.tickets + "\\n🎤 Artis: " + d.artists + "\\n🎵 Publik: " + d.public_songs + "\\n💰 Total Saldo: " + fmtRp(d.total_balance));
    }

    if (command.startsWith("!ceksaldo")) {
      const nama = args.join(" ");
      if (!nama) return reply("⚠️ Gunakan: !ceksaldo [username]");
      const res = await api("balances");
      const user = (res.data || []).find((u) => u.username.toLowerCase().includes(nama.toLowerCase()));
      if (!user) return reply("❌ User '" + nama + "' tidak ditemukan.");
      return reply("💰 *Saldo " + user.username + ":*\\n\\n" + fmtRp(user.balance));
    }

    if (command.startsWith("!cekgame")) {
      const nama = args.join(" ");
      if (!nama) return reply("⚠️ Gunakan: !cekgame [username]");
      const user = await resolveVid(nama);
      if (!user) return reply("❌ User tidak ditemukan.");
      const gs = await api("game_stats&visitor_id=" + user.visitor_id);
      if (!gs.data?.length) return reply("🎮 " + user.username + " belum punya stats game.");
      const list = gs.data.map((g) => "• " + g.game_type + ": W" + g.wins + "/L" + g.losses + " | Pts:" + g.points).join("\\n");
      return reply("🎮 *Game Stats " + user.username + ":*\\n\\n" + list);
    }

    if (command === "!paket") {
      const res = await api("packages");
      const d = res.data || {};
      let txt = "📦 *Paket Tersedia:*\\n";
      if (d.credit?.length) { txt += "\\n💎 *Kredit Game:*\\n" + d.credit.map((p) => "• " + p.label + " — " + fmtRp(p.price) + " (" + p.credits + " kredit)").join("\\n"); }
      if (d.streak?.length) { txt += "\\n\\n🔥 *Streak:*\\n" + d.streak.map((p) => "• " + p.name + " — " + fmtRp(p.price) + " (" + p.days + " hari)").join("\\n"); }
      if (d.storage?.length) { txt += "\\n\\n💾 *Storage:*\\n" + d.storage.map((p) => "• " + p.name + " — " + fmtRp(p.price) + " (" + p.storage_mb + " MB)").join("\\n"); }
      if (d.bundle?.length) { txt += "\\n\\n🎁 *Bundle:*\\n" + d.bundle.map((p) => "• " + p.name + " — " + fmtRp(p.price)).join("\\n"); }
      return reply(txt);
    }

    if (command === "!cekvoucher" || command === "!promo") {
      const res = await api("vouchers");
      const d = res.data || {};
      let txt = "🎟️ *Voucher Aktif:*\\n";
      const allV = [...(d.discount || []), ...(d.game || []), ...(d.streak || []), ...(d.music || []), ...(d.storage || [])].filter((v) => v.is_active);
      if (!allV.length) return reply("🎟️ Tidak ada voucher aktif saat ini.");
      allV.slice(0, 15).forEach((v) => { txt += "\\n• " + v.code + " — Diskon " + fmtRp(v.discount_amount || v.storage_mb || 0) + " (Sisa: " + (v.max_uses - v.used_count) + "x)"; });
      return reply(txt);
    }

    if (command === "!lb") {
      const res = await api("balances");
      const sorted = (res.data || []).sort((a, b) => b.balance - a.balance).slice(0, 10);
      if (!sorted.length) return reply("🏆 Belum ada data leaderboard.");
      const list = sorted.map((u, i) => (i+1) + ". " + u.username + " — " + fmtRp(u.balance)).join("\\n");
      return reply("🏆 *Leaderboard Saldo:*\\n\\n" + list);
    }

    if (command === "!bantuan") {
      return reply([
        "❓ *Pusat Bantuan Lengkap*",
        "",
        "🛒 *Cara Belanja:*",
        "1. Daftar akun saldo di website/bot",
        "2. Top up saldo melalui deposit ke admin",
        "3. Login di bot: !login [user] [password]",
        "4. Lihat produk: !produk (ada ID produk)",
        "5. Beli: !beli [ID/nama] [jumlah]",
        "6. Set PIN: !setpin [6 digit] untuk verifikasi",
        "7. Voucher otomatis dikirim setelah pembelian",
        "",
        "🎫 *Klaim Voucher:*",
        "• Ketik !klaim [kode1] [kode2] ...",
        "• Masukkan kode voucher yang didapat",
        "• Bisa klaim beberapa kode sekaligus",
        "",
        "💰 *Saldo & Deposit:*",
        "• Top up via admin (hubungi WA admin)",
        "• Cek saldo: !saldoku",
        "• Riwayat: !riwayat",
        "",
        "🔥 *Streak Harian:*",
        "• Beli paket streak: !belistreak [paket]",
        "• Auto-klaim otomatis setelah beli",
        "• Klaim manual: !klaimstreak",
        "• Cek status: !streakku",
        "",
        "🎮 *Game AI:*",
        "• 8 jenis game AI tersedia",
        "• Ketik !tekateki, !tebakkata, dll",
        "• Sistem 3 nyawa per soal",
        "• Leaderboard: !lbgame",
        "• Beli kredit: !belikredit",
        "",
        "❤️ *Like & Favorit:*",
        "• Like produk: !likeproduk [nama/id]",
        "• Like lagu: !likelagu [judul]",
        "• Like sponsor: !likesponsor [no]",
        "• Lihat favorit: !likeku",
        "",
        "🎵 *Musik:*",
        "• Daftar lagu: !lagu",
        "• Download: !download [judul]",
        "• Kirim file: !kirim [judul]",
        "• Artis & playlist tersedia",
        "",
        "🎫 *Support / Tiket:*",
        "• Buat tiket: !buattiket [kategori] | [deskripsi]",
        "• Lihat tiket: !tiketku",
        "• Balas tiket: !balastiket [no] [pesan]",
        "• Kategori: Akun, Refund, Deposit, Produk, dll",
        "",
        "🏪 *Sponsor / Rekber:*",
        "• Sponsor adalah produk pihak ke-3",
        "• Gunakan rekber admin untuk keamanan",
        "• Lihat: !sponsor, !detailsponsor [no]",
        "",
        "📋 *FAQ:*",
        "Q: Saldo tidak masuk? → Hubungi admin",
        "Q: Voucher tidak valid? → Cek kode & expired",
        "Q: Akun terkunci? → Reset password via admin",
        "Q: Kredit game habis? → Beli di !belikredit",
        "Q: Cara login bot? → !login [user] [pass]",
        "Q: Download lagu? → !download [judul]",
        "Q: Lupa PIN? → Hubungi admin untuk reset",
      ].join("\\n"));
    }

    if (command === "!syarat") {
      return reply("📋 *Syarat & Ketentuan:*\\n\\n1. Produk sponsor bukan tanggung jawab admin platform\\n2. Penjual wajib kirim produk sesuai deskripsi\\n3. Pembeli wajib cek deskripsi sebelum beli\\n4. Garansi sesuai detail produk\\n5. Penipuan = akun diblokir\\n6. Tanpa rekber = risiko ditanggung pembeli\\n7. Dilarang jual produk ilegal\\n8. Admin berhak hapus sponsor melanggar\\n9. Harga & stok bisa berubah\\n10. Komplain max 1x24 jam\\n11. Batas komplain max 1x24 jam setelah transaksi");
    }

    // ═══ SOSMED ADMIN ═══
    if (command === "!sosmed") {
      const res = await api("admin_posts");
      const posts = res.data || [];
      let txt = "📱 *Social Media Admin:*\\n";
      let hasSocmed = false;
      posts.forEach((p) => {
        const links = [];
        if (p.whatsapp) links.push("📞 WA: " + p.whatsapp);
        if (p.instagram) links.push("📸 IG: " + p.instagram);
        if (p.facebook) links.push("👥 FB: " + p.facebook);
        if (p.tiktok) links.push("🎵 TT: " + p.tiktok);
        if (p.youtube) links.push("📺 YT: " + p.youtube);
        if (p.twitter) links.push("🐦 X: " + p.twitter);
        if (links.length) { hasSocmed = true; txt += "\\n*" + p.title + "*\\n" + links.join("\\n") + "\\n"; }
      });
      if (!hasSocmed) txt += "\\nBelum ada info sosmed. Kunjungi website untuk detail.";
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

    // ═══ TOP UP KREDIT INFO ═══
    if (command === "!topupkredit") {
      const pkgs = await api("packages&type=credit");
      const list = (pkgs.data?.credit || []).map((p, i) => (i+1) + ". " + p.label + " — " + fmtRp(p.price) + " (" + (p.is_unlimited ? "Unlimited " + p.unlimited_days + " hari" : p.credits + " kredit") + ")").join("\\n");
      return reply("💎 *Paket Kredit Game:*\\n\\n" + (list || "Tidak ada paket") + "\\n\\n💡 Beli: !belikredit [nama paket]\\n🔒 Harus login dulu: !login [user] [pass]");
    }

    // ═══ KIRIM FILE LAGU VIA WA ═══
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
        await client.sendMessage(remoteJid, { 
          audio: audioBuf, 
          mimetype: "audio/mpeg", 
          fileName: song.title + " - " + song.artist + ".mp3",
          ptt: false 
        }, { quoted: msg });
        return;
      } catch (e) {
        return reply("🎵 *" + song.title + "* — " + song.artist + "\\n\\n❌ Gagal kirim file audio. Download manual:\\n🔗 " + song.file_url);
      }
    }

    // ═══ KLAIM VOUCHER (perlu login) ═══
    if (command.startsWith("!klaim ")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const codes = args.filter((c) => c.length > 0);
      if (!codes.length) return reply("⚠️ Gunakan: !klaim [kode1] [kode2] ...\\nContoh: !klaim ABC123 DEF456");
      const res = await api("claim_voucher", "POST", { visitor_id: session.visitor_id, codes, device_info: "WhatsApp Bot", browser: "Bot" });
      if (res.error) return reply("❌ " + res.error);
      if (res.data?.results) {
        const results = res.data.results;
        let txt = "🎫 *Hasil Klaim Voucher:*\\n";
        results.forEach((r) => {
          txt += "\\n" + (r.success ? "✅" : "❌") + " " + r.code + ": " + (r.message || r.error || "OK");
        });
        return reply(txt);
      }
      return reply("✅ Voucher berhasil diklaim!");
    }

    // ═══ KLAIM STREAK HARIAN (perlu login) ═══
    if (command === "!klaimstreak") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("claim_streak", "POST", { visitor_id: session.visitor_id });
      if (res.error) return reply("❌ " + res.error);
      const d = res.data || {};
      return reply("🔥 *Streak Harian:*\\n\\n" + (d.already_claimed ? "ℹ️ Sudah diklaim hari ini" : "✅ Berhasil diklaim!") + "\\n🔥 Streak: " + (d.current_streak || 0) + " hari\\n🏆 Terpanjang: " + (d.longest_streak || 0));
    }

    // ═══ LIKE/UNLIKE (perlu login) ═══
    if (command.startsWith("!likeproduk")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const q = args.join(" ");
      if (!q) return reply("⚠️ Gunakan: !likeproduk [nama/id produk]");
      const pRes = await api("products");
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(q.toLowerCase());
      const p = (pRes.data || []).find((x) => isUuid ? x.id === q : x.title.toLowerCase().includes(q.toLowerCase()));
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
      let txt = "❤️ *Favorit Saya:*\\n";
      if (d.products?.length) { txt += "\\n📦 *Produk:*\\n" + d.products.map((p, i) => (i+1) + ". " + (p.products?.title || p.product_id) + " — " + fmtRp(p.products?.price || 0)).join("\\n"); }
      if (d.songs?.length) { txt += "\\n\\n🎵 *Lagu:*\\n" + d.songs.map((s, i) => (i+1) + ". " + (s.playlist_songs?.title || s.song_id) + " — " + (s.playlist_songs?.artist || "")).join("\\n"); }
      if (d.sponsors?.length) { txt += "\\n\\n🏪 *Sponsor:*\\n" + d.sponsors.map((s, i) => (i+1) + ". " + (s.sponsors?.title || s.sponsor_id) + " — " + fmtRp(s.sponsors?.price || 0)).join("\\n"); }
      if (!d.products?.length && !d.songs?.length && !d.sponsors?.length) txt += "\\nBelum ada favorit.";
      return reply(txt);
    }

    // ═══ TIKET SUPPORT (perlu login) ═══
    if (command.startsWith("!buattiket")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const parts = args.join(" ").split("|");
      const category = (parts[0] || "").trim() || "Umum";
      const description = (parts[1] || "").trim();
      if (!description) return reply("⚠️ Gunakan: !buattiket [kategori] | [deskripsi masalah]\\n\\nKategori: Akun/Login, Refund, Deposit, Produk/Token, Rekber, Game, Musik, Sponsor, Lainnya\\n\\nContoh: !buattiket Deposit | Saldo belum masuk sudah 2 jam");
      const res = await api("create_ticket", "POST", { name: session.username, phone: session.phone || "-", category, description });
      if (res.error) return reply("❌ " + res.error);
      const t = res.data;
      return reply("✅ *Tiket Dibuat!*\\n\\n🆔 #" + (t.ticket_number || "-") + "\\n📂 Kategori: " + category + "\\n📝 " + description + "\\n\\n💡 Cek status: !tiketku\\nBalas: !balastiket " + (t.ticket_number || t.id) + " [pesan]");
    }

    if (command === "!tiketku") {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      const res = await api("user_tickets&name=" + encodeURIComponent(session.username));
      if (!res.data?.length) return reply("🎫 Belum ada tiket support.");
      const list = res.data.slice(0, 10).map((t, i) => (i+1) + ". #" + t.ticket_number + " [" + t.status + "] " + t.category + "\\n   📝 " + (t.description || "-").slice(0, 50) + "\\n   📅 " + new Date(t.created_at).toLocaleDateString("id-ID")).join("\\n");
      return reply("🎫 *Tiket Saya:*\\n\\n" + list);
    }

    if (command.startsWith("!balastiket")) {
      if (!session) return reply("🔒 Login dulu: !login [user] [password]");
      if (args.length < 2) return reply("⚠️ Gunakan: !balastiket [no_tiket/id] [pesan]");
      const ticketRef = args[0];
      const message = args.slice(1).join(" ");
      // Find ticket
      const tRes = await api("user_tickets&name=" + encodeURIComponent(session.username));
      const ticket = (tRes.data || []).find((t) => String(t.ticket_number) === ticketRef || t.id === ticketRef);
      if (!ticket) return reply("❌ Tiket #" + ticketRef + " tidak ditemukan.");
      const res = await api("reply_ticket", "POST", { ticket_id: ticket.id, message, sender_type: "user" });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Balasan terkirim ke tiket #" + ticket.ticket_number);
    }

    // ═══ GAME AI VIA WHATSAPP (Interactive with Credits, Timer, Levels) ═══
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

    // Helper: check if game timer expired
    function isGameExpired(game) {
      if (!game || !game.startedAt) return false;
      const elapsed = (Date.now() - game.startedAt) / 1000;
      return elapsed > (game.timerSeconds || 90);
    }

    // Helper: get remaining time
    function getRemainingTime(game) {
      if (!game || !game.startedAt) return "?";
      const elapsed = Math.floor((Date.now() - game.startedAt) / 1000);
      const remaining = Math.max(0, (game.timerSeconds || 90) - elapsed);
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      return m + ":" + String(s).padStart(2, "0");
    }

    // Helper: game level from points
    function getGameLevel(points) {
      const thresholds = [0, 90, 250, 500, 1000, 2000, 4000, 8000];
      let level = 1;
      for (let i = 1; i < thresholds.length; i++) {
        if (points >= thresholds[i]) level = i + 1; else break;
      }
      return level;
    }

    // Helper: end game and show result
    async function endGameWithResult(jid, game, correct, userAnswer) {
      delete userSessions[jid + "_game"];
      const pts = correct ? (POINTS_MAP[game.difficulty] || 20) : 0;
      let txt = "";
      if (correct) {
        txt = "✅ *BENAR!* 🎉 +" + pts + " poin\\n\\n🔑 Jawaban: *" + game.answer + "*";
      } else {
        const reason = isGameExpired(game) ? "⏰ Waktu habis!" : "❌ Salah! Nyawa habis! 💀";
        txt = reason + "\\n\\n🔑 Jawaban yang benar: *" + game.answer + "*";
      }
      if (game.explanation) txt += "\\n\\n📖 " + game.explanation;
      
      // Show game stats if logged in
      if (session) {
        const gRes = await api("game_credits&visitor_id=" + session.visitor_id);
        const credits = gRes.data?.[0]?.credits || 0;
        txt += "\\n\\n💎 Kredit: " + credits;
      }
      
      txt += "\\n\\n🔄 Ketik perintah game lagi untuk soal baru, contoh:\\n• !" + (game.type || "tekateki").replace(/-/g, "") + " " + (game.difficulty || "sedang");
      return txt;
    }

    // Check if user is answering an active game
    const activeGame = userSessions[remoteJid + "_game"];
    
    // Check timer expiry for active game
    if (activeGame && isGameExpired(activeGame)) {
      const resultTxt = await endGameWithResult(remoteJid, activeGame, false, "");
      return reply(resultTxt);
    }

    if (activeGame && !command.startsWith("!")) {
      const userAnswer = text.trim();
      const correctAnswer = activeGame.answer;
      const normalize = (s) => s.toUpperCase().trim().replace(/\\s+/g, " ");
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
          if (activeGame.hints[hintIdx - 1]) hintTxt = "\\n💡 Petunjuk: " + activeGame.hints[hintIdx - 1];
        }
        return reply("❌ Salah! ❤️ Nyawa: " + activeGame.lives + "/3 | ⏱️ " + getRemainingTime(activeGame) + hintTxt + "\\n\\nCoba lagi! Ketik jawabanmu langsung.");
      }
    }

    // Handle !jawab command
    if (command.startsWith("!jawab")) {
      if (!userSessions[remoteJid + "_game"]) return reply("ℹ️ Tidak ada game aktif. Mulai game dulu, contoh: !tekateki mudah");
      const ag = userSessions[remoteJid + "_game"];
      if (isGameExpired(ag)) {
        const resultTxt = await endGameWithResult(remoteJid, ag, false, "");
        return reply(resultTxt);
      }
      const userAnswer = args.join(" ");
      if (!userAnswer) return reply("⚠️ Gunakan: !jawab [jawabanmu]");
      const normalize = (s) => s.toUpperCase().trim().replace(/\\s+/g, " ");
      const isCorrect = normalize(userAnswer) === normalize(ag.answer);
      if (isCorrect) {
        const resultTxt = await endGameWithResult(remoteJid, ag, true, userAnswer);
        return reply(resultTxt);
      } else {
        ag.lives = (ag.lives || 3) - 1;
        if (ag.lives <= 0) {
          const resultTxt = await endGameWithResult(remoteJid, ag, false, userAnswer);
          return reply(resultTxt);
        }
        userSessions[remoteJid + "_game"] = ag;
        let hintTxt = "";
        if (ag.hints?.length) {
          const hintIdx = 3 - ag.lives;
          if (ag.hints[hintIdx - 1]) hintTxt = "\\n💡 Petunjuk: " + ag.hints[hintIdx - 1];
        }
        return reply("❌ Salah! ❤️ Nyawa: " + ag.lives + "/3 | ⏱️ " + getRemainingTime(ag) + hintTxt + "\\n\\nCoba lagi!");
      }
    }

    // Hint command (costs 1 credit)
    if (command === "!hint" || command === "!petunjuk") {
      if (!userSessions[remoteJid + "_game"]) return reply("ℹ️ Tidak ada game aktif.");
      const ag = userSessions[remoteJid + "_game"];
      if (!ag.hints?.length) return reply("💡 Tidak ada petunjuk untuk game ini.");
      const usedHints = ag.usedHints || 0;
      if (usedHints >= ag.hints.length) return reply("💡 Semua petunjuk sudah digunakan.");
      // Check credits if logged in
      if (session) {
        const gcRes = await api("game_credits&visitor_id=" + session.visitor_id);
        const credits = gcRes.data?.[0]?.credits || 0;
        if (credits <= 0) return reply("💎 Kredit habis! Beli di !belikredit atau !topupkredit");
        // Deduct 1 credit
        await api("deduct_credit", "POST", { visitor_id: session.visitor_id, amount: 1 });
      }
      const hint = ag.hints[usedHints];
      ag.usedHints = usedHints + 1;
      userSessions[remoteJid + "_game"] = ag;
      return reply("💡 *Petunjuk " + (usedHints + 1) + "/" + ag.hints.length + ":*\\n" + hint + (session ? "\\n💎 -1 kredit" : "") + "\\n⏱️ Sisa waktu: " + getRemainingTime(ag));
    }

    // Cancel game
    if (command === "!nyerah" || command === "!menyerah") {
      if (!userSessions[remoteJid + "_game"]) return reply("ℹ️ Tidak ada game aktif.");
      const ag = userSessions[remoteJid + "_game"];
      delete userSessions[remoteJid + "_game"];
      let txt = "🏳️ *Menyerah!*\\n\\n🔑 Jawaban: *" + ag.answer + "*" + (ag.explanation ? "\\n\\n📖 " + ag.explanation : "");
      txt += "\\n\\n🔄 Ketik perintah game lagi untuk soal baru.";
      return reply(txt);
    }

    const gameCmd = Object.keys(gameTypes).find((k) => command.startsWith(k));
    if (gameCmd) {
      const gt = gameTypes[gameCmd];
      const difficulty = args[0] || "sedang";
      const timerSec = TIMER_SECONDS[difficulty] || 90;

      // Show credit info if logged in
      let creditInfo = "";
      if (session) {
        const gcRes = await api("game_credits&visitor_id=" + session.visitor_id);
        const credits = gcRes.data?.[0]?.credits || 0;
        const unlimited = gcRes.data?.[0]?.unlimited_until;
        const isUnlimited = unlimited && new Date(unlimited) > new Date();
        creditInfo = "\\n💎 Kredit: " + (isUnlimited ? "♾️ Unlimited" : credits);
        
        // Show level
        const gsRes = await api("game_stats&visitor_id=" + session.visitor_id);
        let totalPts = 0;
        (gsRes.data || []).forEach((g) => totalPts += g.points);
        const level = getGameLevel(totalPts);
        creditInfo += " | ⭐ Level " + level + " (" + totalPts + " pts)";
      }

      await reply("🎮 *" + gt.name + "* (Tingkat: " + difficulty + ")" + creditInfo + "\\n⏱️ Waktu: " + Math.floor(timerSec / 60) + ":" + String(timerSec % 60).padStart(2, "0") + "\\n⏳ Membuat soal...");
      const res = await api("play_game", "POST", { game_type: gt.fn, difficulty });
      if (res.error) return reply("❌ Gagal: " + res.error);
      const d = res.data || res;

      // Store game session for interactive play
      const gameSession = {
        type: gt.fn,
        name: gt.name,
        difficulty: difficulty,
        answer: (d.answer || d.jawaban || "").toUpperCase(),
        explanation: d.explanation || d.penjelasan || "",
        hints: d.hints || [],
        lives: 3,
        startedAt: Date.now(),
        timerSeconds: timerSec,
        usedHints: 0,
      };
      userSessions[remoteJid + "_game"] = gameSession;

      const timeStr = Math.floor(timerSec / 60) + ":" + String(timerSec % 60).padStart(2, "0");
      let txt = "🎮 *" + gt.name + "*\\n❤️ Nyawa: 3/3 | ⏱️ " + timeStr + "\\n\\n";

      // Special handling for tebak gambar - send actual image
      if (gt.fn === "tebak-gambar" && d.image) {
        try {
          let imgData = d.image;
          if (imgData.startsWith("data:")) {
            imgData = imgData.split(",")[1] || imgData;
          }
          const imgBuffer = Buffer.from(imgData, "base64");
          if (imgBuffer.length < 100) throw new Error("Image too small");
          await client.sendMessage(remoteJid, { 
            image: imgBuffer, 
            caption: "🎮 *" + gt.name + "*\\n❤️ Nyawa: 3/3 | ⏱️ " + timeStr + "\\n🔤 Jumlah huruf: " + (d.letterCount || "?") + "\\n\\n❓ Tebak objek apa ini?\\n✏️ Ketik jawabanmu langsung atau !jawab [jawaban]\\n💡 Minta petunjuk: !hint (1 kredit)\\n🏳️ Menyerah? Ketik !nyerah" 
          }, { quoted: msg });
          return;
        } catch (e) {
          console.error("Failed to send image:", e?.message || e);
          txt += "🖼️ Gambar gagal dikirim.\\n";
          if (d.letterCount) txt += "🔤 Jumlah huruf: " + d.letterCount + "\\n";
          if (d.hints?.[0]) txt += "💡 Petunjuk: " + d.hints[0] + "\\n";
        }
      }

      // Different format per game type
      if (d.riddle || d.question || d.pertanyaan) {
        txt += "❓ *Soal:* " + (d.riddle || d.question || d.pertanyaan) + "\\n";
        if (d.options) { d.options.forEach((o, i) => { txt += "\\n" + ["A", "B", "C", "D"][i] + ". " + o; }); txt += "\\n"; }
        if (d.hints?.length) { txt += "\\n💡 *Petunjuk pertama:*\\n" + d.hints[0] + "\\n"; }
      } else if (d.word || d.kata) {
        txt += "🔤 Kata: " + (d.word || d.kata) + "\\n";
        if (d.hint || d.petunjuk) txt += "💡 Petunjuk: " + (d.hint || d.petunjuk) + "\\n";
      } else if (d.letterCount) {
        txt += "🔤 Jumlah huruf: " + d.letterCount + "\\n";
        if (d.hints?.[0]) txt += "💡 Petunjuk: " + d.hints[0] + "\\n";
      } else {
        txt += JSON.stringify(d, null, 2).slice(0, 300);
      }
      txt += "\\n\\n✏️ Ketik jawabanmu langsung atau !jawab [jawaban]\\n💡 Petunjuk: !hint (1 kredit) | 🏳️ !nyerah";
      return reply(txt);
    }

    // ═══ LEADERBOARD GAME ═══
    if (command === "!lbgame") {
      const res = await api("game_leaderboard");
      if (!res.data?.length) return reply("🏆 Belum ada data leaderboard game.");
      // Aggregate by visitor
      const agg = {};
      res.data.forEach((s) => {
        if (!agg[s.visitor_id]) agg[s.visitor_id] = { username: s.username, points: 0, wins: 0, losses: 0 };
        agg[s.visitor_id].points += s.points;
        agg[s.visitor_id].wins += s.wins;
        agg[s.visitor_id].losses += s.losses;
      });
      const sorted = Object.values(agg).sort((a, b) => b.points - a.points).slice(0, 10);
      const list = sorted.map((u, i) => (i+1) + ". " + u.username + " — " + u.points + " pts (W" + u.wins + "/L" + u.losses + ")").join("\\n");
      return reply("🏆 *Leaderboard Game:*\\n\\n" + list);
    }

    // ═══ TAMPILKAN NO HP PENGIRIM ═══
    if (command === "!nomorku") {
      const phoneNum = remoteJid.replace("@s.whatsapp.net", "");
      return reply("📱 *Nomor WA Kamu:*\\n\\n" + phoneNum);
    }

    // ═══════════════════════════════════════
    // ═══ ADMIN COMMANDS ═══
    // ═══════════════════════════════════════
    if (command === "!admin") {
      if (!isAdmin(msg)) return reply("❌ Hanya admin yang bisa akses.");
      return reply([
        "🔐 *Perintah Admin v8.0.0:*",
        "",
        "💡 Semua perintah admin sekarang pakai *username* bukan visitor_id!",
        "",
        "💰 *Saldo:*",
        "• !saldo — Semua saldo user",
        "• !tambahsaldo [username] [jumlah] — Tambah saldo",
        "• !kurangsaldo [username] [jumlah] — Kurangi saldo",
        "• !setsaldo [username] [jumlah] — Set saldo",
        "• !resetsaldo [username] — Reset saldo ke 0",
        "",
        "🏦 *Deposit:*",
        "• !deposit — Riwayat deposit",
        "• !setdeposit [id] [status] — Ubah status deposit",
        "• !rekapdeposit — Rekap deposit",
        "",
        "🎮 *Game:*",
        "• !game [username] — Stats game user",
        "• !kredit [username] — Kredit game user",
        "• !setkredit [username] [jumlah] — Set kredit",
        "• !resetkredit [username] — Reset kredit",
        "• !resetgame [username] — Reset game stats",
        "• !leaderboardadmin — Leaderboard detail",
        "",
        "🔥 *Streak:*",
        "• !streak [username] — Status streak",
        "• !setstreak [username] [jumlah] — Set streak",
        "• !resetstreak [username] — Reset streak",
        "• !streaksub [username] — Langganan streak",
        "",
        "📦 *Produk & Sponsor:*",
        "• !stok [id] [jumlah] — Stok produk",
        "• !stoksponsor [id] [jumlah] — Stok sponsor",
        "",
        "👥 *User:*",
        "• !user [nama] — Cari user",
        "• !alluser — Semua user",
        "• !topuser — Top user saldo",
        "• !detailuser [username] — Detail lengkap",
        "• !loginhistory [username] — Riwayat login",
        "• !transaksi [username] — Riwayat transaksi",
        "",
        "🎵 *Musik:*",
        "• !musikprofil [username] — Profil musik",
        "• !storage [username] — Storage musik",
        "• !resetstorage [username] — Reset storage",
        "",
        "📊 *Lainnya:*",
        "• !profil [username] — Profil game",
        "• !follow — Stats follow",
        "• !tiket — Tiket support",
        "• !settiket [id] [status] — Status tiket",
        "• !tiketdetail [id] — Detail tiket",
        "• !chat — Chat produk",
        "• !notif [username] [isi] — Kirim notif",
        "• !broadcast [judul] | [isi] — Broadcast",
        "• !hapusnotif [username] — Hapus notif user",
        "• !likes — Stats likes",
        "• !dashboard — Dashboard ringkas",
        "• !report — Laporan",
        "• !aktivitas — Aktivitas terbaru",
        "• !token — Daftar token",
        "• !tokendetail [id] — Detail token",
      ].join("\\n"));
    }

    // ── ADMIN: SALDO (username-based) ──
    if (command === "!saldo") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("balances");
      if (!res.data?.length) return reply("💰 Tidak ada data saldo.");
      const list = res.data.slice(0, 20).map((u, i) => (i+1) + ". " + u.username + " — " + fmtRp(u.balance)).join("\\n");
      return reply("💰 *Semua Saldo:*\\n\\n" + list + (res.data.length > 20 ? "\\n\\n...dan " + (res.data.length - 20) + " lainnya" : ""));
    }

    if (command.startsWith("!tambahsaldo")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !tambahsaldo [username] [jumlah]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("add_balance", "POST", { visitor_id: user.visitor_id, amount: Number(args[1]), description: "Top up via bot admin" });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Saldo *" + user.username + "* ditambah " + fmtRp(args[1]) + "\\nSaldo baru: " + fmtRp(res.data?.new_balance));
    }

    if (command.startsWith("!kurangsaldo")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !kurangsaldo [username] [jumlah]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("deduct_balance", "POST", { visitor_id: user.visitor_id, amount: Number(args[1]), description: "Potong via bot admin" });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Saldo *" + user.username + "* dikurangi " + fmtRp(args[1]) + "\\nSaldo baru: " + fmtRp(res.data?.new_balance));
    }

    if (command.startsWith("!setsaldo")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !setsaldo [username] [jumlah]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("set_balance", "POST", { visitor_id: user.visitor_id, balance: Number(args[1]) });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Saldo *" + user.username + "* diset ke " + fmtRp(args[1]) + "\\n(Sebelumnya: " + fmtRp(res.data?.old_balance) + ")");
    }

    if (command.startsWith("!resetsaldo")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !resetsaldo [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("reset_balance", "POST", { visitor_id: user.visitor_id });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Saldo *" + user.username + "* direset ke Rp 0 (sebelumnya: " + fmtRp(res.data?.old_balance) + ")");
    }

    // ── ADMIN: DEPOSIT ──
    if (command === "!deposit") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("deposits");
      if (!res.data?.length) return reply("🏦 Tidak ada deposit.");
      const list = res.data.slice(0, 15).map((d, i) => (i+1) + ". " + d.username + " — " + fmtRp(d.amount) + " [" + d.status + "] " + d.payment_method + "\\n   🆔 " + d.trx_id).join("\\n");
      return reply("🏦 *Riwayat Deposit:*\\n\\n" + list);
    }

    if (command.startsWith("!setdeposit")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !setdeposit [deposit_id/trx_id] [status]");
      const res = await api("set_deposit_status", "POST", { deposit_id: args[0], status: args[1] });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Deposit diubah ke: " + args[1]);
    }

    if (command === "!rekapdeposit") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("deposits");
      const deps = res.data || [];
      const pending = deps.filter((d) => d.status === "pending");
      const approved = deps.filter((d) => d.status === "approved");
      const totalAll = deps.reduce((s, d) => s + d.amount, 0);
      return reply("🏦 *Rekap Deposit:*\\n\\n📊 Total: " + deps.length + "\\n⏳ Pending: " + pending.length + "\\n✅ Approved: " + approved.length + "\\n💰 Total Amount: " + fmtRp(totalAll));
    }

    // ── ADMIN: TOKEN ──
    if (command === "!token") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("tokens");
      if (!res.data?.length) return reply("🎫 Tidak ada token.");
      const list = res.data.slice(0, 15).map((t, i) => (i+1) + ". " + t.token_code + " [" + (t.is_claimed ? "Claimed" : "Available") + "] — " + (t.products?.title || "?")).join("\\n");
      return reply("🎫 *Daftar Token:*\\n\\n" + list);
    }

    if (command.startsWith("!tokendetail")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !tokendetail [token_id/code]");
      const res = await api("tokens");
      const t = (res.data || []).find((x) => x.id === args[0] || x.token_code === args[0]);
      if (!t) return reply("❌ Token tidak ditemukan.");
      return reply("🎫 *Token:* " + t.token_code + "\\n📦 Produk: " + (t.products?.title || "-") + "\\n📌 Status: " + (t.is_claimed ? "Claimed" : "Available") + "\\n📅 Dibuat: " + new Date(t.created_at).toLocaleString("id-ID"));
    }

    // ── ADMIN: GAME (username-based) ──
    if (command.startsWith("!game ") || (command === "!game" && args[0])) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !game [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("game_stats&visitor_id=" + user.visitor_id);
      if (!res.data?.length) return reply("🎮 " + user.username + " belum punya stats game.");
      const list = res.data.map((g) => "• " + g.game_type + ": W" + g.wins + "/L" + g.losses + " | Pts:" + g.points + " | Q:" + g.total_questions).join("\\n");
      return reply("🎮 *Game Stats " + user.username + ":*\\n\\n" + list);
    }

    if (command.startsWith("!kredit")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !kredit [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("game_credits&visitor_id=" + user.visitor_id);
      if (!res.data?.length) return reply("💎 " + user.username + " belum punya kredit game.");
      const c = res.data[0];
      return reply("💎 *Kredit Game " + user.username + ":*\\n\\nKredit: " + c.credits + (c.unlimited_until ? "\\n♾️ Unlimited sampai: " + new Date(c.unlimited_until).toLocaleString("id-ID") : ""));
    }

    if (command.startsWith("!setkredit")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !setkredit [username] [jumlah]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("set_credits", "POST", { visitor_id: user.visitor_id, credits: Number(args[1]) });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Kredit game *" + user.username + "* diset ke " + args[1]);
    }

    if (command.startsWith("!resetkredit")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !resetkredit [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("reset_credits", "POST", { visitor_id: user.visitor_id });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Kredit game *" + user.username + "* direset ke 0");
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

    if (command === "!leaderboardadmin") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const [bal, gs] = await Promise.all([api("balances"), api("game_stats")]);
      const sorted = (bal.data || []).sort((a, b) => b.balance - a.balance).slice(0, 10);
      let txt = "🏆 *Leaderboard Admin:*\\n\\n💰 *Top Saldo:*\\n";
      txt += sorted.map((u, i) => (i+1) + ". " + u.username + " — " + fmtRp(u.balance)).join("\\n");
      const gsSorted = (gs.data || []).sort((a, b) => b.points - a.points).slice(0, 5);
      if (gsSorted.length) {
        // Map game stats visitor_id to username
        const users = bal.data || [];
        txt += "\\n\\n🎮 *Top Game Points:*\\n" + gsSorted.map((g, i) => {
          const u = users.find((x) => x.visitor_id === g.visitor_id);
          return (i+1) + ". " + (u ? u.username : g.visitor_id.slice(0,8)) + " — " + g.points + " pts (" + g.game_type + ")";
        }).join("\\n");
      }
      return reply(txt);
    }

    // ── ADMIN: STREAK (username-based) ──
    if (command.startsWith("!streak") && !command.startsWith("!streaksub") && !command.startsWith("!streakku")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !streak [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("streaks&visitor_id=" + user.visitor_id);
      if (!res.data?.length) return reply("🔥 " + user.username + " belum punya data streak.");
      const s = res.data[0];
      return reply("🔥 *Streak " + user.username + ":*\\n\\nStreak: " + s.current_streak + " hari\\nTerpanjang: " + s.longest_streak + "\\nTotal claim: " + s.total_claims + "\\nTerakhir: " + s.last_claim_date);
    }

    if (command.startsWith("!setstreak")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !setstreak [username] [jumlah]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("set_streak", "POST", { visitor_id: user.visitor_id, current_streak: Number(args[1]) });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Streak *" + user.username + "* diset ke " + args[1] + " hari");
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

    if (command.startsWith("!streaksub")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const uname = args[0];
      let ep = "streak_subs";
      if (uname) {
        const user = await resolveVid(uname);
        if (!user) return reply("❌ User '" + uname + "' tidak ditemukan.");
        ep = "streak_subs&visitor_id=" + user.visitor_id;
      }
      const res = await api(ep);
      if (!res.data?.length) return reply("🔥 Tidak ada langganan streak.");
      const list = res.data.slice(0, 10).map((s, i) => (i+1) + ". " + s.plan_name + " [" + (s.is_active ? "Aktif" : "Expired") + "] — " + fmtRp(s.price_paid)).join("\\n");
      return reply("🔥 *Langganan Streak:*\\n\\n" + list);
    }

    // ── ADMIN: STOK ──
    if (command.startsWith("!stok ") && !command.startsWith("!stoksponsor")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !stok [product_id] [jumlah]");
      const res = await api("update_stock", "POST", { product_id: args[0], stock: Number(args[1]) });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Stok produk diubah ke " + args[1]);
    }

    if (command.startsWith("!stoksponsor")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !stoksponsor [sponsor_id] [jumlah]");
      const res = await api("update_sponsor_stock", "POST", { sponsor_id: args[0], stock: Number(args[1]) });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Stok sponsor diubah ke " + args[1]);
    }

    // ── ADMIN: USER (username-based) ──
    if (command.startsWith("!user ")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const q = args.join(" ").toLowerCase();
      const res = await api("balances");
      const found = (res.data || []).filter((u) => u.username.toLowerCase().includes(q) || (u.phone || "").includes(q) || (u.email || "").toLowerCase().includes(q));
      if (!found.length) return reply("❌ User '" + q + "' tidak ditemukan.");
      const list = found.slice(0, 10).map((u, i) => (i+1) + ". " + u.username + " — " + fmtRp(u.balance) + "\\n   📞 " + u.phone + " | 📧 " + (u.email || "-")).join("\\n");
      return reply("👥 *Hasil Cari:*\\n\\n" + list);
    }

    if (command === "!alluser") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("balances");
      if (!res.data?.length) return reply("👥 Belum ada user.");
      return reply("👥 *Total User: " + res.data.length + "*\\n\\n" + res.data.slice(0, 20).map((u, i) => (i+1) + ". " + u.username + " — " + fmtRp(u.balance)).join("\\n") + (res.data.length > 20 ? "\\n\\n...dan " + (res.data.length - 20) + " lainnya" : ""));
    }

    if (command === "!topuser") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("balances");
      const sorted = (res.data || []).sort((a, b) => b.balance - a.balance).slice(0, 10);
      const list = sorted.map((u, i) => (i+1) + ". " + u.username + " — " + fmtRp(u.balance)).join("\\n");
      return reply("🏆 *Top User Saldo:*\\n\\n" + list);
    }

    if (command.startsWith("!detailuser")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !detailuser [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const vid = user.visitor_id;
      const [gs, gc, st, stor] = await Promise.all([
        api("game_stats&visitor_id=" + vid), api("game_credits&visitor_id=" + vid),
        api("streaks&visitor_id=" + vid), api("storage&visitor_id=" + vid),
      ]);
      let txt = "👤 *Detail User:*\\n\\n📛 " + user.username + "\\n📞 " + user.phone + "\\n📧 " + (user.email || "-") + "\\n💰 Saldo: " + fmtRp(user.balance);
      if (gc.data?.[0]) txt += "\\n💎 Kredit: " + gc.data[0].credits;
      if (st.data?.[0]) txt += "\\n🔥 Streak: " + st.data[0].current_streak + " hari";
      if (gs.data?.length) {
        let totalP = 0; gs.data.forEach((g) => totalP += g.points);
        txt += "\\n🎮 Game: " + gs.data.length + " tipe | " + totalP + " total pts";
      }
      if (stor.data?.length) txt += "\\n💾 Storage: " + stor.data.reduce((s, x) => s + x.storage_mb, 0) + " MB";
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
      const list = res.data.slice(0, 10).map((l, i) => (i+1) + ". " + new Date(l.logged_in_at).toLocaleString("id-ID") + "\\n   🌐 " + (l.browser || "?") + " | 📍 " + (l.ip_address || "?")).join("\\n");
      return reply("📋 *Riwayat Login:*\\n\\n" + list);
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
        return (i+1) + ". [" + t.type + "] " + fmtRp(t.amount) + " — " + (t.description || "-") + "\\n   📅 " + date + (t.trx_id ? " | 🆔 " + t.trx_id : "");
      }).join("\\n");
      return reply("📋 *Riwayat Transaksi:*\\n\\n" + list);
    }

    // ── ADMIN: MUSIK (username-based) ──
    if (command.startsWith("!musikprofil")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      let ep = "music_profiles";
      if (args[0]) {
        const user = await resolveVid(args[0]);
        if (user) ep = "music_profiles&visitor_id=" + user.visitor_id;
      }
      const res = await api(ep);
      if (!res.data?.length) return reply("🎵 Tidak ada profil musik.");
      const list = res.data.slice(0, 10).map((m, i) => (i+1) + ". " + m.username + (m.description ? " — " + m.description : "")).join("\\n");
      return reply("🎵 *Profil Musik:*\\n\\n" + list);
    }

    if (command.startsWith("!storage") && !command.startsWith("!stok")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !storage [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("storage&visitor_id=" + user.visitor_id);
      if (!res.data?.length) return reply("💾 " + user.username + " belum punya storage.");
      const total = res.data.reduce((s, x) => s + x.storage_mb, 0);
      return reply("💾 *Storage Musik " + user.username + ":*\\n\\nTotal: " + total + " MB\\nVoucher: " + res.data.length + " kali redeem");
    }

    if (command.startsWith("!resetstorage")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !resetstorage [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("reset_storage", "POST", { visitor_id: user.visitor_id });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Storage musik *" + user.username + "* direset");
    }

    if (command.startsWith("!profil") && !command.startsWith("!profilku")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !profil [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("game_profiles&visitor_id=" + user.visitor_id);
      if (!res.data?.length) return reply("👤 " + user.username + " belum punya profil game.");
      const p = res.data[0];
      return reply("👤 *Profil Game " + user.username + ":*\\n\\n📛 " + p.display_name + "\\n📝 " + (p.description || "-") + "\\n👻 Guest: " + (p.is_guest ? "Ya" : "Tidak"));
    }

    // ── ADMIN: OTHER ──
    if (command === "!follow") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const [uf, gf] = await Promise.all([api("follows"), api("game_follows")]);
      return reply("👥 *Stats Follow:*\\n\\nUser follows: " + (uf.data?.length || 0) + "\\nGame follows: " + (gf.data?.length || 0));
    }

    if (command === "!tiket") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("tickets");
      if (!res.data?.length) return reply("🎫 Tidak ada tiket.");
      const list = res.data.slice(0, 10).map((t, i) => (i+1) + ". #" + t.ticket_number + " [" + t.status + "] " + t.name + " — " + t.category).join("\\n");
      return reply("🎫 *Tiket Support:*\\n\\n" + list);
    }

    if (command.startsWith("!settiket")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (args.length < 2) return reply("⚠️ Gunakan: !settiket [ticket_id] [status]");
      const res = await api("set_ticket_status", "POST", { ticket_id: args[0], status: args[1] });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ Tiket diubah ke: " + args[1]);
    }

    if (command.startsWith("!tiketdetail")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !tiketdetail [ticket_id/nomor]");
      const res = await api("tickets");
      const t = (res.data || []).find((x) => x.id === args[0] || String(x.ticket_number) === args[0]);
      if (!t) return reply("❌ Tiket tidak ditemukan.");
      return reply("🎫 *Tiket #" + t.ticket_number + "*\\n\\n📛 " + t.name + "\\n📞 " + t.phone + "\\n📂 " + t.category + "\\n📌 Status: " + t.status + "\\n📝 " + t.description + "\\n📅 " + new Date(t.created_at).toLocaleString("id-ID"));
    }

    if (command === "!chat") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("chats");
      if (!res.data?.length) return reply("💬 Tidak ada chat produk.");
      const list = res.data.slice(0, 10).map((c, i) => (i+1) + ". " + c.visitor_name + " [" + c.status + "] — " + (c.product_chat_messages?.length || 0) + " pesan").join("\\n");
      return reply("💬 *Chat Produk:*\\n\\n" + list);
    }

    if (command.startsWith("!notif ")) {
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

    if (command.startsWith("!hapusnotif")) {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      if (!args[0]) return reply("⚠️ Gunakan: !hapusnotif [username]");
      const user = await resolveVid(args[0]);
      if (!user) return reply("❌ User '" + args[0] + "' tidak ditemukan.");
      const res = await api("delete_notifications", "POST", { visitor_id: user.visitor_id });
      if (res.error) return reply("❌ " + res.error);
      return reply("✅ " + (res.data?.deleted || 0) + " notifikasi *" + user.username + "* dihapus");
    }

    if (command === "!likes") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("likes");
      const d = res.data || {};
      return reply("❤️ *Stats Likes:*\\n\\n📦 Produk: " + d.products + "\\n🎵 Lagu: " + d.songs + "\\n🏪 Sponsor: " + d.sponsors);
    }

    if (command === "!dashboard") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const res = await api("dashboard");
      const d = res.data || {};
      return reply("📊 *Dashboard Admin:*\\n\\n📦 Produk: " + d.products + "\\n👥 User: " + d.users + "\\n🎵 Lagu: " + d.songs + "\\n🏪 Sponsor: " + d.sponsors + "\\n🏦 Deposit: " + d.deposits + "\\n🎫 Tiket: " + d.tickets + "\\n🎤 Artis: " + d.artists + "\\n🎵 Publik: " + d.public_songs + "\\n💰 Total Saldo: " + fmtRp(d.total_balance));
    }

    if (command === "!report" || command === "!aktivitas") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      const [dash, deps, tix] = await Promise.all([api("dashboard"), api("deposits"), api("tickets")]);
      const d = dash.data || {};
      const recentDeps = (deps.data || []).slice(0, 5);
      const recentTix = (tix.data || []).slice(0, 5);
      let txt = "📋 *Laporan:*\\n\\n📊 " + d.products + " produk, " + d.users + " user, " + d.songs + " lagu\\n💰 Total saldo: " + fmtRp(d.total_balance);
      if (recentDeps.length) { txt += "\\n\\n🏦 *Deposit Terbaru:*\\n" + recentDeps.map((d) => "• " + d.username + " " + fmtRp(d.amount) + " [" + d.status + "]").join("\\n"); }
      if (recentTix.length) { txt += "\\n\\n🎫 *Tiket Terbaru:*\\n" + recentTix.map((t) => "• #" + t.ticket_number + " " + t.name + " [" + t.status + "]").join("\\n"); }
      return reply(txt);
    }

    if (command === "!backup") {
      if (!isAdmin(msg)) return reply("❌ Akses ditolak.");
      return reply("💾 *Info Backup:*\\n\\nData tersimpan di Lovable Cloud (auto-backup).\\nSession bot: folder auth_session/\\nUntuk backup manual, download data dari dashboard admin.");
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
`;
  }

  function generatePackageJson() {
    return JSON.stringify({
      name: "bot-wa-agungadi",
        version: "8.0.0",
        description: "Bot WhatsApp Agung Adi Store - Full Feature: Game AI, Tiket, Like, Klaim, Kirim Lagu",
      main: "index.js",
      scripts: {
        start: "node index.js",
        dev: "node index.js"
      },
      dependencies: {
        "@whiskeysockets/baileys": "^6.7.16",
        "pino": "^9.6.0",
        "qrcode-terminal": "^0.12.0"
      },
      engines: {
        node: ">=18.0.0"
      }
    }, null, 2);
  }

  function generateReadmeMd() {
    return `# 🤖 Bot WhatsApp - Agung Adi Store v8.0.0

## 📋 Persyaratan
- Node.js >= 18
- NPM / Yarn

## 🚀 Cara Install

### Lokal / VPS
${"```"}bash
npm install
node index.js
${"```"}

### Panel Pterodactyl
1. Buat server baru dengan **Egg Node.js** (versi 18+)
2. Upload semua file (index.js, package.json, README.md) ke server
3. Set **Startup Command**: npm start
4. Start server lalu pilih metode login
5. Ketik **1** untuk scan QR atau **2** untuk pairing nomor WhatsApp
6. Jika pilih pairing, masukkan nomor WA lalu tekan Enter
7. Kode login muncul di console dan biasanya berlaku sekitar 30 detik
8. Buka WhatsApp > Linked Devices > Link with phone number lalu masukkan kode
9. Jika koneksi awal putus, bot akan reconnect otomatis dan menampilkan QR / kode baru

## 📲 Login WhatsApp
Bot mendukung **2 mode login**:
- **1. Scan QR** → QR muncul di terminal
- **2. Pairing nomor** → masukkan nomor WA lalu kode 8 digit muncul di terminal
- Kode pairing tidak dikirim lewat chat / notif WhatsApp
- Kode pairing biasanya berlaku sekitar 30 detik
- Sesi tersimpan di folder auth_session/
- Jika koneksi awal putus, bot akan reconnect otomatis sampai 8x

## 🔄 Reset Sesi
Jika bot error, logout, atau koneksi close saat pairing:
${"```"}bash
rm -rf auth_session
node index.js
${"```"}

## 📌 Konfigurasi
- API_KEY — API Key dari dashboard admin
- DEFAULT_PAIRING_PHONE — Nomor default pairing opsional (format: 628xxx)
- ADMIN_NUMBERS — Daftar nomor admin

## 📱 Perintah
Kirim !help di chat untuk melihat semua perintah.

---
_© 2026 Agung Adi Store_
`;
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/public-api`;

  const setupSteps = `# =============================================
# 🛠️ PANDUAN SETUP BOT WHATSAPP (Step by Step)
# =============================================

# LANGKAH 1: Install Node.js
# Download dari: https://nodejs.org (pilih LTS)
# Cek instalasi:
node --version
npm --version

# LANGKAH 2: Buat folder project
mkdir bot-wa-agungadi
cd bot-wa-agungadi

# LANGKAH 3: Upload file hasil download
# Upload: index.js, package.json, README.md

# LANGKAH 4: Install dependencies
npm install

# LANGKAH 5: Jalankan bot
node index.js

# LANGKAH 6: Pilih metode login
# 1 = Scan QR
# 2 = Pairing nomor WhatsApp
# Jika pilih 2, masukkan nomor WA lalu Enter
# Kode login muncul di terminal / console panel
# Buka WhatsApp > Linked Devices > Link with phone number
# Masukkan kode yang tampil (biasanya berlaku sekitar 30 detik)

# LANGKAH 7: Test bot
# Kirim pesan "!help" ke nomor WA yang terhubung
# Bot akan membalas dengan daftar perintah

# =============================================
# ⚠️ CATATAN PENTING:
# =============================================
# - Jangan tutup terminal selama bot berjalan
# - Untuk menjalankan di background, gunakan:
#   npm install -g pm2
#   pm2 start index.js --name "wa-bot"
#   pm2 save
#   pm2 startup
#
# - Jika pairing gagal / koneksi close, hapus folder auth_session
#   lalu jalankan ulang: node index.js
#
# - Pastikan internet stabil
# - Jangan gunakan nomor WA utama untuk testing
# =============================================`;

  const activeKeys = keys.filter((k) => k.is_active);
  const selectedDownloadKey = activeKeys.find((k) => k.id === downloadKeyId) ?? null;

  return (
    <div className="space-y-3">
      {/* Buat API Key */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" /> Buat API Key Baru
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="Nama API Key (misal: Bot WA)"
            value={keyName}
            onChange={e => setKeyName(e.target.value)}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-2" onClick={createKey}>
              <Plus className="w-4 h-4" /> Buat Key
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowUsage(true)}>
              <BookOpen className="w-3.5 h-3.5" /> Panduan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List API Keys */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">API Keys ({keys.length})</h3>
      </div>

      {keys.map(k => (
        <Card key={k.id} className={!k.is_active ? "opacity-50" : ""}>
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm truncate flex-1">{k.key_name}</p>
              <div className="flex gap-0.5 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Download ZIP 3 file" onClick={() => downloadBotFile(k.api_key, k.key_name)}>
                  <Download className="w-3.5 h-3.5 text-primary" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleKey(k)}>
                  {k.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteKey(k.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <code className="text-[10px] bg-muted px-2 py-1 rounded font-mono break-all flex-1">
                {visibleKeys.has(k.id) ? k.api_key : maskKey(k.api_key)}
              </code>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => toggleVisibility(k.id)}>
                {visibleKeys.has(k.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copyKey(k.api_key, k.id)}>
                {copiedId === k.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-2">
              <span>{new Date(k.created_at).toLocaleDateString("id-ID")}</span>
              {k.last_used_at && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(k.last_used_at).toLocaleDateString("id-ID")}
                </span>
              )}
              <span className={k.is_active ? "text-green-600" : "text-destructive"}>
                {k.is_active ? "● Aktif" : "● Nonaktif"}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
      {keys.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-6">Belum ada API Key. Buat satu untuk mulai.</p>
      )}

      {/* Download Bot Script Section */}
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" /> Download Script Bot WA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Pilih API Key aktif. Nanti terdownload ZIP berisi index.js, package.json, dan README.md.
          </p>

          {/* Pilih dari API Key yang ada */}
          {activeKeys.length > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold">Pilih API Key:</label>
              <Select value={downloadKeyId} onValueChange={setDownloadKeyId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="-- Pilih API Key --" />
                </SelectTrigger>
                <SelectContent>
                  {activeKeys.map(k => (
                    <SelectItem key={k.id} value={k.id} className="text-xs">
                      {k.key_name} — {k.api_key.substring(0, 10)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {activeKeys.length === 0 && (
            <p className="text-[10px] text-muted-foreground">
              Belum ada API Key aktif. Buat atau aktifkan API Key dulu, lalu download ZIP dari tombol pada list key.
            </p>
          )}

          {/* Input nomor HP untuk pairing */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold flex items-center gap-1">
              <Phone className="w-3 h-3" /> Nomor default pairing (opsional):
            </label>
            <Input
              placeholder="628xxxxxxxxxx"
              value={pairingPhone}
              onChange={e => setPairingPhone(e.target.value)}
              className="text-xs font-mono h-8"
            />
            <p className="text-[10px] text-muted-foreground">
              Nomor ini jadi default saat pilih mode pairing. Saat bot jalan tetap pilih 1 (QR) atau 2 (pairing).
            </p>
          </div>

          {/* Preview */}
          {selectedDownloadKey && (
            <div className="bg-muted rounded p-2 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground">API Key yang akan masuk di index.js:</p>
              <code className="text-[10px] font-mono text-primary break-all">{selectedDownloadKey.api_key}</code>
              {pairingPhone && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground mt-1">Nomor Default Pairing:</p>
                  <code className="text-[10px] font-mono text-primary">{pairingPhone}</code>
                </>
              )}
            </div>
          )}

          <Button
            size="sm"
            className="w-full gap-2"
            disabled={!selectedDownloadKey}
            onClick={() => selectedDownloadKey && downloadBotFile(selectedDownloadKey.api_key, selectedDownloadKey.key_name)}
          >
            <Download className="w-4 h-4" /> Download ZIP 3 File
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            📲 Jalankan <code className="bg-muted px-1 rounded">npm install</code> lalu <code className="bg-muted px-1 rounded">node index.js</code> — lalu pilih 1 (QR) atau 2 (pairing nomor)
          </p>
        </CardContent>
      </Card>

      {/* Dialog Panduan Lengkap */}
      <Dialog open={showUsage} onOpenChange={setShowUsage}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              📖 Panduan API & Bot WhatsApp
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-8">
              <TabsTrigger value="setup" className="text-[11px]">🛠️ Setup</TabsTrigger>
              <TabsTrigger value="botcode" className="text-[11px]">🤖 Kode Bot</TabsTrigger>
              <TabsTrigger value="api" className="text-[11px]">📡 API Ref</TabsTrigger>
            </TabsList>

            {/* TAB: Setup Guide */}
            <TabsContent value="setup" className="space-y-3 mt-3">
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs font-bold text-primary">🚀 Cara Setup Bot WA (5 Menit)</p>
                  <div className="space-y-3">
                    {[
                      { step: "1", title: "Install Node.js", desc: "Download dari nodejs.org (pilih LTS v18+), lalu install." },
                      { step: "2", title: "Download file", desc: "Download ZIP dari panel di atas lalu extract: index.js, package.json, dan README.md." },
                      { step: "3", title: "Install dependencies", desc: "Buka terminal di folder project, ketik: npm install" },
                      { step: "4", title: "Jalankan bot", desc: "Di terminal, ketik: node index.js" },
                      { step: "5", title: "Pilih metode", desc: "Pilih 1 untuk scan QR atau 2 untuk pairing nomor WhatsApp." },
                      { step: "6", title: "Login ke WhatsApp", desc: "Kalau pilih pairing, masukkan nomor WA lalu Enter. Kode muncul di terminal dan biasanya berlaku sekitar 30 detik." },
                    ].map(s => (
                      <div key={s.step} className="flex gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {s.step}
                        </span>
                        <div>
                          <p className="text-xs font-semibold">{s.title}</p>
                          <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs font-bold">📋 Command Terminal:</p>
              <pre className="text-[10px] bg-muted p-2 rounded font-mono whitespace-pre-wrap leading-relaxed">
{`npm install
node index.js`}
              </pre>
              <Button size="sm" variant="outline" className="w-full gap-2 text-xs" onClick={() => copyText("npm install && node index.js", "Command")}>
                <Copy className="w-3 h-3" /> Salin Command
              </Button>

              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-3">
                  <p className="text-xs font-bold text-yellow-700">⚠️ Tips Penting:</p>
                  <ul className="text-[11px] text-muted-foreground space-y-1 mt-1 list-disc pl-3">
                    <li>Jangan tutup terminal saat bot jalan</li>
                    <li>Untuk background: install <code className="bg-muted px-1 rounded">pm2</code> lalu <code className="bg-muted px-1 rounded">pm2 start index.js</code></li>
                    <li>Saat bot jalan, pilih 1 untuk scan QR atau 2 untuk pairing nomor</li>
                        <li>Kode pairing muncul di terminal / panel, bukan lewat notif atau chat WhatsApp</li>
                    <li>Sesi error? Hapus folder <code className="bg-muted px-1 rounded">auth_session</code> lalu jalankan ulang</li>
                    <li>Gunakan nomor WA cadangan untuk testing</li>
                    <li>Pastikan koneksi internet stabil</li>
                    <li>Bot menggunakan Baileys — tidak perlu Chrome/Puppeteer</li>
                  </ul>
                </CardContent>
              </Card>

              <Button size="sm" variant="outline" className="w-full gap-2 text-xs" onClick={() => copyText(setupSteps, "Panduan setup")}>
                <Download className="w-3 h-3" /> Salin Seluruh Panduan Setup
              </Button>
            </TabsContent>

            {/* TAB: Bot Code */}
            <TabsContent value="botcode" className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground">
                Download ZIP dari bagian atas, extract, lalu jalankan file index.js. File sudah lengkap dengan semua perintah.
              </p>

              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-2">
                  <p className="text-[11px] font-bold text-blue-700 mb-1">📌 Perintah USER ({45} perintah):</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span><code>!help</code> — Menu bantuan</span>
                    <span><code>!login</code> — Login akun</span>
                    <span><code>!logout</code> — Logout akun</span>
                    <span><code>!saldoku</code> — Cek saldo</span>
                    <span><code>!profilku</code> — Profil lengkap</span>
                    <span><code>!riwayat</code> — Riwayat transaksi</span>
                    <span><code>!detailtrx</code> — Detail transaksi</span>
                    <span><code>!gameku</code> — Stats game</span>
                    <span><code>!kreditku</code> — Kredit game</span>
                    <span><code>!streakku</code> — Status streak</span>
                    <span><code>!notifku</code> — Notifikasi</span>
                    <span><code>!beli [nama]</code> — Beli produk</span>
                    <span><code>!belistreak</code> — Beli streak</span>
                    <span><code>!belikredit</code> — Beli kredit</span>
                    <span><code>!belistorage</code> — Beli storage</span>
                    <span><code>!belibundle</code> — Beli bundle</span>
                    <span><code>!setpin</code> — Set PIN sesi</span>
                    <span><code>!grosir [nama]</code> — Harga grosir</span>
                    <span><code>!flashsale</code> — Info flash sale</span>
                    <span><code>!produk</code> — Daftar produk</span>
                    <span><code>!cari [kata]</code> — Cari produk</span>
                    <span><code>!sponsor</code> — Sponsor aktif</span>
                    <span><code>!lagu</code> — Daftar lagu</span>
                    <span><code>!carilagu [kata]</code> — Cari lagu</span>
                    <span><code>!download [judul]</code> — Download lagu</span>
                    <span><code>!artis</code> — Daftar artis</span>
                    <span><code>!playlist</code> — Daftar playlist</span>
                    <span><code>!publik</code> — Lagu publik</span>
                    <span><code>!info</code> — Statistik toko</span>
                    <span><code>!ceksaldo [nama]</code> — Cek saldo</span>
                    <span><code>!cekgame [nama]</code> — Stats game</span>
                    <span><code>!paket</code> — Paket tersedia</span>
                    <span><code>!cekvoucher</code> — Voucher aktif</span>
                    <span><code>!promo</code> — Promo aktif</span>
                    <span><code>!kategori</code> — Kategori</span>
                    <span><code>!harga [min] [max]</code> — Filter</span>
                    <span><code>!random</code> — Produk random</span>
                    <span><code>!top</code> — Terpopuler</span>
                    <span><code>!detailproduk</code> — Detail produk</span>
                    <span><code>!detailsponsor</code> — Detail sponsor</span>
                    <span><code>!detailartis</code> — Detail artis</span>
                    <span><code>!lb</code> — Leaderboard</span>
                    <span><code>!bantuan</code> — FAQ</span>
                    <span><code>!syarat</code> — S&K</span>
                    <span><code>!waktu</code> — Waktu server</span>
                    <span><code>!versi</code> — Info bot</span>
                    <span><code>!ping</code> — Status bot</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="p-2">
                  <p className="text-[11px] font-bold text-red-700 mb-1">🔐 Perintah ADMIN ({52} perintah):</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span><code>!admin</code> — Menu admin</span>
                    <span><code>!saldo</code> — Semua saldo</span>
                    <span><code>!tambahsaldo</code> — Tambah saldo</span>
                    <span><code>!kurangsaldo</code> — Kurangi saldo</span>
                    <span><code>!resetsaldo</code> — Reset saldo</span>
                    <span><code>!setsaldo</code> — Set saldo</span>
                    <span><code>!deposit</code> — Riwayat deposit</span>
                    <span><code>!setdeposit</code> — Ubah status</span>
                    <span><code>!rekapdeposit</code> — Rekap deposit</span>
                    <span><code>!token</code> — Daftar token</span>
                    <span><code>!tokendetail</code> — Detail token</span>
                    <span><code>!game [vid]</code> — Stats game</span>
                    <span><code>!kredit [vid]</code> — Kredit game</span>
                    <span><code>!setkredit</code> — Set kredit</span>
                    <span><code>!resetkredit</code> — Reset kredit</span>
                    <span><code>!resetgame</code> — Reset game stats</span>
                    <span><code>!leaderboardadmin</code> — LB detail</span>
                    <span><code>!streak [vid]</code> — Status streak</span>
                    <span><code>!resetstreak</code> — Reset streak</span>
                    <span><code>!setstreak</code> — Set streak</span>
                    <span><code>!streaksub</code> — Langganan streak</span>
                    <span><code>!storage [vid]</code> — Storage</span>
                    <span><code>!resetstorage</code> — Reset storage</span>
                    <span><code>!profil [vid]</code> — Profil game</span>
                    <span><code>!stok [id] [n]</code> — Stok produk</span>
                    <span><code>!produkdetail</code> — Detail produk</span>
                    <span><code>!sponsordetail</code> — Detail sponsor</span>
                    <span><code>!stoksponsor</code> — Stok sponsor</span>
                    <span><code>!user [nama]</code> — Cari user</span>
                    <span><code>!alluser</code> — Semua user</span>
                    <span><code>!topuser</code> — Top user saldo</span>
                    <span><code>!detailuser</code> — Detail lengkap</span>
                    <span><code>!loginhistory</code> — Riwayat login</span>
                    <span><code>!transaksi</code> — Riwayat trx</span>
                    <span><code>!musikprofil</code> — Profil musik</span>
                    <span><code>!follow</code> — Stats follow</span>
                    <span><code>!tiket</code> — Tiket support</span>
                    <span><code>!settiket</code> — Status tiket</span>
                    <span><code>!tiketdetail</code> — Detail tiket</span>
                    <span><code>!chat</code> — Chat produk</span>
                    <span><code>!notif [isi]</code> — Kirim notif</span>
                    <span><code>!broadcast</code> — Broadcast</span>
                    <span><code>!hapusnotif</code> — Hapus notif</span>
                    <span><code>!likes</code> — Stats likes</span>
                    <span><code>!dashboard</code> — Dashboard</span>
                    <span><code>!report</code> — Laporan harian</span>
                    <span><code>!aktivitas</code> — Aktivitas baru</span>
                    <span><code>!backup</code> — Info backup</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-2">
                  <p className="text-[11px] font-bold text-yellow-700 mb-1">⚙️ Konfigurasi Admin:</p>
                  <p className="text-[10px] text-muted-foreground">
                    Di file index.js, isi array <code className="bg-muted px-1 rounded">ADMIN_NUMBERS</code> dengan nomor WA admin.
                    Format: <code className="bg-muted px-1 rounded">"628xxxxxxxxxx@c.us"</code>.
                    Jika kosong, semua bisa akses perintah admin.
                  </p>
                </CardContent>
              </Card>

              <p className="text-[10px] text-muted-foreground text-center">
                💡 Download ZIP lalu jalankan file index.js yang sudah siap dipakai.
              </p>
            </TabsContent>

            {/* TAB: API Reference */}
            <TabsContent value="api" className="space-y-3 mt-3">
              <div>
                <p className="text-xs font-bold">Base URL:</p>
                <div className="flex items-center gap-1 mt-1">
                  <code className="text-[10px] bg-muted p-1.5 rounded block break-all font-mono flex-1">{baseUrl}</code>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => copyText(baseUrl, "URL")}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold">Header Wajib:</p>
                <code className="text-[10px] bg-muted p-1.5 rounded block font-mono mt-1">x-api-key: YOUR_API_KEY</code>
              </div>

              <div>
                <p className="text-xs font-bold mb-1">Endpoint GET ({[
                  "products", "sponsors", "balances", "songs", "deposits",
                  "notifications", "tokens", "transactions", "streaks",
                  "game_credits", "game_stats", "game_profiles", "tickets",
                  "playlists", "artists", "public_songs", "storage",
                  "vouchers", "packages", "likes", "chats", "streak_subs",
                  "music_profiles", "login_history", "dashboard",
                ].length}):</p>
                <div className="space-y-1">
                  {[
                    { ep: "products", desc: "Semua produk" },
                    { ep: "sponsors", desc: "Sponsor aktif" },
                    { ep: "balances", desc: "Saldo user" },
                    { ep: "songs", desc: "Lagu playlist" },
                    { ep: "deposits", desc: "Riwayat deposit" },
                    { ep: "notifications", desc: "Notifikasi (?visitor_id=xxx)" },
                    { ep: "tokens", desc: "Token & produk" },
                    { ep: "transactions", desc: "Transaksi (?visitor_id=xxx)" },
                    { ep: "streaks", desc: "Data streak (?visitor_id=xxx)" },
                    { ep: "game_credits", desc: "Kredit game (?visitor_id=xxx)" },
                    { ep: "game_stats", desc: "Stats game (?visitor_id=xxx)" },
                    { ep: "game_profiles", desc: "Profil game (?visitor_id=xxx)" },
                    { ep: "tickets", desc: "Tiket support" },
                    { ep: "playlists", desc: "Playlist + items" },
                    { ep: "artists", desc: "Daftar artis" },
                    { ep: "public_songs", desc: "Lagu publik (?visitor_id=xxx)" },
                    { ep: "storage", desc: "Storage musik (?visitor_id=xxx)" },
                    { ep: "vouchers", desc: "Semua voucher (?type=discount/game/streak/music/storage)" },
                    { ep: "packages", desc: "Paket tersedia (?type=credit/streak/storage/bundle)" },
                    { ep: "likes", desc: "Jumlah likes (produk, lagu, sponsor)" },
                    { ep: "chats", desc: "Chat produk + pesan" },
                    { ep: "streak_subs", desc: "Langganan streak (?visitor_id=xxx)" },
                    { ep: "music_profiles", desc: "Profil musik (?visitor_id=xxx)" },
                    { ep: "login_history", desc: "Riwayat login (?visitor_id=xxx)" },
                    { ep: "dashboard", desc: "Statistik lengkap toko" },
                  ].map(e => (
                    <div key={e.ep} className="flex items-start gap-1.5 text-[11px]">
                      <code className="bg-primary/10 text-primary px-1 rounded shrink-0 font-mono text-[10px]">{e.ep}</code>
                      <span className="text-muted-foreground">{e.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold mb-1">Endpoint POST (13):</p>
                <div className="space-y-1">
                  {[
                    { ep: "notifications", desc: "Kirim notifikasi {visitor_id, title, message, type}" },
                    { ep: "add_balance", desc: "Tambah saldo {visitor_id, amount, description}" },
                    { ep: "deduct_balance", desc: "Kurangi saldo {visitor_id, amount, description}" },
                    { ep: "reset_balance", desc: "Reset saldo ke 0 {visitor_id}" },
                    { ep: "reset_credits", desc: "Reset kredit game {visitor_id}" },
                    { ep: "set_credits", desc: "Set kredit {visitor_id, credits}" },
                    { ep: "reset_streak", desc: "Reset streak {visitor_id}" },
                    { ep: "reset_storage", desc: "Reset storage {visitor_id}" },
                    { ep: "update_stock", desc: "Update stok produk {product_id, stock}" },
                    { ep: "broadcast", desc: "Broadcast ke semua {title, message, type}" },
                    { ep: "delete_notifications", desc: "Hapus notif user {visitor_id}" },
                    { ep: "set_deposit_status", desc: "Ubah status deposit {deposit_id, status}" },
                    { ep: "set_ticket_status", desc: "Ubah status tiket {ticket_id, status}" },
                  ].map(e => (
                    <div key={e.ep} className="flex items-start gap-1.5 text-[11px]">
                      <code className="bg-primary/10 text-primary px-1 rounded shrink-0 font-mono text-[10px]">{e.ep}</code>
                      <span className="text-muted-foreground">{e.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold mb-1">Response:</p>
                <pre className="text-[9px] bg-muted p-2 rounded font-mono">{`{
  "success": true,
  "data": [ ... ]
}`}</pre>
              </div>

              <div>
                <p className="text-xs font-bold mb-1">Contoh cURL:</p>
                <pre className="text-[9px] bg-muted p-2 rounded font-mono whitespace-pre-wrap">{`curl -H "x-api-key: YOUR_KEY" \\
  "${baseUrl}?endpoint=products"`}</pre>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] mt-1" onClick={() => copyText(`curl -H "x-api-key: YOUR_KEY" "${baseUrl}?endpoint=products"`, "cURL")}>
                  <Copy className="w-3 h-3 mr-1" /> Salin
                </Button>
              </div>

              <div>
                <p className="text-xs font-bold mb-1">Contoh POST:</p>
                <pre className="text-[9px] bg-muted p-2 rounded font-mono whitespace-pre-wrap">{`curl -X POST \\
  -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"visitor_id":"xxx","amount":10000}' \\
  "${baseUrl}?endpoint=add_balance"`}</pre>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] mt-1" onClick={() => copyText(`curl -X POST -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" -d '{"visitor_id":"xxx","amount":10000}' "${baseUrl}?endpoint=add_balance"`, "cURL POST")}>
                  <Copy className="w-3 h-3 mr-1" /> Salin
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
