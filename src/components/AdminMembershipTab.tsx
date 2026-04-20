import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Crown } from "lucide-react";

export default function AdminMembershipTab() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("streak_membership_plans").select("*").order("sort_order", { ascending: true });
    setPlans(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name) return toast({ title: "Nama wajib diisi", variant: "destructive" });
    const payload = { ...editing };
    delete payload.created_at;
    delete payload.updated_at;
    const { error } = editing.id
      ? await supabase.from("streak_membership_plans").update(payload).eq("id", editing.id)
      : await supabase.from("streak_membership_plans").insert(payload);
    if (error) return toast({ title: "Gagal", description: error.message, variant: "destructive" });
    toast({ title: "✅ Tersimpan" });
    setEditing(null); load();
  };

  const del = async (id: string) => {
    if (!confirm("Hapus paket?")) return;
    await supabase.from("streak_membership_plans").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setEditing({ name: "", description: "", duration_days: 30, price_idr: 0, price_coins: 0, price_gems: 0, bonus_multiplier: 1.5, bonus_freeze_count: 3, bonus_streak_coins: 100, bonus_gems: 50, icon: "👑", badge_color: "#FFD700", is_active: true, is_featured: false, sort_order: 0 })}>
        <Plus className="h-4 w-4 mr-1" /> Tambah Paket
      </Button>

      {editing && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Nama</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Icon</Label><Input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></div>
          </div>
          <div><Label>Deskripsi</Label><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Durasi (hari)</Label><Input type="number" value={editing.duration_days} onChange={(e) => setEditing({ ...editing, duration_days: +e.target.value })} /></div>
            <div><Label>Harga IDR</Label><Input type="number" value={editing.price_idr} onChange={(e) => setEditing({ ...editing, price_idr: +e.target.value })} /></div>
            <div><Label>Harga Coins</Label><Input type="number" value={editing.price_coins} onChange={(e) => setEditing({ ...editing, price_coins: +e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Multiplier</Label><Input type="number" step="0.1" value={editing.bonus_multiplier} onChange={(e) => setEditing({ ...editing, bonus_multiplier: +e.target.value })} /></div>
            <div><Label>Freeze Bonus</Label><Input type="number" value={editing.bonus_freeze_count} onChange={(e) => setEditing({ ...editing, bonus_freeze_count: +e.target.value })} /></div>
            <div><Label>Bonus Coins</Label><Input type="number" value={editing.bonus_streak_coins} onChange={(e) => setEditing({ ...editing, bonus_streak_coins: +e.target.value })} /></div>
            <div><Label>Bonus Gems</Label><Input type="number" value={editing.bonus_gems} onChange={(e) => setEditing({ ...editing, bonus_gems: +e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}><Save className="h-4 w-4 mr-1" /> Simpan</Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
          </div>
        </CardContent></Card>
      )}

      {plans.map((p) => (
        <Card key={p.id}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{p.icon}</span>
              <div>
                <p className="font-bold">{p.name} ({p.duration_days} hari)</p>
                <p className="text-xs text-muted-foreground">Rp{p.price_idr.toLocaleString()} · {p.price_coins} coins · x{p.bonus_multiplier}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => del(p.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {plans.length === 0 && !editing && <p className="text-center text-sm text-muted-foreground py-4">Belum ada paket membership</p>}
    </div>
  );
}
