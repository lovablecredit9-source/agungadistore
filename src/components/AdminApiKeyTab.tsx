import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, Trash2, Check, Eye, EyeOff, Plus, Clock, BookOpen, Download, Bot, ChevronDown } from "lucide-react";
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

  function generateBotCode(apiKey: string) {
    return `// =============================================
// 🤖 BOT WHATSAPP - Agung Adi Store
// =============================================
// Cara pakai:
//   1. npm install whatsapp-web.js qrcode-terminal
//   2. node bot.js
//   3. Scan QR di WhatsApp > Linked Devices
// =============================================

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

// ✅ API Key sudah otomatis terisi!
const API_KEY = "${apiKey}";
const BASE = "${baseUrl}";

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("\\n📱 Scan QR code di bawah dengan WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("\\n✅ Bot WhatsApp sudah siap!");
  console.log("📋 Kirim !help di chat untuk lihat perintah\\n");
});

client.on("authenticated", () => console.log("🔐 Autentikasi berhasil!"));
client.on("auth_failure", (msg) => console.error("❌ Autentikasi gagal:", msg));

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
client.on("message", async (msg) => {
  const text = msg.body.trim().toLowerCase();

  // ── MENU ──
  if (text === "!help" || text === "!menu") {
    await msg.reply(\`🤖 *BOT AGUNG ADI STORE*
━━━━━━━━━━━━━━━━━━━━━━
📦 *!produk* — Lihat semua produk
🔍 *!cari [kata]* — Cari produk
📢 *!sponsor* — Lihat sponsor aktif
💰 *!saldo* — Cek saldo semua user
🎵 *!lagu* — Daftar lagu
💳 *!deposit* — Riwayat deposit
🎟️ *!token* — Daftar token
🔔 *!notif [pesan]* — Kirim notifikasi
📊 *!info* — Info & statistik
ℹ️ *!help* — Menu ini
━━━━━━━━━━━━━━━━━━━━━━
_Bot otomatis Agung Adi Store_\`);
    return;
  }

  // ── PRODUK ──
  if (text === "!produk") {
    const data = await apiGet("products");
    if (!data || data.length === 0) { await msg.reply("📦 Belum ada produk."); return; }
    let r = "📦 *DAFTAR PRODUK*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((p, i) => {
      r += \`*\${i + 1}. \${p.title}*\\n\`;
      r += \`   💰 \${rp(p.price)}\\n\`;
      r += \`   📦 Stok: \${p.stock}\\n\`;
      if (p.category) r += \`   🏷️ \${p.category}\\n\`;
      if (p.description) r += \`   📝 \${p.description.substring(0, 80)}\\n\`;
      r += "\\n";
    });
    r += \`_Total: \${data.length} produk_\`;
    await msg.reply(r);
    return;
  }

  // ── CARI PRODUK ──
  if (text.startsWith("!cari ")) {
    const keyword = msg.body.trim().substring(6).toLowerCase();
    const data = await apiGet("products");
    if (!data) { await msg.reply("❌ Gagal mengambil data."); return; }
    const hasil = data.filter(
      (p) =>
        p.title.toLowerCase().includes(keyword) ||
        (p.category || "").toLowerCase().includes(keyword) ||
        (p.description || "").toLowerCase().includes(keyword)
    );
    if (hasil.length === 0) {
      await msg.reply(\`🔍 Tidak ditemukan produk "*\${keyword}*"\`);
      return;
    }
    let r = \`🔍 *HASIL: "\${keyword}"*\\n━━━━━━━━━━━━━━━━━━\\n\\n\`;
    hasil.forEach((p, i) => {
      r += \`*\${i + 1}. \${p.title}*\\n   💰 \${rp(p.price)} | 📦 Stok: \${p.stock}\\n\\n\`;
    });
    r += \`_Ditemukan: \${hasil.length} produk_\`;
    await msg.reply(r);
    return;
  }

  // ── SPONSOR ──
  if (text === "!sponsor") {
    const data = await apiGet("sponsors");
    if (!data || data.length === 0) { await msg.reply("📢 Belum ada sponsor."); return; }
    let r = "📢 *DAFTAR SPONSOR*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((s, i) => {
      r += \`*\${i + 1}. \${s.title}* (#\${s.sponsor_number})\\n\`;
      r += \`   👤 \${s.seller_name}\\n\`;
      r += \`   💰 \${rp(s.price)} | 📦 Stok: \${s.stock}\\n\`;
      if (s.wa_number) r += \`   📱 WA: \${s.wa_number}\\n\`;
      r += \`   ⏰ \${s.is_active ? "✅ Aktif" : "❌ Nonaktif"}\\n\\n\`;
    });
    await msg.reply(r);
    return;
  }

  // ── SALDO ──
  if (text === "!saldo") {
    const data = await apiGet("balances");
    if (!data || data.length === 0) { await msg.reply("💰 Belum ada data saldo."); return; }
    let r = "💰 *DAFTAR SALDO*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((b, i) => {
      r += \`\${i + 1}. *\${b.username}*: \${rp(b.balance)}\\n\`;
    });
    await msg.reply(r);
    return;
  }

  // ── LAGU ──
  if (text === "!lagu") {
    const data = await apiGet("songs");
    if (!data || data.length === 0) { await msg.reply("🎵 Belum ada lagu."); return; }
    let r = "🎵 *DAFTAR LAGU*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((s, i) => {
      const dur = s.duration ? \`\${Math.floor(s.duration / 60)}:\${String(s.duration % 60).padStart(2, "0")}\` : "-";
      r += \`\${i + 1}. *\${s.title}* — \${s.artist} (\${dur})\\n\`;
    });
    r += \`\\n_Total: \${data.length} lagu_\`;
    await msg.reply(r);
    return;
  }

  // ── DEPOSIT ──
  if (text === "!deposit") {
    const data = await apiGet("deposits");
    if (!data || data.length === 0) { await msg.reply("💳 Belum ada deposit."); return; }
    let r = "💳 *RIWAYAT DEPOSIT*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.slice(0, 10).forEach((d, i) => {
      const tgl = new Date(d.created_at).toLocaleString("id-ID");
      r += \`\${i + 1}. *\${d.username}* — \${rp(d.amount)}\\n\`;
      r += \`   📅 \${tgl}\\n\`;
      r += \`   💳 \${d.payment_method.toUpperCase()} | \${d.status === "success" ? "✅" : "⏳"} \${d.status}\\n\\n\`;
    });
    await msg.reply(r);
    return;
  }

  // ── TOKEN ──
  if (text === "!token") {
    const data = await apiGet("tokens");
    if (!data || data.length === 0) { await msg.reply("🎟️ Belum ada token."); return; }
    let r = "🎟️ *DAFTAR TOKEN*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.slice(0, 15).forEach((t, i) => {
      const produk = t.products ? t.products.title : "-";
      r += \`\${i + 1}. \${t.token_code}\\n   📦 \${produk} | \${t.is_claimed ? "✅ Diklaim" : "⏳ Belum"}\\n\\n\`;
    });
    await msg.reply(r);
    return;
  }

  // ── INFO / STATISTIK ──
  if (text === "!info") {
    const [produk, sponsor, saldo, lagu] = await Promise.all([
      apiGet("products"),
      apiGet("sponsors"),
      apiGet("balances"),
      apiGet("songs"),
    ]);
    let r = "📊 *STATISTIK TOKO*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    r += \`📦 Produk: \${produk ? produk.length : 0}\\n\`;
    r += \`📢 Sponsor: \${sponsor ? sponsor.length : 0}\\n\`;
    r += \`👥 User: \${saldo ? saldo.length : 0}\\n\`;
    r += \`🎵 Lagu: \${lagu ? lagu.length : 0}\\n\`;
    if (saldo && saldo.length > 0) {
      const totalSaldo = saldo.reduce((s, b) => s + Number(b.balance), 0);
      r += \`\\n💰 Total saldo: \${rp(totalSaldo)}\\n\`;
    }
    r += \`\\n📅 \${new Date().toLocaleString("id-ID")}\`;
    await msg.reply(r);
    return;
  }

  // ── NOTIFIKASI ──
  if (text.startsWith("!notif ")) {
    const pesan = msg.body.trim().substring(7);
    if (!pesan) { await msg.reply("❌ Tulis: !notif [isi pesan]"); return; }
    const result = await apiPost("notifications", {
      visitor_id: "wa-bot",
      title: "Notifikasi Bot WA",
      message: pesan,
      type: "info",
    });
    await msg.reply(result && result.success ? "✅ Notifikasi terkirim!" : "❌ Gagal mengirim.");
    return;
  }
});

client.initialize();
console.log("🚀 Memulai bot WhatsApp...");
console.log("📱 Tunggu QR code muncul...\\n");
`;
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/public-api`;

  const waFullBot = `// =============================================
// 🤖 BOT WHATSAPP - Agung Adi Store (LENGKAP)
// =============================================
// File: bot.js
// Jalankan: node bot.js
// =============================================

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

// ⚠️ GANTI DENGAN API KEY KAMU!
const API_KEY = "PASTE_API_KEY_DISINI";
const BASE = "${baseUrl}";

// Inisialisasi client dengan sesi tersimpan
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

// Tampilkan QR untuk login
client.on("qr", (qr) => {
  console.log("📱 Scan QR code di bawah dengan WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Bot WhatsApp sudah siap!");
  console.log("📋 Ketik !help di chat untuk lihat perintah");
});

client.on("authenticated", () => {
  console.log("🔐 Autentikasi berhasil!");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Autentikasi gagal:", msg);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper: panggil API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.error("API Error:", err.message);
    return null;
  }
}

// Format angka ke Rupiah
function rp(n) {
  return "Rp " + Number(n).toLocaleString("id-ID");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Handler pesan masuk
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
client.on("message", async (msg) => {
  const text = msg.body.trim().toLowerCase();
  const chat = await msg.getChat();

  // ── MENU BANTUAN ──
  if (text === "!help" || text === "!menu") {
    const menu = \`🤖 *BOT AGUNG ADI STORE*
━━━━━━━━━━━━━━━━━━━━━━
📦 *!produk* — Lihat semua produk
🔍 *!cari [kata]* — Cari produk
📢 *!sponsor* — Lihat sponsor aktif
💰 *!saldo* — Cek saldo semua user
🎵 *!lagu* — Daftar lagu
💳 *!deposit* — Riwayat deposit
🎟️ *!token* — Daftar token
🔔 *!notif [pesan]* — Kirim notifikasi
ℹ️ *!help* — Tampilkan menu ini
━━━━━━━━━━━━━━━━━━━━━━
_Bot otomatis Agung Adi Store_\`;
    await msg.reply(menu);
    return;
  }

  // ── DAFTAR PRODUK ──
  if (text === "!produk") {
    const data = await apiGet("products");
    if (!data || data.length === 0) {
      await msg.reply("📦 Belum ada produk.");
      return;
    }
    let reply = "📦 *DAFTAR PRODUK*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((p, i) => {
      reply += \`*\${i + 1}. \${p.title}*\\n\`;
      reply += \`   💰 \${rp(p.price)}\\n\`;
      reply += \`   📦 Stok: \${p.stock}\\n\`;
      if (p.category) reply += \`   🏷️ Kategori: \${p.category}\\n\`;
      if (p.description) reply += \`   📝 \${p.description.substring(0, 80)}\\n\`;
      reply += "\\n";
    });
    reply += \`_Total: \${data.length} produk_\`;
    await msg.reply(reply);
    return;
  }

  // ── CARI PRODUK ──
  if (text.startsWith("!cari ")) {
    const keyword = msg.body.trim().substring(6).toLowerCase();
    const data = await apiGet("products");
    if (!data) { await msg.reply("❌ Gagal mengambil data."); return; }
    const hasil = data.filter(
      (p) =>
        p.title.toLowerCase().includes(keyword) ||
        (p.category || "").toLowerCase().includes(keyword) ||
        (p.description || "").toLowerCase().includes(keyword)
    );
    if (hasil.length === 0) {
      await msg.reply(\`🔍 Tidak ditemukan produk dengan kata kunci "*\${keyword}*"\`);
      return;
    }
    let reply = \`🔍 *HASIL PENCARIAN: "\${keyword}"*\\n━━━━━━━━━━━━━━━━━━\\n\\n\`;
    hasil.forEach((p, i) => {
      reply += \`*\${i + 1}. \${p.title}*\\n\`;
      reply += \`   💰 \${rp(p.price)} | 📦 Stok: \${p.stock}\\n\\n\`;
    });
    reply += \`_Ditemukan: \${hasil.length} produk_\`;
    await msg.reply(reply);
    return;
  }

  // ── DAFTAR SPONSOR ──
  if (text === "!sponsor") {
    const data = await apiGet("sponsors");
    if (!data || data.length === 0) {
      await msg.reply("📢 Belum ada sponsor.");
      return;
    }
    let reply = "📢 *DAFTAR SPONSOR*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((s, i) => {
      reply += \`*\${i + 1}. \${s.title}* (#\${s.sponsor_number})\\n\`;
      reply += \`   👤 \${s.seller_name}\\n\`;
      reply += \`   💰 \${rp(s.price)}\\n\`;
      reply += \`   📦 Stok: \${s.stock}\\n\`;
      if (s.wa_number) reply += \`   📱 WA: \${s.wa_number}\\n\`;
      reply += \`   ⏰ Status: \${s.is_active ? "✅ Aktif" : "❌ Nonaktif"}\\n\\n\`;
    });
    await msg.reply(reply);
    return;
  }

  // ── CEK SALDO ──
  if (text === "!saldo") {
    const data = await apiGet("balances");
    if (!data || data.length === 0) {
      await msg.reply("💰 Belum ada data saldo.");
      return;
    }
    let reply = "💰 *DAFTAR SALDO USER*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((b, i) => {
      reply += \`\${i + 1}. *\${b.username}*: \${rp(b.balance)}\\n\`;
    });
    await msg.reply(reply);
    return;
  }

  // ── DAFTAR LAGU ──
  if (text === "!lagu") {
    const data = await apiGet("songs");
    if (!data || data.length === 0) {
      await msg.reply("🎵 Belum ada lagu.");
      return;
    }
    let reply = "🎵 *DAFTAR LAGU*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.forEach((s, i) => {
      const durasi = s.duration ? \`\${Math.floor(s.duration / 60)}:\${String(s.duration % 60).padStart(2, "0")}\` : "-";
      reply += \`\${i + 1}. *\${s.title}* — \${s.artist}\\n\`;
      reply += \`   ⏱️ \${durasi}\\n\\n\`;
    });
    reply += \`_Total: \${data.length} lagu_\`;
    await msg.reply(reply);
    return;
  }

  // ── RIWAYAT DEPOSIT ──
  if (text === "!deposit") {
    const data = await apiGet("deposits");
    if (!data || data.length === 0) {
      await msg.reply("💳 Belum ada deposit.");
      return;
    }
    let reply = "💳 *RIWAYAT DEPOSIT*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.slice(0, 10).forEach((d, i) => {
      const tgl = new Date(d.created_at).toLocaleString("id-ID");
      reply += \`\${i + 1}. *\${d.username}* — \${rp(d.amount)}\\n\`;
      reply += \`   📅 \${tgl}\\n\`;
      reply += \`   💳 \${d.payment_method.toUpperCase()} | \${d.status === "success" ? "✅" : "⏳"} \${d.status}\\n\\n\`;
    });
    await msg.reply(reply);
    return;
  }

  // ── DAFTAR TOKEN ──
  if (text === "!token") {
    const data = await apiGet("tokens");
    if (!data || data.length === 0) {
      await msg.reply("🎟️ Belum ada token.");
      return;
    }
    let reply = "🎟️ *DAFTAR TOKEN*\\n━━━━━━━━━━━━━━━━━━\\n\\n";
    data.slice(0, 15).forEach((t, i) => {
      const produk = t.products ? t.products.title : "-";
      reply += \`\${i + 1}. \${t.token_code}\\n\`;
      reply += \`   📦 \${produk} | \${t.is_claimed ? "✅ Diklaim" : "⏳ Belum"}\\n\\n\`;
    });
    await msg.reply(reply);
    return;
  }

  // ── KIRIM NOTIFIKASI ──
  if (text.startsWith("!notif ")) {
    const pesan = msg.body.trim().substring(7);
    if (!pesan) { await msg.reply("❌ Tulis pesan: !notif [isi pesan]"); return; }
    const result = await apiPost("notifications", {
      visitor_id: "wa-bot",
      title: "Notifikasi dari Bot WA",
      message: pesan,
      type: "info",
    });
    if (result && result.success) {
      await msg.reply("✅ Notifikasi berhasil dikirim!");
    } else {
      await msg.reply("❌ Gagal mengirim notifikasi.");
    }
    return;
  }
});

// Jalankan bot
client.initialize();
console.log("🚀 Memulai bot WhatsApp...");
console.log("📱 Tunggu QR code muncul...");`;

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
                Salin kode di bawah, paste ke file <code className="bg-muted px-1 rounded font-bold">bot.js</code>, ganti API Key, lalu jalankan <code className="bg-muted px-1 rounded">node bot.js</code>
              </p>

              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-2">
                  <p className="text-[11px] font-bold text-green-700 mb-1">📋 Perintah yang tersedia di bot:</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span><code>!help</code> — Menu bantuan</span>
                    <span><code>!produk</code> — Daftar produk</span>
                    <span><code>!cari [kata]</code> — Cari produk</span>
                    <span><code>!sponsor</code> — Daftar sponsor</span>
                    <span><code>!saldo</code> — Saldo user</span>
                    <span><code>!lagu</code> — Daftar lagu</span>
                    <span><code>!deposit</code> — Riwayat deposit</span>
                    <span><code>!token</code> — Daftar token</span>
                    <span><code>!notif [isi]</code> — Kirim notif</span>
                  </div>
                </CardContent>
              </Card>

              <pre className="text-[9px] bg-muted p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto border">
                {waFullBot}
              </pre>

              <Button size="sm" className="w-full gap-2" onClick={() => copyText(waFullBot, "Kode bot WA")}>
                <Copy className="w-3 h-3" /> Salin Kode Bot (Siap Pakai)
              </Button>
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
                <p className="text-xs font-bold mb-1">Endpoint GET:</p>
                <div className="space-y-1">
                  {[
                    { ep: "products", desc: "Semua produk (judul, harga, stok, gambar, kategori)" },
                    { ep: "sponsors", desc: "Sponsor/iklan aktif (penjual, harga, kontak)" },
                    { ep: "balances", desc: "Saldo user (username, balance)" },
                    { ep: "songs", desc: "Lagu di playlist (judul, artis, durasi)" },
                    { ep: "deposits", desc: "Riwayat deposit (status, metode, jumlah)" },
                    { ep: "tokens", desc: "Token & info produk terkait" },
                    { ep: "notifications", desc: "Notifikasi (tambah &visitor_id=xxx)" },
                  ].map(e => (
                    <div key={e.ep} className="flex items-start gap-1.5 text-[11px]">
                      <code className="bg-primary/10 text-primary px-1 rounded shrink-0 font-mono text-[10px]">{e.ep}</code>
                      <span className="text-muted-foreground">{e.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold mb-1">Endpoint POST:</p>
                <div className="text-[11px] space-y-1">
                  <code className="bg-primary/10 text-primary px-1 rounded font-mono text-[10px]">notifications</code>
                  <pre className="text-[9px] bg-muted p-2 rounded font-mono mt-1">{`{
  "visitor_id": "xxx",
  "title": "Judul",
  "message": "Isi pesan",
  "type": "info"
}`}</pre>
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
                <p className="text-xs font-bold mb-1">Contoh Python:</p>
                <pre className="text-[9px] bg-muted p-2 rounded font-mono whitespace-pre-wrap">{`import requests

API_KEY = "YOUR_KEY"
BASE = "${baseUrl}"
headers = {"x-api-key": API_KEY}

res = requests.get(
  f"{BASE}?endpoint=products",
  headers=headers
)
data = res.json()["data"]
for p in data:
    print(f"{p['title']} - Rp {p['price']:,}")`}</pre>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] mt-1" onClick={() => copyText(`import requests\n\nAPI_KEY = "YOUR_KEY"\nBASE = "${baseUrl}"\nheaders = {"x-api-key": API_KEY}\n\nres = requests.get(f"{BASE}?endpoint=products", headers=headers)\ndata = res.json()["data"]\nfor p in data:\n    print(f"{p['title']} - Rp {p['price']:,}")`, "Python")}>
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
