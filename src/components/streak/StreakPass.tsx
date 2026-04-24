import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Crown, Loader2, Lock, Check, Sparkles, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface Tier {
  id: string;
  tier_level: number;
  xp_required: number;
  free_reward_type: string | null;
  free_reward_value: number;
  free_reward_label: string;
  free_reward_icon: string;
  premium_reward_type: string | null;
  premium_reward_value: number;
  premium_reward_label: string;
  premium_reward_icon: string;
}

interface Season {
  id: string;
  name: string;
  description: string;
  ends_at: string;
  premium_price: number;
}

interface ProgressData {
  total_xp: number;
  is_premium: boolean;
  claimed_free_tiers: number[];
  claimed_premium_tiers: number[];
}

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

export default function StreakPass({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [season, setSeason] = useState<Season | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        `streak-pass?action=status&visitorId=${visitorId}`,
        { method: "GET" as any },
      );
      if (error) throw error;
      setSeason((data as any).season);
      setTiers((data as any).tiers || []);
      setProgress((data as any).progress);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  const claimTier = async (tier: Tier, track: "free" | "premium") => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("streak-pass?action=claim_tier", {
        body: { visitorId, tierLevel: tier.tier_level, track },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "🏅 Tier Diklaim!", description: (data as any).reward.label });
      load();
      onUpdate?.();
    } catch (e) {
      toast({ title: "Gagal klaim", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const buyPremium = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("streak-pass?action=buy_premium", {
        body: { visitorId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "💎 Premium Aktif!", description: "Selamat menikmati hadiah premium!" });
      load();
      onUpdate?.();
    } catch (e) {
      toast({ title: "Gagal beli", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="cyber-card-pink rounded-2xl p-4 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-pink-300" />
    </div>
  );

  if (!season) return (
    <div className="cyber-card-pink rounded-2xl p-3 text-center text-xs text-white/60">
      Belum ada Streak Pass season aktif.
    </div>
  );

  const xp = progress?.total_xp ?? 0;
  const claimedFree = new Set(progress?.claimed_free_tiers ?? []);
  const claimedPrem = new Set(progress?.claimed_premium_tiers ?? []);
  const isPremium = progress?.is_premium ?? false;
  const maxXp = tiers.length > 0 ? tiers[tiers.length - 1].xp_required : 100;
  const currentTier = tiers.filter(t => xp >= t.xp_required).length;
  const nextTier = tiers.find(t => xp < t.xp_required);
  const daysLeft = Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="cyber-card-pink rounded-2xl p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 icon-3d-trophy" strokeWidth={2.5} />
          <span className="text-xs font-black neon-text-pink tracking-widest uppercase">Streak Pass</span>
          {isPremium && (
            <span className="text-[9px] font-black bg-gradient-to-r from-yellow-400 to-amber-500 text-black px-1.5 py-0.5 rounded uppercase tracking-wider">Premium</span>
          )}
        </div>
        <span className="text-[9px] font-bold text-white/60 uppercase tracking-wider">{daysLeft}h tersisa</span>
      </div>

      <div className="bg-black/40 rounded-xl p-2.5 border border-purple-500/30">
        <div className="text-[10px] font-black neon-text-cyan tracking-widest uppercase mb-1">{season.name}</div>
        <div className="text-[10px] text-white/70 mb-2 line-clamp-2">{season.description}</div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-white/80">Tier {currentTier}/{tiers.length}</span>
          <span className="text-[10px] font-black neon-text-yellow">{xp} / {maxXp} XP</span>
        </div>
        <Progress value={(xp / maxXp) * 100} className="h-2" />
        {nextTier && (
          <div className="text-[9px] text-white/60 mt-1">
            Tier berikutnya: butuh {nextTier.xp_required - xp} XP lagi
          </div>
        )}
      </div>

      {!isPremium && (
        <Button
          onClick={buyPremium}
          disabled={busy}
          className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-black font-black h-10 text-xs uppercase tracking-wider"
        >
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crown className="w-4 h-4 mr-2" />}
          Aktifkan Premium - Rp{Number(season.premium_price).toLocaleString("id-ID")}
        </Button>
      )}

      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
        {tiers.map(tier => {
          const reached = xp >= tier.xp_required;
          const freeClaimed = claimedFree.has(tier.tier_level);
          const premClaimed = claimedPrem.has(tier.tier_level);

          return (
            <motion.div
              key={tier.id}
              whileHover={reached ? { scale: 1.01 } : {}}
              className={`grid grid-cols-[28px_1fr_1fr] gap-1.5 items-center p-1.5 rounded-lg border ${
                reached ? "bg-purple-500/10 border-purple-400/50" : "bg-black/30 border-white/10 opacity-70"
              }`}
            >
              <div className={`flex flex-col items-center justify-center w-7 h-7 rounded-md text-[10px] font-black ${
                reached ? "bg-gradient-to-br from-pink-500 to-purple-600 text-white" : "bg-white/10 text-white/60"
              }`}>
                {tier.tier_level}
              </div>

              {/* Free reward */}
              <div className="min-w-0">
                {tier.free_reward_type ? (
                  <button
                    onClick={() => reached && !freeClaimed && claimTier(tier, "free")}
                    disabled={!reached || freeClaimed || busy}
                    className={`w-full flex items-center gap-1.5 p-1.5 rounded-md text-left transition ${
                      freeClaimed
                        ? "bg-green-500/20 border border-green-400/50"
                        : reached
                        ? "bg-cyan-500/20 border border-cyan-400/50 hover:bg-cyan-500/30"
                        : "bg-white/5 border border-white/10"
                    }`}
                  >
                    <span className="text-base shrink-0">{tier.free_reward_icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[8px] font-black text-white/60 uppercase">Free</div>
                      <div className="text-[10px] font-bold text-white truncate">{tier.free_reward_label}</div>
                    </div>
                    {freeClaimed && <Check className="w-3 h-3 text-green-300 shrink-0" strokeWidth={3} />}
                  </button>
                ) : (
                  <div className="py-2" aria-hidden="true" />
                )}
              </div>

              {/* Premium reward */}
              <div className="min-w-0">
                {tier.premium_reward_type && (
                  <button
                    onClick={() => isPremium && reached && !premClaimed && claimTier(tier, "premium")}
                    disabled={!isPremium || !reached || premClaimed || busy}
                    className={`w-full flex items-center gap-1.5 p-1.5 rounded-md text-left transition relative ${
                      premClaimed
                        ? "bg-green-500/20 border border-green-400/50"
                        : isPremium && reached
                        ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-400/50 hover:from-yellow-500/30 hover:to-amber-500/30"
                        : "bg-white/5 border border-yellow-500/20"
                    }`}
                  >
                    <span className="text-base shrink-0">{tier.premium_reward_icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[8px] font-black text-yellow-400 uppercase flex items-center gap-0.5">
                        <Gem className="w-2 h-2" /> Premium
                      </div>
                      <div className="text-[10px] font-bold text-white truncate">{tier.premium_reward_label}</div>
                    </div>
                    {premClaimed ? (
                      <Check className="w-3 h-3 text-green-300 shrink-0" strokeWidth={3} />
                    ) : !isPremium ? (
                      <Lock className="w-3 h-3 text-yellow-500/60 shrink-0" />
                    ) : null}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
