import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Flame, Loader2, Crown, Check, Lock, Gem, Target, Trophy, Sparkles } from "lucide-react";

interface FirePassTabProps {
  visitorId: string;
}

export default function FirePassTab({ visitorId }: FirePassTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<any>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  const load = async () => {
    if (!visitorId) return;
    setLoading(true);
    const [statusRes, missionRes] = await Promise.all([
      supabase.functions.invoke("fire-pass", { body: { action: "status", visitorId } }),
      supabase.functions.invoke("fire-pass", { body: { action: "list_missions", visitorId } }),
    ]);
    const s = statusRes.data as any;
    const m = missionRes.data as any;
    setSeason(s?.season); setTiers(s?.tiers || []); setProgress(s?.progress);
    setMissions(m?.missions || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [visitorId]);

  if (!visitorId) return null;

  const claim = async (tierLevel: number, track: "free" | "premium") => {
    setClaiming(`${track}-${tierLevel}`);
    try {
      const { data, error } = await supabase.functions.invoke("fire-pass", { body: { action: "claim_tier", visitorId, tierLevel, track } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "🔥 Reward diklaim!", description: (data as any).reward_label });
      load();
    } catch (e) { toast({ title: "Gagal", description: String(e), variant: "destructive" }); }
    finally { setClaiming(null); }
  };

  const claimMission = async (missionId: string) => {
    setClaiming(`mission-${missionId}`);
    try {
      const { data, error } = await supabase.functions.invoke("fire-pass", { body: { action: "claim_mission", visitorId, missionId } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "🏅 Badge didapat!", description: `+${(data as any).badges_awarded} badge` });
      load();
    } catch (e) { toast({ title: "Gagal", description: String(e), variant: "destructive" }); }
    finally { setClaiming(null); }
  };

  const buyPremium = async (method: "saldo" | "gems") => {
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("fire-pass", { body: { action: "buy_premium", visitorId, method } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "🔥 Premium aktif!" });
      load();
    } catch (e) { toast({ title: "Gagal", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
    finally { setBuying(false); }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!season) return <div className="p-8 text-center text-sm text-muted-foreground">Belum ada season Fire Pass aktif</div>;

  const badges = progress?.badges || 0;
  const isPremium = !!progress?.is_premium;
  const daysLeft = Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86400000));

  const renderTierRow = (t: any, track: "free" | "premium") => {
    const canClaim = badges >= t.badge_required;
    const claimed = track === "free"
      ? progress?.claimed_free_tiers?.includes(t.tier_level)
      : progress?.claimed_premium_tiers?.includes(t.tier_level);
    const label = track === "free" ? t.free_reward_label : t.premium_reward_label;
    const pct = Math.min(100, (badges / t.badge_required) * 100);
    return (
      <Card key={`${track}-${t.id}`} className={canClaim ? "border-orange-400/60" : "opacity-70"}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black flex items-center gap-1">
              {track === "premium" ? <Crown className="w-3 h-3 text-yellow-500" /> : null}
              Tier {t.tier_level}
            </div>
            <div className="text-[10px] text-muted-foreground">🏅 {t.badge_required}</div>
          </div>
          <Progress value={pct} className="h-1.5" />
          <div className={`flex items-center justify-between p-2 rounded ${track === "premium" ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-muted/30"}`}>
            <div className="text-[11px] font-medium">{label || "-"}</div>
            {claimed ? <Check className="w-4 h-4 text-green-500" /> :
              track === "premium" && !isPremium ? <Lock className="w-4 h-4 text-muted-foreground" /> :
              <Button
                size="sm"
                className={`h-6 text-[10px] ${track === "premium" ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black" : ""}`}
                disabled={!canClaim || claiming === `${track}-${t.tier_level}`}
                onClick={() => claim(t.tier_level, track)}
              >
                {claiming === `${track}-${t.tier_level}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "Klaim"}
              </Button>
            }
          </div>
        </CardContent>
      </Card>
    );
  };

  const dailyMissions = missions.filter(m => m.mission_type === "daily");
  const weeklyMissions = missions.filter(m => m.mission_type === "weekly");

  const renderMission = (m: any) => {
    const pct = Math.min(100, ((m.current_value || 0) / m.target_value) * 100);
    return (
      <div key={m.id} className="p-2 rounded-lg border border-orange-500/20 bg-orange-500/5 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold truncate">{m.title}</div>
            <div className="text-[9px] text-muted-foreground truncate">{m.description}</div>
          </div>
          <div className="text-[10px] font-black text-orange-500 whitespace-nowrap">+{m.badge_reward} 🏅</div>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-1.5 flex-1" />
          <div className="text-[9px] text-muted-foreground whitespace-nowrap">{m.current_value}/{m.target_value}</div>
        </div>
        {m.is_claimed ? (
          <div className="text-[10px] text-green-500 flex items-center gap-1"><Check className="w-3 h-3" /> Diklaim</div>
        ) : m.is_completed ? (
          <Button size="sm" className="w-full h-6 text-[10px] bg-gradient-to-r from-orange-500 to-red-500 text-white" disabled={claiming === `mission-${m.id}`} onClick={() => claimMission(m.id)}>
            {claiming === `mission-${m.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "Klaim Badge"}
          </Button>
        ) : (
          <div className="text-[9px] text-muted-foreground text-center">Belum selesai</div>
        )}
      </div>
    );
  };

  return (
    <div className="p-3 space-y-3 pb-24">
      {/* Hero */}
      <Card className="border-orange-500/60 bg-gradient-to-br from-orange-600/20 via-red-600/20 to-pink-600/20 overflow-hidden">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-orange-500 animate-pulse" />
              <div>
                <div className="text-[10px] uppercase tracking-widest opacity-70">Fire Pass · Season {season.season_number}</div>
                <div className="font-black text-lg">{season.name}</div>
              </div>
            </div>
            {isPremium ? (
              <div className="px-2 py-1 rounded-full bg-yellow-500 text-black text-[10px] font-black flex items-center gap-1"><Crown className="w-3 h-3" /> PREMIUM</div>
            ) : (
              <div className="px-2 py-1 rounded-full bg-muted text-[10px] font-bold">FREE</div>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">🏅 {badges} Badge · {daysLeft} hari tersisa</div>
        </CardContent>
      </Card>

      {!isPremium && (
        <Card className="border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-500" /><span className="text-sm font-bold">Upgrade ke Premium</span></div>
            <p className="text-[10px] text-muted-foreground">Buka jalur reward Premium yang jauh lebih besar.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => buyPremium("saldo")} disabled={buying} className="text-xs">💰 Rp{Number(season.price_saldo_in).toLocaleString("id-ID")}</Button>
              <Button onClick={() => buyPremium("gems")} disabled={buying} variant="outline" className="text-xs"><Gem className="w-3 h-3 mr-1" />{season.price_gems}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missions */}
      <Card className="border-orange-500/40 bg-gradient-to-br from-orange-500/5 to-red-500/5">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-bold">Misi Fire Pass</span>
            <span className="text-[10px] text-muted-foreground">· Selesaikan untuk dapat badge</span>
          </div>
          <Tabs defaultValue="daily">
            <TabsList className="grid grid-cols-2 h-8">
              <TabsTrigger value="daily" className="text-[11px]"><Sparkles className="w-3 h-3 mr-1" />Harian</TabsTrigger>
              <TabsTrigger value="weekly" className="text-[11px]"><Trophy className="w-3 h-3 mr-1" />Mingguan</TabsTrigger>
            </TabsList>
            <TabsContent value="daily" className="space-y-2 mt-2">
              {dailyMissions.length === 0 ? <div className="text-[10px] text-center text-muted-foreground py-2">Tidak ada misi harian</div> : dailyMissions.map(renderMission)}
            </TabsContent>
            <TabsContent value="weekly" className="space-y-2 mt-2">
              {weeklyMissions.length === 0 ? <div className="text-[10px] text-center text-muted-foreground py-2">Tidak ada misi mingguan</div> : weeklyMissions.map(renderMission)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tier Reward — split Free / Premium */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" /> Tier Reward</h3>
        <Tabs defaultValue="free">
          <TabsList className="grid grid-cols-2 h-9 w-full">
            <TabsTrigger value="free" className="text-xs">🎁 Free</TabsTrigger>
            <TabsTrigger value="premium" className="text-xs">👑 Premium</TabsTrigger>
          </TabsList>
          <TabsContent value="free" className="space-y-2 mt-2">
            {tiers.map(t => renderTierRow(t, "free"))}
          </TabsContent>
          <TabsContent value="premium" className="space-y-2 mt-2">
            {!isPremium && (
              <Card className="border-yellow-500/40 bg-yellow-500/5">
                <CardContent className="p-2 text-center text-[11px]">
                  <Lock className="w-4 h-4 inline mr-1 text-yellow-500" />
                  Upgrade Premium untuk klaim reward di jalur ini
                </CardContent>
              </Card>
            )}
            {tiers.map(t => renderTierRow(t, "premium"))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
