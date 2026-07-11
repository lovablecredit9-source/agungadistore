import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Send, RotateCcw, Save, MessageSquare } from "lucide-react";

type Cfg = {
  id: string;
  event_type: string;
  wa_number: string;
  enabled: boolean;
  template: string;
};

const EVENT_LABELS: Record<string, { title: string; desc: string; vars: string[] }> = {
  purchase: {
    title: "🛒 Pembelian Produk",
    desc: "Terkirim setiap kali user membeli produk via saldo / token.",
    vars: ["trx_id", "user", "produk", "qty", "harga", "waktu"],
  },
  product_edit: {
    title: "📦 Edit / Tambah / Hapus Produk",
    desc: "Terkirim ketika admin menambah, mengubah, atau menghapus produk.",
    vars: ["action", "produk_id", "produk", "harga", "stok", "user", "waktu"],
  },
  login: {
    title: "🔐 Login User",
    desc: "Terkirim saat user berhasil login ke akun saldo.",
    vars: ["user", "hp", "device", "waktu"],
  },
  deposit: {
    title: "💰 Deposit & Pembatalan",
    desc: "Terkirim saat deposit dibuat, dikonfirmasi, atau dibatalkan.",
    vars: ["action", "trx_id", "user", "harga", "metode", "waktu"],
  },
  confess_purchase: {
    title: "💌 Pembelian Confess",
    desc: "Terkirim saat user membeli fitur Confess (mis. buka identitas).",
    vars: ["jenis", "biaya", "waktu"],
  },
  gem_purchase: {
    title: "💎 Pembelian Gem",
    desc: "Terkirim saat user membeli paket Gem.",
    vars: ["gem", "jumlah", "paket", "waktu"],
  },
  email_change: {
    title: "📧 Ubah Email",
    desc: "Peringatan keamanan saat email akun saldo diubah.",
    vars: ["email_baru", "waktu"],
  },
  password_change: {
    title: "🔑 Ubah Sandi",
    desc: "Peringatan keamanan saat sandi akun saldo diubah.",
    vars: ["metode", "waktu"],
  },
  enable_2fa: {
    title: "🛡️ Aktifkan 2FA",
    desc: "Peringatan keamanan saat verifikasi 2 langkah diaktifkan.",
    vars: ["waktu"],
  },
  pin_reset: {
    title: "🔢 Reset PIN",
    desc: "Peringatan keamanan saat PIN transaksi direset.",
    vars: ["metode", "waktu"],
  },
};

const DEFAULTS: Record<string, string> = {
  purchase: "🛒 *Pembelian Baru*\nTRX: {trx_id}\nUser: {user}\nProduk: {produk}\nJumlah: {qty}\nHarga: Rp{harga}\nWaktu: {waktu}",
  product_edit: "📦 *Produk {action}*\nID: {produk_id}\nNama: {produk}\nHarga: Rp{harga}\nStok: {stok}\nAdmin: {user}\nWaktu: {waktu}",
  login: "🔐 *Login User*\nUser: {user}\nHP: {hp}\nDevice: {device}\nWaktu: {waktu}",
  deposit: "💰 *Deposit {action}*\nTRX: {trx_id}\nUser: {user}\nJumlah: Rp{harga}\nMetode: {metode}\nWaktu: {waktu}",
  confess_purchase: "💌 *Pembelian Confess*\nJenis: {jenis}\nBiaya: {biaya}\nWaktu: {waktu}",
  gem_purchase: "💎 *Pembelian Gem*\nGem: +{gem}\nJumlah: {jumlah}\nPaket: {paket}\nWaktu: {waktu}",
  email_change: "📧 *Email Diubah*\nEmail baru: {email_baru}\nWaktu: {waktu}\n\nJika ini bukan kamu, segera hubungi admin.",
  password_change: "🔑 *Sandi Diubah*\nMetode: {metode}\nWaktu: {waktu}\n\nJika ini bukan kamu, segera hubungi admin.",
  enable_2fa: "🛡️ *2FA Diaktifkan*\nWaktu: {waktu}\n\nAkunmu kini lebih aman dengan verifikasi 2 langkah.",
  pin_reset: "🔢 *PIN Direset*\nMetode: {metode}\nWaktu: {waktu}\n\nJika ini bukan kamu, segera hubungi admin.",
};

const KNOWN_EVENTS = Object.keys(DEFAULTS);


