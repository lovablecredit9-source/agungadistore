import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Flame, Loader2, Crown, Check, Lock, Coins, Gem } from "lucide-react";

export default function FirePassTab() {
  const { toast } = useToast();
  const visitorId = localStorage.getItem("balance_visitor_id") || getVisitorId();
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<any>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("fire-pass", { body: { action: "status", visitorId } });
    const d = data as any;
    setSeason(d?.season); setTiers(d?.tiers || []); setProgress(d?.progress);
    setLoading(false);
  };
  useEffect(() => { load(); }, [visitorId]);

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

  const buyPremium = async (method: "saldo" | "gems") => {
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("fire-pass", { body: { action: "buy_premium", visitorId, method } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "🔥 Premium aktif!" });
      load();
    } catch (e) { toast({ title: "Gagal", description: String(e), variant: "destructive" }); }
    finally { setBuying(false); }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!season) return <div className="p-8 text-center text-sm text-muted-foreground">Belum ada season Fire Pass aktif</div>;

  const badges = progress?.badges || 0;
  const isPremium = !!progress?.is_premium;
  const daysLeft = Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86400000));

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
              <Button onClick={() => buyPremium("saldo")} disabled={buying} className="text-xs">💰 Rp{season.price_saldo_in.toLocaleString("id-ID")}</Button>
              <Button onClick={() => buyPremium("gems")} disabled={buying} variant="outline" className="text-xs"><Gem className="w-3 h-3 mr-1" />{season.price_gems}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h3 className="font-bold text-sm flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" /> Tier Reward</h3>
        {tiers.map(t => {
          const canClaim = badges >= t.badge_required;
          const freeClaimed = progress?.claimed_free_tiers?.includes(t.tier_level);
          const premClaimed = progress?.claimed_premium_tiers?.includes(t.tier_level);
          const pct = Math.min(100, (badges / t.badge_required) * 100);
          return (
            <Card key={t.id} className={canClaim ? "border-orange-400/60" : "opacity-70"}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black">Tier {t.tier_level}</div>
                  <div className="text-[10px] text-muted-foreground">🏅 {t.badge_required}</div>
                </div>
                <Progress value={pct} className="h-1.5" />

                {/* Free */}
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="text-[11px]"><span className="font-bold">FREE:</span> {t.free_reward_label || '-'}</div>
                  {freeClaimed ? <Check className="w-4 h-4 text-green-500" /> :
                    <Button size="sm" className="h-6 text-[10px]" disabled={!canClaim || claiming === `free-${t.tier_level}`} onClick={() => claim(t.tier_level, "free")}>
                      {claiming === `free-${t.tier_level}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "Klaim"}
                    </Button>
                  }
                </div>
                {/* Premium */}
                <div className="flex items-center justify-between p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                  <div className="text-[11px] flex items-center gap-1"><Crown className="w-3 h-3 text-yellow-500" /><span className="font-bold">PREMIUM:</span> {t.premium_reward_label || '-'}</div>
                  {premClaimed ? <Check className="w-4 h-4 text-green-500" /> :
                    !isPremium ? <Lock className="w-4 h-4 text-muted-foreground" /> :
                    <Button size="sm" className="h-6 text-[10px] bg-gradient-to-r from-yellow-500 to-orange-500 text-black" disabled={!canClaim || claiming === `premium-${t.tier_level}`} onClick={() => claim(t.tier_level, "premium")}>
                      {claiming === `premium-${t.tier_level}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "Klaim"}
                    </Button>
                  }
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
