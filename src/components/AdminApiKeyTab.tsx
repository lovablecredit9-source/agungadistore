import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, Trash2, Check, Eye, EyeOff, Plus, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/public-api`;

  const usageExample = `# ==========================================
# 📖 PANDUAN LENGKAP API - Agung Adi Store
# ==========================================
# Base URL: ${baseUrl}
# Auth: Header "x-api-key: YOUR_API_KEY"
# ==========================================

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. AMBIL SEMUA PRODUK
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -H "x-api-key: YOUR_API_KEY" \\
  "${baseUrl}?endpoint=products"

# 2. AMBIL SEMUA SPONSOR/IKLAN
curl -H "x-api-key: YOUR_API_KEY" \\
  "${baseUrl}?endpoint=sponsors"

# 3. AMBIL SALDO USER
curl -H "x-api-key: YOUR_API_KEY" \\
  "${baseUrl}?endpoint=balances"

# 4. AMBIL SEMUA LAGU
curl -H "x-api-key: YOUR_API_KEY" \\
  "${baseUrl}?endpoint=songs"

# 5. AMBIL DEPOSIT
curl -H "x-api-key: YOUR_API_KEY" \\
  "${baseUrl}?endpoint=deposits"

# 6. AMBIL TOKEN
curl -H "x-api-key: YOUR_API_KEY" \\
  "${baseUrl}?endpoint=tokens"

# 7. KIRIM NOTIFIKASI (POST)
curl -X POST -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"visitor_id":"xxx","title":"Halo","message":"Pesan test","type":"info"}' \\
  "${baseUrl}?endpoint=notifications"

# 8. AMBIL NOTIFIKASI (GET)
curl -H "x-api-key: YOUR_API_KEY" \\
  "${baseUrl}?endpoint=notifications"

# Filter notifikasi per visitor:
curl -H "x-api-key: YOUR_API_KEY" \\
  "${baseUrl}?endpoint=notifications&visitor_id=xxx"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONTOH BOT WHATSAPP (Node.js)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Install: npm install whatsapp-web.js qrcode-terminal

const { Client } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const API_KEY = "YOUR_API_KEY";
const BASE = "${baseUrl}";

const client = new Client();
client.on("qr", qr => qrcode.generate(qr, { small: true }));
client.on("ready", () => console.log("Bot WA siap!"));