export default function AdminWaNotifTab() {
  const [items, setItems] = useState<Cfg[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let { data } = await supabase
      .from("wa_notification_configs" as any)
      .select("*")
      .order("event_type");
    let rows: any[] = (data as any) || [];
    // Seed config yang belum ada untuk event baru agar bisa diatur admin.
    const existing = new Set(rows.map((r) => r.event_type));
    const missing = KNOWN_EVENTS.filter((e) => !existing.has(e));
    if (missing.length > 0) {
      await supabase.from("wa_notification_configs" as any).insert(
        missing.map((e) => ({ event_type: e, wa_number: "", enabled: false, template: DEFAULTS[e] })),
      );
      const res = await supabase
        .from("wa_notification_configs" as any)
        .select("*")
        .order("event_type");
      rows = (res.data as any) || rows;
    }
    setItems(rows.map((d: any) => ({
      ...d,
      template: String(d.template || "").replace(/%0A/gi, "\n"),
    })));
    setLoading(false);
  };


  useEffect(() => { load(); }, []);

  const update = (idx: number, patch: Partial<Cfg>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const save = async (cfg: Cfg) => {
    setSaving(cfg.event_type);
    const phone = cfg.wa_number.replace(/\D/g, "");
    if (phone.length < 9) {
      toast.error("Nomor WA tidak valid");
      setSaving(null);
      return;
    }
    const { error } = await supabase
      .from("wa_notification_configs" as any)
      .update({
        wa_number: phone,
        enabled: cfg.enabled,
        template: cfg.template,
      })
      .eq("id", cfg.id);
    setSaving(null);
    if (error) toast.error("Gagal: " + error.message);
    else toast.success("Tersimpan");
  };

  const resetTpl = (idx: number, eventType: string) => {
    update(idx, { template: DEFAULTS[eventType] || "" });
    toast.info("Template direset (klik Simpan untuk menyimpan)");
  };

  const sendTest = async (cfg: Cfg) => {
    setTesting(cfg.event_type);
    const sampleVars: Record<string, string> = {
      trx_id: "TEST-" + Date.now().toString().slice(-6),
      user: "User Demo",
      produk: "Produk Contoh",
      qty: "1",
      harga: "15.000",
      stok: "10",
      produk_id: "#99999",
      action: "CONTOH",
      hp: "0812****1234",
      device: "Android Chrome",
      metode: "QRIS",
    };
    const { data, error } = await supabase.functions.invoke("send-wa-notification", {
      body: {
        event_type: cfg.event_type,
        vars: sampleVars,
        wa_number: cfg.wa_number,
        test: true,
      },
    });
    setTesting(null);
    if (error || (data as any)?.error) {
      toast.error("Gagal kirim test: " + (error?.message || (data as any)?.error));
    } else {
      toast.success("Test terkirim ke bot ✓");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="font-extrabold text-base">Notifikasi WhatsApp Otomatis</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Atur nomor WA tujuan dan template pesan untuk tiap event. Pesan dikirim otomatis
          lewat bot WhatsApp toko ketika event terjadi.
        </p>
      </div>

      {items.map((cfg, idx) => {
        const meta = EVENT_LABELS[cfg.event_type] || { title: cfg.event_type, desc: "", vars: [] };
        return (
          <Card key={cfg.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-sm">{meta.title}</div>
                <div className="text-xs text-muted-foreground">{meta.desc}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {cfg.enabled ? "Aktif" : "Off"}
                </span>
                <Switch
                  checked={cfg.enabled}
                  onCheckedChange={(v) => update(idx, { enabled: v })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Nomor WA Tujuan</label>
              <Input
                value={cfg.wa_number}
                onChange={(e) => update(idx, { wa_number: e.target.value })}
                placeholder="6285769302532"
                className="font-mono text-sm"
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Format internasional tanpa + (contoh: 6285769302532)
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-muted-foreground">Template Pesan</label>
                <button
                  onClick={() => resetTpl(idx, cfg.event_type)}
                  className="text-[11px] text-primary flex items-center gap-1 hover:underline"
                >
                  <RotateCcw className="w-3 h-3" /> Reset default
                </button>
              </div>
              <Textarea
                value={cfg.template}
                onChange={(e) => update(idx, { template: e.target.value })}
                rows={6}
                className="text-xs font-mono"
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {meta.vars.map(v => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="text-[10px] cursor-pointer"
                    onClick={() => update(idx, { template: cfg.template + `{${v}}` })}
                  >
                    {`{${v}}`}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => save(cfg)}
                disabled={saving === cfg.event_type}
                className="flex-1"
                size="sm"
              >
                {saving === cfg.event_type ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="ml-1">Simpan</span>
              </Button>
              <Button
                onClick={() => sendTest(cfg)}
                disabled={testing === cfg.event_type}
                variant="outline"
                size="sm"
              >
                {testing === cfg.event_type ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="ml-1">Test Kirim</span>
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
