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
  Loader2, Trophy, Zap, X,
} from "lucide-react";
import FadedWheel from "@/components/streak/FadedWheel";

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const doSpin = async (mode: "single" | "pack", count?: number) => {
    if (!visitorId || spinning) return;
    setSpinning(true);
    setReelSpinning(true);
    try {
      const body: any = { visitorId };
      if (mode === "single") {
        body.action = "spin_single";
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
      // Simulasi animasi spin reel cepat ~600ms
      await new Promise(r => setTimeout(r, 600));
      setReelSpinning(false);
      setResults(data.results);
      setGems(data.gems);
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
          <Tabs defaultValue="spin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-amber-500/30">
              <TabsTrigger value="spin" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white font-black tracking-wider text-[11px]">
                🎰 SPIN ROYALE
              </TabsTrigger>
              <TabsTrigger value="faded" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-600 data-[state=active]:text-white font-black tracking-wider text-[11px]">
                🎡 FADED WHEEL
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
