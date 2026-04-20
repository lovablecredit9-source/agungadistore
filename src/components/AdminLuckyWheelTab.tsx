import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Save, Sparkles, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Tier {
  id: string;
  tier_key: string;
  tier_name: string;
  description: string;
  icon: string;
  cost_coins: number;
  cost_gems: number;
  cost_balance: number;
  free_daily: boolean;
  pity_threshold: number;
  sort_order: number;
  is_active: boolean;
  color_class: string;
}

interface Segment {
  id: string;
  tier: string;
  label: string;
  icon: string;
  reward_type: string;
  reward_value: number;
  weight: number;
  color_class: string;
  is_jackpot: boolean;
  sort_order: number;
  is_active: boolean;
}

const REWARD_TYPES = [
  { value: "streak_coins", label: "Streak Coins" },
  { value: "gems", label: "Gems" },
  { value: "freeze_token", label: "Freeze Token" },
  { value: "balance", label: "Saldo (Rp)" },
];

const COLOR_PRESETS = [
  "from-cyan-400 to-blue-500",
  "from-pink-400 to-rose-500",
  "from-purple-500 to-fuchsia-500",
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-indigo-500",
  "from-violet-500 to-purple-600",
  "from-yellow-400 to-orange-500",
  "from-yellow-300 to-pink-500",
  "from-amber-400 to-orange-500",
];

