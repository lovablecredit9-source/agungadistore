import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, MessageSquareHeart, Phone, Bell } from "lucide-react";
import AdminConfessVoucherSection from "./AdminConfessVoucherSection";

const KEYS = [
  "confess_title",
  "confess_description",
  "confess_price_1",
  "confess_price_2",
  "confess_price_3",
  "confess_admin_wa",
  "confess_notify_purchase",
  "confess_notify_cancel",
];

const AdminConfessTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("admin_settings").select("setting_key, setting_value").in("setting_key", KEYS);
    const m: Record<string, string> = {};
    (data || []).forEach((r: any) => (m[r.setting_key] = r.setting_value));
    setVals({
      confess_title: m.confess_title || "Confess Anonim",
      confess_description: m.confess_description || "",
      confess_price_1: m.confess_price_1 || "2000",
      confess_price_2: m.confess_price_2 || "4000",
      confess_price_3: m.confess_price_3 || "5000",
      confess_admin_wa: m.confess_admin_wa || "",
      confess_notify_purchase: m.confess_notify_purchase || "on",
      confess_notify_cancel: m.confess_notify_cancel || "on",
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const adminWa = vals.confess_admin_wa.replace(/\D/g, "");
    if (adminWa && adminWa.length < 9) {
      toast({ title: "No WA tidak valid", description: "Minimal 9 digit (contoh: 6285769302532)", variant: "destructive" });
      setSaving(false);
      return;
    }
    const rows = KEYS.map((k) => ({
      setting_key: k,
      setting_value: k === "confess_admin_wa" ? adminWa : String(vals[k] ?? ""),
    }));
    const { error } = await supabase.from("admin_settings").upsert(rows, { onConflict: "setting_key" });
    setSaving(false);
    if (error) {
      toast({ title: "Gagal simpan", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Tersimpan", description: "Pengaturan Confess diperbarui." });
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold flex items-center gap-2">
        <MessageSquareHeart className="w-5 h-5 text-primary" /> Pengaturan Confess
      </h2>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-bold">Tampilan Fitur</h3>
          <div>
            <label className="text-xs font-medium mb-1 block">Judul</label>
            <Input value={vals.confess_title} onChange={(e) => set("confess_title", e.target.value)} maxLength={60} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Deskripsi</label>
            <Textarea value={vals.confess_description} onChange={(e) => set("confess_description", e.target.value)} rows={3} maxLength={300} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-bold">Harga (Rupiah)</h3>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <label className="text-[11px] font-medium mb-1 block">{n} nomor</label>
                <Input
                  type="number" inputMode="numeric" min={0}
                  value={vals[`confess_price_${n}`]}
                  onChange={(e) => set(`confess_price_${n}`, e.target.value.replace(/\D/g, ""))}
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Harga dipotong dari saldo pengguna. Diskon trial Rp 2.000 berlaku otomatis untuk akun baru.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-1.5"><Phone className="w-4 h-4" /> Notifikasi WA Admin</h3>
          <div>
            <label className="text-xs font-medium mb-1 block">No WhatsApp Admin (format 62...)</label>
            <Input
              value={vals.confess_admin_wa}
              onChange={(e) => set("confess_admin_wa", e.target.value)}
              placeholder="6285769302532"
              inputMode="numeric"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Dikirim lewat bot WA toko. Pastikan bot aktif & sudah ada thread untuk no ini.</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <div>
                <div className="text-xs font-semibold">Notif Saat Pembelian Confess</div>
                <div className="text-[10px] text-muted-foreground">Kirim WA tiap kali user beli/jadwal confess.</div>
              </div>
            </div>
            <Switch
              checked={vals.confess_notify_purchase === "on"}
              onCheckedChange={(c) => set("confess_notify_purchase", c ? "on" : "off")}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-destructive" />
              <div>
                <div className="text-xs font-semibold">Notif Saat Pembatalan</div>
                <div className="text-[10px] text-muted-foreground">Kirim WA saat confess terjadwal dibatalkan & direfund.</div>
              </div>
            </div>
            <Switch
              checked={vals.confess_notify_cancel === "on"}
              onCheckedChange={(c) => set("confess_notify_cancel", c ? "on" : "off")}
            />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full gap-2" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? "Menyimpan..." : "Simpan Pengaturan"}
      </Button>
    </div>
  );
};

export default AdminConfessTab;
