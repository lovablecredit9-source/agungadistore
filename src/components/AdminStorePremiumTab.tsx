import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, Crown, Users } from "lucide-react";

export default function AdminStorePremiumTab() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [subs, setSubs] = useState<any[]>([]);

  const load = async () => {
    const { data: p } = await supabase.from("store_premium_plans").select("*").order("sort_order");
    setPlans(p ?? []);
    const { data: s } = await supabase.from("store_premium_subscriptions").select("*").eq("is_active", true).gt("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }).limit(100);
    setSubs(s ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.duration_days || !editing?.price) {
      return toast({ title: "Lengkapi nama, durasi & harga", variant: "destructive" });
    }
    const payload = { ...editing };
    delete payload.created_at; delete payload.updated_at;
    const { error } = editing.id
      ? await supabase.from("store_premium_plans").update(payload).eq("id", editing.id)
      : await supabase.from("store_premium_plans").insert(payload);
    if (error) return toast({ title: "Gagal", description: error.message, variant: "destructive" });
    toast({ title: "✅ Tersimpan" });
    setEditing(null); load();
  };

  const del = async (id: string) => {
    if (!confirm("Hapus paket?")) return;
    await supabase.from("store_premium_plans").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 p-3">
        <p className="text-sm font-black flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Premium Toko</p>
        <p className="text-[11px] text-muted-foreground">Atur paket membership premium toko (1/2/6 bulan). Member dapat klaim voucher Rp 2.000 setiap hari.</p>
      </div>

      <Button onClick={() => setEditing({ name: "", duration_days: 30, price: 20000, description: "", sort_order: plans.length, is_active: true })}>
        <Plus className="w-4 h-4 mr-1" /> Tambah Paket
      </Button>

      {editing && (
        <Card><CardContent className="p-4 space-y-3">
          <div><Label>Nama Paket</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Premium 1 Bulan" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Durasi (hari)</Label><Input type="number" value={editing.duration_days} onChange={(e) => setEditing({ ...editing, duration_days: +e.target.value })} /></div>
            <div><Label>Harga (Rp)</Label><Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: +e.target.value })} /></div>
          </div>
          <div><Label>Deskripsi</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={editing.is_active} onCheckedChange={(c) => setEditing({ ...editing, is_active: c })} />
            <Label>Aktif</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}><Save className="w-4 h-4 mr-1" /> Simpan</Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm flex items-center gap-1"><Crown className="w-3.5 h-3.5 text-amber-500" />{p.name} {!p.is_active && <span className="text-[9px] text-red-500">(Nonaktif)</span>}</p>
                <p className="text-[11px] text-muted-foreground">{p.duration_days} hari · Rp {p.price.toLocaleString("id-ID")}</p>
                {p.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{p.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => del(p.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Belum ada paket</p>}
      </div>

      <div className="pt-3 border-t">
        <p className="text-sm font-black flex items-center gap-1 mb-2"><Users className="w-4 h-4" /> Member Aktif ({subs.length})</p>
        <div className="space-y-1.5">
          {subs.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-muted/30">
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{s.plan_name}</p>
                <p className="text-[10px] text-muted-foreground">{s.visitor_id.slice(0, 12)}... · sampai {new Date(s.expires_at).toLocaleDateString("id-ID")}</p>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 font-black">PREMIUM</span>
            </div>
          ))}
          {subs.length === 0 && <p className="text-center text-[11px] text-muted-foreground py-2">Belum ada member aktif</p>}
        </div>
      </div>
    </div>
  );
}
