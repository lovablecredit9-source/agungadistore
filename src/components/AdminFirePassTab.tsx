import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Flame, Loader2, Trash2, Save, Plus } from "lucide-react";

const REWARD_TYPES = [
  { v: "saldo_in", l: "Saldo IN (Rp)" },
  { v: "coins", l: "Koin Streak" },
  { v: "gems", l: "Gem" },
  { v: "premium_quest_days", l: "Premium Quest (hari)" },
];

export default function AdminFirePassTab() {
  const { toast } = useToast();
  const [seasons, setSeasons] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [activeSeason, setActiveSeason] = useState<any | null>(null);
  const [seasonForm, setSeasonForm] = useState<any>(null);
  const [tierForm, setTierForm] = useState<any>(null);
  const [grantUser, setGrantUser] = useState("");

  const load = async () => {
    const { data: sData } = await supabase.from("fire_pass_seasons").select("*").order("season_number", { ascending: false });
    setSeasons(sData || []);
    const active = sData?.find((s: any) => s.is_active) || sData?.[0];
    setActiveSeason(active);
    if (active) {
      const { data: tData } = await supabase.from("fire_pass_tiers").select("*").eq("season_id", active.id).order("tier_level");
      setTiers(tData || []);
    }
  };
  useEffect(() => { load(); }, []);

  const saveSeason = async () => {
    await supabase.functions.invoke("fire-pass", { body: { action: "admin_upsert_season", ...seasonForm } });
    toast({ title: "✅ Season disimpan" });
    setSeasonForm(null);
    load();
  };

  const saveTier = async () => {
    await supabase.functions.invoke("fire-pass", { body: { action: "admin_upsert_tier", tier: { season_id: activeSeason.id, ...tierForm } } });
    toast({ title: "✅ Tier disimpan" });
    setTierForm(null);
    load();
  };

  const deleteTier = async (id: string) => {
    if (!confirm("Hapus tier?")) return;
    await supabase.functions.invoke("fire-pass", { body: { action: "admin_delete_tier", id } });
    load();
  };

  const toggleFreePremium = async (enabled: boolean) => {
    await supabase.functions.invoke("fire-pass", {
      body: { action: "admin_upsert_season", id: activeSeason.id,
        season_number: activeSeason.season_number, name: activeSeason.name,
        starts_at: activeSeason.starts_at, ends_at: activeSeason.ends_at,
        is_active: activeSeason.is_active, free_premium_enabled: enabled,
        price_saldo_in: activeSeason.price_saldo_in, price_gems: activeSeason.price_gems },
    });
    load();
  };

  const grantPremium = async () => {
    if (!grantUser) return;
    const { data: ub } = await supabase.from("user_balances").select("visitor_id").or(`username.eq.${grantUser},phone.eq.${grantUser}`).maybeSingle();
    if (!ub?.visitor_id) return toast({ title: "User tidak ditemukan", variant: "destructive" });
    await supabase.functions.invoke("fire-pass", { body: { action: "admin_grant_premium", visitorId: ub.visitor_id } });
    toast({ title: "✅ Premium diberikan" });
    setGrantUser("");
  };

  return (
    <div className="space-y-4">
      <Card className="border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-red-500/10">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2"><Flame className="w-5 h-5 text-orange-500" /><h3 className="font-bold">Fire Pass Season</h3></div>
          {activeSeason && (
            <div className="text-xs space-y-1">
              <div>{activeSeason.name} · Season {activeSeason.season_number}</div>
              <div className="flex items-center gap-2">
                <Switch checked={activeSeason.free_premium_enabled} onCheckedChange={toggleFreePremium} />
                <span>Free Premium global</span>
              </div>
              <div>Harga: Rp{activeSeason.price_saldo_in.toLocaleString("id-ID")} atau {activeSeason.price_gems}💎</div>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={() => setSeasonForm(activeSeason || { season_number: (seasons[0]?.season_number || 0) + 1, name: "New Season", starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 30 * 86400000).toISOString(), is_active: true, free_premium_enabled: false, price_saldo_in: 25000, price_gems: 100 })}>
            Edit / Season Baru
          </Button>
        </CardContent>
      </Card>

      {seasonForm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Nomor</Label><Input type="number" value={seasonForm.season_number} onChange={(e) => setSeasonForm({ ...seasonForm, season_number: +e.target.value })} /></div>
              <div><Label className="text-xs">Nama</Label><Input value={seasonForm.name} onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Mulai</Label><Input type="datetime-local" value={seasonForm.starts_at?.slice(0, 16)} onChange={(e) => setSeasonForm({ ...seasonForm, starts_at: new Date(e.target.value).toISOString() })} /></div>
              <div><Label className="text-xs">Berakhir</Label><Input type="datetime-local" value={seasonForm.ends_at?.slice(0, 16)} onChange={(e) => setSeasonForm({ ...seasonForm, ends_at: new Date(e.target.value).toISOString() })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Harga Saldo</Label><Input type="number" value={seasonForm.price_saldo_in} onChange={(e) => setSeasonForm({ ...seasonForm, price_saldo_in: +e.target.value })} /></div>
              <div><Label className="text-xs">Harga Gem</Label><Input type="number" value={seasonForm.price_gems} onChange={(e) => setSeasonForm({ ...seasonForm, price_gems: +e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={seasonForm.is_active} onCheckedChange={(c) => setSeasonForm({ ...seasonForm, is_active: c })} /><span className="text-xs">Aktif</span></div>
            <div className="flex gap-2"><Button size="sm" onClick={saveSeason}><Save className="w-3 h-3 mr-1" />Simpan</Button><Button size="sm" variant="ghost" onClick={() => setSeasonForm(null)}>Batal</Button></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="font-bold text-sm">Beri Premium Manual</h4>
          <div className="flex gap-2">
            <Input placeholder="Username/nomor HP" value={grantUser} onChange={(e) => setGrantUser(e.target.value)} />
            <Button onClick={grantPremium}>Grant</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm">Tier ({tiers.length})</h4>
          <Button size="sm" onClick={() => setTierForm({ tier_level: tiers.length + 1, badge_required: (tiers.length + 1) * 10, free_reward_type: "saldo_in", free_reward_value: 500, free_reward_label: "Rp 500", premium_reward_type: "gems", premium_reward_value: 50, premium_reward_label: "50 💎" })}><Plus className="w-3 h-3 mr-1" />Tier</Button>
        </div>

        {tierForm && (
          <Card className="border-primary">
            <CardContent className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Level</Label><Input type="number" value={tierForm.tier_level} onChange={(e) => setTierForm({ ...tierForm, tier_level: +e.target.value })} /></div>
                <div><Label className="text-xs">Badge Wajib</Label><Input type="number" value={tierForm.badge_required} onChange={(e) => setTierForm({ ...tierForm, badge_required: +e.target.value })} /></div>
              </div>
              <div className="p-2 rounded bg-muted/30 space-y-1">
                <div className="text-[10px] font-bold">FREE</div>
                <div className="grid grid-cols-3 gap-1">
                  <select className="border rounded px-1 py-1 text-xs bg-background" value={tierForm.free_reward_type} onChange={(e) => setTierForm({ ...tierForm, free_reward_type: e.target.value })}>{REWARD_TYPES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}</select>
                  <Input type="number" placeholder="Nilai" value={tierForm.free_reward_value} onChange={(e) => setTierForm({ ...tierForm, free_reward_value: +e.target.value })} />
                  <Input placeholder="Label" value={tierForm.free_reward_label} onChange={(e) => setTierForm({ ...tierForm, free_reward_label: e.target.value })} />
                </div>
              </div>
              <div className="p-2 rounded bg-yellow-500/10 space-y-1">
                <div className="text-[10px] font-bold">👑 PREMIUM</div>
                <div className="grid grid-cols-3 gap-1">
                  <select className="border rounded px-1 py-1 text-xs bg-background" value={tierForm.premium_reward_type} onChange={(e) => setTierForm({ ...tierForm, premium_reward_type: e.target.value })}>{REWARD_TYPES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}</select>
                  <Input type="number" placeholder="Nilai" value={tierForm.premium_reward_value} onChange={(e) => setTierForm({ ...tierForm, premium_reward_value: +e.target.value })} />
                  <Input placeholder="Label" value={tierForm.premium_reward_label} onChange={(e) => setTierForm({ ...tierForm, premium_reward_label: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2"><Button size="sm" onClick={saveTier}>Simpan</Button><Button size="sm" variant="ghost" onClick={() => setTierForm(null)}>Batal</Button></div>
            </CardContent>
          </Card>
        )}

        {tiers.map(t => (
          <Card key={t.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  <div className="font-bold">Tier {t.tier_level} · {t.badge_required} 🏅</div>
                  <div className="text-muted-foreground">Free: {t.free_reward_label || '-'} | 👑 {t.premium_reward_label || '-'}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setTierForm(t)}>Edit</Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteTier(t.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
