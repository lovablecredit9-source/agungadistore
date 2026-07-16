import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Zap, Loader2, Trash2, Sparkles } from "lucide-react";

const TYPES = [
  { v: "music_seconds", l: "Dengar musik (detik)" },
  { v: "purchase_amount", l: "Belanja (rupiah)" },
  { v: "streak_days", l: "Hari streak" },
  { v: "quest_claim", l: "Klaim quest" },
  { v: "game_win", l: "Menang game" },
];

export default function AdminLagaQuestTab() {
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", icon: "⚡", requirement_type: "music_seconds",
    target_value: 1, min_amount: 0, reward_saldo_in: 1000, reward_gems: 10, reward_coins: 500,
    difficulty: "susah", week_start: new Date().toISOString().slice(0, 10),
    active_date: new Date().toISOString().slice(0, 10), duration_hours: 24, is_active: true,
  });

  const load = async () => {
    const { data } = await supabase.functions.invoke("laga-quest", { body: { action: "admin_list" } });
    setList((data as any)?.quests || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title) return toast({ title: "Isi judul" });
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("laga-quest", { body: { action: "admin_create", quest: form } });
      if (error) throw error;
      toast({ title: "✅ Quest dibuat" });
      setForm({ ...form, title: "", description: "" });
      load();
    } catch (e) {
      toast({ title: "Gagal", description: String(e), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Hapus quest?")) return;
    await supabase.functions.invoke("laga-quest", { body: { action: "admin_delete", id } });
    load();
  };

  const scheduleWeek = async () => {
    const { data } = await supabase.functions.invoke("laga-quest", { body: { action: "schedule_week" } });
    toast({ title: (data as any)?.message || `Generated ${(data as any)?.generated || 0}` });
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-yellow-500" /><h3 className="font-bold text-sm">Quest Laga Mingguan</h3></div>
            <Button size="sm" variant="outline" onClick={scheduleWeek}>Auto-Generate</Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Quest laga muncul 1× per minggu di hari acak dengan hadiah besar.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="font-bold text-sm">Buat Quest Baru</h4>
          <div>
            <Label className="text-xs">Judul</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Deskripsi</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Icon</Label>
              <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Tipe</Label>
              <select className="w-full border rounded px-2 py-1 text-sm bg-background" value={form.requirement_type} onChange={(e) => setForm({ ...form, requirement_type: e.target.value })}>
                {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Target</Label><Input type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: +e.target.value })} /></div>
            <div><Label className="text-xs">Min. Belanja (Rp)</Label><Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: +e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Saldo IN</Label><Input type="number" value={form.reward_saldo_in} onChange={(e) => setForm({ ...form, reward_saldo_in: +e.target.value })} /></div>
            <div><Label className="text-xs">Gem</Label><Input type="number" value={form.reward_gems} onChange={(e) => setForm({ ...form, reward_gems: +e.target.value })} /></div>
            <div><Label className="text-xs">Koin</Label><Input type="number" value={form.reward_coins} onChange={(e) => setForm({ ...form, reward_coins: +e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Awal Minggu</Label><Input type="date" value={form.week_start} onChange={(e) => setForm({ ...form, week_start: e.target.value })} /></div>
            <div><Label className="text-xs">Tanggal Aktif</Label><Input type="date" value={form.active_date} onChange={(e) => setForm({ ...form, active_date: e.target.value })} /></div>
            <div><Label className="text-xs">Durasi (jam)</Label><Input type="number" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: +e.target.value })} /></div>
          </div>
          <Button onClick={create} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1" />Buat Quest Laga</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h4 className="font-bold text-sm">Daftar Quest ({list.length})</h4>
        {list.map(q => (
          <Card key={q.id}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <span className="text-2xl">{q.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{q.title}</div>
                  <div className="text-[10px] text-muted-foreground">{q.description}</div>
                  <div className="text-[10px] mt-1">📅 {q.active_date} · ⏱ {q.duration_hours}h · 🎯 {q.target_value} {q.requirement_type}</div>
                  <div className="text-[10px] text-primary">🎁 Rp{q.reward_saldo_in} · {q.reward_gems}💎 · {q.reward_coins}🪙</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => del(q.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
