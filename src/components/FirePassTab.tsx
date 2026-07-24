import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Flame, Loader2, Crown, Check, Lock, Gem, Target, Trophy, Sparkles, Zap, History } from "lucide-react";

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

  const buyProMissions = async (method: "saldo" | "gems") => {
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("fire-pass", { body: { action: "buy_pro_missions", visitorId, method } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "🔮 Misi PRO aktif 30 hari!" });
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
  const monthlyMissions = missions.filter(m => m.mission_type === "monthly");
  const proMissions = missions.filter(m => m.mission_type === "pro");
  const proUntil = progress?.pro_missions_until ? new Date(progress.pro_missions_until).getTime() : 0;
  const proActive = proUntil > Date.now();
  const proDaysLeft = proActive ? Math.max(0, Math.ceil((proUntil - Date.now()) / 86400000)) : 0;
  const proPriceSaldo = season.pro_price_saldo_in ?? 30000;
  const proPriceGems = season.pro_price_gems ?? 500;

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
            <TabsList className="grid grid-cols-4 h-8">
              <TabsTrigger value="daily" className="text-[10px] px-1"><Sparkles className="w-3 h-3 mr-0.5" />Harian</TabsTrigger>
              <TabsTrigger value="weekly" className="text-[10px] px-1"><Trophy className="w-3 h-3 mr-0.5" />Mingguan</TabsTrigger>
              <TabsTrigger value="monthly" className="text-[10px] px-1"><Crown className="w-3 h-3 mr-0.5" />Bulanan</TabsTrigger>
              <TabsTrigger value="pro" className="text-[10px] px-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white"><Zap className="w-3 h-3 mr-0.5" />PRO</TabsTrigger>
            </TabsList>
            <TabsContent value="daily" className="space-y-2 mt-2">
              {dailyMissions.length === 0 ? <div className="text-[10px] text-center text-muted-foreground py-2">Tidak ada misi harian</div> : dailyMissions.map(renderMission)}
            </TabsContent>
            <TabsContent value="weekly" className="space-y-2 mt-2">
              {weeklyMissions.length === 0 ? <div className="text-[10px] text-center text-muted-foreground py-2">Tidak ada misi mingguan</div> : weeklyMissions.map(renderMission)}
            </TabsContent>
            <TabsContent value="monthly" className="space-y-2 mt-2">
              {monthlyMissions.length === 0 ? <div className="text-[10px] text-center text-muted-foreground py-2">Tidak ada misi bulanan</div> : monthlyMissions.map(renderMission)}
            </TabsContent>
            <TabsContent value="pro" className="space-y-2 mt-2">
              {(() => {
                const totalBadges = proMissions.reduce((s, m) => s + (m.badge_reward || 0), 0);
                const claimedCount = proMissions.filter(m => m.is_claimed).length;
                const readyCount = proMissions.filter(m => m.is_completed && !m.is_claimed).length;
                const sortedPro = [...proMissions].sort((a, b) => {
                  const score = (m: any) => (m.is_claimed ? 2 : m.is_completed ? 0 : 1);
                  return score(a) - score(b) || (a.badge_reward || 0) - (b.badge_reward || 0);
                });
                return (
                  <>
                    <div className="relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-purple-700/30 via-fuchsia-600/25 to-pink-600/30 border border-purple-400/40">
                      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-fuchsia-500/30 blur-2xl animate-pulse" />
                      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-purple-500/30 blur-2xl animate-pulse" />
                      <div className="relative flex items-center justify-between">
                        <div>
                          <div className="text-[9px] uppercase tracking-widest text-purple-200/80 font-bold flex items-center gap-1">
                            <Zap className="w-3 h-3" /> Fire Pass PRO
                          </div>
                          <div className="text-base font-black bg-gradient-to-r from-yellow-200 via-pink-200 to-purple-200 bg-clip-text text-transparent">
                            {proMissions.length} Misi · {totalBadges} 🏅 Total
                          </div>
                          <div className="text-[10px] text-purple-100/80 mt-0.5">
                            {proActive ? <>✨ Aktif · sisa <b>{proDaysLeft}</b> hari · {claimedCount}/{proMissions.length} klaim{readyCount > 0 && <> · <span className="text-yellow-300 font-black">{readyCount} siap klaim!</span></>}</> : "🔒 Beli akses untuk klaim badge besar"}
                          </div>
                        </div>
                        {proActive && (
                          <div className="px-2 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-pink-500 text-black text-[10px] font-black shadow-lg animate-pulse">PRO</div>
                        )}
                      </div>
                    </div>

                    {!proActive && (
                      <Card className="border-purple-500/50 bg-gradient-to-br from-purple-600/15 via-pink-600/10 to-purple-800/15 overflow-hidden relative">
                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.3),transparent_50%)]" />
                        <CardContent className="p-3 space-y-2 relative">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                              <Zap className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-black bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">Buka Misi PRO</div>
                              <div className="text-[9px] text-purple-200/70">Akses 30 hari · hadiah badge sampai 150 🏅</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-center">
                            <div className="p-1.5 rounded bg-black/30 border border-purple-500/30"><div className="text-[9px] text-purple-200/70">Misi</div><div className="text-xs font-black text-white">{proMissions.length}+</div></div>
                            <div className="p-1.5 rounded bg-black/30 border border-purple-500/30"><div className="text-[9px] text-purple-200/70">Badge</div><div className="text-xs font-black text-yellow-300">{totalBadges}🏅</div></div>
                            <div className="p-1.5 rounded bg-black/30 border border-purple-500/30"><div className="text-[9px] text-purple-200/70">Durasi</div><div className="text-xs font-black text-white">30hr</div></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button onClick={() => buyProMissions("saldo")} disabled={buying} className="text-[11px] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg">
                              💰 Rp{Number(proPriceSaldo).toLocaleString("id-ID")}
                            </Button>
                            <Button onClick={() => buyProMissions("gems")} disabled={buying} variant="outline" className="text-[11px] border-purple-500/50 hover:bg-purple-500/10">
                              <Gem className="w-3 h-3 mr-1 text-purple-400" />{proPriceGems}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {sortedPro.length === 0 ? (
                      <div className="text-[10px] text-center text-muted-foreground py-2">Belum ada misi PRO</div>
                    ) : (
                      sortedPro.map(m => (
                        <div key={m.id} className={proActive ? "" : "opacity-60 pointer-events-none"}>
                          {renderMission(m)}
                        </div>
                      ))
                    )}
                  </>
                );
              })()}
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