export default function AdminLuckyWheelTab() {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<string>("");

  async function load() {
    setLoading(true);
    const [tRes, sRes] = await Promise.all([
      supabase.from("streak_wheel_tier_config").select("*").order("sort_order"),
      supabase.from("streak_wheel_segments").select("*").order("sort_order"),
    ]);
    setTiers((tRes.data || []) as Tier[]);
    setSegments((sRes.data || []) as Segment[]);
    if (tRes.data?.length && !activeTier) setActiveTier((tRes.data[0] as Tier).tier_key);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function saveTier(t: Tier) {
    setSaving(t.id);
    const { error } = await supabase.from("streak_wheel_tier_config").update({
      tier_name: t.tier_name,
      description: t.description,
      icon: t.icon,
      cost_coins: t.cost_coins,
      cost_gems: t.cost_gems,
      cost_balance: t.cost_balance,
      free_daily: t.free_daily,
      pity_threshold: t.pity_threshold,
      sort_order: t.sort_order,
      is_active: t.is_active,
      color_class: t.color_class,
    }).eq("id", t.id);
    setSaving(null);
    if (error) toast({ title: "Gagal", description: error.message, variant: "destructive" });
    else { toast({ title: "✅ Tier disimpan" }); load(); }
  }

  async function saveSegment(s: Segment) {
    setSaving(s.id);
    const { error } = await supabase.from("streak_wheel_segments").update({
      tier: s.tier,
      label: s.label,
      icon: s.icon,
      reward_type: s.reward_type,
      reward_value: s.reward_value,
      weight: s.weight,
      color_class: s.color_class,
      is_jackpot: s.is_jackpot,
      sort_order: s.sort_order,
      is_active: s.is_active,
    }).eq("id", s.id);
    setSaving(null);
    if (error) toast({ title: "Gagal", description: error.message, variant: "destructive" });
    else { toast({ title: "✅ Segmen disimpan" }); load(); }
  }

  async function addSegment() {
    if (!activeTier) return;
    const { error } = await supabase.from("streak_wheel_segments").insert({
      tier: activeTier,
      label: "Hadiah Baru",
      icon: "🎁",
      reward_type: "streak_coins",
      reward_value: 50,
      weight: 10,
      color_class: "from-cyan-400 to-blue-500",
      is_jackpot: false,
      sort_order: (segments.filter(s => s.tier === activeTier).length || 0) + 1,
      is_active: true,
    });
    if (error) toast({ title: "Gagal", description: error.message, variant: "destructive" });
    else { toast({ title: "✅ Segmen ditambah" }); load(); }
  }

  async function deleteSegment(id: string) {
    if (!confirm("Hapus segmen ini?")) return;
    const { error } = await supabase.from("streak_wheel_segments").delete().eq("id", id);
    if (error) toast({ title: "Gagal", description: error.message, variant: "destructive" });
    else { toast({ title: "🗑️ Dihapus" }); load(); }
  }

  function updateSegmentField(id: string, field: keyof Segment, value: any) {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  function updateTierField(id: string, field: keyof Tier, value: any) {
    setTiers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const tierSegments = segments.filter(s => s.tier === activeTier);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-pink-500" />
        <h2 className="text-lg font-bold">Lucky Wheel Manager</h2>
        <Badge variant="secondary">{tiers.length} tier · {segments.length} segmen</Badge>
      </div>

      <Tabs defaultValue="tiers">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="tiers"><Settings className="h-3 w-3 mr-1" />Tier Config</TabsTrigger>
          <TabsTrigger value="segments"><Sparkles className="h-3 w-3 mr-1" />Segmen Hadiah</TabsTrigger>
        </TabsList>

        {/* ===== TIER CONFIG ===== */}
        <TabsContent value="tiers" className="space-y-3">
          {tiers.map(t => (
            <Card key={t.id} className={`p-3 bg-gradient-to-br ${t.color_class} text-white`}>
              <div className="bg-background text-foreground rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{t.icon}</span>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded">{t.tier_key}</code>
                  </div>
                  <Switch checked={t.is_active} onCheckedChange={v => updateTierField(t.id, "is_active", v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nama Tier</Label>
                    <Input value={t.tier_name} onChange={e => updateTierField(t.id, "tier_name", e.target.value)} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Icon</Label>
                    <Input value={t.icon} onChange={e => updateTierField(t.id, "icon", e.target.value)} className="h-8" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Deskripsi</Label>
                  <Textarea value={t.description} onChange={e => updateTierField(t.id, "description", e.target.value)} className="min-h-[40px] text-xs" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">💰 Koin</Label>
                    <Input type="number" value={t.cost_coins} onChange={e => updateTierField(t.id, "cost_coins", parseInt(e.target.value) || 0)} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">💎 Gem</Label>
                    <Input type="number" value={t.cost_gems} onChange={e => updateTierField(t.id, "cost_gems", parseInt(e.target.value) || 0)} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">💵 Saldo</Label>
                    <Input type="number" value={t.cost_balance} onChange={e => updateTierField(t.id, "cost_balance", parseInt(e.target.value) || 0)} className="h-8" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <Label className="text-xs">Pity Threshold</Label>
                    <Input type="number" value={t.pity_threshold} onChange={e => updateTierField(t.id, "pity_threshold", parseInt(e.target.value) || 50)} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Sort</Label>
                    <Input type="number" value={t.sort_order} onChange={e => updateTierField(t.id, "sort_order", parseInt(e.target.value) || 0)} className="h-8" />
                  </div>
                  <div className="flex items-center gap-1 h-8">
                    <Switch checked={t.free_daily} onCheckedChange={v => updateTierField(t.id, "free_daily", v)} />
                    <Label className="text-xs">Free Spin</Label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Color Class</Label>
                  <Select value={t.color_class} onValueChange={v => updateTierField(t.id, "color_class", v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLOR_PRESETS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => saveTier(t)} disabled={saving === t.id} size="sm" className="w-full">
                  {saving === t.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                  Simpan Tier
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* ===== SEGMENTS ===== */}
        <TabsContent value="segments" className="space-y-3">
          <div className="flex gap-2 items-center">
            <Select value={activeTier} onValueChange={setActiveTier}>
              <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Pilih tier" /></SelectTrigger>
              <SelectContent>
                {tiers.map(t => <SelectItem key={t.tier_key} value={t.tier_key}>{t.icon} {t.tier_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={addSegment} size="sm"><Plus className="h-3 w-3 mr-1" />Tambah</Button>
          </div>

          <div className="space-y-2">
            {tierSegments.map(s => (
              <Card key={s.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{s.icon}</span>
                    {s.is_jackpot && <Badge className="bg-yellow-500 text-black">JACKPOT</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.is_active} onCheckedChange={v => updateSegmentField(s.id, "is_active", v)} />
                    <Button variant="destructive" size="icon" onClick={() => deleteSegment(s.id)} className="h-8 w-8"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input value={s.label} onChange={e => updateSegmentField(s.id, "label", e.target.value)} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Icon (emoji)</Label>
                    <Input value={s.icon} onChange={e => updateSegmentField(s.id, "icon", e.target.value)} className="h-8" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Reward Type</Label>
                    <Select value={s.reward_type} onValueChange={v => updateSegmentField(s.id, "reward_type", v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REWARD_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Reward Value</Label>
                    <Input type="number" value={s.reward_value} onChange={e => updateSegmentField(s.id, "reward_value", parseInt(e.target.value) || 0)} className="h-8" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Weight (peluang)</Label>
                    <Input type="number" value={s.weight} onChange={e => updateSegmentField(s.id, "weight", parseInt(e.target.value) || 1)} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Sort Order</Label>
                    <Input type="number" value={s.sort_order} onChange={e => updateSegmentField(s.id, "sort_order", parseInt(e.target.value) || 0)} className="h-8" />
                  </div>
                  <div className="flex items-center gap-1 h-8 pt-5">
                    <Switch checked={s.is_jackpot} onCheckedChange={v => updateSegmentField(s.id, "is_jackpot", v)} />
                    <Label className="text-xs">Jackpot</Label>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Color</Label>
                  <Select value={s.color_class} onValueChange={v => updateSegmentField(s.id, "color_class", v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLOR_PRESETS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={() => saveSegment(s)} disabled={saving === s.id} size="sm" className="w-full">
                  {saving === s.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                  Simpan
                </Button>
              </Card>
            ))}
            {tierSegments.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Belum ada segmen di tier ini. Klik "Tambah" untuk membuat.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
