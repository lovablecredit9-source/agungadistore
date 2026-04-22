import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Gem, Sparkles, Crown, Loader2, Trophy, Shield, Coins,
  Star, Award, Flame, Lock, Zap, Diamond,
} from "lucide-react";

interface Prize {
  kind: "gems" | "coins" | "freeze" | "title" | "skin";
  label: string; value: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  weight: number; color: string;
}
interface HistoryItem {
  id: string; reward_label: string; rarity: string; reward_kind: string;
  reward_value: number; spin_type: string; is_pity_break: boolean; created_at: string;
}
interface RoyaleState {
  pity_counter: number; rare_pity_counter: number;
  total_spins: number; total_legendary: number;
}

const RARITY_STYLE: Record<string, { glow: string; gradient: string; label: string; ring: string; text: string }> = {
  common: { glow: "shadow-slate-500/30", gradient: "from-slate-600 to-slate-800", label: "COMMON", ring: "ring-slate-400/40", text: "text-slate-200" },
  rare: { glow: "shadow-cyan-500/60", gradient: "from-cyan-500 to-blue-600", label: "RARE", ring: "ring-cyan-400/60", text: "text-cyan-100" },
  epic: { glow: "shadow-purple-500/70", gradient: "from-fuchsia-500 to-purple-700", label: "EPIC", ring: "ring-fuchsia-400/70", text: "text-fuchsia-100" },
  legendary: { glow: "shadow-amber-500/80", gradient: "from-amber-400 via-orange-500 to-red-600", label: "LEGENDARY", ring: "ring-amber-400/90", text: "text-yellow-100" },
};

function kindIcon(kind: string) {
  switch (kind) {
    case "gems": return <Gem className="w-full h-full" fill="currentColor" />;
    case "coins": return <Coins className="w-full h-full" />;
    case "freeze": return <Shield className="w-full h-full" fill="currentColor" />;
    case "title": return <Crown className="w-full h-full" fill="currentColor" />;
    case "skin": return <Star className="w-full h-full" fill="currentColor" />;
    default: return <Sparkles className="w-full h-full" />;
  }
}

interface Props {
  visitorId: string | null;
  onGemsChange?: (gems: number) => void;
}

