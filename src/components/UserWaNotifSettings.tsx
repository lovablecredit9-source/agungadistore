import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, Send, MessageSquare, ShoppingCart, LogIn, Wallet } from "lucide-react";

type Pref = {
  wa_number: string;
  notify_purchase: boolean;
  notify_login: boolean;
  notify_deposit: boolean;
};

const EVENTS = [
  { key: "notify_purchase", label: "Pembelian Produk", icon: ShoppingCart, desc: "Notif tiap kamu beli produk pakai saldo/token." },
  { key: "notify_login", label: "Login Akun", icon: LogIn, desc: "Notif tiap akun saldo kamu login (keamanan)." },
  { key: "notify_deposit", label: "Deposit & Pembatalan", icon: Wallet, desc: "Notif saat deposit dibuat / dibatalkan." },
] as const;

export default function UserWaNotifSettings() {
  const [visitorId, setVisitorId] = useState<string>("");
  const [pref, setPref] = useState<Pref>({
    wa_number: "",
    notify_purchase: true,
    notify_login: true,
    notify_deposit: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      const vid = await getVisitorId();
      setVisitorId(vid);
      const { data } = await supabase
        .from("user_wa_notif_prefs" as any)
        .select("wa_number, notify_purchase, notify_login, notify_deposit")
        .eq("visitor_id", vid)
        .maybeSingle();
      if (data) setPref(data as any);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    const phone = pref.wa_number.replace(/\D/g, "");
    if (phone && phone.length < 9) {
      toast.error("Nomor WA tidak valid");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("user_wa_notif_prefs" as any)
      .upsert({
        visitor_id: visitorId,
        wa_number: phone,
        notify_purchase: pref.notify_purchase,
        notify_login: pref.notify_login,
        notify_deposit: pref.notify_deposit,
      }, { onConflict: "visitor_id" });
    setSaving(false);
    if (error) toast.error("Gagal: " + error.message);
    else toast.success("Pengaturan tersimpan ✓");
  };

  const testKirim = async () => {
    const phone = pref.wa_number.replace(/\D/g, "");
    if (!phone || phone.length < 9) {
      toast.error("Isi & simpan nomor WA dulu");
      return;
    }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("send-wa-notification", {
      body: {
        event_type: "login",
        notify_visitor_id: visitorId,
        wa_number: "0", // tidak kirim admin
        text: "🔔 *Test Notifikasi Akun Anda*\n\nIni adalah pesan tes dari Agung Adi Store. Jika anda menerima ini, notifikasi WA anda aktif ✓",
        vars: {},
      },
    });
    setTesting(false);
    if (error || (data as any)?.error) {
      toast.error("Gagal: " + (error?.message || (data as any)?.error));
    } else {
      toast.success("Test terkirim ke " + phone);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-2xl p-4 border border-green-500/20">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-green-600" />
          <h3 className="font-extrabold">Notifikasi WhatsApp</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Masukkan nomor WhatsApp kamu. Bot toko akan kirim pesan otomatis tiap ada
          aktivitas penting di akun kamu (pembelian, login, deposit).
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Nomor WhatsApp Kamu</label>
          <Input
            value={pref.wa_number}
            onChange={(e) => setPref(p => ({ ...p, wa_number: e.target.value }))}
            placeholder="08xxxxxxxxxx atau 628xxxxxxxxxx"
            inputMode="numeric"
            className="font-mono"
          />
          <div className="text-[10px] text-muted-foreground mt-1">
            Format Indonesia (08xx) otomatis dikonversi ke internasional (628xx).
          </div>
        </div>

        <div className="space-y-2 pt-2">
          {EVENTS.map(ev => {
            const Icon = ev.icon;
            return (
              <div key={ev.key} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-muted/40 border">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{ev.label}</div>
                    <div className="text-[11px] text-muted-foreground">{ev.desc}</div>
                  </div>
                </div>
                <Switch
                  checked={pref[ev.key] as boolean}
                  onCheckedChange={(v) => setPref(p => ({ ...p, [ev.key]: v }))}
                />
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="ml-1">Simpan</span>
          </Button>
          <Button onClick={testKirim} disabled={testing} variant="outline">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="ml-1">Test</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