client.on("message", async msg => {
  const text = msg.body.toLowerCase();

  if (text === "!produk") {
    const res = await fetch(BASE + "?endpoint=products", {
      headers: { "x-api-key": API_KEY }
    });
    const { data } = await res.json();
    let reply = "📦 *DAFTAR PRODUK*\\n━━━━━━━━━━━━━━━━━━\\n";
    data.forEach((p, i) => {
      reply += \`\${i+1}. *\${p.title}*\\n\`;
      reply += \`   💰 Rp \${p.price.toLocaleString()}\\n\`;
      reply += \`   📦 Stok: \${p.stock}\\n\\n\`;
    });
    msg.reply(reply);
  }

  if (text === "!sponsor") {
    const res = await fetch(BASE + "?endpoint=sponsors", {
      headers: { "x-api-key": API_KEY }
    });
    const { data } = await res.json();
    let reply = "📢 *DAFTAR SPONSOR*\\n━━━━━━━━━━━━━━━━━━\\n";
    data.forEach((s, i) => {
      reply += \`\${i+1}. *\${s.title}*\\n\`;
      reply += \`   👤 \${s.seller_name}\\n\`;
      reply += \`   💰 Rp \${s.price.toLocaleString()}\\n\\n\`;
    });
    msg.reply(reply);
  }

  if (text === "!saldo") {
    const res = await fetch(BASE + "?endpoint=balances", {
      headers: { "x-api-key": API_KEY }
    });
    const { data } = await res.json();
    let reply = "💰 *DAFTAR SALDO*\\n━━━━━━━━━━━━━━━━━━\\n";
    data.forEach((b, i) => {
      reply += \`\${i+1}. \${b.username}: Rp \${b.balance.toLocaleString()}\\n\`;
    });
    msg.reply(reply);
  }
});

client.initialize();

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONTOH PYTHON
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import requests

API_KEY = "YOUR_API_KEY"
BASE = "${baseUrl}"
headers = {"x-api-key": API_KEY}

# Ambil produk
res = requests.get(f"{BASE}?endpoint=products", headers=headers)
produk = res.json()["data"]
for p in produk:
    print(f"{p['title']} - Rp {p['price']:,}")

# Kirim notifikasi
requests.post(
    f"{BASE}?endpoint=notifications",
    headers={**headers, "Content-Type": "application/json"},
    json={"visitor_id": "xxx", "title": "Halo", "message": "Test"}
)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONTOH FETCH (Browser / Node.js)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const res = await fetch("${baseUrl}?endpoint=products", {
  headers: { "x-api-key": "YOUR_API_KEY" }
});
const data = await res.json();
console.log(data);`;

  return (
    <div className="space-y-4">
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
              <Plus className="w-4 h-4" /> Buat API Key
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowUsage(true)}>
              📖 Cara Pakai
            </Button>
          </div>
        </CardContent>
      </Card>

      <h3 className="font-bold text-sm">API Keys ({keys.length})</h3>
      {keys.map(k => (
        <Card key={k.id} className={!k.is_active ? "opacity-60" : ""}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{k.key_name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <code className="text-[10px] bg-muted px-2 py-1 rounded font-mono break-all flex-1">
                    {visibleKeys.has(k.id) ? k.api_key : maskKey(k.api_key)}
                  </code>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => toggleVisibility(k.id)}>
                    {visibleKeys.has(k.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyKey(k.api_key, k.id)}>
                    {copiedId === k.id ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => toggleKey(k)}>
                  {k.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => deleteKey(k.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-3">
              <span>Dibuat: {new Date(k.created_at).toLocaleString("id-ID")}</span>
              {k.last_used_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Terakhir: {new Date(k.last_used_at).toLocaleString("id-ID")}
                </span>
              )}
              <span className={k.is_active ? "text-accent" : "text-destructive"}>
                {k.is_active ? "✓ Aktif" : "✗ Nonaktif"}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
      {keys.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Belum ada API Key</p>}

      <Dialog open={showUsage} onOpenChange={setShowUsage}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">📖 Cara Pakai API</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Gunakan API Key di header <code className="bg-muted px-1 rounded">x-api-key</code> untuk mengakses data dari bot WA, script Python, atau aplikasi lainnya.
            </p>
            <p className="text-xs font-bold">Base URL:</p>
            <code className="text-[10px] bg-muted p-2 rounded block break-all font-mono">{baseUrl}</code>
            
            <p className="text-xs font-bold">Cara Kerja:</p>
            <ol className="text-xs space-y-1 list-decimal pl-4 text-muted-foreground">
              <li>Buat API Key di atas, lalu salin</li>
              <li>Pasang di header <code className="bg-muted px-1 rounded">x-api-key</code></li>
              <li>Panggil endpoint yang diinginkan</li>
              <li>Data dikembalikan dalam format JSON</li>
            </ol>
            
            <p className="text-xs font-bold mt-2">Endpoint Tersedia (GET):</p>
            <ul className="text-xs space-y-1 list-disc pl-4">
              <li><code>?endpoint=products</code> — Semua produk (judul, harga, stok, gambar)</li>
              <li><code>?endpoint=sponsors</code> — Semua sponsor/iklan aktif</li>
              <li><code>?endpoint=balances</code> — Saldo semua user</li>
              <li><code>?endpoint=songs</code> — Semua lagu di playlist</li>
              <li><code>?endpoint=deposits</code> — Riwayat deposit</li>
              <li><code>?endpoint=tokens</code> — Token & info produk</li>
              <li><code>?endpoint=notifications</code> — Notifikasi (tambah <code>&visitor_id=xxx</code> untuk filter)</li>
            </ul>
            
            <p className="text-xs font-bold mt-2">Endpoint (POST):</p>
            <ul className="text-xs space-y-1 list-disc pl-4">
              <li><code>?endpoint=notifications</code> — Kirim notifikasi
                <br /><span className="text-muted-foreground">Body: <code>{`{"visitor_id":"xxx","title":"Judul","message":"Isi","type":"info"}`}</code></span>
              </li>
            </ul>
            
            <p className="text-xs font-bold mt-2">Response Format:</p>
            <pre className="text-[9px] bg-muted p-2 rounded font-mono">{`{
  "success": true,
  "data": [ ... ]
}`}</pre>

            <p className="text-xs font-bold mt-2">💡 Contoh Penggunaan Bot WA & Script:</p>
            <pre className="text-[9px] bg-muted p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {usageExample}
            </pre>
            <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => {
              navigator.clipboard.writeText(usageExample);
              toast({ title: "Contoh script tersalin!" });
            }}>
              <Copy className="w-3 h-3" /> Salin Contoh Script
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
