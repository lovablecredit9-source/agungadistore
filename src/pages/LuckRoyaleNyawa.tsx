import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import {
  ArrowLeft, Heart, Lightbulb, Timer, Shield, Gem, Sparkles, Crown,
  Loader2, Trophy, Zap, X, Dices, BarChart3, Flame, Star, Award, TrendingUp,
  Brain, Target, TrendingDown, CheckCircle2, AlertCircle, Rocket, Gift, Flame as FlameIcon,
} from "lucide-react";
import FadedWheel from "@/components/streak/FadedWheel";
import DiamondRoyaleInline from "@/components/streak/DiamondRoyaleInline";

interface Prize {
  kind: "extra_life" | "auto_hint" | "time_freeze" | "streak_freeze" | "gems" | "coins";
  value: number;
  label: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  weight: number;
  color: string;
}

interface SpinResult extends Prize {
  index: number;
}

interface HistoryItem {
  id: string;
  reward_label: string;
  rarity: string;
  reward_kind: string;
  reward_value: number;
  spin_type: string;
  created_at: string;
}

const RARITY_STYLE: Record<string, { glow: string; gradient: string; label: string; ring: string }> = {
  common: { glow: "shadow-slate-500/30", gradient: "from-slate-600 to-slate-800", label: "COMMON", ring: "ring-slate-400/40" },
  rare: { glow: "shadow-cyan-500/50", gradient: "from-cyan-500 to-blue-600", label: "RARE", ring: "ring-cyan-400/60" },
  epic: { glow: "shadow-purple-500/60", gradient: "from-fuchsia-500 to-purple-700", label: "EPIC", ring: "ring-fuchsia-400/70" },
  legendary: { glow: "shadow-amber-500/70", gradient: "from-amber-400 via-orange-500 to-red-600", label: "LEGENDARY", ring: "ring-amber-400/80" },
  mythic: { glow: "shadow-fuchsia-500/80", gradient: "from-red-500 via-yellow-400 via-green-400 via-cyan-400 via-blue-500 to-fuchsia-500", label: "MYTHIC", ring: "ring-fuchsia-300/90" },
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

export default function LuckRoyaleNyawa() {
  const nav = useNavigate();
  const { toast } = useToast();
  const visitorId = typeof window !== "undefined" ? getVisitorId() : null;

  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [gems, setGems] = useState(0);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [singleCost, setSingleCost] = useState(50);
  const [bundles, setBundles] = useState<Array<{ count: number; cost: number; label: string; badge?: string }>>([]);
  const [results, setResults] = useState<SpinResult[] | null>(null);
  const [reelSpinning, setReelSpinning] = useState(false);
  const [freeSpinAvailable, setFreeSpinAvailable] = useState(false);
  const [luckyStreak, setLuckyStreak] = useState(0);
  const [streakMultiplier, setStreakMultiplier] = useState(1);
  const [bonusPopup, setBonusPopup] = useState<number | null>(null);

  const fetchData = async () => {
    if (!visitorId) return;
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "check" },
      });
      if (error) throw error;
      setPrizes(data.prizes || []);
      setGems(data.gems || 0);
      setHistory(data.history || []);
      setSingleCost(data.singleCostGems || 50);
      setBundles(data.bundles || []);
      setFreeSpinAvailable(!!data.freeSpinAvailable);
      setLuckyStreak(Number(data.luckyStreak || 0));
      setStreakMultiplier(Number(data.streakMultiplier || 1));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const doSpin = async (mode: "single" | "pack" | "free", count?: number) => {
    if (!visitorId || spinning) return;
    setSpinning(true);
    setReelSpinning(true);
    try {
      const body: any = { visitorId };
      if (mode === "single") {
        body.action = "spin_single";
      } else if (mode === "free") {
        body.action = "spin_free";
      } else {
        body.action = "spin_pack";
        body.count = count;
      }
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", { body });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal spin", description: data.error, variant: "destructive" });
        setReelSpinning(false);
        return;
      }
      setReelSpinning(false);
      setResults(data.results);
      setGems(data.gems);
      if (typeof data.luckyStreak === "number") setLuckyStreak(data.luckyStreak);
      if (typeof data.streakMultiplier === "number") setStreakMultiplier(data.streakMultiplier);
      if (data.totalBonusGems && data.totalBonusGems > 0) {
        setBonusPopup(data.totalBonusGems);
        setTimeout(() => setBonusPopup(null), 4000);
      }
      if (mode === "free") setFreeSpinAvailable(false);
      // Refresh history
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
      setReelSpinning(false);
    } finally {
      setSpinning(false);
    }
  };

  const featured = prizes.filter(p => ["extra_life", "auto_hint", "time_freeze", "streak_freeze"].includes(p.kind));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0820] via-[#1a0e3d] to-[#0b0820] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/40 border-b border-amber-500/30">
        <div className="flex items-center justify-between px-3 py-2.5">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => nav(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <h1 className="font-black text-sm tracking-widest text-amber-300">LUCK ROYALE</h1>
          </div>
          <div className="flex items-center gap-1 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 rounded-full px-2.5 py-1">
            <Gem className="w-3.5 h-3.5 text-cyan-300" />
            <span className="font-bold text-xs tabular-nums">{gems.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      ) : (
        <div className="px-3 py-4 space-y-4 max-w-md mx-auto">
          {/* Quick Stats Bar */}
          {(() => {
            const totalSpins = history.length;
            const mythicCount = history.filter(h => h.rarity === "mythic").length;
            const legendaryCount = history.filter(h => h.rarity === "legendary").length;
            const epicCount = history.filter(h => h.rarity === "epic").length;
            return (
              <div className="grid grid-cols-4 gap-1.5">
                <div className="rounded-lg bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-cyan-500/30 p-2 text-center">
                  <Dices className="w-3.5 h-3.5 text-cyan-300 mx-auto mb-0.5" />
                  <div className="text-[9px] text-cyan-200/70 font-bold">SPIN</div>
                  <div className="text-sm font-black text-white tabular-nums">{totalSpins}</div>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-fuchsia-900/60 to-purple-900/60 border border-fuchsia-500/40 p-2 text-center">
                  <Star className="w-3.5 h-3.5 text-fuchsia-300 mx-auto mb-0.5" fill="currentColor" />
                  <div className="text-[9px] text-fuchsia-200/70 font-bold">MYTHIC</div>
                  <div className="text-sm font-black text-fuchsia-200 tabular-nums">{mythicCount}</div>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-amber-900/60 to-orange-900/60 border border-amber-500/40 p-2 text-center">
                  <Crown className="w-3.5 h-3.5 text-amber-300 mx-auto mb-0.5" fill="currentColor" />
                  <div className="text-[9px] text-amber-200/70 font-bold">LEGEND</div>
                  <div className="text-sm font-black text-amber-200 tabular-nums">{legendaryCount}</div>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-purple-900/60 to-indigo-900/60 border border-purple-500/40 p-2 text-center">
                  <Sparkles className="w-3.5 h-3.5 text-purple-300 mx-auto mb-0.5" />
                  <div className="text-[9px] text-purple-200/70 font-bold">EPIC</div>
                  <div className="text-sm font-black text-purple-200 tabular-nums">{epicCount}</div>
                </div>
              </div>
            );
          })()}

          <Tabs defaultValue="spin" className="w-full">
            <TabsList className="grid w-full grid-cols-6 bg-black/40 border border-amber-500/30 h-auto p-1 gap-1">
              <TabsTrigger value="spin" className="flex-col gap-0.5 py-1.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-amber-500/40 font-black tracking-wider text-[8px] rounded-md">
                <Dices className="w-3.5 h-3.5" />
                SPIN
              </TabsTrigger>
              <TabsTrigger value="faded" className="flex-col gap-0.5 py-1.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-cyan-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-cyan-500/40 font-black tracking-wider text-[8px] rounded-md">
                <Sparkles className="w-3.5 h-3.5" />
                FADED
              </TabsTrigger>
              <TabsTrigger value="diamond" className="flex-col gap-0.5 py-1.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-fuchsia-500 data-[state=active]:via-purple-600 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-fuchsia-500/50 font-black tracking-wider text-[8px] rounded-md">
                <Gem className="w-3.5 h-3.5" />
                DIAMOND
              </TabsTrigger>
              <TabsTrigger value="tips" className="flex-col gap-0.5 py-1.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-pink-500 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-pink-500/40 font-black tracking-wider text-[8px] rounded-md">
                <Brain className="w-3.5 h-3.5" />
                TIPS
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex-col gap-0.5 py-1.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/40 font-black tracking-wider text-[8px] rounded-md">
                <BarChart3 className="w-3.5 h-3.5" />
                STATS
              </TabsTrigger>
              <TabsTrigger value="top" className="flex-col gap-0.5 py-1.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-fuchsia-500 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-fuchsia-500/40 font-black tracking-wider text-[8px] rounded-md">
                <Trophy className="w-3.5 h-3.5" />
                TOP
              </TabsTrigger>
            </TabsList>

            <TabsContent value="spin" className="space-y-4 mt-3">
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600/30 via-orange-600/20 to-red-600/30 border-2 border-amber-500/40 p-4">
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: "radial-gradient(circle at 50% 50%, rgba(251,191,36,0.4), transparent 60%)",
            }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-red-600 text-white font-black text-[10px]">EPIC+</Badge>
                <span className="text-[10px] font-bold tracking-widest text-amber-300">LUCK ROYALE</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                NYAWA & HINT<br />SHADOW PACK
              </h2>
              <p className="text-xs text-amber-100/80 mt-1">Dapatkan Nyawa, Hint, & Streak Freeze!</p>
            </div>
          </div>

          {/* Hadiah Utama */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-black tracking-widest text-amber-300">| HADIAH UTAMA</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {featured.slice(0, 4).map((p, i) => {
                const style = RARITY_STYLE[p.rarity];
                return (
                  <div key={i} className={`relative aspect-square rounded-lg bg-gradient-to-br ${style.gradient} ring-2 ${style.ring} shadow-lg ${style.glow} flex items-center justify-center overflow-hidden`}>
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle, white, transparent 70%)" }} />
                    <div className="w-7 h-7 text-white relative z-10">{getKindIcon(p.kind)}</div>
                    <div className="absolute bottom-0.5 left-0.5 right-0.5 text-center">
                      <div className="text-[8px] font-black bg-black/70 rounded px-0.5 truncate">{p.label.split(" ").slice(0, 2).join(" ")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reel / Wheel Display */}
          <div className="relative aspect-square rounded-2xl bg-gradient-to-br from-purple-900/60 via-indigo-900/60 to-purple-900/60 border-2 border-purple-500/40 overflow-hidden">
            <div className="absolute inset-0" style={{
              backgroundImage: "radial-gradient(circle at center, rgba(168,85,247,0.3), transparent 70%)",
            }} />
            {reelSpinning ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-2 animate-pulse">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => {
                    const p = prizes[i % prizes.length];
                    return (
                      <div key={i} className={`w-12 h-12 rounded-lg bg-gradient-to-br ${RARITY_STYLE[p?.rarity || "common"].gradient} flex items-center justify-center animate-spin`} style={{ animationDuration: `${0.3 + (i % 3) * 0.2}s` }}>
                        <span className="text-xl">{p?.emoji}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 flex items-center justify-center shadow-2xl shadow-amber-500/50 mb-3 ring-4 ring-amber-400/40">
                  <Trophy className="w-10 h-10 text-white" />
                </div>
                <p className="text-center text-xs font-bold text-amber-200 tracking-wide">SPIN UNTUK MEMBUKA HADIAH</p>
                <p className="text-center text-[10px] text-purple-200/80 mt-1">Nyawa • Hint • Time Freeze • Streak Freeze</p>
              </div>
            )}
          </div>

          {/* Spin Buttons */}
          <div className="space-y-2">
            <button
              disabled={spinning}
              onClick={() => doSpin("single")}
              className="w-full relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 px-3 py-3 font-black shadow-lg shadow-cyan-500/40 active:scale-95 transition disabled:opacity-50 flex items-center justify-between"
            >
              <span className="text-sm tracking-widest">1 SPIN</span>
              <span className="flex items-center gap-1 text-xs bg-black/30 rounded-full px-2 py-0.5">
                <Gem className="w-3 h-3" /> {singleCost}
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              {bundles.map((b) => {
                const savings = singleCost * b.count - b.cost;
                const pct = Math.round((savings / (singleCost * b.count)) * 100);
                const isHighlight = b.count === 20 || b.count === 125;
                return (
                  <button
                    key={b.count}
                    disabled={spinning}
                    onClick={() => doSpin("pack", b.count)}
                    className={`relative overflow-hidden rounded-xl px-2 py-3 font-black shadow-lg active:scale-95 transition disabled:opacity-50 ${
                      isHighlight
                        ? "bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-700 shadow-fuchsia-500/50 ring-2 ring-fuchsia-300/60"
                        : "bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 shadow-amber-500/40"
                    }`}
                  >
                    {b.badge && (
                      <span className="absolute top-1 right-1 text-[8px] font-black bg-black/70 text-amber-200 rounded px-1 py-0.5">
                        {b.badge}
                      </span>
                    )}
                    <div className="text-sm tracking-widest text-white">{b.label}</div>
                    <div className="flex items-center justify-center gap-1 text-xs mt-0.5 text-white">
                      <Gem className="w-3 h-3" /> {b.cost.toLocaleString()}
                    </div>
                    {savings > 0 && (
                      <div className="text-[9px] text-amber-100/90 mt-0.5">
                        Hemat {savings.toLocaleString()} ({pct}%)
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-center text-[10px] text-purple-200/70">
            Dijamin mendapatkan hadiah setiap spin • Makin banyak makin hemat!
          </p>

          {/* All Prizes List */}
          <div>
            <h3 className="text-xs font-black tracking-widest text-amber-300 mb-2 px-1">| HADIAH LAINNYA</h3>
            <div className="grid grid-cols-4 gap-2">
              {prizes.map((p, i) => {
                const style = RARITY_STYLE[p.rarity];
                return (
                  <div key={i} className={`relative aspect-square rounded-lg bg-gradient-to-br ${style.gradient} ring-1 ${style.ring} flex flex-col items-center justify-center p-1`}>
                    <div className="w-5 h-5 text-white">{getKindIcon(p.kind)}</div>
                    <div className="text-[9px] font-black mt-0.5">×{p.value}</div>
                    <div className="absolute top-0.5 right-0.5 text-[7px] font-black bg-black/60 rounded px-0.5">{style.label[0]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div>
              <h3 className="text-xs font-black tracking-widest text-amber-300 mb-2 px-1">| RIWAYAT SPIN TERAKHIR</h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {history.slice(0, 10).map(h => {
                  const style = RARITY_STYLE[h.rarity] || RARITY_STYLE.common;
                  return (
                    <div key={h.id} className={`flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r ${style.gradient} bg-opacity-20 ring-1 ${style.ring}`}>
                      <div className="w-7 h-7 text-white shrink-0">{getKindIcon(h.reward_kind)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{h.reward_label}</div>
                        <div className="text-[9px] text-white/60">{new Date(h.created_at).toLocaleString("id-ID")}</div>
                      </div>
                      <Badge className="bg-black/60 text-[8px] font-black">{style.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
            </TabsContent>

            <TabsContent value="faded" className="mt-3">
              <FadedWheel visitorId={visitorId} onGemsChange={(g) => setGems(g)} />
            </TabsContent>

            <TabsContent value="diamond" className="mt-3">
              <DiamondRoyaleInline visitorId={visitorId} onGemsChange={(g) => setGems(g)} />
            </TabsContent>

            <TabsContent value="tips" className="mt-3 space-y-3">
              {(() => {
                const total = history.length;
                const mythicCount = history.filter(h => h.rarity === "mythic").length;
                const legendaryCount = history.filter(h => h.rarity === "legendary").length;
                const epicCount = history.filter(h => h.rarity === "epic").length;
                const rareEpicPlus = mythicCount + legendaryCount + epicCount;
                const rareRate = total > 0 ? (rareEpicPlus / total) * 100 : 0;

                // Hitung spin sejak hadiah langka terakhir (pity tracker)
                const lastRareIdx = history.findIndex(h => ["mythic", "legendary", "epic"].includes(h.rarity));
                const spinsSinceRare = lastRareIdx === -1 ? total : lastRareIdx;
                const pityProgress = Math.min(100, (spinsSinceRare / 30) * 100);

                // Analisis waktu (jam paling sering dapat hadiah langka)
                const rareHours = history
                  .filter(h => ["mythic", "legendary", "epic"].includes(h.rarity))
                  .map(h => new Date(h.created_at).getHours());
                const hourCounts: Record<number, number> = {};
                rareHours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
                const luckyHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

                // Rekomendasi mode spin
                const bundle10 = bundles.find(b => b.count === 10);
                const bundle20 = bundles.find(b => b.count === 20);
                const recommendedBundle = gems >= (bundle20?.cost || 999999)
                  ? bundle20
                  : gems >= (bundle10?.cost || 999999)
                  ? bundle10
                  : null;

                // Smart recommendations
                const recs: Array<{ icon: any; color: string; title: string; desc: string; priority: "high" | "med" | "low" }> = [];

                if (spinsSinceRare >= 20) {
                  recs.push({
                    icon: Rocket,
                    color: "from-red-500 to-orange-600",
                    title: "🔥 PITY HAMPIR PECAH!",
                    desc: `Sudah ${spinsSinceRare} spin tanpa Epic+. Peluang hadiah langka SANGAT TINGGI sekarang!`,
                    priority: "high",
                  });
                }

                if (gems < singleCost) {
                  recs.push({
                    icon: AlertCircle,
                    color: "from-amber-500 to-yellow-600",
                    title: "Gems Tidak Cukup",
                    desc: `Butuh ${singleCost} gems untuk 1 spin. Top up dulu di Gem Shop atau coba Faded Wheel!`,
                    priority: "high",
                  });
                } else if (recommendedBundle) {
                  const savings = singleCost * recommendedBundle.count - recommendedBundle.cost;
                  recs.push({
                    icon: Target,
                    color: "from-fuchsia-500 to-purple-600",
                    title: `Pakai Bundle ${recommendedBundle.label}`,
                    desc: `Hemat ${savings.toLocaleString()} gems & peluang Mythic 10x lebih besar dengan multi-spin!`,
                    priority: "high",
                  });
                }

                if (total < 5) {
                  recs.push({
                    icon: Sparkles,
                    color: "from-cyan-500 to-blue-600",
                    title: "Pemula? Mulai Pelan-pelan",
                    desc: "Coba 1 SPIN dulu untuk merasakan ritme. Setelah 5 spin, baru pertimbangkan bundle!",
                    priority: "med",
                  });
                }

                if (rareRate < 10 && total >= 10) {
                  recs.push({
                    icon: TrendingDown,
                    color: "from-slate-500 to-slate-700",
                    title: "Luck Rate Rendah",
                    desc: `Rare rate kamu ${rareRate.toFixed(1)}%. Coba Faded Wheel — sistem 3x3 grid lebih predictable!`,
                    priority: "med",
                  });
                } else if (rareRate >= 20 && total >= 10) {
                  recs.push({
                    icon: CheckCircle2,
                    color: "from-emerald-500 to-green-600",
                    title: "Lagi Hoki Banget! 🍀",
                    desc: `Rare rate kamu ${rareRate.toFixed(1)}% — di atas rata-rata. Manfaatkan momen ini dengan multi-spin!`,
                    priority: "high",
                  });
                }

                if (luckyHour && parseInt(luckyHour[1] as any) >= 2) {
                  const h = parseInt(luckyHour[0]);
                  recs.push({
                    icon: Timer,
                    color: "from-indigo-500 to-purple-600",
                    title: `Jam Hoki: ${h}:00 WIB`,
                    desc: `Mayoritas hadiah langka kamu didapat sekitar jam ${h}:00. Spin lagi di jam ini!`,
                    priority: "low",
                  });
                }

                if (mythicCount === 0 && total >= 15) {
                  recs.push({
                    icon: Star,
                    color: "from-pink-500 to-rose-600",
                    title: "Belum Pernah Mythic",
                    desc: "Mythic punya peluang ~0.5%. Bundle 125 SPIN paling efektif untuk berburu jackpot 20.000 Gems!",
                    priority: "med",
                  });
                }

                recs.push({
                  icon: Lightbulb,
                  color: "from-amber-500 to-orange-600",
                  title: "Tips Pro",
                  desc: "Inventory power-up tidak menambah peluang spin. Jangan buang gems untuk yang sudah penuh!",
                  priority: "low",
                });

                const sorted = recs.sort((a, b) => {
                  const order = { high: 0, med: 1, low: 2 };
                  return order[a.priority] - order[b.priority];
                });

                return (
                  <>
                    {/* Pity Tracker Card */}
                    <div className="rounded-2xl bg-gradient-to-br from-pink-900/40 via-rose-900/40 to-purple-900/40 border-2 border-pink-500/40 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-pink-300" />
                        <h3 className="text-xs font-black tracking-widest text-pink-200">| AI REKOMENDASI</h3>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3 mb-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-pink-200/80 tracking-wider">PITY TRACKER (Epic+)</span>
                          <span className="text-[10px] font-black text-pink-100 tabular-nums">{spinsSinceRare}/30</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-black/50 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-rose-500 transition-all duration-500"
                            style={{ width: `${pityProgress}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-pink-200/60 mt-1">
                          {spinsSinceRare >= 25
                            ? "🔥 Hadiah langka HAMPIR PASTI di spin berikutnya!"
                            : spinsSinceRare >= 15
                            ? "⚡ Peluang hadiah langka mulai meningkat..."
                            : "💫 Lanjutkan spin untuk membangun peluang!"}
                        </p>
                      </div>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        <div className="bg-black/40 rounded-lg p-1.5 text-center">
                          <div className="text-[9px] text-pink-200/60 font-bold">RARE RATE</div>
                          <div className="text-sm font-black text-pink-100 tabular-nums">{rareRate.toFixed(1)}%</div>
                        </div>
                        <div className="bg-black/40 rounded-lg p-1.5 text-center">
                          <div className="text-[9px] text-pink-200/60 font-bold">SISA GEMS</div>
                          <div className="text-sm font-black text-cyan-200 tabular-nums">{gems}</div>
                        </div>
                        <div className="bg-black/40 rounded-lg p-1.5 text-center">
                          <div className="text-[9px] text-pink-200/60 font-bold">SPIN BISA</div>
                          <div className="text-sm font-black text-amber-200 tabular-nums">{Math.floor(gems / singleCost)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Recommendations List */}
                    <div className="space-y-2">
                      {sorted.map((r, i) => {
                        const Icon = r.icon;
                        return (
                          <div
                            key={i}
                            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${r.color} p-3 shadow-lg ring-1 ring-white/20`}
                          >
                            <div className="absolute inset-0 opacity-20" style={{
                              backgroundImage: "radial-gradient(circle at top right, white, transparent 60%)",
                            }} />
                            <div className="relative flex gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-black/30 flex items-center justify-center shrink-0">
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <h4 className="text-xs font-black text-white tracking-wide">{r.title}</h4>
                                  {r.priority === "high" && (
                                    <Badge className="bg-red-600/80 text-white text-[7px] font-black px-1 py-0">HOT</Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-white/90 leading-relaxed">{r.desc}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Strategy Card */}
                    <div className="rounded-xl bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-purple-500/40 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-purple-300" />
                        <h4 className="text-xs font-black tracking-widest text-purple-200">| STRATEGI OPTIMAL</h4>
                      </div>
                      <ul className="space-y-1.5 text-[10px] text-purple-100/90">
                        <li className="flex gap-2">
                          <span className="text-amber-300">▸</span>
                          <span><b className="text-amber-200">Hemat:</b> Bundle 10 spin = hemat ~10% gems</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-fuchsia-300">▸</span>
                          <span><b className="text-fuchsia-200">Jackpot:</b> Bundle 125 spin paling besar peluang Mythic</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-cyan-300">▸</span>
                          <span><b className="text-cyan-200">Free:</b> Faded Wheel sering kasih hadiah tanpa biaya gems</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-emerald-300">▸</span>
                          <span><b className="text-emerald-200">Pity:</b> Setelah 25+ spin tanpa Epic, peluang naik drastis</span>
                        </li>
                      </ul>
                    </div>
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="stats" className="mt-3 space-y-3">
              {(() => {
                const total = history.length || 1;
                const buckets = ["mythic", "legendary", "epic", "rare", "common"] as const;
                const counts = buckets.map(b => ({
                  rarity: b,
                  count: history.filter(h => h.rarity === b).length,
                }));
                const gemsWon = history
                  .filter(h => h.reward_kind === "gems")
                  .reduce((s, h) => s + (h.reward_value || 0), 0);
                const livesWon = history
                  .filter(h => h.reward_kind === "extra_life")
                  .reduce((s, h) => s + (h.reward_value || 0), 0);
                return (
                  <>
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-emerald-300" />
                        <h3 className="text-xs font-black tracking-widest text-emerald-200">| RARITY BREAKDOWN</h3>
                      </div>
                      <div className="space-y-2">
                        {counts.map(({ rarity, count }) => {
                          const style = RARITY_STYLE[rarity];
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={rarity}>
                              <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                                <span className="tracking-widest">{style.label}</span>
                                <span className="tabular-nums">{count} ({pct}%)</span>
                              </div>
                              <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                                <div
                                  className={`h-full bg-gradient-to-r ${style.gradient} transition-all duration-500`}
                                  style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-gradient-to-br from-cyan-900/50 to-blue-900/50 border border-cyan-500/40 p-3 text-center">
                        <Gem className="w-6 h-6 text-cyan-300 mx-auto mb-1" />
                        <div className="text-[10px] text-cyan-200/70 font-bold tracking-wider">TOTAL GEMS</div>
                        <div className="text-lg font-black text-cyan-100 tabular-nums">{gemsWon.toLocaleString()}</div>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-rose-900/50 to-pink-900/50 border border-rose-500/40 p-3 text-center">
                        <Heart className="w-6 h-6 text-rose-300 mx-auto mb-1" fill="currentColor" />
                        <div className="text-[10px] text-rose-200/70 font-bold tracking-wider">EXTRA LIFE</div>
                        <div className="text-lg font-black text-rose-100 tabular-nums">{livesWon}</div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-gradient-to-br from-amber-900/40 to-orange-900/40 border border-amber-500/30 p-3 flex items-center gap-3">
                      <Flame className="w-8 h-8 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-[10px] font-black tracking-widest text-amber-200">LUCK SCORE</div>
                        <div className="text-xl font-black text-amber-100">
                          {Math.min(100, Math.round((counts[0].count * 50 + counts[1].count * 20 + counts[2].count * 8) / Math.max(total, 1)))}
                          <span className="text-xs text-amber-300/70">/100</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="top" className="mt-3 space-y-2">
              <div className="rounded-xl bg-gradient-to-br from-fuchsia-900/40 to-purple-900/40 border border-fuchsia-500/30 p-3 mb-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-fuchsia-300" />
                  <h3 className="text-xs font-black tracking-widest text-fuchsia-200">| TOP HADIAH LANGKA</h3>
                </div>
                <p className="text-[10px] text-fuchsia-200/70 mt-1">Hadiah Mythic, Legendary & Epic dari spin-mu</p>
              </div>

              {(() => {
                const top = history
                  .filter(h => ["mythic", "legendary", "epic"].includes(h.rarity))
                  .slice(0, 20);
                if (top.length === 0) {
                  return (
                    <div className="rounded-xl bg-black/30 border border-purple-500/20 p-6 text-center">
                      <Trophy className="w-10 h-10 text-purple-400/50 mx-auto mb-2" />
                      <p className="text-xs text-purple-200/70 font-bold">Belum ada hadiah langka</p>
                      <p className="text-[10px] text-purple-300/50 mt-1">Spin sekarang untuk mengincar Mythic!</p>
                    </div>
                  );
                }
                return top.map((h, idx) => {
                  const style = RARITY_STYLE[h.rarity] || RARITY_STYLE.common;
                  return (
                    <div key={h.id} className={`relative flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r ${style.gradient} ring-1 ${style.ring} shadow-md ${style.glow} overflow-hidden`}>
                      <div className="absolute top-0 left-0 w-8 h-8 rounded-br-xl bg-black/50 flex items-center justify-center text-[10px] font-black text-amber-200">
                        #{idx + 1}
                      </div>
                      <div className="w-10 h-10 text-white shrink-0 ml-6">{getKindIcon(h.reward_kind)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black truncate text-white">{h.reward_label}</div>
                        <div className="text-[9px] text-white/70">{new Date(h.created_at).toLocaleString("id-ID")}</div>
                      </div>
                      <Badge className="bg-black/70 text-[8px] font-black tracking-widest">{style.label}</Badge>
                    </div>
                  );
                });
              })()}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Result Modal */}
      {results && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <Card className="relative max-w-sm w-full bg-gradient-to-br from-[#1a0e3d] to-[#0b0820] border-2 border-amber-500/50 p-5 shadow-2xl shadow-amber-500/30 animate-scale-in">
            <button onClick={() => setResults(null)} className="absolute top-2 right-2 text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-3">
              <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-1" />
              <h3 className="text-xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">SELAMAT!</h3>
              <p className="text-xs text-purple-200 mt-1">Kamu mendapatkan {results.length} hadiah</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {results.map((r, i) => {
                const style = RARITY_STYLE[r.rarity];
                return (
                  <div key={i} className={`relative rounded-xl bg-gradient-to-br ${style.gradient} ring-2 ${style.ring} shadow-lg ${style.glow} p-3 flex flex-col items-center text-center`}>
                    <Badge className="absolute top-1 right-1 bg-black/70 text-[8px] font-black px-1 py-0">{style.label}</Badge>
                    <div className="w-10 h-10 text-white mb-1">{getKindIcon(r.kind)}</div>
                    <div className="text-[10px] font-black leading-tight">{r.label}</div>
                  </div>
                );
              })}
            </div>
            <Button onClick={() => setResults(null)} className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-black tracking-wider">
              <Zap className="w-4 h-4 mr-1" /> KEREN!
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
