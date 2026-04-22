import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Heart, Lightbulb, Timer, Shield, Gem, Crown, Loader2, X, Sparkles, Zap, Gift, RefreshCw } from "lucide-react";

interface FadedPrize {
  kind: "extra_life" | "auto_hint" | "time_freeze" | "streak_freeze" | "gems";
  value: number;
  label: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

interface BonusThreshold {
  spins: number;
  bonus: { kind: string; value: number; label: string; rarity: string };
}

interface State {
  grid: FadedPrize[];
  claimedIndexes: number[];
  spinsInRound: number;
  totalSpinsLifetime: number;
  currentRound: number;
  nextCost: number;
  spinCosts: number[];
  bonusThresholds: BonusThreshold[];
  gems: number;
}

const RARITY_STYLE: Record<string, { glow: string; gradient: string; label: string; ring: string; bg: string }> = {
  common: { glow: "shadow-slate-500/30", gradient: "from-slate-600 to-slate-800", label: "C", ring: "ring-slate-400/40", bg: "bg-slate-700/40" },
  rare: { glow: "shadow-cyan-500/50", gradient: "from-cyan-500 to-blue-600", label: "R", ring: "ring-cyan-400/60", bg: "bg-cyan-700/40" },
  epic: { glow: "shadow-purple-500/60", gradient: "from-fuchsia-500 to-purple-700", label: "E", ring: "ring-fuchsia-400/70", bg: "bg-purple-800/40" },
  legendary: { glow: "shadow-amber-500/70", gradient: "from-amber-400 via-orange-500 to-red-600", label: "L", ring: "ring-amber-400/80", bg: "bg-amber-700/40" },
};

function getKindIcon(kind: string) {
  switch (kind) {
    case "extra_life": return <Heart className="w-full h-full" fill="currentColor" />;
    case "auto_hint": return <Lightbulb className="w-full h-full" fill="currentColor" />;
    case "time_freeze": return <Timer className="w-full h-full" />;
    case "streak_freeze": return <Shield className="w-full h-full" fill="currentColor" />;
    case "gems": return <Gem className="w-full h-full" fill="currentColor" />;
    default: return <Sparkles className="w-full h-full" />;
  }
}

interface Props {
  visitorId: string | null;
  onGemsChange?: (g: number) => void;
}

export default function FadedWheel({ visitorId, onGemsChange }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);
  const [revealedPrize, setRevealedPrize] = useState<FadedPrize | null>(null);
  const [revealedBonus, setRevealedBonus] = useState<any>(null);
  const [highlightCycle, setHighlightCycle] = useState<number | null>(null);

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

