import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import { formatCompactNumber } from "@/lib/utils";
import {
  ArrowLeft, Heart, Lightbulb, Timer, Shield, Gem, Coins, Sparkles, Crown,
  Loader2, Trophy, Zap, X, Dices, BarChart3, Flame, Star, Award, TrendingUp,
  Brain, Target, TrendingDown, CheckCircle2, AlertCircle, Rocket, Gift, Flame as FlameIcon,
} from "lucide-react";
import MegaSpinArena from "@/components/luck/MegaSpinArena";
import FadedWheel from "@/components/streak/FadedWheel";
import DiamondRoyaleInline from "@/components/streak/DiamondRoyaleInline";


interface Prize {
  kind: "extra_life" | "auto_hint" | "time_freeze" | "streak_freeze" | "streak_coins" | "gems" | "coins";
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
    case "streak_coins":
    case "coins": return <Coins className="w-full h-full" fill="currentColor" />;
    default: return <Sparkles className="w-full h-full" />;
  }
}

export default function LuckRoyaleNyawa() {
  const nav = useNavigate();
  const { toast } = useToast();
  // Prioritaskan akun login (balance_visitor_id) supaya gem terbaca dari akun yg sama
  // di semua domain (preview Lovable maupun custom/published domain).
  const visitorId = typeof window !== "undefined"
    ? (localStorage.getItem("balance_visitor_id") || getVisitorId())
    : null;

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
  const [jackpotPopup, setJackpotPopup] = useState<number | null>(null);
  const [tokenPopup, setTokenPopup] = useState<number | null>(null);
  const [luckyTokens, setLuckyTokens] = useState(0);
  const [tokenProgress, setTokenProgress] = useState(0);
  const [tokenThreshold, setTokenThreshold] = useState(5);
  const [megaPool, setMegaPool] = useState(5000);
  // ⚠️ Popup peringatan menang/kalah — wajib di-acknowledge sebelum spin pertama
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningAck, setWarningAck] = useState(false);
  const [pendingSpin, setPendingSpin] = useState<{ mode: "single" | "pack" | "free"; count?: number } | null>(null);
  const [tokenShop, setTokenShop] = useState<Array<{ code: string; name: string; cost: number; kind: string; value: number; rarity: string; emoji: string; tier?: "free" | "premium" | "super_premium" | "ultra" }>>([]);
  const [freeDailyShop, setFreeDailyShop] = useState<Array<{ code: string; name: string; kind: string; value: number; rarity: string; emoji: string; claimedToday: boolean }>>([]);
  const [shopAccess, setShopAccess] = useState<{ isActive: boolean; activeUntil: string | null; purchasedAt: string | null; price: number; durationDays: number }>({ isActive: false, activeUntil: null, purchasedAt: null, price: 100000, durationDays: 30 });
  const [superShopAccess, setSuperShopAccess] = useState<{ isActive: boolean; activeUntil: string | null; purchasedAt: string | null; price: number; durationDays: number }>({ isActive: false, activeUntil: null, purchasedAt: null, price: 300000, durationDays: 30 });
  const [ultraShopAccess, setUltraShopAccess] = useState<{ isActive: boolean; activeUntil: string | null; purchasedAt: string | null; price: number; durationDays: number }>({ isActive: false, activeUntil: null, purchasedAt: null, price: 500000, durationDays: 30 });
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [shopTier, setShopTier] = useState<"free" | "premium" | "super_premium" | "ultra">("free");

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
      setLuckyTokens(Number(data.luckyTokens || 0));
      setTokenProgress(Number(data.luckyTokenProgress || 0));
      setTokenThreshold(Number(data.luckyTokenThreshold || 5));
      setMegaPool(Number(data.megaJackpotPool || 5000));
      setTokenShop(data.tokenShop || []);
      setFreeDailyShop(data.freeDailyShop || []);
      setShopAccess(data.shopAccess || { isActive: false, activeUntil: null, purchasedAt: null, price: 100000, durationDays: 30 });
      setSuperShopAccess(data.superShopAccess || { isActive: false, activeUntil: null, purchasedAt: null, price: 300000, durationDays: 30 });
      setUltraShopAccess(data.ultraShopAccess || { isActive: false, activeUntil: null, purchasedAt: null, price: 500000, durationDays: 30 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    // Tampilkan otomatis setiap masuk halaman Luck Royale, bukan hanya saat tombol spin ditekan.
    setWarningOpen(true);
  }, []);

  const doSpin = async (mode: "single" | "pack" | "free", count?: number, skipWarning = false) => {
    if (!visitorId || spinning) return;
    // ⚠️ Tahan spin pertama sampai user setuju peringatan menang/kalah
    if (!skipWarning && !warningAck) {
      setPendingSpin({ mode, count });
      setWarningOpen(true);
      return;
    }
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
      if (data.jackpotWonTotal && data.jackpotWonTotal > 0) {
        setJackpotPopup(data.jackpotWonTotal);
        setTimeout(() => setJackpotPopup(null), 6000);
      }
      if (data.earnedTokens && data.earnedTokens > 0) {
        setTokenPopup(data.earnedTokens);
        setTimeout(() => setTokenPopup(null), 4000);
      }
      if (typeof data.luckyTokens === "number") setLuckyTokens(data.luckyTokens);
      if (typeof data.luckyTokenProgress === "number") setTokenProgress(data.luckyTokenProgress);
      if (typeof data.megaJackpotPool === "number") setMegaPool(data.megaJackpotPool);
      if (mode === "free") setFreeSpinAvailable(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
      setReelSpinning(false);
    } finally {
      setSpinning(false);
    }
  };

  const redeemToken = async (itemCode: string) => {
    if (!visitorId || redeeming) return;
    setRedeeming(itemCode);
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "redeem_token", itemCode },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal tukar", description: data.error, variant: "destructive" });
        return;
      }
      setLuckyTokens(data.luckyTokens);
      setGems(data.gems);
      toast({ title: "🎟️ Token Ditukar!", description: `Kamu dapat: ${data.item.name}` });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
    } finally {
      setRedeeming(null);
    }
  };

  const claimFreeDaily = async (itemCode: string) => {
    if (!visitorId || redeeming) return;
    setRedeeming(itemCode);
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "claim_free_daily", itemCode },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal klaim", description: data.error, variant: "destructive" });
        return;
      }
      setGems(data.gems);
      toast({ title: "🎁 Hadiah Gratis Diklaim!", description: `Kamu dapat: ${data.item.name}` });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
    } finally {
      setRedeeming(null);
    }
  };

  const buyShopAccess = async (tier: "premium" | "super_premium" | "ultra" = "premium") => {
    if (!visitorId || redeeming) return;
    const access = tier === "ultra" ? ultraShopAccess : tier === "super_premium" ? superShopAccess : shopAccess;
    const tierLabel = tier === "ultra" ? "Ultra" : tier === "super_premium" ? "Super Premium" : "Premium";
    const flavor = tier === "ultra" ? "GOD-TIER " : tier === "super_premium" ? "MEGA " : "";
    if (!confirm(
      `Beli Akses ${tierLabel}?\n\nHarga: Rp ${access.price.toLocaleString("id-ID")} (potong saldo)\nBerlaku: ${access.durationDays} hari\n\nSetelah aktif, kamu bisa tukar Lucky Token dengan hadiah ${flavor}PASTI di tier ${tierLabel}.`
    )) return;
    const key = tier === "ultra" ? "__ultra_shop_access__" : tier === "super_premium" ? "__super_shop_access__" : "__shop_access__";
    setRedeeming(key);
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "buy_shop_access", tier },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal beli akses", description: data.error, variant: "destructive" });
        return;
      }
      if (tier === "ultra" && data.ultraShopAccess) setUltraShopAccess(data.ultraShopAccess);
      else if (tier === "super_premium" && data.superShopAccess) setSuperShopAccess(data.superShopAccess);
      else if (data.shopAccess) setShopAccess(data.shopAccess);
      toast({
        title: `🔓 Akses ${tierLabel} Aktif!`,
        description: `Berlaku ${access.durationDays} hari - sisa saldo Rp ${data.balance.toLocaleString("id-ID")}`,
      });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
    } finally {
      setRedeeming(null);
    }
  };

  // 🏆 Hadiah Utama: tampilkan hadiah PALING JACKPOT dulu (mythic → legendary → epic),
  // bukan power-up common. Player harus lihat "wow factor" sebelum spin.
  const RARITY_RANK: Record<string, number> = { mythic: 5, legendary: 4, epic: 3, rare: 2, common: 1 };
  const featured = [...prizes]
    .sort((a, b) => {
      const ra = RARITY_RANK[a.rarity] || 0;
      const rb = RARITY_RANK[b.rarity] || 0;
      if (rb !== ra) return rb - ra;
      // tie-breaker: nilai hadiah lebih besar di depan
      return (b.value || 0) - (a.value || 0);
    });
  const totalPrizeWeight = prizes.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);

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
            <span className="font-bold text-xs tabular-nums">{formatCompactNumber(gems)}</span>
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
            <TabsList className="grid w-full grid-cols-7 bg-black/40 border border-amber-500/30 h-auto p-1 gap-1">
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
              <TabsTrigger value="mega" className="flex-col gap-0.5 py-1.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-fuchsia-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-fuchsia-500/50 font-black tracking-wider text-[8px] rounded-md">
                <Rocket className="w-3.5 h-3.5" />
                MEGA
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
          {/* 👑 Hadiah normal - tidak ikut pool Mega/Combo */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-fuchsia-500 border-2 border-yellow-200 p-3 shadow-xl shadow-yellow-400/40">
            <div className="absolute inset-0 opacity-30 animate-pulse" style={{
              backgroundImage: "linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.7) 50%, transparent 80%)",
            }} />
            <div className="relative flex items-center gap-3 text-black">
              <div className="w-14 h-14 rounded-2xl bg-black/80 ring-2 ring-white/80 flex items-center justify-center shrink-0 animate-pulse">
                <Heart className="w-8 h-8 text-rose-300" fill="currentColor" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Badge className="bg-black text-yellow-200 font-black text-[8px]">NORMAL</Badge>
                  <span className="text-[9px] font-black tracking-widest">HADIAH SPIN NYAWA</span>
                </div>
                <div className="flex items-center gap-2 text-lg font-black drop-shadow">
                  <Heart className="w-5 h-5" fill="currentColor" />
                  <Lightbulb className="w-5 h-5" fill="currentColor" />
                  <Timer className="w-5 h-5" />
                  <Shield className="w-5 h-5" fill="currentColor" />
                </div>
                <p className="text-[10px] font-black mt-0.5">
                  Spin normal hanya nyawa, hint, time freeze, dan streak freeze — bukan hadiah Mega.
                </p>
              </div>
            </div>
          </div>

          {/* 🎟️ LUCKY TOKEN PROGRESS BANNER */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700/60 via-blue-700/40 to-cyan-700/60 border-2 border-cyan-400/50 p-3 shadow-lg shadow-cyan-500/30">
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: "radial-gradient(circle at 80% 20%, rgba(34,211,238,0.6), transparent 60%)",
            }} />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 ring-2 ring-amber-300/60 flex items-center justify-center shrink-0">
                <Award className="w-7 h-7 text-white" fill="currentColor" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[9px] font-black tracking-widest text-cyan-200">🎟️ LUCKY TOKEN</span>
                  <span className="text-lg font-black text-amber-300 tabular-nums">{luckyTokens}</span>
                </div>
                <div className="bg-black/40 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 transition-all"
                    style={{ width: `${Math.min(100, (tokenProgress / tokenThreshold) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-cyan-100/80 mt-0.5">
                  {tokenProgress}/{tokenThreshold} spin berbayar → +1 Token. Tukar di Token Shop bawah!
                </p>
              </div>
            </div>
          </div>

          {/* 🔥 LUCKY STREAK BANNER (visible if streak >= 3) */}
          {luckyStreak >= 3 && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 border-2 border-amber-300 p-3 shadow-xl shadow-orange-500/50 animate-pulse">
              <div className="absolute inset-0 opacity-30" style={{
                backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4), transparent 60%)",
              }} />
              <div className="relative flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center ring-2 ring-amber-300">
                  <FlameIcon className="w-7 h-7 text-amber-200" fill="currentColor" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black tracking-widest text-amber-200 bg-black/40 px-1.5 py-0.5 rounded">LUCKY STREAK</span>
                    <span className="text-xl font-black text-white tabular-nums">{luckyStreak}🔥</span>
                  </div>
                  <p className="text-[10px] font-bold text-amber-100 mt-0.5">
                    Bonus hadiah <span className="text-amber-200 font-black">+{Math.round((streakMultiplier - 1) * 100)}%</span> aktif!
                    Pertahankan dengan dapat Rare+ lagi
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 🎁 DAILY FREE SPIN CARD */}
          <div className={`relative overflow-hidden rounded-2xl border-2 p-3 ${
            freeSpinAvailable
              ? "bg-gradient-to-br from-emerald-600/40 via-green-600/30 to-cyan-600/40 border-emerald-400/60 shadow-lg shadow-emerald-500/40"
              : "bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-slate-600/40 opacity-70"
          }`}>
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: "radial-gradient(circle at 80% 20%, rgba(16,185,129,0.5), transparent 60%)",
            }} />
            <div className="relative flex items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ring-2 ${
                freeSpinAvailable ? "bg-gradient-to-br from-emerald-400 to-green-600 ring-emerald-300/60 shadow-lg shadow-emerald-500/50 animate-pulse" : "bg-slate-700 ring-slate-500/40"
              }`}>
                <Gift className="w-8 h-8 text-white" fill="currentColor" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Badge className={freeSpinAvailable ? "bg-amber-500 text-black font-black text-[8px]" : "bg-slate-600 text-[8px]"}>
                    {freeSpinAvailable ? "🎉 GRATIS!" : "TERPAKAI"}
                  </Badge>
                  <span className="text-[9px] font-black tracking-widest text-emerald-200">DAILY FREE SPIN</span>
                </div>
                <h4 className="text-sm font-black text-white">Putar Gratis 1× Setiap Hari!</h4>
                <p className="text-[10px] text-emerald-100/80">
                  {freeSpinAvailable ? "Klaim hadiahmu sekarang • Reset 00:00 WIB" : "Sudah klaim hari ini, kembali besok"}
                </p>
              </div>
              <button
                disabled={!freeSpinAvailable || spinning}
                onClick={() => doSpin("free")}
                className={`shrink-0 px-3 py-2 rounded-xl font-black text-xs tracking-wider transition active:scale-95 ${
                  freeSpinAvailable
                    ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-lg shadow-amber-500/50 hover:shadow-amber-500/70"
                    : "bg-slate-700 text-slate-400 cursor-not-allowed"
                }`}
              >
                {freeSpinAvailable ? "PUTAR!" : "✓"}
              </button>
            </div>
          </div>

          {/* ✨ Hero Banner — premium animated */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/50 p-4 shadow-2xl shadow-amber-500/30">
            {/* Animated aurora background */}
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-700 via-amber-600 to-rose-700" />
            <div className="absolute inset-0 opacity-60 animate-pulse" style={{
              backgroundImage: "radial-gradient(circle at 20% 30%, rgba(251,191,36,0.6), transparent 50%), radial-gradient(circle at 80% 70%, rgba(236,72,153,0.5), transparent 55%)",
            }} />
            {/* Sparkle dots */}
            <div className="absolute inset-0 opacity-50 pointer-events-none" style={{
              backgroundImage: "radial-gradient(circle, white 1px, transparent 1.5px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(ellipse at center, black, transparent 80%)",
            }} />
            {/* Diagonal shine */}
            <div className="absolute -inset-x-10 -top-10 h-24 rotate-12 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-2xl animate-pulse" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge className="bg-gradient-to-r from-rose-600 via-fuchsia-600 to-purple-700 text-white font-black text-[10px] shadow-lg shadow-fuchsia-500/50 ring-1 ring-white/30">🔥 MYTHIC+</Badge>
                <span className="text-[10px] font-black tracking-[0.25em] text-amber-100 drop-shadow">LUCK ROYALE</span>
              </div>
              <h2 className="text-[26px] leading-none font-black tracking-tight bg-gradient-to-br from-yellow-100 via-amber-300 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(251,191,36,0.6)]">
                JACKPOT<br />SHADOW VAULT
              </h2>
              <p className="text-[11px] text-amber-50/90 mt-1.5 font-semibold">
                ❤️ Nyawa • 💡 Hint • ⏱️ Time Freeze • 🛡️ Streak Freeze — Spin normal tetap normal!
              </p>
            </div>
          </div>

          {/* 🏆 Hadiah Utama — showcase TOP rarity */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-[11px] font-black tracking-widest text-amber-300 flex items-center gap-1">
                <Trophy className="w-3 h-3" /> HADIAH UTAMA
              </h3>
              <span className="text-[9px] font-bold text-fuchsia-300/80 tracking-wider">⭐ TOP REWARDS</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {featured.slice(0, 4).map((p, i) => {
                const style = RARITY_STYLE[p.rarity];
                return (
                  <div key={i} className={`relative aspect-square rounded-xl bg-gradient-to-br ${style.gradient} ring-2 ${style.ring} shadow-xl ${style.glow} flex items-center justify-center overflow-hidden group`}>
                    {/* shimmer */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-transparent via-white/40 to-transparent rotate-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000" />
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, white, transparent 70%)" }} />
                    {/* Rarity tag */}
                    <span className="absolute top-0.5 left-0.5 text-[7px] font-black bg-black/70 text-white px-1 py-0.5 rounded leading-none tracking-wider">
                      {style.label}
                    </span>
                    <div className="w-7 h-7 text-white relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">{getKindIcon(p.kind)}</div>
                    <div className="absolute bottom-0.5 left-0.5 right-0.5 text-center">
                      <div className="text-[8px] font-black bg-black/80 rounded px-0.5 truncate text-amber-100">
                        {p.label.replace(/[👑💎🌈🎰❤️💡⏱️🛡️🪙🎁]/g, "").trim().split(" ").slice(0, 2).join(" ")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 📊 Info peluang hadiah */}
          <div className="rounded-2xl bg-black/35 border border-cyan-400/25 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-black tracking-widest text-cyan-200 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> INFO HADIAH
              </h3>
              <span className="text-[9px] font-bold text-white/60">Semakin kecil %, semakin langka</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {prizes.map((p, i) => {
                const style = RARITY_STYLE[p.rarity] || RARITY_STYLE.common;
                const chance = totalPrizeWeight ? ((Number(p.weight) || 0) / totalPrizeWeight) * 100 : 0;
                return (
                  <div key={`${p.kind}-${p.value}-${i}`} className={`flex items-center justify-between gap-1 rounded-lg bg-gradient-to-r ${style.gradient} px-2 py-1 ring-1 ${style.ring}`}>
                    <span className="min-w-0 flex items-center gap-1 text-[9px] font-black text-white truncate">
                      <span>{p.emoji}</span>
                      <span className="truncate">{p.label.replace(/[👑💎🌈🎰❤️💡⏱️🛡️🪙🎁]/g, "").trim()}</span>
                    </span>
                    <span className="shrink-0 text-[9px] font-black text-amber-100 tabular-nums">{chance < 0.1 ? "<0.1" : chance.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 🎰 Reel / Wheel Display — premium vault */}
          <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-amber-400/50 shadow-2xl shadow-purple-900/60">
            {/* Layered cosmic background */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950" />
            <div className="absolute inset-0 opacity-70" style={{
              backgroundImage: "radial-gradient(circle at 50% 50%, rgba(168,85,247,0.5), transparent 65%), radial-gradient(circle at 20% 80%, rgba(251,191,36,0.3), transparent 55%), radial-gradient(circle at 80% 20%, rgba(236,72,153,0.3), transparent 55%)",
            }} />
            {/* Star field */}
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
              backgroundImage: "radial-gradient(circle, white 0.5px, transparent 1px)",
              backgroundSize: "16px 16px",
            }} />
            {/* Rotating glow ring */}
            {!reelSpinning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[80%] h-[80%] rounded-full border border-amber-400/20 animate-[spin_8s_linear_infinite]" style={{ borderStyle: "dashed" }} />
              </div>
            )}
            {reelSpinning ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => {
                    const p = prizes[i % prizes.length];
                    return (
                      <div key={i} className={`w-12 h-12 rounded-lg bg-gradient-to-br ${RARITY_STYLE[p?.rarity || "common"].gradient} ring-2 ${RARITY_STYLE[p?.rarity || "common"].ring} shadow-lg ${RARITY_STYLE[p?.rarity || "common"].glow} flex items-center justify-center animate-spin`} style={{ animationDuration: `${0.3 + (i % 3) * 0.2}s` }}>
                        <span className="text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{p?.emoji}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                {/* Glowing trophy orb */}
                <div className="relative mb-3">
                  <div className="absolute inset-0 rounded-full bg-amber-400/40 blur-2xl scale-150 animate-pulse" />
                  <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-yellow-300 via-amber-500 to-orange-700 flex items-center justify-center shadow-2xl shadow-amber-500/70 ring-4 ring-amber-300/50 animate-[pulse_2.5s_ease-in-out_infinite]">
                    <Trophy className="w-12 h-12 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
                  </div>
                  {/* Sparkle accents */}
                  <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-200 animate-pulse" />
                  <Sparkles className="absolute -bottom-1 -left-1 w-4 h-4 text-fuchsia-300 animate-pulse" style={{ animationDelay: "0.5s" }} />
                </div>
                <p className="text-center text-sm font-black text-amber-200 tracking-widest drop-shadow">
                  PUTAR & MENANGKAN
                </p>
                <p className="text-center text-[10px] text-purple-200/90 mt-1 font-semibold">
                  ❤️ Nyawa • 💡 Hint • ⏱️ Time Freeze • 🛡️ Freeze
                </p>
                {/* Mini featured strip */}
                <div className="flex items-center gap-1.5 mt-3">
                  {featured.slice(0, 5).map((p, i) => (
                    <div key={i} className={`w-7 h-7 rounded-md bg-gradient-to-br ${RARITY_STYLE[p.rarity].gradient} ring-1 ${RARITY_STYLE[p.rarity].ring} flex items-center justify-center text-sm shadow-md`}>
                      {p.emoji}
                    </div>
                  ))}
                </div>
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
                      <Gem className="w-3 h-3" /> {formatCompactNumber(b.cost)}
                    </div>
                    {savings > 0 && (
                      <div className="text-[9px] text-amber-100/90 mt-0.5">
                        Hemat {formatCompactNumber(savings)} ({pct}%)
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


          {/* 🎁 FREE DAILY SHOP - gratis 1x per hari */}
          {freeDailyShop.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-emerald-900/40 via-green-900/30 to-teal-900/40 border-2 border-emerald-400/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-emerald-300" fill="currentColor" />
                  <h3 className="text-xs font-black tracking-widest text-emerald-200">| FREE DAILY - GRATIS 1× SEHARI</h3>
                </div>
                <Badge className="bg-emerald-500 text-black font-black text-[8px]">🎁 FREE</Badge>
              </div>
              <p className="text-[10px] text-emerald-100/80 mb-2.5">
                Klaim hadiah <span className="font-black text-emerald-300">tanpa biaya</span> - reset tiap hari (jam 00:00 WIB)!
              </p>
              <div className="grid grid-cols-2 gap-2">
                {freeDailyShop.map((item) => {
                  const style = RARITY_STYLE[item.rarity] || RARITY_STYLE.common;
                  const claimed = item.claimedToday;
                  return (
                    <button
                      key={item.code}
                      disabled={claimed || redeeming === item.code}
                      onClick={() => claimFreeDaily(item.code)}
                      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${claimed ? "from-slate-700 to-slate-900 opacity-60" : style.gradient} ring-2 ${claimed ? "ring-slate-500/30" : "ring-emerald-400/60"} p-2.5 text-left active:scale-95 transition disabled:cursor-not-allowed`}
                    >
                      <div className="absolute top-1 right-1 bg-black/60 rounded-full px-1.5 py-0.5">
                        <span className="text-[8px] font-black text-emerald-200">{claimed ? "✓ DONE" : "GRATIS"}</span>
                      </div>
                      <div className="text-2xl mb-0.5">{item.emoji}</div>
                      <div className="text-[10px] font-black text-white leading-tight">{item.name}</div>
                      <div className="text-[8px] font-bold text-white/70 mt-1">{claimed ? "Kembali besok" : "Tap untuk klaim"}</div>
                      {redeeming === item.code && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 🔓 AKSES PREMIUM (Rp 100k/bln) & SUPER PREMIUM (Rp 300k/bln) */}
          {tokenShop.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Premium */}
              <div className={`rounded-2xl border-2 p-3 ${shopAccess.isActive ? "bg-gradient-to-br from-emerald-900/50 via-teal-900/40 to-cyan-900/50 border-emerald-400/60" : "bg-gradient-to-br from-rose-900/50 via-red-900/40 to-orange-900/50 border-rose-400/60"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Crown className={`w-4 h-4 ${shopAccess.isActive ? "text-emerald-300" : "text-rose-300"}`} fill="currentColor" />
                    <h3 className={`text-[11px] font-black tracking-widest ${shopAccess.isActive ? "text-emerald-200" : "text-rose-200"}`}>
                      | PREMIUM {shopAccess.isActive ? "AKTIF" : "LOCKED"}
                    </h3>
                  </div>
                  <Badge className={`${shopAccess.isActive ? "bg-emerald-500" : "bg-rose-500"} text-white font-black text-[8px]`}>
                    {shopAccess.isActive ? "✓" : "🔒"}
                  </Badge>
                </div>
                {shopAccess.isActive ? (
                  <p className="text-[10px] text-emerald-100/90">
                    Aktif sampai <span className="font-black text-emerald-200">{shopAccess.activeUntil ? new Date(shopAccess.activeUntil).toLocaleDateString("id-ID") : "-"}</span>
                    {shopAccess.activeUntil && <> · ⏳ <span className="font-black">{Math.max(0, Math.ceil((new Date(shopAccess.activeUntil).getTime() - Date.now()) / 86400000))} hari</span></>}
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] text-rose-100/90 mb-2">
                      Tukar Lucky Token tier <span className="font-black">Premium</span> (20-60). Hadiah MANTAP. Berlaku <span className="font-black">{shopAccess.durationDays} hari</span>.
                    </p>
                    <Button
                      disabled={redeeming === "__shop_access__"}
                      onClick={() => buyShopAccess("premium")}
                      className="w-full h-9 text-[11px] font-black bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 hover:from-amber-500 hover:via-orange-600 hover:to-red-700 text-white shadow-lg shadow-orange-500/40"
                    >
                      {redeeming === "__shop_access__" ? <Loader2 className="w-4 h-4 animate-spin" /> : <>🔓 Rp {shopAccess.price.toLocaleString("id-ID")} / {shopAccess.durationDays} HARI</>}
                    </Button>
                  </>
                )}
              </div>

              {/* Super Premium */}
              <div className={`rounded-2xl border-2 p-3 ${superShopAccess.isActive ? "bg-gradient-to-br from-fuchsia-900/60 via-purple-900/50 to-amber-900/40 border-fuchsia-400/70" : "bg-gradient-to-br from-purple-900/50 via-fuchsia-900/40 to-rose-900/50 border-purple-400/60"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Crown className={`w-4 h-4 ${superShopAccess.isActive ? "text-amber-300" : "text-fuchsia-300"}`} fill="currentColor" />
                    <h3 className={`text-[11px] font-black tracking-widest ${superShopAccess.isActive ? "text-amber-200" : "text-fuchsia-200"}`}>
                      | SUPER {superShopAccess.isActive ? "AKTIF" : "LOCKED"}
                    </h3>
                  </div>
                  <Badge className={`${superShopAccess.isActive ? "bg-amber-500" : "bg-fuchsia-600"} text-white font-black text-[8px]`}>
                    {superShopAccess.isActive ? "✓ DIVINE" : "👑 MEGA"}
                  </Badge>
                </div>
                {superShopAccess.isActive ? (
                  <p className="text-[10px] text-amber-100/90">
                    Aktif sampai <span className="font-black text-amber-200">{superShopAccess.activeUntil ? new Date(superShopAccess.activeUntil).toLocaleDateString("id-ID") : "-"}</span>
                    {superShopAccess.activeUntil && <> · ⏳ <span className="font-black">{Math.max(0, Math.ceil((new Date(superShopAccess.activeUntil).getTime() - Date.now()) / 86400000))} hari</span></>}
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] text-fuchsia-100/90 mb-2">
                      Tier <span className="font-black text-amber-300">SUPER PREMIUM</span> (70-150) - hadiah MEGA: 100k Gem, 1jt Coin, 15k Nyawa! Berlaku <span className="font-black">{superShopAccess.durationDays} hari</span>.
                    </p>
                    <Button
                      disabled={redeeming === "__super_shop_access__"}
                      onClick={() => buyShopAccess("super_premium")}
                      className="w-full h-9 text-[11px] font-black bg-gradient-to-r from-fuchsia-500 via-purple-600 to-amber-500 hover:from-fuchsia-600 hover:via-purple-700 hover:to-amber-600 text-white shadow-lg shadow-fuchsia-500/40"
                    >
                      {redeeming === "__super_shop_access__" ? <Loader2 className="w-4 h-4 animate-spin" /> : <>👑 Rp {superShopAccess.price.toLocaleString("id-ID")} / {superShopAccess.durationDays} HARI</>}
                    </Button>
                  </>
                )}
              </div>

              {/* ULTRA — Rp 500k/bln */}
              <div className={`sm:col-span-2 rounded-2xl border-2 p-3 ${ultraShopAccess.isActive ? "bg-gradient-to-br from-cyan-900/50 via-emerald-900/40 to-amber-900/40 border-cyan-300/70" : "bg-gradient-to-br from-cyan-950/60 via-emerald-950/50 to-amber-950/50 border-cyan-400/50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Crown className={`w-4 h-4 ${ultraShopAccess.isActive ? "text-cyan-200" : "text-cyan-300"}`} fill="currentColor" />
                    <h3 className={`text-[11px] font-black tracking-widest ${ultraShopAccess.isActive ? "text-cyan-100" : "text-cyan-200"}`}>
                      | ULTRA {ultraShopAccess.isActive ? "AKTIF" : "LOCKED"}
                    </h3>
                  </div>
                  <Badge className={`${ultraShopAccess.isActive ? "bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400" : "bg-cyan-700"} text-white font-black text-[8px]`}>
                    {ultraShopAccess.isActive ? "✦ GOD-TIER" : "💠 GOD-TIER"}
                  </Badge>
                </div>
                {ultraShopAccess.isActive ? (
                  <p className="text-[10px] text-cyan-100/90">
                    Aktif sampai <span className="font-black text-cyan-100">{ultraShopAccess.activeUntil ? new Date(ultraShopAccess.activeUntil).toLocaleDateString("id-ID") : "-"}</span>
                    {ultraShopAccess.activeUntil && <> · ⏳ <span className="font-black">{Math.max(0, Math.ceil((new Date(ultraShopAccess.activeUntil).getTime() - Date.now()) / 86400000))} hari</span></>}
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] text-cyan-100/90 mb-2">
                      Tier <span className="font-black text-amber-200">ULTRA</span> (160-300) — hadiah PALING DAHSYAT: <span className="font-black">100k Gem</span>, <span className="font-black">10jt Coin</span>, <span className="font-black">100k Nyawa</span>! Berlaku <span className="font-black">{ultraShopAccess.durationDays} hari</span>.
                    </p>
                    <Button
                      disabled={redeeming === "__ultra_shop_access__"}
                      onClick={() => buyShopAccess("ultra")}
                      className="w-full h-9 text-[11px] font-black bg-gradient-to-r from-cyan-400 via-emerald-500 to-amber-500 hover:from-cyan-500 hover:via-emerald-600 hover:to-amber-600 text-white shadow-lg shadow-cyan-500/40"
                    >
                      {redeeming === "__ultra_shop_access__" ? <Loader2 className="w-4 h-4 animate-spin" /> : <>💠 Rp {ultraShopAccess.price.toLocaleString("id-ID")} / {ultraShopAccess.durationDays} HARI</>}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 🎟️ TOKEN SHOP - 4 tier (Free / Premium / Super / Ultra) */}
          {tokenShop.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-pink-900/40 border-2 border-amber-500/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-300" fill="currentColor" />
                  <h3 className="text-xs font-black tracking-widest text-amber-200">| TOKEN SHOP - HADIAH PASTI</h3>
                </div>
                <Badge className="bg-amber-500 text-black font-black text-[8px]">🎟️ {luckyTokens}</Badge>
              </div>
              <p className="text-[10px] text-amber-100/80 mb-2">
                <span className="font-black text-emerald-300">FREE</span> bebas tukar. <span className="font-black text-fuchsia-300">PREMIUM</span>, <span className="font-black text-amber-300">SUPER</span> & <span className="font-black text-cyan-300">ULTRA</span> butuh akses bulanan.
              </p>

              {/* 4-tier toggle */}
              <div className="grid grid-cols-4 gap-1 mb-2.5 bg-black/40 rounded-lg p-1">
                <button
                  onClick={() => setShopTier("free")}
                  className={`py-1.5 rounded-md text-[9px] font-black tracking-wider transition ${shopTier === "free" ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/40" : "text-emerald-200/60"}`}
                >
                  🎁 FREE
                </button>
                <button
                  onClick={() => setShopTier("premium")}
                  className={`py-1.5 rounded-md text-[9px] font-black tracking-wider transition ${shopTier === "premium" ? "bg-gradient-to-r from-fuchsia-500 via-purple-600 to-amber-500 text-white shadow-lg shadow-fuchsia-500/40" : "text-fuchsia-200/60"}`}
                >
                  👑 PREMIUM
                </button>
                <button
                  onClick={() => setShopTier("super_premium")}
                  className={`py-1.5 rounded-md text-[9px] font-black tracking-wider transition ${shopTier === "super_premium" ? "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-600 text-white shadow-lg shadow-amber-500/50" : "text-amber-200/60"}`}
                >
                  💎 SUPER
                </button>
                <button
                  onClick={() => setShopTier("ultra")}
                  className={`py-1.5 rounded-md text-[9px] font-black tracking-wider transition ${shopTier === "ultra" ? "bg-gradient-to-r from-cyan-400 via-emerald-500 to-amber-500 text-white shadow-lg shadow-cyan-500/50" : "text-cyan-200/60"}`}
                >
                  💠 ULTRA
                </button>
              </div>

              {/* Per-tier locked banner */}
              {shopTier === "premium" && !shopAccess.isActive && (
                <div className="mb-2 rounded-lg bg-rose-950/60 border border-rose-500/40 p-2 text-center">
                  <p className="text-[10px] font-black text-rose-200">
                    🔒 Akses Premium belum aktif - beli Rp {shopAccess.price.toLocaleString("id-ID")} di atas
                  </p>
                </div>
              )}
              {shopTier === "super_premium" && !superShopAccess.isActive && (
                <div className="mb-2 rounded-lg bg-fuchsia-950/60 border border-fuchsia-500/40 p-2 text-center">
                  <p className="text-[10px] font-black text-fuchsia-200">
                    🔒 Akses Super Premium belum aktif - beli Rp {superShopAccess.price.toLocaleString("id-ID")} di atas
                  </p>
                </div>
              )}
              {shopTier === "ultra" && !ultraShopAccess.isActive && (
                <div className="mb-2 rounded-lg bg-cyan-950/60 border border-cyan-400/50 p-2 text-center">
                  <p className="text-[10px] font-black text-cyan-200">
                    🔒 Akses Ultra belum aktif - beli Rp {ultraShopAccess.price.toLocaleString("id-ID")} di atas
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {tokenShop.filter(item => (item.tier || "free") === shopTier).map((item) => {
                  const style = RARITY_STYLE[item.rarity] || RARITY_STYLE.common;
                  const canAfford = luckyTokens >= item.cost;
                  const tierLocked =
                    (item.tier === "premium" && !shopAccess.isActive) ||
                    (item.tier === "super_premium" && !superShopAccess.isActive) ||
                    (item.tier === "ultra" && !ultraShopAccess.isActive);
                  const disabled = tierLocked || !canAfford || redeeming === item.code;
                  return (
                    <button
                      key={item.code}
                      disabled={disabled}
                      onClick={() => redeemToken(item.code)}
                      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${style.gradient} ring-2 ${style.ring} p-2.5 text-left active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-black/60 rounded-full px-1.5 py-0.5">
                        <Award className="w-2.5 h-2.5 text-amber-300" fill="currentColor" />
                        <span className="text-[9px] font-black text-amber-200">{item.cost}</span>
                      </div>
                      <div className="text-2xl mb-0.5">{item.emoji}</div>
                      <div className="text-[10px] font-black text-white leading-tight">{item.name}</div>
                      <div className="text-[8px] font-bold text-white/70 mt-1">{style.label}</div>
                      {tierLocked && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <span className="text-lg">🔒</span>
                        </div>
                      )}
                      {redeeming === item.code && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-amber-100/60 mt-2 text-center">
                {shopTier === "free" && "10 item FREE - bisa diklaim tanpa langganan"}
                {shopTier === "premium" && "40 item Premium - hadiah MANTAP (Rp 100k/bln)"}
                {shopTier === "super_premium" && "20 item SUPER PREMIUM - hadiah MEGA DIVINE (Rp 300k/bln)"}
                {shopTier === "ultra" && "20 item ULTRA - hadiah PALING DAHSYAT GOD-TIER (Rp 500k/bln)"}
              </p>
            </div>
          )}

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

            <TabsContent value="mega" className="mt-3">
              <MegaSpinArena visitorId={visitorId} gems={gems} setGems={setGems} />
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
                    desc: `Rare rate kamu ${rareRate.toFixed(1)}%. Coba Faded Wheel - sistem 3x3 grid lebih predictable!`,
                    priority: "med",
                  });
                } else if (rareRate >= 20 && total >= 10) {
                  recs.push({
                    icon: CheckCircle2,
                    color: "from-emerald-500 to-green-600",
                    title: "Lagi Hoki Banget! 🍀",
                    desc: `Rare rate kamu ${rareRate.toFixed(1)}% - di atas rata-rata. Manfaatkan momen ini dengan multi-spin!`,
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
                    desc: "Mythic punya peluang tipis. Bundle 125 SPIN paling efektif untuk berburu Jackpot Utama 10.000 Gems!",
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
                        <div className="text-lg font-black text-cyan-100 tabular-nums">{formatCompactNumber(gemsWon)}</div>
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

      {/* 🔥 Streak Bonus Popup */}
      {bonusPopup !== null && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-fade-in pointer-events-none">
          <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-full px-5 py-2.5 shadow-2xl shadow-orange-500/60 ring-4 ring-amber-300/40 flex items-center gap-2 animate-pulse">
            <FlameIcon className="w-5 h-5 text-amber-200" fill="currentColor" />
            <div>
              <div className="text-[9px] font-black text-amber-200 tracking-widest leading-none">STREAK BONUS!</div>
              <div className="text-base font-black text-white leading-tight">+{formatCompactNumber(bonusPopup)} 💎</div>
            </div>
          </div>
        </div>
      )}

      {/* 💥 MEGA JACKPOT WIN POPUP */}
      {jackpotPopup !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-gradient-to-br from-purple-700 via-fuchsia-600 to-pink-600 rounded-3xl p-6 shadow-2xl shadow-fuchsia-500/80 ring-4 ring-amber-300/60 animate-pulse max-w-xs mx-4 text-center">
            <div className="text-5xl mb-2">💥🎰💥</div>
            <div className="text-[10px] font-black text-amber-200 tracking-widest mb-1">MEGA JACKPOT PECAH!</div>
            <div className="text-3xl font-black text-white drop-shadow mb-1">+{formatCompactNumber(jackpotPopup)}</div>
            <div className="flex items-center justify-center gap-1 text-amber-300 font-black">
              <Gem className="w-5 h-5" fill="currentColor" /> GEM
            </div>
            <p className="text-[10px] text-fuchsia-100/90 mt-2">Selamat, kamu pecahkan pool komunitas!</p>
          </div>
        </div>
      )}

      {/* 🎟️ EARNED TOKEN POPUP */}
      {tokenPopup !== null && (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[60] animate-fade-in pointer-events-none">
          <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 rounded-full px-5 py-2.5 shadow-2xl shadow-amber-500/60 ring-4 ring-amber-200/40 flex items-center gap-2">
            <Award className="w-5 h-5 text-white" fill="currentColor" />
            <div>
              <div className="text-[9px] font-black text-white tracking-widest leading-none">LUCKY TOKEN!</div>
              <div className="text-base font-black text-white leading-tight">+{tokenPopup} 🎟️</div>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ POPUP PERINGATAN MENANG/KALAH — Luck Royale */}
      {warningOpen && (
        <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-2xl shadow-amber-500/40 animate-scale-in">
            {/* Gradient bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-rose-900 via-orange-900 to-amber-900" />
            <div className="absolute inset-0 opacity-50" style={{
              backgroundImage: "radial-gradient(circle at 30% 20%, rgba(251,191,36,0.5), transparent 55%), radial-gradient(circle at 80% 80%, rgba(244,63,94,0.4), transparent 55%)",
            }} />
            <div className="relative p-5 text-white">
              {/* Header icon */}
              <div className="flex flex-col items-center text-center mb-3">
                <div className="relative mb-2">
                  <div className="absolute inset-0 rounded-full bg-amber-400/40 blur-xl scale-150 animate-pulse" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-amber-500/60 ring-4 ring-amber-300/40">
                    <AlertCircle className="w-9 h-9 text-white drop-shadow" />
                  </div>
                </div>
                <Badge className="bg-rose-600 text-white font-black text-[10px] tracking-widest mb-1">⚠️ PERINGATAN</Badge>
                <h3 className="text-xl font-black tracking-tight bg-gradient-to-r from-yellow-100 via-amber-300 to-orange-400 bg-clip-text text-transparent">
                  Menang Kalah Tergantung Hoki
                </h3>
              </div>

              {/* Body */}
              <div className="space-y-2 text-[12px] leading-relaxed text-amber-50/95">
                <div className="flex gap-2 bg-black/30 rounded-lg p-2.5 border border-amber-500/30">
                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <p>Luck Royale adalah <b>permainan keberuntungan</b>. Hadiah bisa berupa <b>koin streak, nyawa, hint, freeze, atau gem</b> sesuai peluang masing-masing.</p>
                </div>
                <div className="flex gap-2 bg-black/30 rounded-lg p-2.5 border border-rose-500/30">
                  <X className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                  <p><b>Gem TIDAK akan dikembalikan</b> jika kamu tidak mendapat hadiah yang diinginkan.</p>
                </div>
                <div className="flex gap-2 bg-black/30 rounded-lg p-2.5 border border-emerald-500/30">
                  <Heart className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" fill="currentColor" />
                  <p>Kalau kamu merasa <b>dirugikan</b>, lebih baik <b>tidak perlu spin</b>. Fitur ini hanya untuk <b>keseruan</b>.</p>
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => { setWarningOpen(false); setPendingSpin(null); }}
                  className="rounded-xl bg-slate-700/80 hover:bg-slate-600 active:scale-95 transition px-3 py-2.5 font-black text-xs tracking-wider text-white border border-white/10"
                >
                  BATAL
                </button>
                <button
                  onClick={() => {
                    setWarningAck(true);
                    setWarningOpen(false);
                    const p = pendingSpin;
                    setPendingSpin(null);
                    if (p) setTimeout(() => doSpin(p.mode, p.count, true), 50);
                  }}
                  className="rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 hover:brightness-110 active:scale-95 transition px-3 py-2.5 font-black text-xs tracking-wider text-white shadow-lg shadow-amber-500/50 ring-1 ring-amber-300/50"
                >
                  SAYA MENGERTI
                </button>
              </div>
              <p className="text-center text-[9px] text-amber-200/70 mt-2 font-semibold tracking-wider">
                Dengan klik SAYA MENGERTI, kamu setuju & tidak akan klaim refund.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
