import { useState, useEffect } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, Trash2, Check, Eye, EyeOff, Plus, Clock, BookOpen, Download, Bot, ChevronDown, Phone } from "lucide-react";
import botTemplate from "@/lib/wa-bot-template.js?raw";
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

const BOT_FILE_VERSION = "13.9.0";

function normalizePairingPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("620")) return `62${digits.slice(3)}`;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export default function AdminApiKeyTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keyName, setKeyName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showUsage, setShowUsage] = useState(false);
  const [downloadKeyId, setDownloadKeyId] = useState<string>("");
  
  const [adminNumbers, setAdminNumbers] = useState<string[]>([""]);
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

  async function downloadBotFile(apiKey: string, keyName: string, target: "pterodactyl" | "termux" = "pterodactyl") {
    try {
      const zip = new JSZip();
      const safeName = keyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "bot-wa";

      const firstAdmin = adminNumbers.find(n => n.trim().length >= 10);
      zip.file("index.js", generateBotCode(apiKey, firstAdmin?.trim() || undefined));
      zip.file("package.json", generatePackageJson());

      if (target === "termux") {
        zip.file("README.md", generateReadmeTermux());
        zip.file("install.sh", generateTermuxInstallScript());
        zip.file(".npmrc", "bin-links=false\nfund=false\naudit=false\n");
      } else {
        zip.file("README.md", generateReadmeMd());
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}-bot-wa-${target}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `ZIP ${target === "termux" ? "Termux" : "Pterodactyl"} berhasil didownload! 📦` });
    } catch {
      toast({ title: "Gagal membuat ZIP bot", variant: "destructive" });
    }
  }

  function generateTermuxInstallScript() {
    return `#!/data/data/com.termux/files/usr/bin/bash
# ============================================
# 🤖 Installer Bot WA - Termux (Agung Adi Store)
# ============================================
# PENTING: JANGAN jalankan dari /sdcard atau /storage/emulated
# Karena partisi itu FAT32 tidak support symlink → error EACCES
# ============================================
set -e

echo "📦 Update paket Termux..."
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts git ffmpeg

# Pastikan kita di internal storage Termux, bukan /sdcard
CURDIR="$(pwd)"
case "$CURDIR" in
  /sdcard*|/storage/*)
    echo "⚠️  Kamu di $CURDIR (eksternal). Memindahkan ke ~/bot-wa ..."
    mkdir -p "$HOME/bot-wa"
    cp -r ./* "$HOME/bot-wa/" 2>/dev/null || true
    cp -r ./.npmrc "$HOME/bot-wa/" 2>/dev/null || true
    cd "$HOME/bot-wa"
    echo "✅ Sekarang di: $(pwd)"
    ;;
esac

echo "🧹 Bersihkan node_modules lama..."
rm -rf node_modules package-lock.json

echo "🎙️ Pastikan ffmpeg terpasang (untuk voice note)..."
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "   ffmpeg belum ada, mencoba install..."
  (command -v pkg >/dev/null 2>&1 && pkg install -y ffmpeg) || \
  (command -v apt >/dev/null 2>&1 && apt install -y ffmpeg) || \
  echo "   ⚠️ Install ffmpeg manual: pkg install ffmpeg"
fi

echo "📥 Install dependencies (no symlink agar aman di Termux)..."
npm install --no-bin-links --no-audit --no-fund

echo ""
echo "✅ Selesai! Jalankan bot dengan:"
echo "   cd $(pwd)"
echo "   node index.js"
echo ""
`;
  }

  function generateBotCode(apiKey: string, phoneNumber?: string) {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
    const supabaseUrl = `https://${projectId}.supabase.co`;
    const base = `${supabaseUrl}/functions/v1/public-api`;
    const web = `https://produkklaimtransaksiagungadistore.lovable.app`;
    const phone = phoneNumber ? normalizePairingPhoneInput(phoneNumber) : "";
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

    const validAdmins = adminNumbers.filter(n => n.trim().length >= 10);
    const adminArr = validAdmins.length > 0
      ? `[\n  ${validAdmins.map(n => `"${normalizePairingPhoneInput(n)}@s.whatsapp.net"`).join(",\n  ")}\n]`
      : `[]`;

    return botTemplate
      .replace('__BOT_API_KEY__', apiKey)
      .replace('__BOT_BASE_URL__', base)
      .replace('__BOT_WEB_URL__', web)
      .replace('__BOT_PAIRING_PHONE__', phone)
      .replace('__BOT_SUPABASE_URL__', supabaseUrl)
      .replace('__BOT_SUPABASE_ANON_KEY__', anonKey)
      .replace('__BOT_ADMIN_NUMBERS__', adminArr);
  }


  function generatePackageJson() {
    return JSON.stringify({
      name: "bot-wa-agungadi",
        version: BOT_FILE_VERSION,
        description: `Bot WhatsApp Agung Adi Store v${BOT_FILE_VERSION} - Confess chat per nomor + balasan 24 jam`,
      main: "index.js",
      scripts: {
        start: "node index.js",
        dev: "node index.js"
      },
      dependencies: {
        "@whiskeysockets/baileys": "^6.7.16",
        "@resvg/resvg-js": "^2.6.2",
        "pino": "^9.6.0",
        "qrcode-terminal": "^0.12.0",
        "qrcode": "^1.5.4"
      },
      engines: {
        node: ">=18.0.0"
      }
    }, null, 2);
  }

  function generateReadmeMd() {    
    return `# 🤖 Bot WhatsApp - Agung Adi Store v${BOT_FILE_VERSION}

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
6. Jika pilih pairing, masukkan nomor WA (08xxx / 628xxx) lalu tekan Enter
7. Tunggu sampai bot menulis **KODE PAIRING AKTIF** dan baris **RAW** di console / terminal
8. Di HP, buka WhatsApp > Linked Devices > Link with phone number lalu masukkan **RAW code** itu secara manual tanpa spasi/strip
9. Tidak ada notif/chat otomatis ke WhatsApp - kodenya hanya tampil di terminal
10. Jika gagal / expired, bot akan reset sesi pairing dan membuat kode baru
11. Untuk bot sewaan, QR child bot akan otomatis dibuat ulang jika koneksi awal gagal
12. Batas generate QR: 6x per subscription (anti-spam)
13. Gunakan !riwayatbot untuk lihat semua bot, !qr [nomor] untuk generate QR

## 📲 Login WhatsApp
Bot mendukung **2 mode login**:
- **1. Scan QR** → QR muncul di terminal
- **2. Pairing nomor** → masukkan nomor WA lalu satu kode pairing aktif muncul di terminal
- Kode pairing tidak dikirim lewat chat / notif WhatsApp
- Setelah nomor dimasukkan, kamu tetap harus buka menu Linked Devices di HP sendiri
- Gunakan baris **RAW** saat input di WhatsApp, jangan yang pakai strip
- Kode pairing berlaku sekitar 20 detik - segera masukkan
- Sesi tersimpan di folder auth_session/
- Bot hanya menjaga satu kode aktif per sesi agar kode tidak tertimpa update koneksi
- Bot otomatis hapus sesi stale saat pairing untuk koneksi bersih
- Jika koneksi awal putus, bot akan reconnect otomatis sampai 8x

## 🔄 Reset Sesi
Jika bot error, logout, atau koneksi close saat pairing:
${"```"}bash
rm -rf auth_session
node index.js
${"```"}

## 📌 Konfigurasi
- API_KEY - API Key dari dashboard admin
- ADMIN_NUMBERS - Daftar nomor admin (nomor pertama otomatis jadi default pairing)

## 📱 Perintah
Kirim !menu / .menu / /menu di chat untuk melihat semua perintah.

---
_© 2026 Agung Adi Store_
`;
  }

  function generateReadmeTermux() {
    return `# 🤖 Bot WhatsApp - Termux Edition v${BOT_FILE_VERSION}

## ⚠️ PENTING SEBELUM MULAI
Termux **TIDAK BISA** install bot di folder \`/sdcard\` atau \`/storage/emulated/0\`
karena partisi SD card pakai FAT32 yang **tidak mendukung symlink**.
Ini sebabnya muncul error: \`EACCES: permission denied, symlink ... pino/bin.js\`

## 🚀 Cara Install (otomatis)
${"```"}bash
pkg install -y nodejs-lts git unzip ffmpeg
cd ~ && mkdir -p bot-wa && cd bot-wa
# extract isi ZIP ke folder ini (jangan di /sdcard), lalu:
bash install.sh
node index.js
${"```"}

## 🛠️ Manual (jika install.sh gagal)
${"```"}bash
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts git ffmpeg
cd ~ && mkdir -p bot-wa && cd bot-wa
rm -rf node_modules package-lock.json
npm install --no-bin-links --no-audit --no-fund
node index.js
${"```"}

## 📂 Akses File via HP
Folder bot ada di: \`/data/data/com.termux/files/home/bot-wa\`
Untuk akses dari File Manager HP:
${"```"}bash
termux-setup-storage
ln -sf ~/bot-wa /sdcard/bot-wa-link
${"```"}

## ❌ Error Umum
| Error | Solusi |
|-------|--------|
| EACCES symlink pino/bin.js | Pindah ke \`~/bot-wa\` (BUKAN /sdcard), pakai \`--no-bin-links\` |
| Cannot find module '@whiskeysockets/baileys' | npm install gagal. \`rm -rf node_modules && npm install --no-bin-links\` |
| Killed saat install | RAM habis - tutup app lain |
| gyp ERR | \`pkg install python make clang\` lalu ulang |

## 📲 Login WhatsApp
Pilih **1** (QR) atau **2** (pairing nomor). Untuk pairing, masukkan nomor WA,
catat baris **RAW** di terminal, buka WhatsApp > Linked Devices > Link with phone number,
input kode RAW tanpa spasi.

## 🔄 Reset Sesi
${"```"}bash
rm -rf auth_session && node index.js
${"```"}

## 📱 Perintah
Kirim \`!menu\` ke nomor bot untuk lihat semua perintah.

---
_© 2026 Agung Adi Store - Termux Edition_
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
# Kirim pesan "!menu" atau ".menu" atau "/menu" ke nomor WA yang terhubung
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
# - Jika pairing gagal, bot otomatis hapus sesi lama
#   Jika masih gagal manual: rm -rf auth_session && node index.js
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
             Pilih API Key aktif. Nanti terdownload ZIP terbaru berisi index.js, package.json, dan README.md.
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
                      {k.key_name} - {k.api_key.substring(0, 10)}...
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


          {/* Input nomor Admin */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold flex items-center gap-1">
              <Phone className="w-3 h-3" /> 🔐 Nomor Admin Bot:
            </label>
            <p className="text-[10px] text-muted-foreground mb-1">
              Nomor admin pertama otomatis jadi default pairing. Hanya nomor di list ini yang bisa akses perintah admin. Input 08xxx otomatis jadi 62xxx.
            </p>
            {adminNumbers.map((num, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <Input
                  placeholder="628xxxxxxxxxx"
                  value={num}
                  onChange={e => {
                    const updated = [...adminNumbers];
                    updated[idx] = normalizePairingPhoneInput(e.target.value);
                    setAdminNumbers(updated);
                  }}
                  className="text-xs font-mono h-8 flex-1"
                />
                {adminNumbers.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive"
                    onClick={() => setAdminNumbers(adminNumbers.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1 text-xs h-7"
              onClick={() => setAdminNumbers([...adminNumbers, ""])}
            >
              <Plus className="w-3 h-3" /> Tambah Admin
            </Button>
          </div>

          {/* Preview */}
          {selectedDownloadKey && (
            <div className="bg-muted rounded p-2 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground">API Key yang akan masuk di index.js:</p>
              <code className="text-[10px] font-mono text-primary break-all">{selectedDownloadKey.api_key}</code>
              {adminNumbers.filter(n => n.trim().length >= 10).length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground mt-1">Admin Numbers:</p>
                  {adminNumbers.filter(n => n.trim().length >= 10).map((n, i) => (
                    <code key={i} className="text-[10px] font-mono text-primary block">{n}@s.whatsapp.net</code>
                  ))}
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              className="gap-1"
              disabled={!selectedDownloadKey}
              onClick={() => selectedDownloadKey && downloadBotFile(selectedDownloadKey.api_key, selectedDownloadKey.key_name, "pterodactyl")}
            >
              <Download className="w-4 h-4" /> Pterodactyl
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="gap-1"
              disabled={!selectedDownloadKey}
              onClick={() => selectedDownloadKey && downloadBotFile(selectedDownloadKey.api_key, selectedDownloadKey.key_name, "termux")}
            >
              <Download className="w-4 h-4" /> Termux
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
              📲 v{BOT_FILE_VERSION} - <b>Pterodactyl</b>: upload & <code className="bg-muted px-1 rounded">npm start</code>. <b>Termux</b>: extract di <code className="bg-muted px-1 rounded">~/bot-wa</code> (BUKAN /sdcard), lalu <code className="bg-muted px-1 rounded">bash install.sh</code>
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
                       { step: "6", title: "Login ke WhatsApp", desc: "Kalau pilih pairing, masukkan nomor WA lalu Enter, tunggu tulisan KODE PAIRING AKTIF dan RAW muncul, lalu buka WhatsApp di HP > Linked Devices > Link with phone number dan masukkan RAW code tanpa spasi/strip." },
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
                     <li>Kode pairing muncul di terminal - pakai baris RAW dan masukkan dalam 20 detik, bukan lewat notif/chat WA</li>
                     <li>Setelah input nomor di panel, WhatsApp tidak kirim notif otomatis; kamu harus buka menu Linked Devices sendiri</li>
                     <li>Bot sekarang menjaga satu kode aktif per sesi supaya kode tidak ketimpa dan ditolak WhatsApp</li>
                     <li>Bot otomatis hapus sesi lama saat pairing agar koneksi bersih</li>
                    <li>Sesi error? Hapus folder <code className="bg-muted px-1 rounded">auth_session</code> lalu jalankan ulang</li>
                    <li>Gunakan nomor WA cadangan untuk testing</li>
                    <li>Pastikan koneksi internet stabil</li>
                    <li>Bot menggunakan Baileys - tidak perlu Chrome/Puppeteer</li>
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
                    <span><code>!menu</code>/<code>.menu</code>/<code>/menu</code> - Menu bantuan</span>
                    <span><code>!login</code> - Login akun</span>
                    <span><code>!logout</code> - Logout akun</span>
                    <span><code>!saldoku</code> - Cek saldo</span>
                    <span><code>!profilku</code> - Profil lengkap</span>
                    <span><code>!riwayat</code> - Riwayat transaksi</span>
                    <span><code>!detailtrx</code> - Detail transaksi</span>
                    <span><code>!gameku</code> - Stats game</span>
                    <span><code>!kreditku</code> - Kredit game</span>
                    <span><code>!streakku</code> - Status streak</span>
                    <span><code>!notifku</code> - Notifikasi</span>
                    <span><code>!beli [nama]</code> - Beli produk</span>
                    <span><code>!belistreak</code> - Beli streak</span>
                    <span><code>!belikredit</code> - Beli kredit</span>
                    <span><code>!belistorage</code> - Beli storage</span>
                    <span><code>!belibundle</code> - Beli bundle</span>
                    <span><code>!buatpin</code> - Buat PIN</span>
                    <span><code>!grosir [nama]</code> - Harga grosir</span>
                    <span><code>!flashsale</code> - Info flash sale</span>
                    <span><code>!produk</code> - Daftar produk</span>
                    <span><code>!cari [kata]</code> - Cari produk</span>
                    <span><code>!sponsor</code> - Sponsor aktif</span>
                    <span><code>!lagu</code> - Daftar lagu</span>
                    <span><code>!carilagu [kata]</code> - Cari lagu</span>
                    <span><code>!download [judul]</code> - Download lagu</span>
                    <span><code>!artis</code> - Daftar artis</span>
                    <span><code>!playlist</code> - Daftar playlist</span>
                    <span><code>!publik</code> - Lagu publik</span>
                    <span><code>!info</code> - Statistik toko</span>
                    <span><code>!ceksaldo [nama]</code> - Cek saldo</span>
                    <span><code>!cekgame [nama]</code> - Stats game</span>
                    <span><code>!paket</code> - Paket tersedia</span>
                    <span><code>!cekvoucher</code> - Voucher aktif</span>
                    <span><code>!promo</code> - Promo aktif</span>
                    <span><code>!kategori</code> - Kategori</span>
                    <span><code>!harga [min] [max]</code> - Filter</span>
                    <span><code>!random</code> - Produk random</span>
                    <span><code>!top</code> - Terpopuler</span>
                    <span><code>!detailproduk</code> - Detail produk</span>
                    <span><code>!detailsponsor</code> - Detail sponsor</span>
                    <span><code>!detailartis</code> - Detail artis</span>
                    <span><code>!lb</code> - Leaderboard</span>
                    <span><code>!bantuan</code> - FAQ</span>
                    <span><code>!syarat</code> - S&K</span>
                    <span><code>!waktu</code> - Waktu server</span>
                    <span><code>!versi</code> - Info bot</span>
                    <span><code>!ping</code> - Status bot</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="p-2">
                  <p className="text-[11px] font-bold text-red-700 mb-1">🔐 Perintah ADMIN ({52} perintah):</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span><code>!admin</code> - Menu admin</span>
                    <span><code>!saldo</code> - Semua saldo</span>
                    <span><code>!tambahsaldo</code> - Tambah saldo</span>
                    <span><code>!kurangsaldo</code> - Kurangi saldo</span>
                    <span><code>!resetsaldo</code> - Reset saldo</span>
                    <span><code>!setsaldo</code> - Set saldo</span>
                    <span><code>!deposit</code> - Riwayat deposit</span>
                    <span><code>!setdeposit</code> - Ubah status</span>
                    <span><code>!rekapdeposit</code> - Rekap deposit</span>
                    <span><code>!token</code> - Daftar token</span>
                    <span><code>!tokendetail</code> - Detail token</span>
                    <span><code>!game [vid]</code> - Stats game</span>
                    <span><code>!kredit [vid]</code> - Kredit game</span>
                    <span><code>!setkredit</code> - Set kredit</span>
                    <span><code>!resetkredit</code> - Reset kredit</span>
                    <span><code>!resetgame</code> - Reset game stats</span>
                    <span><code>!leaderboardadmin</code> - LB detail</span>
                    <span><code>!streak [vid]</code> - Status streak</span>
                    <span><code>!resetstreak</code> - Reset streak</span>
                    <span><code>!setstreak</code> - Set streak</span>
                    <span><code>!streaksub</code> - Langganan streak</span>
                    <span><code>!storage [vid]</code> - Storage</span>
                    <span><code>!resetstorage</code> - Reset storage</span>
                    <span><code>!profil [vid]</code> - Profil game</span>
                    <span><code>!stok [id] [n]</code> - Stok produk</span>
                    <span><code>!produkdetail</code> - Detail produk</span>
                    <span><code>!sponsordetail</code> - Detail sponsor</span>
                    <span><code>!stoksponsor</code> - Stok sponsor</span>
                    <span><code>!user [nama]</code> - Cari user</span>
                    <span><code>!alluser</code> - Semua user</span>
                    <span><code>!topuser</code> - Top user saldo</span>
                    <span><code>!detailuser</code> - Detail lengkap</span>
                    <span><code>!loginhistory</code> - Riwayat login</span>
                    <span><code>!transaksi</code> - Riwayat trx</span>
                    <span><code>!musikprofil</code> - Profil musik</span>
                    <span><code>!follow</code> - Stats follow</span>
                    <span><code>!tiket</code> - Tiket support</span>
                    <span><code>!settiket</code> - Status tiket</span>
                    <span><code>!tiketdetail</code> - Detail tiket</span>
                    <span><code>!chat</code> - Chat produk</span>
                    <span><code>!notif [isi]</code> - Kirim notif</span>
                    <span><code>!broadcast</code> - Broadcast</span>
                    <span><code>!hapusnotif</code> - Hapus notif</span>
                    <span><code>!likes</code> - Stats likes</span>
                    <span><code>!dashboard</code> - Dashboard</span>
                    <span><code>!report</code> - Laporan harian</span>
                    <span><code>!aktivitas</code> - Aktivitas baru</span>
                    <span><code>!backup</code> - Info backup</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-2">
                  <p className="text-[11px] font-bold text-yellow-700 mb-1">⚙️ Konfigurasi Admin:</p>
                  <p className="text-[10px] text-muted-foreground">
                    Masukkan nomor admin di bagian <strong>"Nomor Admin Bot"</strong> pada panel download di atas sebelum download ZIP.
                    Nomor otomatis diformat ke <code className="bg-muted px-1 rounded">628xxx@s.whatsapp.net</code>.
                    Jika kosong, semua orang bisa akses perintah admin.
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
