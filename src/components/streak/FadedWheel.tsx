import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Heart, Lightbulb, Timer, Shield, Gem, Loader2, X, Sparkles, Zap, Gift, Package, Key, Wallet } from "lucide-react";

interface PendingClaim { index: number }

interface BonusThreshold {
  spins: number;
  bonus: { kind: string; value: number; label: string; rarity: string };
}

const GRID_SIZE = 30;
const SPECIAL_INDEXES = [2, 5, 8, 12, 16, 19, 23, 27];
const LIMITED_INDEXES = [4, 11, 18, 25];
const SUPER_LIMITED_INDEXES = [9, 21, 29];

function boxTier(i: number): "normal" | "special" | "limited" | "super_limited" {
  if (SUPER_LIMITED_INDEXES.includes(i)) return "super_limited";
  if (LIMITED_INDEXES.includes(i)) return "limited";
  if (SPECIAL_INDEXES.includes(i)) return "special";
  return "normal";
}

const TIER_BOX: Record<string, string> = {
  normal: "bg-gradient-to-br from-fuchsia-600 via-purple-700 to-indigo-800 ring-2 ring-fuchsia-400/60 shadow-md shadow-fuchsia-500/40",
  special: "bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 ring-2 ring-yellow-200 shadow-lg shadow-amber-400/60",
  limited: "bg-[linear-gradient(135deg,#f43f5e,#a855f7,#22d3ee,#22c55e,#facc15)] ring-2 ring-white/70 shadow-lg shadow-fuchsia-400/60",
  super_limited: "bg-[linear-gradient(135deg,#fff1f2,#fb7185,#c084fc,#38bdf8,#4ade80,#fde047)] ring-4 ring-white shadow-2xl shadow-cyan-300/70 animate-pulse",
};

const TIER_TAG: Record<string, string> = {
  normal: "",
  special: "SPECIAL",
  limited: "LIMITED",
  super_limited: "SUPER",
};

interface State {
  gridSize: number;
  claimedIndexes: number[];
  pendingClaims: PendingClaim[];
  spinsInRound: number;
  totalSpinsLifetime: number;
  currentRound: number;
  nextCost: number;
  spinCosts: number[];
  bonusThresholds: BonusThreshold[];
  gems: number;
}