  const doSpin = async () => {
    if (!visitorId || spinning || !state) return;
    if (state.gems < state.nextCost) {
      toast({ title: "Gem Kurang", description: `Butuh ${state.nextCost} 💎`, variant: "destructive" });
      return;
    }
    setSpinning(true);
    setRevealedIndex(null);
    setRevealedPrize(null);
    setRevealedBonus(null);

    // Animasi cycle highlight di grid sebelum reveal
    const available = state.grid.map((_, i) => i).filter(i => !state.claimedIndexes.includes(i));
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

      // Slow down: lanjut animasi 1 detik lalu reveal
      await new Promise(r => setTimeout(r, 1500));
      clearInterval(cycleInterval);
      setHighlightCycle(data.prizeIndex);
      await new Promise(r => setTimeout(r, 400));
      setRevealedIndex(data.prizeIndex);
      setRevealedPrize(data.prize);
      setRevealedBonus(data.bonus);

      // Update state lokal
      setState({
        ...state,
        grid: data.newState.grid,
        claimedIndexes: data.newState.claimedIndexes,
        spinsInRound: data.newState.spinsInRound,
        totalSpinsLifetime: data.newState.totalSpinsLifetime,
        currentRound: data.newState.currentRound,
        nextCost: data.nextCost,
        gems: data.gems,
      });
      onGemsChange?.(data.gems);

      if (data.resetTriggered) {
        toast({ title: "🎉 Grid Reset!", description: "Semua hadiah telah didapat. Grid baru dimulai!" });
      }
    } catch (e: any) {
      clearInterval(cycleInterval);
      setHighlightCycle(null);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSpinning(false);
    }
  };

  if (loading || !state) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const claimedSet = new Set(state.claimedIndexes);
  const remaining = state.grid.length - claimedSet.size;

  return (
    <div className="space-y-3">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-700/40 via-blue-800/30 to-cyan-900/40 border-2 border-cyan-500/50 p-3">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 30% 50%, rgba(6,182,212,0.6), transparent 60%)",
        }} />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Badge className="bg-cyan-600 text-white font-black text-[9px] px-1.5">MYTHIC</Badge>
              <span className="text-[9px] font-black tracking-widest text-cyan-300">FADED WHEEL</span>
            </div>
            <h2 className="text-lg font-black tracking-tight bg-gradient-to-br from-cyan-200 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              ANIMASI MEMBELAH<br />NYAWA SHADOW
            </h2>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-cyan-100/90">
              <span>Ronde #{state.currentRound}</span>
              <span>•</span>
              <span>Spin: {state.spinsInRound}/9</span>
              <span>•</span>
              <span>{remaining} hadiah tersisa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="text-[10px] text-cyan-200/80 text-center px-2 leading-tight">
        💡 Hadiah yang sudah didapat tidak akan diulang. Diamond yang dibutuhkan akan meningkat setiap kali spin.
      </div>

      {/* Grid 3x3 */}
      <div className="relative rounded-2xl bg-gradient-to-br from-purple-900/40 via-indigo-900/40 to-cyan-900/40 border-2 border-cyan-500/30 p-3">
        <div className="grid grid-cols-3 gap-2">
          {state.grid.map((p, i) => {
            const claimed = claimedSet.has(i);
            const style = RARITY_STYLE[p.rarity];
            const isHighlighted = highlightCycle === i;
            const isRevealed = revealedIndex === i;
            return (
              <div
                key={i}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center p-1.5 transition-all duration-150
                  ${claimed
                    ? "bg-black/60 ring-1 ring-white/10 opacity-30 grayscale"
                    : `bg-gradient-to-br ${style.gradient} ring-2 ${style.ring} shadow-md ${style.glow}`
                  }
                  ${isHighlighted && !claimed ? "ring-4 ring-amber-300 scale-110 shadow-2xl shadow-amber-500/60" : ""}
                  ${isRevealed ? "animate-pulse ring-4 ring-amber-400" : ""}
                `}
              >
                {claimed && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <X className="w-8 h-8 text-red-500/70" strokeWidth={3} />
                  </div>
                )}
                <div className={`w-7 h-7 text-white ${claimed ? "opacity-30" : ""}`}>{getKindIcon(p.kind)}</div>
                <div className={`text-[9px] font-black mt-0.5 text-white text-center leading-tight ${claimed ? "opacity-30" : ""}`}>
                  ×{p.value}
                </div>
                <Badge className={`absolute top-0.5 right-0.5 text-[7px] font-black px-1 py-0 bg-black/70 ${claimed ? "opacity-40" : ""}`}>
                  {style.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spin Button */}
      <button
        disabled={spinning || remaining === 0}
        onClick={doSpin}
        className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 px-4 py-3.5 font-black shadow-lg shadow-amber-500/50 active:scale-95 transition disabled:opacity-50"
      >
        <div className="flex items-center justify-center gap-2 text-white">
          {spinning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="tracking-widest text-sm">SPINNING...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span className="tracking-widest text-base">SPIN</span>
              <span className="flex items-center gap-1 bg-black/30 rounded-full px-2 py-0.5 text-xs">
                <Gem className="w-3 h-3" /> {state.nextCost}
              </span>
            </>
          )}
        </div>
      </button>

      {/* Bonus Tambahan */}
      <div>
        <h3 className="text-xs font-black tracking-widest text-cyan-300 mb-2 px-1">| HADIAH TAMBAHAN</h3>
        <div className="space-y-1.5">
          {state.bonusThresholds.map((b, i) => {
            const unlocked = state.spinsInRound >= b.spins;
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
                  <div className="text-[10px] text-white/70">Spin ke-{b.spins}</div>
                </div>
                <Badge className={`text-[9px] font-black ${unlocked ? "bg-amber-500 text-black" : "bg-black/60 text-white/60"}`}>
                  {unlocked ? "✓ DAPAT" : `${b.spins}X`}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reveal Modal */}
      {revealedPrize && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => { setRevealedPrize(null); setRevealedIndex(null); setRevealedBonus(null); }}>
          <Card className="relative max-w-xs w-full bg-gradient-to-br from-[#1a0e3d] to-[#0b0820] border-2 border-amber-500/50 p-5 shadow-2xl shadow-amber-500/30 animate-scale-in" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setRevealedPrize(null); setRevealedIndex(null); setRevealedBonus(null); }} className="absolute top-2 right-2 text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-1" />
              <h3 className="text-xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent mb-3">SELAMAT!</h3>
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
            <Button onClick={() => { setRevealedPrize(null); setRevealedIndex(null); setRevealedBonus(null); }} className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-black tracking-wider">
              <Zap className="w-4 h-4 mr-1" /> KEREN!
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
