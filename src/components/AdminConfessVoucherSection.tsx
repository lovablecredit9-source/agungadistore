import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Ticket, Copy, Trash2, Plus, RefreshCw } from "lucide-react";

type Voucher = {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  note: string | null;
  created_at: string;
};

const randomCode = () =>
  "CON-" + Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

const AdminConfessVoucherSection = () => {
  const { toast } = useToast();
  const [list, setList] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    code: randomCode(),
    discount_percent: 100,
    max_uses: 1,
    expires_days: 30,
    note: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("confess_vouchers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setList((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const pct = Math.max(1, Math.min(100, Number(form.discount_percent) || 0));
    const max = Math.max(1, Number(form.max_uses) || 1);
    const days = Math.max(0, Number(form.expires_days) || 0);
    const code = (form.code || randomCode()).trim().toUpperCase();
    if (!code) { toast({ title: "Kode kosong", variant: "destructive" }); return; }
    setCreating(true);
    const expires_at = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
    const { error } = await supabase.from("confess_vouchers").insert({
      code, discount_percent: pct, max_uses: max, expires_at,
      note: form.note || null, is_active: true, created_by: "admin",
    });
    setCreating(false);
    if (error) { toast({ title: "Gagal", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Voucher dibuat", description: code });
    setForm({ code: randomCode(), discount_percent: 100, max_uses: 1, expires_days: 30, note: "" });
    load();
  };

  const toggle = async (v: Voucher) => {
    await supabase.from("confess_vouchers").update({ is_active: !v.is_active }).eq("id", v.id);
    load();
  };

  const remove = async (v: Voucher) => {
    if (!confirm(`Hapus voucher ${v.code}?`)) return;
    await supabase.from("confess_vouchers").delete().eq("id", v.id);
    load();
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Tersalin", description: code });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <Ticket className="w-4 h-4 text-primary" /> Voucher Diskon Confess
          </h3>
          <Button size="sm" variant="ghost" onClick={load} className="h-7 px-2">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="rounded-xl border p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium block mb-1">Kode</label>
              <div className="flex gap-1">
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="h-8 text-xs" />
                <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setForm({ ...form, code: randomCode() })}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium block mb-1">Diskon (%)</label>
              <Input type="number" min={1} max={100} value={form.discount_percent}
                onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-medium block mb-1">Max Pakai</label>
              <Input type="number" min={1} value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: Number(e.target.value) })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-medium block mb-1">Berlaku (hari, 0=permanen)</label>
              <Input type="number" min={0} value={form.expires_days}
                onChange={(e) => setForm({ ...form, expires_days: Number(e.target.value) })} className="h-8 text-xs" />
            </div>
          </div>
          <Input placeholder="Catatan (opsional)" value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} className="h-8 text-xs" />
          <Button onClick={create} disabled={creating} className="w-full h-8 gap-1.5">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Buat Voucher
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Diskon 100% → user gratis & <b>tanpa PIN</b>. Diskon &lt;100% → tetap minta PIN saat checkout.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
        ) : list.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground py-4">Belum ada voucher.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {list.map((v) => {
              const expired = v.expires_at && new Date(v.expires_at) < new Date();
              const exhausted = v.used_count >= v.max_uses;
              return (
                <div key={v.id} className={`rounded-lg border p-2.5 text-xs ${(!v.is_active || expired || exhausted) ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono font-bold text-sm">{v.code}</code>
                      <button onClick={() => copy(v.code)} className="text-muted-foreground hover:text-primary">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={v.is_active} onCheckedChange={() => toggle(v)} />
                      <button onClick={() => remove(v)} className="text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">{v.discount_percent}% OFF</span>
                    <span>Pakai: {v.used_count}/{v.max_uses}</span>
                    {v.expires_at && <span>Exp: {new Date(v.expires_at).toLocaleDateString("id-ID")}</span>}
                    {expired && <span className="text-destructive">Kadaluarsa</span>}
                    {exhausted && <span className="text-destructive">Habis</span>}
                  </div>
                  {v.note && <p className="text-[10px] mt-1 italic">{v.note}</p>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminConfessVoucherSection;
