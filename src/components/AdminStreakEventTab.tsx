import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save } from "lucide-react";

export default function AdminStreakEventTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const { data: s } = await supabase.from("weekly_spin_event_settings").select("*").limit(1).maybeSingle();
    setSettings(s);
    const { data: seg } = await supabase.from("weekly_spin_wheel_segments").select("*").order("sort_order");
    setSegments(seg ?? []);
  };
  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    if (!settings) return;
    const payload = { ...settings };
    delete payload.created_at; delete payload.updated_at;
    const { error } = await supabase.from("weekly_spin_event_settings").update(payload).eq("id", settings.id);
    if (error) return toast({ title: "Gagal", variant: "destructive" });
    toast({ title: "✅ Pengaturan tersimpan" });
  };

  const saveSegment = async () => {
    if (!editing?.label) return;
    const payload = { ...editing }; delete payload.created_at; delete payload.updated_at;
    const { error } = editing.id
      ? await supabase.from("weekly_spin_wheel_segments").update(payload).eq("id", editing.id)
      : await supabase.from("weekly_spin_wheel_segments").insert(payload);
    if (error) return toast({ title: "Gagal", description: error.message, variant: "destructive" });
    toast({ title: "✅ Segmen tersimpan" });
    setEditing(null); load();
  };

  const totalWeight = segments.reduce((s, x) => s + (x.is_active ? x.weight : 0), 0);

  return (
    <div className="space-y-6">
      {settings && (
        <Card><CardContent className="p-4 space-y-3">
          <h3 className="font-bold">⚙️ Pengaturan Event</h3>
          <div><Label>Masa Aktif (hari)</Label><Input type="number" min={1} value={settings.event_days ?? 7} onChange={(e) => setSettings({ ...settings, event_days: +e.target.value })} /></div>
          <div><Label>Judul Banner</Label><Input value={settings.banner_title} onChange={(e) => setSettings({ ...settings, banner_title: e.target.value })} /></div>
          <div><Label>Catatan Tambahan</Label><Input value={settings.admin_note ?? ""} placeholder="Tampilkan info ke pengguna..." onChange={(e) => setSettings({ ...settings, admin_note: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.is_active} onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })} /> Event Aktif
          </label>
          <Button onClick={saveSettings}><Save className="h-4 w-4 mr-1" /> Simpan Pengaturan</Button>
        </CardContent></Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold">🎡 Segmen Roda (Total weight: {totalWeight})</h3>
          <Button size="sm" onClick={() => setEditing({ label: "", reward_type: "coins", reward_value: 100, weight: 10, color: "#8B5CF6", icon: "🎁", rarity: "common", is_active: true, sort_order: segments.length })}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {editing && (
          <Card className="mb-3"><CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Label</Label><Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} /></div>
              <div><Label>Icon</Label><Input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></div>
              <div><Label>Type</Label>
                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={editing.reward_type} onChange={(e) => setEditing({ ...editing, reward_type: e.target.value })}>
                  <option value="coins">Coins</option><option value="gems">Gems</option><option value="freeze">Freeze</option><option value="multiplier">Multiplier</option><option value="empty">Kosong</option>
                </select>
              </div>
              <div><Label>Value</Label><Input type="number" value={editing.reward_value} onChange={(e) => setEditing({ ...editing, reward_value: +e.target.value })} /></div>
              <div><Label>Weight (peluang)</Label><Input type="number" value={editing.weight} onChange={(e) => setEditing({ ...editing, weight: +e.target.value })} /></div>
              <div><Label>Warna</Label><Input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></div>
              <div><Label>Rarity</Label>
                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={editing.rarity} onChange={(e) => setEditing({ ...editing, rarity: e.target.value })}>
                  <option value="common">Common</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveSegment}><Save className="h-4 w-4 mr-1" /> Simpan</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
            </div>
          </CardContent></Card>
        )}

        <div className="space-y-2">
          {segments.map((s) => {
            const chance = totalWeight > 0 && s.is_active ? ((s.weight / totalWeight) * 100).toFixed(1) : "0";
            return (
              <Card key={s.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{ background: s.color }}>{s.icon}</div>
                    <div>
                      <p className="font-semibold text-sm">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.reward_type} {s.reward_value} · {chance}% · {s.rarity}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={async () => { await supabase.from("weekly_spin_wheel_segments").delete().eq("id", s.id); load(); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