interface RevealedPrize {
  kind: string;
  value: number;
  label: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

const RARITY_STYLE: Record<string, { glow: string; gradient: string; label: string; ring: string }> = {
  common: { glow: "shadow-slate-500/30", gradient: "from-slate-500 to-slate-700", label: "C", ring: "ring-slate-400/40" },
  rare: { glow: "shadow-cyan-500/50", gradient: "from-cyan-500 to-blue-600", label: "R", ring: "ring-cyan-400/60" },
  epic: { glow: "shadow-purple-500/60", gradient: "from-fuchsia-500 to-purple-700", label: "E", ring: "ring-fuchsia-400/70" },
  legendary: { glow: "shadow-amber-500/70", gradient: "from-amber-400 via-orange-500 to-red-600", label: "L", ring: "ring-amber-400/80" },
};

function getKindIcon(kind: string) {
  switch (kind) {
    case "extra_life": return <Heart className="w-full h-full" fill="currentColor" />;
    case "auto_hint": return <Lightbulb className="w-full h-full" fill="currentColor" />;
    case "time_freeze": return <Timer className="w-full h-full" />;
    case "streak_freeze": return <Shield className="w-full h-full" fill="currentColor" />;
    case "gems": return <Gem className="w-full h-full" fill="currentColor" />;
    case "game_credits": return <Key className="w-full h-full" />;
    case "game_balance": return <Wallet className="w-full h-full" />;
    default: return <Sparkles className="w-full h-full" />;
  }
}

interface Props {
  visitorId: string | null;
  onGemsChange?: (g: number) => void;
  activeLuckyVoucher?: { code: string; pct: number; expiresAt: string } | null;
}

export default function FadedWheel({ visitorId, onGemsChange, activeLuckyVoucher }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [claimingIndex, setClaimingIndex] = useState<number | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [highlightCycle, setHighlightCycle] = useState<number | null>(null);
  const [revealedPrize, setRevealedPrize] = useState<RevealedPrize | null>(null);
  const [revealedBonus, setRevealedBonus] = useState<any>(null);
  const [revealedAtIndex, setRevealedAtIndex] = useState<number | null>(null);

  const fetchState = async () => {
    if (!visitorId) return;
    try {
      const { data, error } = await supabase.functions.invoke("faded-wheel", {
        body: { visitorId, action: "check" },
      });
      if (error) throw error;
      setState(data);
      onGemsChange?.(data.gems);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchState(); }, [visitorId]);

  const pendingSet = state ? new Set(state.pendingClaims.map((p) => p.index)) : new Set<number>();
  const claimedSet = state ? new Set(state.claimedIndexes) : new Set<number>();

  const doSpin = async () => {
    if (!visitorId || spinning || !state) return;
    if (state.gems < effectiveNextCost) {
      toast({ title: "Gem Kurang", description: `Butuh ${effectiveNextCost} 💎`, variant: "destructive" });
      return;
    }
    setSpinning(true);
    setRevealedPrize(null);
    setRevealedBonus(null);
    setRevealedAtIndex(null);

    // Animasi cycle highlight di box yang available
    const available = Array.from({ length: GRID_SIZE }, (_, i) => i).filter(
      (i) => !claimedSet.has(i) && !pendingSet.has(i)
    );
    let cycleCount = 0;
    const cycleInterval = setInterval(() => {
      setHighlightCycle(available[cycleCount % available.length]);
      cycleCount++;
    }, 100);

    try {
      const { data, error } = await supabase.functions.invoke("faded-wheel", {
        body: { visitorId, action: "spin" },
      });
      if (error) throw error;
      if (data.error) {
        clearInterval(cycleInterval);
        setHighlightCycle(null);
        toast({ title: "Gagal", description: data.error, variant: "destructive" });
        setSpinning(false);
        return;
      }

      // Slow down: lanjut animasi ~1.5 detik lalu fokus ke box terpilih
      await new Promise((r) => setTimeout(r, 1500));
      clearInterval(cycleInterval);
      setHighlightCycle(data.boxIndex);
      await new Promise((r) => setTimeout(r, 600));
      setHighlightCycle(null);

      setState({
        ...state,
        pendingClaims: data.pendingClaims,
        gems: data.gems,
        nextCost: data.nextCost,
        spinsInRound: data.spinsInRound,
        totalSpinsLifetime: data.totalSpinsLifetime,
      });
      onGemsChange?.(data.gems);

      toast({
        title: "📦 Box Terbuka!",
        description: `Box #${data.boxIndex + 1} siap diklaim. Tap box untuk reveal hadiah!`,
      });
    } catch (e: any) {
      clearInterval(cycleInterval);
      setHighlightCycle(null);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSpinning(false);
    }
  };

  const claimBox = async (idx: number) => {
    if (!visitorId || claimingIndex !== null || !state) return;
    if (!pendingSet.has(idx)) return;
    setClaimingIndex(idx);
    try {
      const { data, error } = await supabase.functions.invoke("faded-wheel", {
        body: { visitorId, action: "claim", boxIndex: idx },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal", description: data.error, variant: "destructive" });
        setClaimingIndex(null);
        return;
      }

      setRevealedPrize(data.prize);
      setRevealedBonus(data.bonus);
      setRevealedAtIndex(idx);

      setState({
        ...state,
        claimedIndexes: data.claimedIndexes,
        pendingClaims: data.pendingClaims,
        gems: data.gems,
        nextCost: data.nextCost,
        currentRound: data.currentRound,
        spinsInRound: data.spinsInRound,
      });
      onGemsChange?.(data.gems);

      if (data.resetTriggered) {
        setTimeout(() => {
          toast({ title: "🎉 Ronde Baru!", description: `${GRID_SIZE} mystery box baru telah disiapkan!` });
        }, 1200);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setClaimingIndex(null);
    }
  };

  if (loading || !state) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const totalOpened = claimedSet.size + pendingSet.size;
  const remaining = GRID_SIZE - totalOpened;
  const pendingCount = pendingSet.size;
  const voucherPct = Math.max(0, Math.min(100, Number(activeLuckyVoucher?.pct || 0)));
  const effectiveNextCost = voucherPct > 0 ? Math.max(1, state.nextCost - Math.floor((state.nextCost * voucherPct) / 100)) : state.nextCost;

  return (
    <div className="space-y-3">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-700/40 via-purple-800/30 to-indigo-900/40 border-2 border-fuchsia-500/50 p-3">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 30% 50%, rgba(217,70,239,0.6), transparent 60%)",
        }} />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Badge className="bg-fuchsia-600 text-white font-black text-[9px] px-1.5">MYSTERY</Badge>
              <span className="text-[9px] font-black tracking-widest text-fuchsia-300">MYSTERY BOX</span>
            </div>
            <h2 className="text-lg font-black tracking-tight bg-gradient-to-br from-fuchsia-200 via-fuchsia-400 to-purple-500 bg-clip-text text-transparent">
              KOTAK MISTERIUS<br />HADIAH ACAK
            </h2>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-fuchsia-100/90">
              <span>Ronde #{state.currentRound}</span>
              <span>•</span>
              <span>{remaining} box tersisa</span>
              {pendingCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-amber-300 font-bold">{pendingCount} siap klaim</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="text-[10px] text-fuchsia-200/80 text-center px-2 leading-tight">
        🎁 Spin untuk membuka 1 mystery box. Tap box yang berkilau untuk klaim hadiah random! Setelah 30 box terbuka, ronde reset.
      </div>

      {/* Legend tier */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-[9px] font-black">
        <span className="px-2 py-0.5 rounded-full bg-gradient-to-br from-fuchsia-600 to-indigo-800 text-white">NORMAL</span>
        <span className="px-2 py-0.5 rounded-full bg-gradient-to-br from-yellow-300 to-orange-500 text-black">SPECIAL · min RARE</span>
        <span className="px-2 py-0.5 rounded-full bg-[linear-gradient(135deg,#f43f5e,#a855f7,#22d3ee,#facc15)] text-white">LIMITED · min EPIC</span>
        <span className="px-2 py-0.5 rounded-full bg-[linear-gradient(135deg,#fff1f2,#fb7185,#c084fc,#38bdf8,#fde047)] text-black">SUPER LIMITED · LEGENDARY</span>
      </div>

      {/* Grid 30 Mystery Boxes */}
      <div className="relative rounded-2xl bg-gradient-to-br from-purple-900/40 via-fuchsia-900/40 to-indigo-900/40 border-2 border-fuchsia-500/30 p-3">
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: GRID_SIZE }, (_, i) => {
            const claimed = claimedSet.has(i);
            const pending = pendingSet.has(i);
            const isHighlighted = highlightCycle === i;
            const isClaimingThis = claimingIndex === i;
            const justRevealed = revealedAtIndex === i && revealedPrize;
            const tier = boxTier(i);

            return (
              <button
                key={i}
                disabled={!pending || claimingIndex !== null || spinning}
                onClick={() => pending && claimBox(i)}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center p-1.5 transition-all duration-150 overflow-hidden
                  ${claimed
                    ? "bg-black/60 ring-1 ring-white/10 opacity-30 grayscale cursor-default"
                    : pending
                      ? "bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 ring-2 ring-amber-300 shadow-lg shadow-amber-500/60 cursor-pointer hover:scale-105 active:scale-95 animate-pulse"
                      : `${TIER_BOX[tier]} cursor-default`
                  }
                  ${isHighlighted && !claimed ? "ring-4 ring-amber-300 scale-110 shadow-2xl shadow-amber-500/60" : ""}
                  ${isClaimingThis ? "animate-spin" : ""}
                `}
              >
                {claimed ? (
                  <>
                    <X className="w-5 h-5 text-red-500/70" strokeWidth={3} />
                    <div className="text-[8px] font-black text-white/40 mt-0.5">DIBUKA</div>
                  </>
                ) : pending ? (
                  <>
                    <Gift className="w-5 h-5 text-white drop-shadow-lg" />
                    <div className="text-[8px] font-black text-white mt-0.5 tracking-wider">KLAIM!</div>
                    <Badge className="absolute top-0.5 right-0.5 text-[7px] font-black px-1 py-0 bg-black/70 text-amber-200">
                      ?
                    </Badge>
                  </>
                ) : (
                  <>
                    <Package className="w-5 h-5 text-white/90 drop-shadow" />
                    <div className="text-[8px] font-black text-white/90 mt-0.5 drop-shadow">#{i + 1}</div>
                    {TIER_TAG[tier] && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[6px] font-black tracking-wider text-white py-0.5">
                        {TIER_TAG[tier]}
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Spin Button */}
      <button
        disabled={spinning || remaining === 0 || claimingIndex !== null}
        onClick={doSpin}
        className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-700 px-4 py-3.5 font-black shadow-lg shadow-fuchsia-500/50 active:scale-95 transition disabled:opacity-50"
      >
        <div className="flex items-center justify-center gap-2 text-white">
          {spinning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="tracking-widest text-sm">MEMBUKA BOX...</span>
            </>
          ) : remaining === 0 ? (
            <>
              <Sparkles className="w-5 h-5" />
              <span className="tracking-widest text-sm">KLAIM SEMUA BOX DULU</span>
            </>
          ) : (
            <>
              <Package className="w-5 h-5" />
              <span className="tracking-widest text-base">BUKA MYSTERY BOX</span>
              <span className="flex items-center gap-1 bg-black/30 rounded-full px-2 py-0.5 text-xs">
                <Gem className="w-3 h-3" /> {voucherPct > 0 && <span className="line-through opacity-60">{state.nextCost}</span>} {effectiveNextCost}
              </span>
            </>
          )}
        </div>
      </button>

      {/* Bonus Tambahan */}
      <div>
        <h3 className="text-xs font-black tracking-widest text-fuchsia-300 mb-2 px-1">| HADIAH BONUS RONDE</h3>
        <div className="space-y-1.5">
          {state.bonusThresholds.map((b, i) => {
            const claimedCount = claimedSet.size;
            const unlocked = claimedCount >= b.spins;
            const style = RARITY_STYLE[b.bonus.rarity] || RARITY_STYLE.common;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  unlocked
                    ? `bg-gradient-to-r ${style.gradient} border-amber-400 shadow-md ${style.glow}`
                    : "bg-black/40 border-white/10"
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${unlocked ? "bg-black/30" : "bg-black/60"}`}>
                  <div className="w-5 h-5 text-white">{getKindIcon(b.bonus.kind)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-white truncate">{b.bonus.label}</div>
                  <div className="text-[10px] text-white/70">Klaim {b.spins} box di ronde ini</div>
                </div>
                <Badge className={`text-[9px] font-black ${unlocked ? "bg-amber-500 text-black" : "bg-black/60 text-white/60"}`}>
                  {unlocked ? "✓ DAPAT" : `${b.spins}/${GRID_SIZE}`}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reveal Modal */}
      {revealedPrize && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => { setRevealedPrize(null); setRevealedBonus(null); setRevealedAtIndex(null); }}
        >
          <Card
            className="relative max-w-xs w-full bg-gradient-to-br from-[#1a0e3d] to-[#0b0820] border-2 border-amber-500/50 p-5 shadow-2xl shadow-amber-500/30 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setRevealedPrize(null); setRevealedBonus(null); setRevealedAtIndex(null); }}
              className="absolute top-2 right-2 text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-1" />
              <h3 className="text-xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent mb-3">
                BOX TERBUKA!
              </h3>
              <div className={`mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br ${RARITY_STYLE[revealedPrize.rarity].gradient} ring-4 ${RARITY_STYLE[revealedPrize.rarity].ring} shadow-2xl ${RARITY_STYLE[revealedPrize.rarity].glow} flex items-center justify-center mb-3`}>
                <div className="w-12 h-12 text-white">{getKindIcon(revealedPrize.kind)}</div>
              </div>
              <Badge className={`bg-gradient-to-r ${RARITY_STYLE[revealedPrize.rarity].gradient} text-white font-black mb-2`}>
                {revealedPrize.rarity.toUpperCase()}
              </Badge>
              <div className="text-lg font-black text-white">{revealedPrize.label}</div>

              {revealedBonus && (
                <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-2 border-amber-400/50">
                  <div className="flex items-center gap-2 mb-1 justify-center">
                    <Gift className="w-4 h-4 text-amber-300" />
                    <span className="text-[10px] font-black tracking-widest text-amber-300">BONUS UNLOCKED!</span>
                  </div>
                  <div className="text-sm font-black text-white">{revealedBonus.label}</div>
                </div>
              )}
            </div>
            <Button
              onClick={() => { setRevealedPrize(null); setRevealedBonus(null); setRevealedAtIndex(null); }}
              className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-black tracking-wider"
            >
              <Zap className="w-4 h-4 mr-1" /> KEREN!
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