export default function DiamondRoyaleInline({ visitorId, onGemsChange }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [gems, setGems] = useState(0);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [state, setState] = useState<RoyaleState>({ pity_counter: 0, rare_pity_counter: 0, total_spins: 0, total_legendary: 0 });
  const [cost, setCost] = useState({ single: 30, multi: 270 });
  const [pity, setPity] = useState({ hard: 80, rare: 10 });
  const [results, setResults] = useState<(Prize & { pityBreak?: boolean })[] | null>(null);
  const [reelSpinning, setReelSpinning] = useState(false);

  const fetchData = async () => {
    if (!visitorId) return;
    try {
      const { data, error } = await supabase.functions.invoke("diamond-royale", {
        body: { visitorId, action: "check" },
      });
      if (error) throw error;
      setGems(data.gems || 0);
      onGemsChange?.(data.gems || 0);
      setPrizes(data.prizes || []);
      setHistory(data.history || []);
      setState(data.state || { pity_counter: 0, rare_pity_counter: 0, total_spins: 0, total_legendary: 0 });
      setCost(data.cost || { single: 30, multi: 270 });
      setPity(data.pity || { hard: 80, rare: 10 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [visitorId]);

  async function spin(spinType: "single" | "multi") {
    if (!visitorId || spinning) return;
    const need = spinType === "multi" ? cost.multi : cost.single;
    if (gems < need) {
      toast({ title: "Gems kurang", description: `Butuh ${need} Gems`, variant: "destructive" });
      return;
    }
    setSpinning(true); setReelSpinning(true); setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("diamond-royale", {
        body: { visitorId, action: "spin", spinType },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal", description: data.error, variant: "destructive" });
        setSpinning(false); setReelSpinning(false);
        return;
      }
      await new Promise(r => setTimeout(r, 2200));
      setReelSpinning(false);
      setResults(data.results);
      setGems(data.gemsAfter || 0);
      onGemsChange?.(data.gemsAfter || 0);
      setState(data.state || state);
      const legendary = data.results.filter((r: any) => r.rarity === "legendary").length;
      if (legendary > 0) {
        toast({ title: "✨ LEGENDARY!", description: `Kamu dapat ${legendary} hadiah legendary!` });
      } else {
        toast({ title: spinType === "multi" ? "10x Spin selesai" : "Spin selesai", description: data.results[0].label });
      }
      setTimeout(fetchData, 500);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSpinning(false);
    }
  }

  const pityRemaining = pity.hard - state.pity_counter;
  const pityProgress = (state.pity_counter / pity.hard) * 100;

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  }

  return (
    <div className="space-y-3">
      {/* Hero / Reel */}
      <Card className="relative overflow-hidden p-3 bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-pink-500/10 border-amber-400/30">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-amber-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-fuchsia-500/20 rounded-full blur-3xl" />

        <div className="relative text-center mb-3">
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black border-0 mb-1.5 text-[9px]">
            💎 PREMIUM SPIN
          </Badge>
          <h2 className="text-lg font-black bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
            Diamond Royale
          </h2>
          <p className="text-[10px] text-white/70 mt-0.5">Pity {pity.hard} spin = legendary guaranteed</p>
        </div>

        {/* Reel */}
        <div className="relative bg-black/40 rounded-xl p-2.5 border border-amber-400/20 min-h-[160px]">
          <AnimatePresence mode="wait">
            {reelSpinning ? (
              <motion.div key="spinning" className="grid grid-cols-5 gap-1.5"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <motion.div key={i} className="aspect-square rounded-lg bg-gradient-to-br from-purple-600 to-amber-600"
                    animate={{ scale: [0.8, 1.1, 0.8], rotate: [0, 180, 360] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.05 }} />
                ))}
              </motion.div>
            ) : results ? (
              <motion.div key="results"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={results.length === 10 ? "grid grid-cols-5 gap-1.5" : "flex justify-center"}>
                {results.map((r, i) => {
                  const rs = RARITY_STYLE[r.rarity];
                  return (
                    <motion.div key={i}
                      initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: i * 0.08, type: "spring" }}
                      className={`relative ${results.length === 1 ? "w-28 h-28" : "aspect-square"} rounded-xl bg-gradient-to-br ${rs.gradient} ring-2 ${rs.ring} ${rs.glow} shadow-xl flex flex-col items-center justify-center p-1.5`}>
                      <div className={`${results.length === 1 ? "w-9 h-9" : "w-5 h-5"} ${rs.text} mb-0.5`}>
                        {kindIcon(r.kind)}
                      </div>
                      <div className={`${results.length === 1 ? "text-[10px]" : "text-[7px]"} font-black ${rs.text} text-center leading-tight px-0.5 line-clamp-2`}>
                        {r.label}
                      </div>
                      {r.rarity === "legendary" && (
                        <motion.div className="absolute -top-1 -right-1"
                          animate={{ scale: [1, 1.3, 1], rotate: [0, 360] }}
                          transition={{ duration: 1.5, repeat: Infinity }}>
                          <Sparkles className="w-3 h-3 text-yellow-300" fill="currentColor" />
                        </motion.div>
                      )}
                      {r.pityBreak && (
                        <Badge className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] px-1 py-0 bg-amber-500 text-black border-0">PITY</Badge>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div key="idle" className="flex flex-col items-center justify-center h-[140px] text-center"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <motion.div animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}>
                  <Diamond className="w-14 h-14 text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]" fill="currentColor" />
                </motion.div>
                <p className="text-xs text-white/70 mt-2 font-bold">Tarik tuas keberuntunganmu!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pity */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-amber-300 flex items-center gap-1"><Lock className="w-3 h-3" /> Pity Legendary</span>
            <span className="text-white/80">{state.pity_counter} / {pity.hard}</span>
          </div>
          <Progress value={pityProgress} className="h-1.5 bg-white/10" />
          <p className="text-[10px] text-white/60">
            {pityRemaining <= 10
              ? <span className="text-amber-300 font-black animate-pulse">🔥 {pityRemaining} spin lagi = LEGENDARY!</span>
              : `${pityRemaining} spin lagi sampai jaminan legendary`}
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={() => spin("single")} disabled={spinning || gems < cost.single}
            className="h-12 bg-gradient-to-br from-purple-600 to-fuchsia-700 hover:from-purple-500 hover:to-fuchsia-600 text-white font-black border border-fuchsia-400/40">
            <div className="flex flex-col items-center leading-tight">
              <span className="text-xs">SPIN 1×</span>
              <span className="text-[10px] flex items-center gap-1 opacity-90">
                <Gem className="w-2.5 h-2.5" fill="currentColor" /> {cost.single}
              </span>
            </div>
          </Button>
          <Button onClick={() => spin("multi")} disabled={spinning || gems < cost.multi}
            className="h-12 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black border border-amber-300/60 relative">
            <Badge className="absolute -top-2 -right-1 text-[8px] px-1 py-0 bg-red-500 text-white border-0">-10%</Badge>
            <div className="flex flex-col items-center leading-tight">
              <span className="text-xs">SPIN 10×</span>
              <span className="text-[10px] flex items-center gap-1 opacity-90">
                <Gem className="w-2.5 h-2.5" fill="currentColor" /> {cost.multi}
              </span>
            </div>
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-2 bg-white/5 border-white/10 text-center">
          <Zap className="w-4 h-4 mx-auto text-cyan-400 mb-0.5" />
          <div className="text-sm font-black">{state.total_spins}</div>
          <div className="text-[9px] text-white/60 font-bold uppercase">Total Spin</div>
        </Card>
        <Card className="p-2 bg-white/5 border-amber-400/20 text-center">
          <Trophy className="w-4 h-4 mx-auto text-amber-400 mb-0.5" />
          <div className="text-sm font-black text-amber-300">{state.total_legendary}</div>
          <div className="text-[9px] text-white/60 font-bold uppercase">Legendary</div>
        </Card>
        <Card className="p-2 bg-white/5 border-fuchsia-400/20 text-center">
          <Flame className="w-4 h-4 mx-auto text-fuchsia-400 mb-0.5" />
          <div className="text-sm font-black text-fuchsia-300">{state.rare_pity_counter}/{pity.rare}</div>
          <div className="text-[9px] text-white/60 font-bold uppercase">Rare Pity</div>
        </Card>
      </div>

      {/* Prize pool */}
      <Card className="p-3 bg-white/5 border-white/10">
        <h3 className="text-xs font-black mb-2 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-amber-400" /> Hadiah Pool (Mantap!)
        </h3>
        <div className="space-y-1.5">
          {prizes.map((p, i) => {
            const rs = RARITY_STYLE[p.rarity];
            const totalWeight = prizes.reduce((s, x) => s + x.weight, 0);
            return (
              <div key={i} className={`flex items-center justify-between p-2 rounded-lg bg-gradient-to-r ${rs.gradient} bg-opacity-20 border ${rs.ring} ring-1`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 ${rs.text}`}>{kindIcon(p.kind)}</div>
                  <div>
                    <div className={`text-xs font-black ${rs.text}`}>{p.label}</div>
                    <Badge className={`text-[8px] px-1 py-0 bg-black/40 border-0 ${rs.text}`}>{rs.label}</Badge>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-white/70">{((p.weight / totalWeight) * 100).toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card className="p-3 bg-white/5 border-white/10">
          <h3 className="text-xs font-black mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" /> Riwayat Spin
          </h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {history.map((h) => {
              const rs = RARITY_STYLE[h.rarity] || RARITY_STYLE.common;
              return (
                <div key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-5 h-5 ${rs.text} shrink-0`}>{kindIcon(h.reward_kind)}</div>
                    <div className="min-w-0">
                      <div className={`text-[11px] font-bold truncate ${rs.text}`}>{h.reward_label}</div>
                      <div className="text-[9px] text-white/50">{new Date(h.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</div>
                    </div>
                  </div>
                  <Badge className={`text-[8px] px-1 py-0 bg-black/40 border-0 ${rs.text} shrink-0`}>{rs.label}</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
