import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, Trash2, Check, Eye, EyeOff, Plus, Clock, BookOpen, Download, Bot, ChevronDown, Phone, FileText } from "lucide-react";
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
  const [customApiKey, setCustomApiKey] = useState("");
  const [pairingPhone, setPairingPhone] = useState("");
  const { toast } = useToast();

  useEffect(() => { fetchKeys(); }, []);

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

  function downloadBotFile(apiKey: string, keyName: string) {
    const code = generateBotCode(apiKey);
    const blob = new Blob([code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-wa-${keyName.toLowerCase().replace(/\s+/g, "-")}.js`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "File bot.js berhasil didownload! 🤖" });
  }

  function generateBotCode(apiKey: string, phoneNumber?: string) {
    const phoneConfig = phoneNumber ? `\nconst PAIRING_PHONE = "${phoneNumber.replace(/[^0-9]/g, '')}";` : `\nconst PAIRING_PHONE = ""; // Isi nomor HP untuk pairing, format: 628xxxxxxxxxx`;
    return `// =============================================
// 🤖 BOT WHATSAPP - Agung Adi Store v5.0
// =============================================
// Library: @whiskeysockets/baileys (Pairing Code)
// Cara pakai:
//   1. npm install
//   2. node bot.js
//   3. Masukkan kode 8 digit yang muncul ke WhatsApp
// =============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");

// ✅ API Key sudah otomatis terisi!
const API_KEY = "${apiKey}";
const BASE = "${baseUrl}";
${phoneConfig}

// === KONFIGURASI ADMIN ===
const ADMIN_NUMBERS = [
  // "6285769302532@s.whatsapp.net",
];

function isAdmin(msg) {
  if (ADMIN_NUMBERS.length === 0) return true;
  return ADMIN_NUMBERS.includes(msg.key.remoteJid);
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_session");
  
  const client = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: ["Agung Adi Store Bot", "Chrome", "1.0.0"],
  });

  // Pairing Code (8 digit)
  if (!client.authState.creds.registered) {
    const phoneNum = PAIRING_PHONE || process.argv[2];
    if (!phoneNum) {
      console.log("❌ Masukkan nomor HP untuk pairing!");
      console.log("   Cara: node bot.js 628xxxxxxxxxx");
      console.log("   Atau isi PAIRING_PHONE di file bot.js");
      process.exit(1);
    }
    console.log("\\n📱 Meminta kode pairing untuk: " + phoneNum);
    setTimeout(async () => {
      const code = await client.requestPairingCode(phoneNum);
      console.log("\\n" + "=".repeat(40));
      console.log("  📲 KODE PAIRING (8 DIGIT):");
      console.log("  ➡️  " + code);
      console.log("=".repeat(40));
      console.log("\\n✅ Buka WhatsApp > Linked Devices > Link a Device");
      console.log("   Pilih 'Link with phone number' dan masukkan kode di atas\\n");
    }, 3000);
  }

  client.ev.on("creds.update", saveCreds);

  client.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting...");
        startBot();
      } else {
        console.log("❌ Logged out. Hapus folder auth_session dan jalankan ulang.");
      }
    } else if (connection === "open") {
      console.log("\\n✅ Bot WhatsApp sudah siap! (Baileys)");
      console.log("📋 Kirim !help di chat untuk lihat perintah\\n");
    }
  });

// ━━━ Helper API ━━━
async function apiGet(endpoint) {
  try {
    const res = await fetch(BASE + "?endpoint=" + endpoint, {
      headers: { "x-api-key": API_KEY },
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "API Error");
    return json.data;
  } catch (err) {
    console.error("API Error:", err.message);
    return null;
  }
}

async function apiPost(endpoint, body) {
  try {
    const res = await fetch(BASE + "?endpoint=" + endpoint, {
      method: "POST",
      headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    console.error("API Error:", err.message);
    return null;
  }
}

function rp(n) {
  return "Rp " + Number(n).toLocaleString("id-ID");
}

// ━━━ Handler Pesan ━━━
  client.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const rawText = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
    const text = rawText.toLowerCase();
    const jid = msg.key.remoteJid;
    
    async function reply(t) { await client.sendMessage(jid, { text: t }); }

  // ══════════════════════════════════════
  // 📌 MENU USER (Semua orang bisa akses)
  // ══════════════════════════════════════

  if (text === "!help" || text === "!menu") {
    await reply(\`🤖 *BOT AGUNG ADI STORE v4.0*
━━━━━━━━━━━━━━━━━━━━━━

📌 *PERINTAH USER (30+):*
📦 *!produk* — Lihat semua produk
🔍 *!cari [kata]* — Cari produk
📢 *!sponsor* — Lihat sponsor aktif
🎵 *!lagu* — Daftar lagu
🔎 *!carilagu [kata]* — Cari lagu
🎤 *!artis* — Daftar artis
🎧 *!playlist* — Daftar playlist
🎶 *!publik* — Lagu publik terbaru
📊 *!info* — Statistik toko
💰 *!ceksaldo [nama]* — Cek saldo
🎮 *!cekgame [nama]* — Stats game
📋 *!paket* — Paket tersedia
🎟️ *!cekvoucher* — Voucher aktif
🏪 *!toko* — Info toko
🏓 *!ping* — Status bot
⏰ *!waktu* — Waktu server
📱 *!versi* — Versi bot
🎲 *!random* — Produk random
🏆 *!top* — Terpopuler
🛒 *!kategori* — Kategori produk
💎 *!harga [min] [max]* — Filter harga
📢 *!promo* — Promo aktif
🎵 *!musikpublik [kata]* — Musik publik
📦 *!detailproduk [nama]* — Detail produk
📢 *!detailsponsor [no]* — Detail sponsor
🎤 *!detailartis [nama]* — Detail artis
🎮 *!lb* — Leaderboard game
📖 *!bantuan* — Pusat bantuan
📜 *!syarat* — Syarat & ketentuan
📱 *!sosmed* — Social media
📊 *!rangkuman* — Rangkuman toko

🔐 *PERINTAH ADMIN:*
Ketik *!admin* untuk lihat perintah admin.

━━━━━━━━━━━━━━━━━━━━━━
_Bot otomatis Agung Adi Store v4.0_
_© 2026 Agung Adi Store_\`);
    return;
  }

  // ── PING ──
  if (text === "!ping") {
    const start = Date.now();
    await apiGet("dashboard");
    const ms = Date.now() - start;
    await reply(\`🏓 *PONG!*\\n⏱️ Response: \${ms}ms\\n✅ Bot aktif & terhubung ke server\`);
    return;
  }

  // ── TOKO ──
  if (text === "!toko") {
    await reply(\`🏪 *AGUNG ADI STORE*
━━━━━━━━━━━━━━━━━━
📱 WA: 085769302532
🌐 Web: produkklaimtransaksiagungadistore.lovable.app
📦 Jual berbagai produk digital
🎵 Layanan musik streaming
🎮 Game & hiburan
💰 Sistem saldo digital
━━━━━━━━━━━━━━━━━━
© 2026 Agung Adi Store\`);
    return;
  }

  // ── PRODUK ──
  if (text === "!produk") {
    const data = await apiGet("products");
    if (!data || data.length === 0) { await reply("📦 Belum ada produk."); return; }
    let r = "📦 *DAFTAR PRODUK*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((p, i) => {
      r += \`*\${i + 1}. \${p.title}*\\n\`;
      r += \`   💰 \${rp(p.price)}\\n\`;
      r += \`   📦 Stok: \${p.stock}\\n\`;
      if (p.category) r += \`   🏷️ \${p.category}\\n\`;
      if (p.has_warranty) r += \`   🛡️ Bergaransi\\n\`;
      if (p.description) r += \`   📝 \${p.description.substring(0, 80)}\\n\`;
      r += "\\n";
    });
    r += \`_Total: \${data.length} produk_\\n📱 Beli: wa.me/6285769302532\`;
    await reply(r);
    return;
  }

  // ── CARI PRODUK ──
  if (text.startsWith("!cari ")) {
    const keyword = rawText.substring(6).toLowerCase();
    const data = await apiGet("products");
    if (!data) { await reply("❌ Gagal mengambil data."); return; }
    const hasil = data.filter(p => p.title.toLowerCase().includes(keyword) || (p.category || "").toLowerCase().includes(keyword) || (p.description || "").toLowerCase().includes(keyword));
    if (hasil.length === 0) { await reply(\`🔍 Tidak ditemukan produk "*\${keyword}*"\`); return; }
    let r = \`🔍 *HASIL: "\${keyword}"*\\n━━━━━━━━━━━━━━━━━━\\n\\n\`;
    hasil.forEach((p, i) => {
      r += \`*\${i + 1}. \${p.title}*\\n   💰 \${rp(p.price)} | 📦 Stok: \${p.stock}\\n\\n\`;
    });
    r += \`_Ditemukan: \${hasil.length} produk_\`;
    await reply(r);
    return;
  }

  // ── SPONSOR ──
  if (text === "!sponsor") {
    const data = await apiGet("sponsors");
    if (!data || data.length === 0) { await reply("📢 Belum ada sponsor."); return; }
    let r = "📢 *DAFTAR SPONSOR*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.filter(s => s.is_active).forEach((s, i) => {
      r += \`*\${i + 1}. \${s.title}* (#\${s.sponsor_number})\\n\`;
      r += \`   👤 \${s.seller_name}\\n\`;
      r += \`   💰 \${rp(s.price)} | 📦 Stok: \${s.stock}\\n\`;
      r += \`   👁️ \${s.view_count}x dilihat\\n\`;
      if (s.wa_number) r += \`   📱 WA: \${s.wa_number}\\n\`;
      r += "\\n";
    });
    await reply(r);
    return;
  }

  // ── LAGU ──
  if (text === "!lagu") {
    const data = await apiGet("songs");
    if (!data || data.length === 0) { await reply("🎵 Belum ada lagu."); return; }
    let r = "🎵 *DAFTAR LAGU*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((s, i) => {
      const dur = s.duration ? \`\${Math.floor(s.duration / 60)}:\${String(s.duration % 60).padStart(2, "0")}\` : "-";
      r += \`\${i + 1}. *\${s.title}* — \${s.artist} (\${dur})\\n\`;
    });
    r += \`\\n_Total: \${data.length} lagu_\`;
    await reply(r);
    return;
  }

  // ── ARTIS ──
  if (text === "!artis") {
    const data = await apiGet("artists");
    if (!data || data.length === 0) { await reply("🎤 Belum ada artis."); return; }
    let r = "🎤 *DAFTAR ARTIS*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((a, i) => {
      r += \`\${i + 1}. *\${a.name}*\`;
      if (a.genre) r += \` — \${a.genre}\`;
      if (a.bio) r += \`\\n   📝 \${a.bio.substring(0, 60)}\`;
      r += "\\n";
    });
    await reply(r);
    return;
  }

  // ── PLAYLIST ──
  if (text === "!playlist") {
    const data = await apiGet("playlists");
    if (!data || data.length === 0) { await reply("🎧 Belum ada playlist."); return; }
    let r = "🎧 *DAFTAR PLAYLIST*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((p, i) => {
      const items = p.playlist_items ? p.playlist_items.length : 0;
      r += \`\${i + 1}. *\${p.name}* (\${items} lagu) — \${p.playlist_type}\\n\`;
    });
    await reply(r);
    return;
  }

  // ── PUBLIK (lagu publik) ──
  if (text === "!publik") {
    const data = await apiGet("public_songs");
    if (!data || data.length === 0) { await reply("🎶 Belum ada lagu publik."); return; }
    let r = "🎶 *LAGU PUBLIK TERBARU*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.filter(s => s.status === "approved").forEach((s, i) => {
      r += \`\${i + 1}. *\${s.title}* — \${s.artist}\\n\`;
      if (s.description) r += \`   📝 \${s.description.substring(0, 60)}\\n\`;
      r += "\\n";
    });
    await reply(r);
    return;
  }

  // ── INFO / STATISTIK ──
  if (text === "!info") {
    const data = await apiGet("dashboard");
    if (!data) { await reply("❌ Gagal mengambil statistik."); return; }
    let r = "📊 *STATISTIK TOKO*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`📦 Produk: \${data.products}\\n\`;
    r += \`📢 Sponsor: \${data.sponsors}\\n\`;
    r += \`👥 User: \${data.users}\\n\`;
    r += \`🎵 Lagu: \${data.songs}\\n\`;
    r += \`🎤 Artis: \${data.artists}\\n\`;
    r += \`🎶 Lagu Publik: \${data.public_songs}\\n\`;
    r += \`💳 Deposit: \${data.deposits}\\n\`;
    r += \`🎫 Tiket: \${data.tickets}\\n\`;
    r += \`\\n💰 Total saldo: \${rp(data.total_balance)}\\n\`;
    r += \`\\n📅 \${new Date().toLocaleString("id-ID")}\`;
    await reply(r);
    return;
  }

  // ── CEK SALDO USER ──
  if (text.startsWith("!ceksaldo")) {
    const keyword = rawText.split(" ").slice(1).join(" ").toLowerCase();
    const data = await apiGet("balances");
    if (!data) { await reply("❌ Gagal mengambil data."); return; }
    if (!keyword) {
      let r = "💰 *DAFTAR SALDO*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
      data.forEach((b, i) => { r += \`\${i + 1}. *\${b.username}*: \${rp(b.balance)}\\n\`; });
      await reply(r);
      return;
    }
    const hasil = data.filter(b => b.username.toLowerCase().includes(keyword));
    if (hasil.length === 0) { await reply(\`👤 User "\${keyword}" tidak ditemukan.\`); return; }
    let r = \`💰 *SALDO: "\${keyword}"*\\n━━━━━━━━━━━━━━━━━━\\n\\n\`;
    hasil.forEach((b, i) => { r += \`\${i + 1}. *\${b.username}*: \${rp(b.balance)}\\n   📧 \${b.email || "-"} | 📱 \${b.phone || "-"}\\n\\n\`; });
    await reply(r);
    return;
  }

  // ── CEK GAME USER ──
  if (text.startsWith("!cekgame")) {
    const keyword = rawText.split(" ").slice(1).join(" ").toLowerCase();
    if (!keyword) { await reply("❌ Tulis: !cekgame [username]"); return; }
    const balances = await apiGet("balances");
    if (!balances) { await reply("❌ Gagal mengambil data."); return; }
    const user = balances.find(b => b.username.toLowerCase().includes(keyword));
    if (!user) { await reply(\`👤 User "\${keyword}" tidak ditemukan.\`); return; }
    const [stats, credits, streak] = await Promise.all([
      apiGet("game_stats&visitor_id=" + user.visitor_id),
      apiGet("game_credits&visitor_id=" + user.visitor_id),
      apiGet("streaks&visitor_id=" + user.visitor_id),
    ]);
    let r = \`🎮 *GAME INFO: \${user.username}*\\n━━━━━━━━━━━━━━━━━━\\n\\n\`;
    if (credits && credits.length > 0) {
      r += \`🏆 Kredit: \${credits[0].credits}\`;
      if (credits[0].unlimited_until) r += \` | ♾️ s/d \${new Date(credits[0].unlimited_until).toLocaleDateString("id-ID")}\`;
      r += "\\n";
    }
    if (streak && streak.length > 0) {
      r += \`🔥 Streak: \${streak[0].current_streak} hari (Terlama: \${streak[0].longest_streak})\\n\`;
    }
    if (stats && stats.length > 0) {
      r += "\\n📊 *Stats per game:*\\n";
      stats.forEach(g => { r += \`   • \${g.game_type}: W\${g.wins} L\${g.losses} | \${g.points} poin\\n\`; });
    }
    await reply(r);
    return;
  }

  // ── PAKET ──
  if (text === "!paket") {
    const data = await apiGet("packages");
    if (!data) { await reply("❌ Gagal mengambil data paket."); return; }
    let r = "📋 *PAKET TERSEDIA*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    if (data.credit && data.credit.length > 0) {
      r += "🎮 *Paket Kredit Game:*\\n";
      data.credit.forEach(p => {
        r += \`   • \${p.label}: \${p.is_unlimited ? "♾️ Unlimited " + p.unlimited_days + " hari" : p.credits + " kredit"} — \${rp(p.price)}\\n\`;
      });
      r += "\\n";
    }
    if (data.streak && data.streak.length > 0) {
      r += "🔥 *Paket Streak:*\\n";
      data.streak.forEach(p => { r += \`   • \${p.name}: \${p.days} hari — \${rp(p.price)}\\n\`; });
      r += "\\n";
    }
    if (data.storage && data.storage.length > 0) {
      r += "💾 *Paket Storage:*\\n";
      data.storage.forEach(p => { r += \`   • \${p.name}: \${p.storage_mb} MB — \${rp(p.price)}\\n\`; });
      r += "\\n";
    }
    if (data.bundle && data.bundle.length > 0) {
      r += "📦 *Paket Bundle:*\\n";
      data.bundle.forEach(p => { r += \`   • \${p.name}: \${p.credits} kredit + \${p.streak_days}h streak + \${p.storage_mb}MB — \${rp(p.price)}\\n\`; });
    }
    await reply(r);
    return;
  }

  // ── CEK VOUCHER ──
  if (text === "!cekvoucher") {
    const data = await apiGet("vouchers");
    if (!data) { await reply("❌ Gagal mengambil data voucher."); return; }
    let r = "🎟️ *VOUCHER AKTIF*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    let count = 0;
    if (data.discount) {
      data.discount.filter(v => v.is_active).forEach(v => { r += \`🏷️ *\${v.code}* — Diskon \${rp(v.discount_amount)} (sisa: \${v.max_uses - v.used_count})\\n\`; count++; });
    }
    if (data.game) {
      data.game.filter(v => v.is_active).forEach(v => { r += \`🎮 *\${v.code}* — Diskon game \${rp(v.discount_amount)} (sisa: \${v.max_uses - v.used_count})\\n\`; count++; });
    }
    if (data.streak) {
      data.streak.filter(v => v.is_active).forEach(v => { r += \`🔥 *\${v.code}* — Diskon streak \${rp(v.discount_amount)} (sisa: \${v.max_uses - v.used_count})\\n\`; count++; });
    }
    if (data.music) {
      data.music.filter(v => v.is_active).forEach(v => { r += \`🎵 *\${v.code}* — Diskon musik \${rp(v.discount_amount)} (sisa: \${v.max_uses - v.used_count})\\n\`; count++; });
    }
    if (data.storage) {
      data.storage.filter(v => v.is_active).forEach(v => { r += \`💾 *\${v.code}* — Storage \${v.storage_mb}MB (sisa: \${v.max_uses - v.used_count})\\n\`; count++; });
    }
    if (count === 0) r += "_Tidak ada voucher aktif saat ini._";
    await reply(r);
    return;
  }

  // ── WAKTU SERVER ──
  if (text === "!waktu") {
    const now = new Date();
    const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    await reply(\`⏰ *WAKTU SERVER*\\n━━━━━━━━━━━━━━━━━━\\n\\n🌍 UTC: \${now.toUTCString()}\\n🇮🇩 WIB: \${wib.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}\\n📅 Hari: \${["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][wib.getDay()]}\`);
    return;
  }

  // ── VERSI BOT ──
  if (text === "!versi" || text === "!version") {
    await reply(\`📱 *INFO BOT*\\n━━━━━━━━━━━━━━━━━━\\n\\n🤖 Bot: Agung Adi Store\\n📌 Versi: 3.0\\n📅 Update: April 2026\\n⚙️ Runtime: Node.js\\n📡 API: public-api v2\\n📋 Total perintah: 60+\\n🔒 Keamanan: API Key Auth\\n\\n_Dibuat oleh Agung Adi Store_\`);
    return;
  }

  // ── RANDOM PRODUK ──
  if (text === "!random") {
    const data = await apiGet("products");
    if (!data || data.length === 0) { await reply("📦 Belum ada produk."); return; }
    const p = data[Math.floor(Math.random() * data.length)];
    let r = "🎲 *PRODUK RANDOM*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`📦 *\${p.title}*\\n💰 \${rp(p.price)}\\n📦 Stok: \${p.stock}\\n\`;
    if (p.category) r += \`🏷️ Kategori: \${p.category}\\n\`;
    if (p.has_warranty) r += \`🛡️ Bergaransi\\n\`;
    if (p.description) r += \`📝 \${p.description}\\n\`;
    r += \`\\n📱 Beli: wa.me/6285769302532\`;
    await reply(r);
    return;
  }

  // ── TOP / POPULER ──
  if (text === "!top" || text === "!populer") {
    const [products, sponsors] = await Promise.all([apiGet("products"), apiGet("sponsors")]);
    let r = "🏆 *TERPOPULER*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    if (products && products.length > 0) {
      r += "📦 *Top Produk (stok terbanyak):*\\n";
      [...products].sort((a, b) => b.stock - a.stock).slice(0, 5).forEach((p, i) => {
        r += \`   \${i + 1}. *\${p.title}* — \${rp(p.price)} (stok: \${p.stock})\\n\`;
      });
      r += "\\n";
    }
    if (sponsors && sponsors.length > 0) {
      r += "📢 *Top Sponsor (paling dilihat):*\\n";
      [...sponsors].filter(s => s.is_active).sort((a, b) => b.view_count - a.view_count).slice(0, 5).forEach((s, i) => {
        r += \`   \${i + 1}. *\${s.title}* — 👁️ \${s.view_count}x\\n\`;
      });
    }
    await reply(r);
    return;
  }

  // ── KATEGORI ──
  if (text === "!kategori") {
    const data = await apiGet("products");
    if (!data || data.length === 0) { await reply("📦 Belum ada produk."); return; }
    const cats = {};
    data.forEach(p => { const c = p.category || "Tanpa Kategori"; cats[c] = (cats[c] || 0) + 1; });
    let r = "🛒 *KATEGORI PRODUK*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count], i) => {
      r += \`\${i + 1}. *\${cat}* — \${count} produk\\n\`;
    });
    r += \`\\n📦 Total: \${data.length} produk\\n🔍 Gunakan *!cari [kategori]* untuk filter\`;
    await reply(r);
    return;
  }

  // ── FILTER HARGA ──
  if (text.startsWith("!harga")) {
    const parts = rawText.split(" ");
    const min = parseInt(parts[1]) || 0;
    const max = parseInt(parts[2]) || 999999999;
    const data = await apiGet("products");
    if (!data) { await reply("❌ Gagal mengambil data."); return; }
    const hasil = data.filter(p => p.price >= min && p.price <= max).sort((a, b) => a.price - b.price);
    if (hasil.length === 0) { await reply(\`💎 Tidak ada produk harga \${rp(min)} - \${rp(max)}\`); return; }
    let r = \`💎 *PRODUK HARGA \${rp(min)} - \${rp(max)}*\\n━━━━━━━━━━━━━━━━━━\\n\\n\`;
    hasil.forEach((p, i) => {
      r += \`\${i + 1}. *\${p.title}* — \${rp(p.price)}\\n   📦 Stok: \${p.stock}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── PROMO / DISKON ──
  if (text === "!promo" || text === "!diskon") {
    const data = await apiGet("vouchers");
    if (!data) { await reply("❌ Gagal mengambil data."); return; }
    let r = "📢 *PROMO & DISKON AKTIF*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    let count = 0;
    if (data.discount) {
      data.discount.filter(v => v.is_active).forEach(v => {
        r += \`🏷️ *\${v.code}* — Diskon \${rp(v.discount_amount)}\\n   Sisa: \${v.max_uses - v.used_count} kuota\\n\`;
        if (v.expires_at) r += \`   ⏳ Exp: \${new Date(v.expires_at).toLocaleDateString("id-ID")}\\n\`;
        r += "\\n"; count++;
      });
    }
    if (data.game) {
      data.game.filter(v => v.is_active).forEach(v => {
        r += \`🎮 *\${v.code}* — Diskon game \${rp(v.discount_amount)}\\n   Sisa: \${v.max_uses - v.used_count} kuota\\n\\n\`; count++;
      });
    }
    if (data.streak) {
      data.streak.filter(v => v.is_active).forEach(v => {
        r += \`🔥 *\${v.code}* — Diskon streak \${rp(v.discount_amount)}\\n   Sisa: \${v.max_uses - v.used_count} kuota\\n\\n\`; count++;
      });
    }
    if (data.music) {
      data.music.filter(v => v.is_active).forEach(v => {
        r += \`🎵 *\${v.code}* — Diskon musik \${rp(v.discount_amount)}\\n   Sisa: \${v.max_uses - v.used_count} kuota\\n\\n\`; count++;
      });
    }
    if (count === 0) r += "_Tidak ada promo aktif saat ini. Cek lagi nanti!_";
    else r += \`_Total \${count} promo aktif_\`;
    await reply(r);
    return;
  }

  // ── CARI LAGU ──
  if (text.startsWith("!carilagu ")) {
    const keyword = rawText.substring(10).toLowerCase();
    const data = await apiGet("songs");
    if (!data) { await reply("❌ Gagal mengambil data."); return; }
    const hasil = data.filter(s => s.title.toLowerCase().includes(keyword) || s.artist.toLowerCase().includes(keyword));
    if (hasil.length === 0) { await reply(\`🔎 Tidak ditemukan lagu "*\${keyword}*"\`); return; }
    let r = \`🔎 *HASIL CARI LAGU: "\${keyword}"*\\n━━━━━━━━━━━━━━━━━━\\n\\n\`;
    hasil.forEach((s, i) => {
      const dur = s.duration ? \`\${Math.floor(s.duration / 60)}:\${String(s.duration % 60).padStart(2, "0")}\` : "-";
      r += \`\${i + 1}. *\${s.title}* — \${s.artist} (\${dur})\\n\`;
    });
    r += \`\\n_Ditemukan: \${hasil.length} lagu_\`;
    await reply(r);
    return;
  }

  // ── MUSIK PUBLIK USER ──
  if (text.startsWith("!musikpublik")) {
    const keyword = rawText.split(" ").slice(1).join(" ").toLowerCase();
    const data = await apiGet("public_songs");
    if (!data || data.length === 0) { await reply("🎶 Belum ada lagu publik."); return; }
    let filtered = data.filter(s => s.status === "approved");
    if (keyword) filtered = filtered.filter(s => s.artist.toLowerCase().includes(keyword) || s.title.toLowerCase().includes(keyword));
    if (filtered.length === 0) { await reply(\`🎵 Tidak ditemukan lagu publik "\${keyword}"\`); return; }
    let r = \`🎵 *MUSIK PUBLIK\${keyword ? ": " + keyword : ""}*\\n━━━━━━━━━━━━━━━━━━\\n\\n\`;
    filtered.slice(0, 20).forEach((s, i) => {
      r += \`\${i + 1}. *\${s.title}* — \${s.artist}\\n\`;
      if (s.description) r += \`   📝 \${s.description.substring(0, 50)}\\n\`;
      r += "\\n";
    });
    r += \`_Total: \${filtered.length} lagu_\`;
    await reply(r);
    return;
  }

  // ── DETAIL PRODUK (user) ──
  if (text.startsWith("!detailproduk ")) {
    const keyword = rawText.substring(14).toLowerCase();
    const data = await apiGet("products");
    if (!data) { await reply("❌ Gagal mengambil data."); return; }
    const p = data.find(x => x.title.toLowerCase().includes(keyword));
    if (!p) { await reply(\`📦 Produk "\${keyword}" tidak ditemukan.\`); return; }
    let r = "📦 *DETAIL PRODUK*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`📌 *\${p.title}*\\n💰 Harga: \${rp(p.price)}\\n📦 Stok: \${p.stock}\\n🏷️ Kategori: \${p.category || "-"}\\n🛡️ Garansi: \${p.has_warranty ? "Ya ✅" : "Tidak"}\\n📝 Deskripsi:\\n\${p.description || "-"}\\n\\n📱 Beli: wa.me/6285769302532\`;
    await reply(r);
    return;
  }

  // ── DETAIL SPONSOR (user) ──
  if (text.startsWith("!detailsponsor ")) {
    const keyword = rawText.substring(15).toLowerCase();
    const data = await apiGet("sponsors");
    if (!data) { await reply("❌ Gagal mengambil data."); return; }
    const s = data.find(x => x.title.toLowerCase().includes(keyword) || String(x.sponsor_number) === keyword);
    if (!s) { await reply(\`📢 Sponsor "\${keyword}" tidak ditemukan.\`); return; }
    let r = "📢 *DETAIL SPONSOR*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`📌 *\${s.title}* (#\${s.sponsor_number})\\n👤 Penjual: \${s.seller_name}\\n💰 Harga: \${rp(s.price)}\\n📦 Stok: \${s.stock}\\n🏷️ Kategori: \${s.category}\\n👁️ Dilihat: \${s.view_count}x\\n\`;
    if (s.wa_number) r += \`📱 WA: \${s.wa_number}\\n\`;
    if (s.instagram) r += \`📸 IG: @\${s.instagram}\\n\`;
    if (s.tiktok) r += \`🎵 TikTok: @\${s.tiktok}\\n\`;
    if (s.description) r += \`\\n📝 \${s.description}\\n\`;
    r += \`\\n📱 Hubungi: wa.me/\${(s.wa_number || "6285769302532").replace(/\\D/g, "")}\`;
    await reply(r);
    return;
  }

  // ── DETAIL ARTIS (user) ──
  if (text.startsWith("!detailartis ")) {
    const keyword = rawText.substring(13).toLowerCase();
    const [artists, songs] = await Promise.all([apiGet("artists"), apiGet("songs")]);
    if (!artists) { await reply("❌ Gagal mengambil data."); return; }
    const a = artists.find(x => x.name.toLowerCase().includes(keyword));
    if (!a) { await reply(\`🎤 Artis "\${keyword}" tidak ditemukan.\`); return; }
    const artistSongs = songs ? songs.filter(s => s.artist.toLowerCase() === a.name.toLowerCase()) : [];
    let r = "🎤 *DETAIL ARTIS*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`🎤 *\${a.name}*\\n🎵 Genre: \${a.genre || "-"}\\n📝 Bio: \${a.bio || "-"}\\n🎶 Jumlah lagu: \${artistSongs.length}\\n\`;
    if (artistSongs.length > 0) {
      r += "\\n🎵 *Daftar Lagu:*\\n";
      artistSongs.forEach((s, i) => {
        const dur = s.duration ? \`\${Math.floor(s.duration / 60)}:\${String(s.duration % 60).padStart(2, "0")}\` : "-";
        r += \`   \${i + 1}. \${s.title} (\${dur})\\n\`;
      });
    }
    await reply(r);
    return;
  }

  // ── LEADERBOARD PUBLIC ──
  if (text === "!lb" || text === "!leaderboard") {
    const data = await apiGet("game_stats");
    if (!data || data.length === 0) { await reply("🏆 Belum ada data game."); return; }
    const playerMap = {};
    data.forEach(g => {
      if (!playerMap[g.visitor_id]) playerMap[g.visitor_id] = { total: 0, wins: 0 };
      playerMap[g.visitor_id].total += g.points;
      playerMap[g.visitor_id].wins += g.wins;
    });
    const profiles = await apiGet("game_profiles");
    const sorted = Object.entries(playerMap).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    const medals = ["🥇", "🥈", "🥉"];
    let r = "🏆 *LEADERBOARD GAME*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    sorted.forEach(([vid, s], i) => {
      const profile = profiles ? profiles.find(p => p.visitor_id === vid) : null;
      const name = profile ? profile.display_name : vid.substring(0, 10) + "...";
      r += \`\${medals[i] || (i + 1) + "."} *\${name}*\\n   💎 \${s.total} poin | 🏆 \${s.wins} wins\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── BANTUAN / PUSAT BANTUAN ──
  if (text === "!bantuan" || text === "!faq") {
    await reply(\`📖 *PUSAT BANTUAN*
━━━━━━━━━━━━━━━━━━

❓ *Cara beli produk?*
Pilih produk > Hubungi admin via WA > Bayar > Terima token klaim.

❓ *Cara klaim token?*
Masuk tab Plus > Masukkan token > Klik Klaim.

❓ *Cara top up saldo?*
Tab Plus > Deposit > Pilih nominal > Bayar QRIS > Tunggu konfirmasi.

❓ *Apa itu sponsor?*
Iklankan produk di toko kami! Hubungi admin.

❓ *Cara main game?*
Tab Game > Pilih game > Butuh kredit game.

❓ *Saldo tidak masuk?*
Tunggu 1x24 jam, atau buat tiket support.

❓ *Cara daftar akun?*
Tab Plus > Buat Akun > Isi data > Selesai.

📱 *Hubungi Admin:*
wa.me/6285769302532

🌐 *Website:*
produkklaimtransaksiagungadistore.lovable.app\`);
    return;
  }

  // ── SYARAT & KETENTUAN ──
  if (text === "!syarat" || text === "!tos") {
    await reply(\`📜 *SYARAT & KETENTUAN*
━━━━━━━━━━━━━━━━━━

1️⃣ Pembeli wajib membaca deskripsi produk sebelum membeli.
2️⃣ Semua transaksi bersifat final, tidak bisa refund kecuali produk bermasalah.
3️⃣ Garansi berlaku sesuai durasi yang tertera di produk.
4️⃣ Dilarang menyalahgunakan sistem saldo/voucher.
5️⃣ Admin berhak menonaktifkan akun yang melanggar aturan.
6️⃣ Sponsor harus mematuhi aturan iklan yang berlaku.
7️⃣ Kredit game tidak bisa ditukar dengan saldo.
8️⃣ Musik publik harus bebas hak cipta.
9️⃣ Data pribadi dijaga kerahasiaannya.
🔟 Syarat dapat berubah sewaktu-waktu.

📱 Hubungi: wa.me/6285769302532
_© 2026 Agung Adi Store_\`);
    return;
  }

  // ── SOSIAL MEDIA ──
  if (text === "!sosmed" || text === "!social") {
    await reply(\`📱 *SOCIAL MEDIA*
━━━━━━━━━━━━━━━━━━

📱 *WhatsApp:* wa.me/6285769302532
🌐 *Website:* produkklaimtransaksiagungadistore.lovable.app
📸 *Instagram:* @agungadistore
🎵 *TikTok:* @agungadistore
📘 *Facebook:* Agung Adi Store
🐦 *Twitter/X:* @agungadistore
📺 *YouTube:* Agung Adi Store

━━━━━━━━━━━━━━━━━━
_Follow untuk update terbaru!_\`);
    return;
  }

  // ── RANGKUMAN TOKO ──
  if (text === "!rangkuman" || text === "!summary") {
    const [dashboard, likes, vouchers] = await Promise.all([
      apiGet("dashboard"), apiGet("likes"), apiGet("vouchers")
    ]);
    let r = "📊 *RANGKUMAN TOKO*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    if (dashboard) {
      r += \`📦 *Produk:* \${dashboard.products}\\n📢 *Sponsor:* \${dashboard.sponsors}\\n🎵 *Lagu:* \${dashboard.songs}\\n🎤 *Artis:* \${dashboard.artists}\\n🎶 *Lagu Publik:* \${dashboard.public_songs}\\n👥 *User:* \${dashboard.users}\\n\\n\`;
    }
    if (likes) {
      r += \`❤️ *Total Likes:*\\n   📦 Produk: \${likes.products} | 🎵 Lagu: \${likes.songs} | 📢 Sponsor: \${likes.sponsors}\\n\\n\`;
    }
    if (vouchers) {
      let activeCount = 0;
      if (vouchers.discount) activeCount += vouchers.discount.filter(v => v.is_active).length;
      if (vouchers.game) activeCount += vouchers.game.filter(v => v.is_active).length;
      if (vouchers.streak) activeCount += vouchers.streak.filter(v => v.is_active).length;
      if (vouchers.music) activeCount += vouchers.music.filter(v => v.is_active).length;
      r += \`🎟️ *Voucher Aktif:* \${activeCount}\\n\`;
    }
    r += \`\\n📅 \${new Date().toLocaleString("id-ID")}\\n_© 2026 Agung Adi Store_\`;
    await reply(r);
    return;
  }

  // ══════════════════════════════════════
  // 🔐 MENU ADMIN (Hanya admin)
  // ══════════════════════════════════════

  if (text === "!admin") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    await reply(\`🔐 *PERINTAH ADMIN (50+)*
━━━━━━━━━━━━━━━━━━━━━━

💰 *SALDO:*
!saldo — Semua saldo user
!tambahsaldo [vid] [jml] — Tambah saldo
!kurangsaldo [vid] [jml] — Kurangi saldo
!resetsaldo [vid] — Reset saldo ke 0
!setsaldo [vid] [jml] — Set saldo langsung

🎮 *GAME:*
!game [vid] — Stats game
!kredit [vid] — Kredit game
!setkredit [vid] [jml] — Set kredit
!resetkredit [vid] — Reset kredit
!profil [vid] — Profil game
!resetgame [vid] — Reset game stats
!leaderboardadmin — Leaderboard detail

🔥 *STREAK:*
!streak [vid] — Status streak
!resetstreak [vid] — Reset streak
!setstreak [vid] [hari] — Set streak
!streaksub — Langganan streak aktif

💾 *STORAGE:*
!storage [vid] — Status storage
!resetstorage [vid] — Reset storage

📦 *PRODUK & SPONSOR:*
!stok [id] [jml] — Update stok produk
!produkdetail [id] — Detail produk
!sponsordetail [id] — Detail sponsor
!stoksponsor [id] [jml] — Update stok sponsor
!deposit — Riwayat deposit
!setdeposit [id] [status] — Status deposit
!token — Daftar token
!tokendetail [kode] — Detail token

👥 *USER:*
!user [nama] — Cari user
!alluser — Semua user
!loginhistory [vid] — Riwayat login
!hapusnotif [vid] — Hapus notif user
!musikprofil — Profil musik
!follow — Stats follow
!detailuser [vid] — Detail lengkap user

🎫 *SUPPORT:*
!tiket — Tiket support
!settiket [id] [status] — Status tiket
!chat — Chat produk
!tiketdetail [id] — Detail tiket

📡 *BROADCAST & MONITORING:*
!notif [pesan] — Kirim notifikasi
!broadcast [pesan] — Broadcast semua
!dashboard — Dashboard lengkap
!likes — Stats likes
!report — Laporan harian
!topuser — Top user saldo
!rekapdeposit — Rekap deposit
!aktivitas — Aktivitas terbaru
!backup — Info backup data

━━━━━━━━━━━━━━━━━━━━━━
_🔐 v4.0 — Hanya admin_\`);
    return;
  }

  // ═══ ADMIN COMMANDS ═══

  // ── SALDO (admin) ──
  if (text === "!saldo") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah admin. Gunakan !ceksaldo"); return; }
    const data = await apiGet("balances");
    if (!data || data.length === 0) { await reply("💰 Belum ada data saldo."); return; }
    let r = "💰 *DAFTAR SALDO USER*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((b, i) => {
      r += \`\${i + 1}. *\${b.username}*: \${rp(b.balance)}\\n   🆔 \${b.visitor_id.substring(0, 16)}...\\n   📧 \${b.email || "-"} | 📱 \${b.phone || "-"}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── DEPOSIT (admin) ──
  if (text === "!deposit") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("deposits");
    if (!data || data.length === 0) { await reply("💳 Belum ada deposit."); return; }
    let r = "💳 *RIWAYAT DEPOSIT*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.slice(0, 15).forEach((d, i) => {
      const tgl = new Date(d.created_at).toLocaleString("id-ID");
      r += \`\${i + 1}. *\${d.username}* — \${rp(d.amount)}\\n\`;
      r += \`   🆔 \${d.id.substring(0, 8)}\\n\`;
      r += \`   📅 \${tgl}\\n\`;
      r += \`   💳 \${d.payment_method.toUpperCase()} | \${d.status === "success" ? "✅" : d.status === "rejected" ? "❌" : "⏳"} \${d.status}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── TOKEN (admin) ──
  if (text === "!token") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("tokens");
    if (!data || data.length === 0) { await reply("🎟️ Belum ada token."); return; }
    let r = "🎟️ *DAFTAR TOKEN*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.slice(0, 15).forEach((t, i) => {
      const produk = t.products ? t.products.title : "-";
      r += \`\${i + 1}. \${t.token_code}\\n   📦 \${produk} | \${t.is_claimed ? "✅ Diklaim" : "⏳ Belum"}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── GAME STATS (admin) ──
  if (text.startsWith("!game")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah admin. Gunakan !cekgame"); return; }
    const vid = rawText.split(" ")[1];
    const url2 = vid ? "game_stats&visitor_id=" + vid : "game_stats";
    const data = await apiGet(url2);
    if (!data || data.length === 0) { await reply("🎮 Tidak ada data game."); return; }
    let r = "🎮 *STATISTIK GAME*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((g, i) => {
      r += \`\${i + 1}. *\${g.game_type}*\\n   🆔 \${g.visitor_id.substring(0, 12)}\\n   🏆 W:\${g.wins} L:\${g.losses} Q:\${g.total_questions} | 💎 \${g.points} poin\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── KREDIT (admin) ──
  if (text.startsWith("!kredit")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    const url2 = vid ? "game_credits&visitor_id=" + vid : "game_credits";
    const data = await apiGet(url2);
    if (!data || data.length === 0) { await reply("🏆 Tidak ada data kredit."); return; }
    let r = "🏆 *KREDIT GAME*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((c, i) => {
      r += \`\${i + 1}. 🆔 \${c.visitor_id.substring(0, 12)} | Kredit: \${c.credits}\`;
      if (c.unlimited_until) r += \` | ♾️ s/d \${new Date(c.unlimited_until).toLocaleDateString("id-ID")}\`;
      r += "\\n";
    });
    await reply(r);
    return;
  }

  // ── STREAK (admin) ──
  if (text.startsWith("!streak")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    const url2 = vid ? "streaks&visitor_id=" + vid : "streaks";
    const data = await apiGet(url2);
    if (!data || data.length === 0) { await reply("🔥 Tidak ada data streak."); return; }
    let r = "🔥 *STATUS STREAK*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((s, i) => {
      r += \`\${i + 1}. 🆔 \${s.visitor_id.substring(0, 12)}\\n   Streak: \${s.current_streak} hari | Total: \${s.total_claims} | Terlama: \${s.longest_streak}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── STORAGE (admin) ──
  if (text.startsWith("!storage")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    const url2 = vid ? "storage&visitor_id=" + vid : "storage";
    const data = await apiGet(url2);
    if (!data || data.length === 0) { await reply("💾 Tidak ada data storage."); return; }
    let r = "💾 *STATUS STORAGE*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((s, i) => {
      r += \`\${i + 1}. 🆔 \${s.visitor_id.substring(0, 12)} | \${s.storage_mb} MB | Kode: \${s.voucher_code}\\n\`;
    });
    await reply(r);
    return;
  }

  // ── PROFIL GAME (admin) ──
  if (text.startsWith("!profil")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    const url2 = vid ? "game_profiles&visitor_id=" + vid : "game_profiles";
    const data = await apiGet(url2);
    if (!data || data.length === 0) { await reply("👤 Tidak ada profil game."); return; }
    let r = "👤 *PROFIL GAME*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((p, i) => {
      r += \`\${i + 1}. *\${p.display_name}*\\n   🆔 \${p.visitor_id.substring(0, 16)}\\n   📝 \${p.description || "-"}\\n   🎭 \${p.is_guest ? "Guest" : "Registered"}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── NOTIFIKASI (admin) ──
  if (text.startsWith("!notif ")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const pesan = rawText.substring(7);
    if (!pesan) { await reply("❌ Tulis: !notif [isi pesan]"); return; }
    const result = await apiPost("notifications", { visitor_id: "wa-bot", title: "Notifikasi Bot WA", message: pesan, type: "info" });
    await reply(result && result.success ? "✅ Notifikasi terkirim!" : "❌ Gagal mengirim.");
    return;
  }

  // ── TIKET SUPPORT (admin) ──
  if (text === "!tiket") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("tickets");
    if (!data || data.length === 0) { await reply("🎫 Belum ada tiket."); return; }
    let r = "🎫 *TIKET SUPPORT*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.slice(0, 10).forEach((t, i) => {
      r += \`\${i + 1}. #\${t.ticket_number} — *\${t.name}*\\n   🆔 \${t.id.substring(0, 8)}\\n   📋 \${t.category || "-"} | \${t.status}\\n   📝 \${t.description.substring(0, 60)}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── TRANSAKSI (admin) ──
  if (text.startsWith("!transaksi")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    if (!vid) { await reply("❌ Tulis: !transaksi [visitor_id]"); return; }
    const data = await apiGet("transactions&visitor_id=" + vid);
    if (!data || data.length === 0) { await reply("📋 Tidak ada transaksi."); return; }
    let r = "📋 *RIWAYAT TRANSAKSI*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.slice(0, 10).forEach((t, i) => {
      const tgl = new Date(t.created_at).toLocaleString("id-ID");
      r += \`\${i + 1}. \${t.type === "topup" ? "➕" : "➖"} \${rp(t.amount)}\\n   📅 \${tgl}\\n   📝 \${t.description || "-"}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── TAMBAH SALDO (admin) ──
  if (text.startsWith("!tambahsaldo")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const parts = rawText.split(" ");
    const vid = parts[1]; const amount = parseInt(parts[2]);
    if (!vid || isNaN(amount)) { await reply("❌ Tulis: !tambahsaldo [visitor_id] [jumlah]"); return; }
    const result = await apiPost("add_balance", { visitor_id: vid, amount, description: "Top up via Bot WA" });
    if (result && result.success) { await reply(\`✅ Saldo ditambahkan!\\n💰 Saldo baru: \${rp(result.data.new_balance)}\`); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── KURANGI SALDO (admin) ──
  if (text.startsWith("!kurangsaldo")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const parts = rawText.split(" ");
    const vid = parts[1]; const amount = parseInt(parts[2]);
    if (!vid || isNaN(amount) || amount <= 0) { await reply("❌ Tulis: !kurangsaldo [visitor_id] [jumlah]"); return; }
    const result = await apiPost("deduct_balance", { visitor_id: vid, amount, description: "Potong saldo via Bot WA" });
    if (result && result.success) { await reply(\`✅ Saldo dikurangi!\\n💰 Saldo baru: \${rp(result.data.new_balance)}\`); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── RESET SALDO (admin) ──
  if (text.startsWith("!resetsaldo")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    if (!vid) { await reply("❌ Tulis: !resetsaldo [visitor_id]"); return; }
    const result = await apiPost("reset_balance", { visitor_id: vid });
    if (result && result.success) { await reply(\`✅ Saldo direset!\\n💰 Saldo lama: \${rp(result.data.old_balance)} → Rp 0\`); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── SET KREDIT (admin) ──
  if (text.startsWith("!setkredit")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const parts = rawText.split(" ");
    const vid = parts[1]; const credits = parseInt(parts[2]);
    if (!vid || isNaN(credits)) { await reply("❌ Tulis: !setkredit [visitor_id] [jumlah]"); return; }
    const result = await apiPost("set_credits", { visitor_id: vid, credits });
    if (result && result.success) { await reply(\`✅ Kredit diubah menjadi \${credits}\`); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── RESET KREDIT (admin) ──
  if (text.startsWith("!resetkredit")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    if (!vid) { await reply("❌ Tulis: !resetkredit [visitor_id]"); return; }
    const result = await apiPost("reset_credits", { visitor_id: vid });
    if (result && result.success) { await reply("✅ Kredit game direset ke 0"); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── RESET STREAK (admin) ──
  if (text.startsWith("!resetstreak")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    if (!vid) { await reply("❌ Tulis: !resetstreak [visitor_id]"); return; }
    const result = await apiPost("reset_streak", { visitor_id: vid });
    if (result && result.success) { await reply("✅ Streak direset ke 0"); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── RESET STORAGE (admin) ──
  if (text.startsWith("!resetstorage")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    if (!vid) { await reply("❌ Tulis: !resetstorage [visitor_id]"); return; }
    const result = await apiPost("reset_storage", { visitor_id: vid });
    if (result && result.success) { await reply("✅ Storage direset"); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── UPDATE STOK (admin) ──
  if (text.startsWith("!stok")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const parts = rawText.split(" ");
    const pid = parts[1]; const stock = parseInt(parts[2]);
    if (!pid || isNaN(stock)) { await reply("❌ Tulis: !stok [product_id] [jumlah]"); return; }
    const result = await apiPost("update_stock", { product_id: pid, stock });
    if (result && result.success) { await reply(\`✅ Stok diubah menjadi \${stock}\`); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── BROADCAST (admin) ──
  if (text.startsWith("!broadcast ")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const pesan = rawText.substring(11);
    if (!pesan) { await reply("❌ Tulis: !broadcast [pesan]"); return; }
    const result = await apiPost("broadcast", { title: "📢 Broadcast", message: pesan, type: "info" });
    if (result && result.success) { await reply(\`✅ Broadcast terkirim ke \${result.data.sent_to} user!\`); }
    else { await reply("❌ Gagal broadcast."); }
    return;
  }

  // ── CARI USER (admin) ──
  if (text.startsWith("!user ")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const keyword = rawText.substring(6).toLowerCase();
    const data = await apiGet("balances");
    if (!data) { await reply("❌ Gagal mengambil data."); return; }
    const hasil = data.filter(b => b.username.toLowerCase().includes(keyword));
    if (hasil.length === 0) { await reply(\`👤 User "*\${keyword}*" tidak ditemukan.\`); return; }
    let r = \`👤 *USER: "\${keyword}"*\\n━━━━━━━━━━━━━━━━━━\\n\\n\`;
    hasil.forEach((b, i) => {
      r += \`\${i + 1}. *\${b.username}*\\n   💰 \${rp(b.balance)}\\n   🆔 \${b.visitor_id}\\n   📧 \${b.email || "-"} | 📱 \${b.phone || "-"}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── LOGIN HISTORY (admin) ──
  if (text.startsWith("!loginhistory")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    if (!vid) { await reply("❌ Tulis: !loginhistory [visitor_id]"); return; }
    const data = await apiGet("login_history&visitor_id=" + vid);
    if (!data || data.length === 0) { await reply("📋 Tidak ada riwayat login."); return; }
    let r = "📋 *RIWAYAT LOGIN*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.slice(0, 10).forEach((l, i) => {
      const tgl = new Date(l.logged_in_at).toLocaleString("id-ID");
      r += \`\${i + 1}. 📅 \${tgl}\\n   🌐 \${l.browser || "-"} | 📱 \${l.device_info || "-"}\\n   🔗 IP: \${l.ip_address || "-"}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── HAPUS NOTIFIKASI (admin) ──
  if (text.startsWith("!hapusnotif")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    if (!vid) { await reply("❌ Tulis: !hapusnotif [visitor_id]"); return; }
    const result = await apiPost("delete_notifications", { visitor_id: vid });
    if (result && result.success) { await reply(\`✅ \${result.data.deleted} notifikasi dihapus\`); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── SET DEPOSIT STATUS (admin) ──
  if (text.startsWith("!setdeposit")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const parts = rawText.split(" ");
    const did = parts[1]; const status = parts[2];
    if (!did || !status) { await reply("❌ Tulis: !setdeposit [deposit_id] [pending/success/rejected]"); return; }
    const result = await apiPost("set_deposit_status", { deposit_id: did, status });
    if (result && result.success) { await reply(\`✅ Status deposit diubah ke \${status}\`); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── SET TIKET STATUS (admin) ──
  if (text.startsWith("!settiket")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const parts = rawText.split(" ");
    const tid = parts[1]; const status = parts[2];
    if (!tid || !status) { await reply("❌ Tulis: !settiket [ticket_id] [open/in_progress/resolved/closed]"); return; }
    const result = await apiPost("set_ticket_status", { ticket_id: tid, status });
    if (result && result.success) { await reply(\`✅ Status tiket diubah ke \${status}\`); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── CHAT PRODUK (admin) ──
  if (text === "!chat") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("chats");
    if (!data || data.length === 0) { await reply("💬 Belum ada chat."); return; }
    let r = "💬 *CHAT PRODUK*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.slice(0, 10).forEach((c, i) => {
      const msgs = c.product_chat_messages ? c.product_chat_messages.length : 0;
      r += \`\${i + 1}. *\${c.visitor_name}* — \${c.status}\\n   💬 \${msgs} pesan\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── LIKES (admin) ──
  if (text === "!likes") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("likes");
    if (!data) { await reply("❌ Gagal mengambil data likes."); return; }
    await reply(\`❤️ *STATISTIK LIKES*\\n━━━━━━━━━━━━━━━━━━\\n\\n📦 Produk: \${data.products} likes\\n🎵 Lagu: \${data.songs} likes\\n📢 Sponsor: \${data.sponsors} likes\`);
    return;
  }

  // ── DASHBOARD (admin) ──
  if (text === "!dashboard") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("dashboard");
    if (!data) { await reply("❌ Gagal."); return; }
    const likes = await apiGet("likes");
    let r = "📊 *DASHBOARD ADMIN*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`📦 Produk: \${data.products}\\n📢 Sponsor: \${data.sponsors}\\n👥 User: \${data.users}\\n🎵 Lagu: \${data.songs}\\n🎤 Artis: \${data.artists}\\n🎶 Lagu Publik: \${data.public_songs}\\n💳 Deposit: \${data.deposits}\\n🎫 Tiket: \${data.tickets}\\n\\n💰 Total saldo: \${rp(data.total_balance)}\\n\`;
    if (likes) r += \`\\n❤️ Likes: 📦\${likes.products} 🎵\${likes.songs} 📢\${likes.sponsors}\\n\`;
    r += \`\\n📅 \${new Date().toLocaleString("id-ID")}\`;
    await reply(r);
    return;
  }

  // ── SET SALDO LANGSUNG (admin) ──
  if (text.startsWith("!setsaldo")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const parts = rawText.split(" ");
    const vid = parts[1]; const amount = parseInt(parts[2]);
    if (!vid || isNaN(amount)) { await reply("❌ Tulis: !setsaldo [visitor_id] [jumlah]"); return; }
    const result = await apiPost("set_balance", { visitor_id: vid, balance: amount });
    if (result && result.success) { await reply(\`✅ Saldo diset ke \${rp(amount)}\`); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── RESET GAME STATS (admin) ──
  if (text.startsWith("!resetgame")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    if (!vid) { await reply("❌ Tulis: !resetgame [visitor_id]"); return; }
    const result = await apiPost("reset_game_stats", { visitor_id: vid });
    if (result && result.success) { await reply("✅ Semua statistik game direset!"); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── LEADERBOARD (admin) ──
  if (text === "!leaderboard" || text === "!lb") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("game_stats");
    if (!data || data.length === 0) { await reply("🏆 Belum ada data game."); return; }
    const playerMap = {};
    data.forEach(g => {
      if (!playerMap[g.visitor_id]) playerMap[g.visitor_id] = { total: 0, wins: 0, games: 0 };
      playerMap[g.visitor_id].total += g.points;
      playerMap[g.visitor_id].wins += g.wins;
      playerMap[g.visitor_id].games++;
    });
    const sorted = Object.entries(playerMap).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    let r = "🏆 *LEADERBOARD TOP 10*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    const medals = ["🥇", "🥈", "🥉"];
    sorted.forEach(([vid, s], i) => {
      r += \`\${medals[i] || (i + 1) + "."} *\${vid.substring(0, 12)}...*\\n   💎 \${s.total} poin | 🏆 \${s.wins} wins | 🎮 \${s.games} games\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── SET STREAK (admin) ──
  if (text.startsWith("!setstreak")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const parts = rawText.split(" ");
    const vid = parts[1]; const days = parseInt(parts[2]);
    if (!vid || isNaN(days)) { await reply("❌ Tulis: !setstreak [visitor_id] [hari]"); return; }
    const result = await apiPost("set_streak", { visitor_id: vid, current_streak: days });
    if (result && result.success) { await reply(\`✅ Streak diset ke \${days} hari\`); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── PRODUK DETAIL (admin) ──
  if (text.startsWith("!produkdetail")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const pid = rawText.split(" ")[1];
    if (!pid) { await reply("❌ Tulis: !produkdetail [product_id]"); return; }
    const data = await apiGet("products");
    if (!data) { await reply("❌ Gagal mengambil data."); return; }
    const p = data.find(x => x.id === pid || x.id.startsWith(pid));
    if (!p) { await reply("❌ Produk tidak ditemukan."); return; }
    let r = "📦 *DETAIL PRODUK*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`📌 *\${p.title}*\\n🆔 \${p.id}\\n💰 Harga: \${rp(p.price)}\\n📦 Stok: \${p.stock}\\n🏷️ Kategori: \${p.category || "-"}\\n🛡️ Garansi: \${p.has_warranty ? "Ya" : "Tidak"}\\n📝 Deskripsi: \${p.description || "-"}\\n📅 Dibuat: \${new Date(p.created_at).toLocaleString("id-ID")}\\n📅 Update: \${new Date(p.updated_at).toLocaleString("id-ID")}\`;
    await reply(r);
    return;
  }

  // ── SPONSOR DETAIL (admin) ──
  if (text.startsWith("!sponsordetail")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const sid = rawText.split(" ")[1];
    if (!sid) { await reply("❌ Tulis: !sponsordetail [sponsor_id atau nomor]"); return; }
    const data = await apiGet("sponsors");
    if (!data) { await reply("❌ Gagal."); return; }
    const s = data.find(x => x.id === sid || x.id.startsWith(sid) || String(x.sponsor_number) === sid);
    if (!s) { await reply("❌ Sponsor tidak ditemukan."); return; }
    let r = "📢 *DETAIL SPONSOR*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`📌 *\${s.title}* (#\${s.sponsor_number})\\n🆔 \${s.id}\\n👤 Penjual: \${s.seller_name}\\n📞 Kontak: \${s.seller_contact}\\n💰 Harga: \${rp(s.price)}\\n📦 Stok: \${s.stock}\\n🏷️ Kategori: \${s.category}\\n👁️ Views: \${s.view_count}\\n\`;
    r += \`✅ Aktif: \${s.is_active ? "Ya" : "Tidak"}\\n📅 Mulai: \${new Date(s.starts_at).toLocaleDateString("id-ID")}\\n\`;
    if (s.expires_at) r += \`⏳ Expired: \${new Date(s.expires_at).toLocaleDateString("id-ID")}\\n\`;
    if (s.wa_number) r += \`📱 WA: \${s.wa_number}\\n\`;
    if (s.instagram) r += \`📸 IG: \${s.instagram}\\n\`;
    if (s.tiktok) r += \`🎵 TikTok: \${s.tiktok}\\n\`;
    if (s.facebook) r += \`📘 FB: \${s.facebook}\\n\`;
    if (s.description) r += \`📝 \${s.description}\\n\`;
    if (s.custom_note) r += \`📋 Note: \${s.custom_note}\\n\`;
    await reply(r);
    return;
  }

  // ── STOK SPONSOR (admin) ──
  if (text.startsWith("!stoksponsor")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const parts = rawText.split(" ");
    const sid = parts[1]; const stock = parseInt(parts[2]);
    if (!sid || isNaN(stock)) { await reply("❌ Tulis: !stoksponsor [sponsor_id] [jumlah]"); return; }
    const result = await apiPost("update_sponsor_stock", { sponsor_id: sid, stock });
    if (result && result.success) { await reply(\`✅ Stok sponsor diubah menjadi \${stock}\`); }
    else { await reply("❌ Gagal: " + (result?.error || "Error")); }
    return;
  }

  // ── ALL USER (admin) ──
  if (text === "!alluser") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("balances");
    if (!data || data.length === 0) { await reply("👥 Belum ada user."); return; }
    let r = "👥 *SEMUA USER*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((b, i) => {
      r += \`\${i + 1}. *\${b.username}*\\n   💰 \${rp(b.balance)} | 📧 \${b.email || "-"}\\n   🆔 \${b.visitor_id.substring(0, 20)}\\n\\n\`;
    });
    r += \`_Total: \${data.length} user_\`;
    await reply(r);
    return;
  }

  // ── MUSIK PROFIL (admin) ──
  if (text === "!musikprofil") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("music_profiles");
    if (!data || data.length === 0) { await reply("🎵 Belum ada profil musik."); return; }
    let r = "🎵 *PROFIL MUSIK*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((p, i) => {
      r += \`\${i + 1}. *\${p.username}*\\n   🆔 \${p.visitor_id.substring(0, 16)}\\n   📝 \${p.description || "-"}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── FOLLOW STATS (admin) ──
  if (text === "!follow") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const [follows, gameFollows] = await Promise.all([apiGet("follows"), apiGet("game_follows")]);
    let r = "👥 *STATISTIK FOLLOW*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`🎵 Musik follow: \${follows ? follows.length : 0}\\n\`;
    r += \`🎮 Game follow: \${gameFollows ? gameFollows.length : 0}\\n\`;
    await reply(r);
    return;
  }

  // ── REPORT HARIAN (admin) ──
  if (text === "!report" || text === "!laporan") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const [dashboard, likes, deposits] = await Promise.all([
      apiGet("dashboard"), apiGet("likes"), apiGet("deposits")
    ]);
    const today = new Date().toISOString().split("T")[0];
    let r = "📋 *LAPORAN HARIAN*\\n━━━━━━━━━━━━━━━━━━\\n📅 " + new Date().toLocaleDateString("id-ID") + "\\n\\n";
    if (dashboard) {
      r += "📊 *Ringkasan:*\\n";
      r += \`   📦 Produk: \${dashboard.products}\\n   📢 Sponsor: \${dashboard.sponsors}\\n   👥 User: \${dashboard.users}\\n   🎵 Lagu: \${dashboard.songs}\\n   💰 Total saldo: \${rp(dashboard.total_balance)}\\n\\n\`;
    }
    if (likes) {
      r += "❤️ *Likes:*\\n";
      r += \`   📦 Produk: \${likes.products} | 🎵 Lagu: \${likes.songs} | 📢 Sponsor: \${likes.sponsors}\\n\\n\`;
    }
    if (deposits && deposits.length > 0) {
      const todayDeposits = deposits.filter(d => d.created_at.startsWith(today));
      const totalToday = todayDeposits.reduce((sum, d) => sum + d.amount, 0);
      r += \`💳 *Deposit Hari Ini:*\\n   \${todayDeposits.length} transaksi | Total: \${rp(totalToday)}\\n\\n\`;
    }
    r += "_Laporan otomatis Bot WA_";
    await reply(r);
    return;
  }

  // ── TOP USER BY SALDO (admin) ──
  if (text === "!topuser") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("balances");
    if (!data || data.length === 0) { await reply("👥 Belum ada user."); return; }
    const sorted = [...data].sort((a, b) => b.balance - a.balance).slice(0, 10);
    let r = "🏆 *TOP USER BY SALDO*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    const medals = ["🥇", "🥈", "🥉"];
    sorted.forEach((b, i) => {
      r += \`\${medals[i] || (i + 1) + "."} *\${b.username}* — \${rp(b.balance)}\\n\`;
    });
    await reply(r);
    return;
  }

  // ── REKAP DEPOSIT (admin) ──
  if (text === "!rekapdeposit") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("deposits");
    if (!data || data.length === 0) { await reply("💳 Belum ada deposit."); return; }
    const success = data.filter(d => d.status === "success");
    const pending = data.filter(d => d.status === "pending");
    const rejected = data.filter(d => d.status === "rejected");
    const totalSuccess = success.reduce((sum, d) => sum + d.amount, 0);
    const totalPending = pending.reduce((sum, d) => sum + d.amount, 0);
    let r = "💳 *REKAP DEPOSIT*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`✅ Berhasil: \${success.length} trx — \${rp(totalSuccess)}\\n\`;
    r += \`⏳ Pending: \${pending.length} trx — \${rp(totalPending)}\\n\`;
    r += \`❌ Ditolak: \${rejected.length} trx\\n\\n\`;
    r += \`📊 Total: \${data.length} deposit\\n💰 Sudah masuk: \${rp(totalSuccess)}\`;
    await reply(r);
    return;
  }

  // ── STREAK SUBSCRIPTIONS (admin) ──
  if (text === "!streaksub") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const data = await apiGet("streak_subs");
    if (!data || data.length === 0) { await reply("🔥 Belum ada langganan streak."); return; }
    let r = "🔥 *LANGGANAN STREAK AKTIF*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.filter(s => s.is_active).forEach((s, i) => {
      r += \`\${i + 1}. 🆔 \${s.visitor_id.substring(0, 12)}\\n   📋 \${s.plan_name} (\${s.plan_days}h)\\n   💰 \${rp(s.price_paid)}\\n   📅 \${new Date(s.starts_at).toLocaleDateString("id-ID")} s/d \${new Date(s.expires_at).toLocaleDateString("id-ID")}\\n\\n\`;
    });
    await reply(r);
    return;
  }

  // ── TOKEN DETAIL (admin) ──
  if (text.startsWith("!tokendetail")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const kode = rawText.split(" ")[1];
    if (!kode) { await reply("❌ Tulis: !tokendetail [kode_token]"); return; }
    const data = await apiGet("tokens");
    if (!data) { await reply("❌ Gagal mengambil data."); return; }
    const t = data.find(x => x.token_code.toLowerCase().includes(kode.toLowerCase()));
    if (!t) { await reply(\`🎟️ Token "\${kode}" tidak ditemukan.\`); return; }
    let r = "🎟️ *DETAIL TOKEN*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`📌 Kode: *\${t.token_code}*\\n🆔 ID: \${t.id}\\n📦 Produk: \${t.products ? t.products.title : "-"}\\n\`;
    r += \`✅ Status: \${t.is_claimed ? "Sudah diklaim" : "Belum diklaim"}\\n\`;
    if (t.claimed_at) r += \`📅 Diklaim: \${new Date(t.claimed_at).toLocaleString("id-ID")}\\n\`;
    r += \`📅 Dibuat: \${new Date(t.created_at).toLocaleString("id-ID")}\`;
    await reply(r);
    return;
  }

  // ── DETAIL USER LENGKAP (admin) ──
  if (text.startsWith("!detailuser")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const vid = rawText.split(" ")[1];
    if (!vid) { await reply("❌ Tulis: !detailuser [visitor_id]"); return; }
    const [balances, credits, streaks, storage, gameProfile, transactions] = await Promise.all([
      apiGet("balances"), apiGet("game_credits&visitor_id=" + vid),
      apiGet("streaks&visitor_id=" + vid), apiGet("storage&visitor_id=" + vid),
      apiGet("game_profiles&visitor_id=" + vid), apiGet("transactions&visitor_id=" + vid),
    ]);
    const user = balances ? balances.find(b => b.visitor_id === vid || b.visitor_id.startsWith(vid)) : null;
    let r = "👤 *DETAIL USER LENGKAP*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    if (user) {
      r += \`👤 *\${user.username}*\\n🆔 \${user.visitor_id}\\n💰 Saldo: \${rp(user.balance)}\\n📧 Email: \${user.email || "-"}\\n📱 HP: \${user.phone || "-"}\\n\\n\`;
    } else {
      r += \`🆔 VID: \${vid}\\n⚠️ Akun saldo tidak ditemukan\\n\\n\`;
    }
    if (credits && credits.length > 0) {
      r += \`🎮 *Game:* \${credits[0].credits} kredit\`;
      if (credits[0].unlimited_until) r += \` | ♾️ s/d \${new Date(credits[0].unlimited_until).toLocaleDateString("id-ID")}\`;
      r += "\\n";
    }
    if (streaks && streaks.length > 0) {
      r += \`🔥 *Streak:* \${streaks[0].current_streak} hari (Max: \${streaks[0].longest_streak})\\n\`;
    }
    if (storage && storage.length > 0) {
      const totalMb = storage.reduce((sum, s) => sum + s.storage_mb, 0);
      r += \`💾 *Storage:* \${totalMb} MB\\n\`;
    }
    if (gameProfile && gameProfile.length > 0) {
      r += \`🎭 *Profil Game:* \${gameProfile[0].display_name} (\${gameProfile[0].is_guest ? "Guest" : "Registered"})\\n\`;
    }
    if (transactions && transactions.length > 0) {
      r += \`\\n📋 *Transaksi Terakhir (\${Math.min(transactions.length, 5)}):*\\n\`;
      transactions.slice(0, 5).forEach((t, i) => {
        r += \`   \${t.type === "topup" ? "➕" : "➖"} \${rp(t.amount)} — \${new Date(t.created_at).toLocaleDateString("id-ID")}\\n\`;
      });
    }
    await reply(r);
    return;
  }

  // ── TIKET DETAIL (admin) ──
  if (text.startsWith("!tiketdetail")) {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const tid = rawText.split(" ")[1];
    if (!tid) { await reply("❌ Tulis: !tiketdetail [ticket_id atau nomor]"); return; }
    const data = await apiGet("tickets");
    if (!data) { await reply("❌ Gagal mengambil data."); return; }
    const t = data.find(x => x.id === tid || x.id.startsWith(tid) || String(x.ticket_number) === tid);
    if (!t) { await reply("❌ Tiket tidak ditemukan."); return; }
    let r = "🎫 *DETAIL TIKET*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`📌 #\${t.ticket_number}\\n🆔 \${t.id}\\n👤 Nama: \${t.name}\\n📱 HP: \${t.phone}\\n🏷️ Kategori: \${t.category}\\n📊 Status: \${t.status}\\n\\n📝 Deskripsi:\\n\${t.description}\\n\\n📅 Dibuat: \${new Date(t.created_at).toLocaleString("id-ID")}\\n📅 Update: \${new Date(t.updated_at).toLocaleString("id-ID")}\`;
    await reply(r);
    return;
  }

  // ── AKTIVITAS TERBARU (admin) ──
  if (text === "!aktivitas" || text === "!activity") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const [deposits, transactions, tickets, notifications] = await Promise.all([
      apiGet("deposits"), apiGet("transactions"), apiGet("tickets"), apiGet("notifications"),
    ]);
    let r = "📡 *AKTIVITAS TERBARU*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    if (deposits && deposits.length > 0) {
      r += "💳 *Deposit Terbaru:*\\n";
      deposits.slice(0, 3).forEach(d => {
        r += \`   \${d.username} — \${rp(d.amount)} (\${d.status}) \${new Date(d.created_at).toLocaleDateString("id-ID")}\\n\`;
      });
      r += "\\n";
    }
    if (transactions && transactions.length > 0) {
      r += "📋 *Transaksi Terbaru:*\\n";
      transactions.slice(0, 3).forEach(t => {
        r += \`   \${t.type === "topup" ? "➕" : "➖"} \${rp(t.amount)} — \${t.description || "-"} (\${new Date(t.created_at).toLocaleDateString("id-ID")})\\n\`;
      });
      r += "\\n";
    }
    if (tickets && tickets.length > 0) {
      r += "🎫 *Tiket Terbaru:*\\n";
      tickets.slice(0, 3).forEach(t => {
        r += \`   #\${t.ticket_number} \${t.name} — \${t.status}\\n\`;
      });
      r += "\\n";
    }
    r += \`📅 \${new Date().toLocaleString("id-ID")}\`;
    await reply(r);
    return;
  }

  // ── BACKUP INFO (admin) ──
  if (text === "!backup") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const dashboard = await apiGet("dashboard");
    let r = "💾 *INFO BACKUP DATA*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += "📊 *Jumlah Data Saat Ini:*\\n";
    if (dashboard) {
      r += \`   📦 Produk: \${dashboard.products}\\n   📢 Sponsor: \${dashboard.sponsors}\\n   👥 User: \${dashboard.users}\\n   🎵 Lagu: \${dashboard.songs}\\n   🎤 Artis: \${dashboard.artists}\\n   💳 Deposit: \${dashboard.deposits}\\n   🎫 Tiket: \${dashboard.tickets}\\n\\n\`;
    }
    r += "💡 *Tips Backup:*\\n";
    r += "   • Data tersimpan aman di cloud\\n";
    r += "   • Gunakan !dashboard untuk monitoring\\n";
    r += "   • Gunakan !report untuk laporan harian\\n";
    r += \`\\n📅 \${new Date().toLocaleString("id-ID")}\`;
    await reply(r);
    return;
  }

  // ── LEADERBOARD ADMIN (detail) ──
  if (text === "!leaderboardadmin" || text === "!lba") {
    if (!isAdmin(msg)) { await reply("🔒 Perintah ini hanya untuk admin."); return; }
    const [stats, profiles, credits] = await Promise.all([
      apiGet("game_stats"), apiGet("game_profiles"), apiGet("game_credits")
    ]);
    if (!stats || stats.length === 0) { await reply("🏆 Belum ada data game."); return; }
    const playerMap = {};
    stats.forEach(g => {
      if (!playerMap[g.visitor_id]) playerMap[g.visitor_id] = { total: 0, wins: 0, losses: 0, games: [] };
      playerMap[g.visitor_id].total += g.points;
      playerMap[g.visitor_id].wins += g.wins;
      playerMap[g.visitor_id].losses += g.losses;
      playerMap[g.visitor_id].games.push(g.game_type);
    });
    const sorted = Object.entries(playerMap).sort((a, b) => b[1].total - a[1].total).slice(0, 15);
    const medals = ["🥇", "🥈", "🥉"];
    let r = "🏆 *LEADERBOARD ADMIN (DETAIL)*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    sorted.forEach(([vid, s], i) => {
      const profile = profiles ? profiles.find(p => p.visitor_id === vid) : null;
      const credit = credits ? credits.find(c => c.visitor_id === vid) : null;
      const name = profile ? profile.display_name : vid.substring(0, 10) + "...";
      r += \`\${medals[i] || (i + 1) + "."} *\${name}*\\n\`;
      r += \`   🆔 \${vid.substring(0, 16)}\\n\`;
      r += \`   💎 \${s.total} poin | W:\${s.wins} L:\${s.losses}\\n\`;
      r += \`   🎮 Games: \${s.games.join(", ")}\\n\`;
      if (credit) r += \`   🏆 Kredit: \${credit.credits}\\n\`;
      r += "\\n";
    });
    await reply(r);
    return;
  }
  });
}

startBot();
console.log("🚀 Memulai bot WhatsApp (Baileys + Pairing Code)...");
console.log("📱 Kode 8 digit akan muncul di terminal...\\n");
`;
  }

  function generatePackageJson() {
    return JSON.stringify({
      name: "bot-wa-agungadi",
      version: "5.0.0",
      description: "Bot WhatsApp Agung Adi Store - Pairing Code",
      main: "bot.js",
      scripts: {
        start: "node bot.js",
        dev: "node bot.js"
      },
      dependencies: {
        "@whiskeysockets/baileys": "^6.7.16",
        "pino": "^9.6.0"
      },
      engines: {
        node: ">=18.0.0"
      }
    }, null, 2);
  }

  function generateReadmeMd() {
    return `# 🤖 Bot WhatsApp - Agung Adi Store v5.0

## 📋 Persyaratan
- Node.js >= 18
- NPM / Yarn

## 🚀 Cara Install

### Lokal / VPS
${"```"}bash
npm install
node bot.js 628xxxxxxxxxx
${"```"}

### Panel Pterodactyl
1. Buat server baru dengan **Egg Node.js** (versi 18+)
2. Upload semua file (bot.js, package.json) ke server
3. Set **Startup Command**: npm start
4. Di file bot.js, isi PAIRING_PHONE dengan nomor WA
5. Start server → kode 8 digit muncul di console
6. Buka WhatsApp > Linked Devices > Link with phone number
7. Masukkan kode 8 digit

## 📲 Pairing Code
Bot menggunakan sistem **Pairing Code** (bukan QR).
- Jalankan bot → kode 8 digit muncul di terminal
- Masukkan kode di WhatsApp > Linked Devices
- Sesi tersimpan di folder auth_session/

## 🔄 Reset Sesi
Jika bot error atau logout:
${"```"}bash
rm -rf auth_session
node bot.js 628xxxxxxxxxx
${"```"}

## 📌 Konfigurasi
- API_KEY — API Key dari dashboard admin
- PAIRING_PHONE — Nomor WA untuk pairing (format: 628xxx)
- ADMIN_NUMBERS — Daftar nomor admin

## 📱 Perintah
Kirim !help di chat untuk melihat semua perintah.

---
_© 2026 Agung Adi Store_
`;
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/public-api`;

  const waFullBot = `Kode bot sudah tertanam di file yang didownload.
Gunakan tombol "Download bot.js" di atas untuk mendapatkan file lengkap dengan API Key tertanam.
Atau salin kode dari panduan di atas.`;

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

# LANGKAH 3: Inisialisasi project
npm init -y

# LANGKAH 4: Install dependencies
npm install whatsapp-web.js qrcode-terminal

# LANGKAH 5: Buat file bot.js
# Salin kode dari tab "Kode Bot WA" di atas
# Paste ke file bot.js

# LANGKAH 6: Ganti API Key
# Buka file bot.js
# Cari baris: const API_KEY = "PASTE_API_KEY_DISINI";
# Ganti dengan API Key yang sudah kamu buat

# LANGKAH 7: Jalankan bot
node bot.js

# LANGKAH 8: Scan QR Code
# QR code akan muncul di terminal
# Buka WhatsApp > Menu > Linked Devices > Link a Device
# Scan QR code yang muncul

# LANGKAH 9: Test bot
# Kirim pesan "!help" ke nomor WA yang terhubung
# Bot akan membalas dengan daftar perintah

# =============================================
# ⚠️ CATATAN PENTING:
# =============================================
# - Jangan tutup terminal selama bot berjalan
# - Untuk menjalankan di background, gunakan:
#   npm install -g pm2
#   pm2 start bot.js --name "wa-bot"
#   pm2 save
#   pm2 startup
#
# - Jika QR expired, hapus folder .wwebjs_auth
#   lalu jalankan ulang: node bot.js
#
# - Pastikan internet stabil
# - Jangan gunakan nomor WA utama untuk testing
# =============================================`;

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
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Download bot.js" onClick={() => downloadBotFile(k.api_key, k.key_name)}>
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
            Pilih API Key atau masukkan manual. API Key akan otomatis tertanam di file bot.js yang didownload.
          </p>

          {/* Pilih dari API Key yang ada */}
          {keys.length > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold">Pilih API Key:</label>
              <Select value={downloadKeyId} onValueChange={(val) => {
                setDownloadKeyId(val);
                const found = keys.find(k => k.id === val);
                if (found) setCustomApiKey(found.api_key);
              }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="-- Pilih API Key --" />
                </SelectTrigger>
                <SelectContent>
                  {keys.filter(k => k.is_active).map(k => (
                    <SelectItem key={k.id} value={k.id} className="text-xs">
                      {k.key_name} — {k.api_key.substring(0, 10)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] text-muted-foreground">atau masukkan manual</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Input manual API Key */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold">API Key Manual:</label>
            <Input
              placeholder="Paste API Key di sini..."
              value={customApiKey}
              onChange={e => { setCustomApiKey(e.target.value); setDownloadKeyId(""); }}
              className="text-xs font-mono h-8"
            />
          </div>

          {/* Preview */}
          {customApiKey && (
            <div className="bg-muted rounded p-2 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground">API Key yang akan masuk di file:</p>
              <code className="text-[10px] font-mono text-primary break-all">{customApiKey}</code>
            </div>
          )}

          <Button
            size="sm"
            className="w-full gap-2"
            disabled={!customApiKey.trim()}
            onClick={() => {
              downloadBotFile(customApiKey.trim(), downloadKeyId ? keys.find(k => k.id === downloadKeyId)?.key_name || "custom" : "custom");
            }}
          >
            <Download className="w-4 h-4" /> Download bot.js (API Key Tertanam)
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            File siap pakai — tinggal <code className="bg-muted px-1 rounded">node bot.js</code>
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
                      { step: "1", title: "Install Node.js", desc: "Download dari nodejs.org (pilih LTS), lalu install." },
                      { step: "2", title: "Buat folder project", desc: "Buka terminal/CMD, ketik:" },
                      { step: "3", title: "Install library", desc: "Di folder project, ketik:" },
                      { step: "4", title: "Buat API Key", desc: "Buat API Key di halaman ini, lalu salin." },
                      { step: "5", title: "Buat file bot.js", desc: 'Salin kode dari tab "🤖 Kode Bot", paste ke file bot.js' },
                      { step: "6", title: "Paste API Key", desc: 'Di bot.js, ganti PASTE_API_KEY_DISINI dengan API Key kamu.' },
                      { step: "7", title: "Jalankan bot", desc: "Di terminal, ketik: node bot.js" },
                      { step: "8", title: "Scan QR", desc: "QR muncul di terminal → Scan di WhatsApp → Linked Devices" },
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
{`mkdir bot-wa-agungadi
cd bot-wa-agungadi
npm init -y
npm install whatsapp-web.js qrcode-terminal`}
              </pre>
              <Button size="sm" variant="outline" className="w-full gap-2 text-xs" onClick={() => copyText("mkdir bot-wa-agungadi && cd bot-wa-agungadi && npm init -y && npm install whatsapp-web.js qrcode-terminal", "Command")}>
                <Copy className="w-3 h-3" /> Salin Command Install
              </Button>

              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-3">
                  <p className="text-xs font-bold text-yellow-700">⚠️ Tips Penting:</p>
                  <ul className="text-[11px] text-muted-foreground space-y-1 mt-1 list-disc pl-3">
                    <li>Jangan tutup terminal saat bot jalan</li>
                    <li>Untuk background: install <code className="bg-muted px-1 rounded">pm2</code> lalu <code className="bg-muted px-1 rounded">pm2 start bot.js</code></li>
                    <li>QR expired? Hapus folder <code className="bg-muted px-1 rounded">.wwebjs_auth</code> lalu jalankan ulang</li>
                    <li>Gunakan nomor WA cadangan untuk testing</li>
                    <li>Pastikan koneksi internet stabil</li>
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
                Download file bot.js dari bagian atas, atau gunakan tombol download di setiap API Key. File sudah lengkap dengan semua perintah.
              </p>

              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-2">
                  <p className="text-[11px] font-bold text-blue-700 mb-1">📌 Perintah USER ({30} perintah):</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span><code>!help</code> — Menu bantuan</span>
                    <span><code>!produk</code> — Daftar produk</span>
                    <span><code>!cari [kata]</code> — Cari produk</span>
                    <span><code>!sponsor</code> — Sponsor aktif</span>
                    <span><code>!lagu</code> — Daftar lagu</span>
                    <span><code>!carilagu [kata]</code> — Cari lagu</span>
                    <span><code>!artis</code> — Daftar artis</span>
                    <span><code>!playlist</code> — Daftar playlist</span>
                    <span><code>!publik</code> — Lagu publik</span>
                    <span><code>!musikpublik</code> — Musik publik</span>
                    <span><code>!info</code> — Statistik toko</span>
                    <span><code>!ceksaldo [nama]</code> — Cek saldo</span>
                    <span><code>!cekgame [nama]</code> — Stats game</span>
                    <span><code>!paket</code> — Paket tersedia</span>
                    <span><code>!cekvoucher</code> — Voucher aktif</span>
                    <span><code>!promo</code> — Promo aktif</span>
                    <span><code>!kategori</code> — Kategori produk</span>
                    <span><code>!harga [min] [max]</code> — Filter harga</span>
                    <span><code>!random</code> — Produk random</span>
                    <span><code>!top</code> — Terpopuler</span>
                    <span><code>!detailproduk</code> — Detail produk</span>
                    <span><code>!detailsponsor</code> — Detail sponsor</span>
                    <span><code>!detailartis</code> — Detail artis</span>
                    <span><code>!lb</code> — Leaderboard</span>
                    <span><code>!bantuan</code> — FAQ</span>
                    <span><code>!syarat</code> — S&K</span>
                    <span><code>!sosmed</code> — Social media</span>
                    <span><code>!rangkuman</code> — Rangkuman</span>
                    <span><code>!toko</code> — Info toko</span>
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
                    Di file bot.js, isi array <code className="bg-muted px-1 rounded">ADMIN_NUMBERS</code> dengan nomor WA admin.
                    Format: <code className="bg-muted px-1 rounded">"628xxxxxxxxxx@c.us"</code>.
                    Jika kosong, semua bisa akses perintah admin.
                  </p>
                </CardContent>
              </Card>

              <p className="text-[10px] text-muted-foreground text-center">
                💡 Download file bot.js — total 80+ perintah lengkap.
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
