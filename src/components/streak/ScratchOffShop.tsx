import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Coins, Loader2, Star, Gift, Trophy, Flame, Target, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

interface Card {
  id: string;
  cost: number;
  name: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  color: string;
  prizes: { label: string; value: number; weight: number; isJackpot?: boolean }[];
}

// Sistem hadiah: kemenangan terasa BESAR tapi jackpot tetap LANGKA.
// Bobot kekalahan tinggi agar ekonomi tetap sehat (house edge positif).
const CARDS: Card[] = [
  {
    id: "bronze", cost: 50, name: "Bronze Scratch", emoji: "🥉", rarity: "common", color: "from-amber-700 to-orange-700",
    prizes: [
      { label: "Zonk", value: 0, weight: 50 },
      { label: "+30 koin", value: 30, weight: 25 },
      { label: "+60 koin", value: 60, weight: 15 },
      { label: "+100 koin", value: 100, weight: 7 },
      { label: "+200 koin JACKPOT", value: 200, weight: 3, isJackpot: true },
    ],
  },
  {
    id: "silver", cost: 150, name: "Silver Scratch", emoji: "🥈", rarity: "rare", color: "from-slate-300 to-slate-500",
    prizes: [
      { label: "Zonk", value: 0, weight: 45 },
      { label: "+100 koin", value: 100, weight: 28 },
      { label: "+200 koin", value: 200, weight: 17 },
      { label: "+350 koin", value: 350, weight: 7 },
      { label: "+600 koin JACKPOT", value: 600, weight: 3, isJackpot: true },
    ],
  },
  {
    id: "gold", cost: 500, name: "Gold Scratch", emoji: "🥇", rarity: "epic", color: "from-yellow-400 to-amber-600",
    prizes: [
      { label: "Zonk", value: 0, weight: 42 },
      { label: "+200 koin", value: 200, weight: 28 },
      { label: "+700 koin", value: 700, weight: 16 },
      { label: "+800 koin", value: 800, weight: 7 },
      { label: "+1000 koin", value: 1000, weight: 4 },
      { label: "+1500 koin", value: 1500, weight: 2 },
      { label: "+2000 koin JACKPOT", value: 2000, weight: 1, isJackpot: true },
    ],
  },
  {
    id: "diamond", cost: 1000, name: "Diamond Scratch", emoji: "💎", rarity: "legendary", color: "from-cyan-300 via-blue-400 to-purple-500",
    prizes: [
      { label: "Zonk", value: 0, weight: 40 },
      { label: "+200 koin", value: 200, weight: 18 },
      { label: "+600 koin", value: 600, weight: 18 },
      { label: "+700 koin", value: 700, weight: 12 },
      { label: "+1500 koin", value: 1500, weight: 7 },
      { label: "+2500 koin", value: 2500, weight: 3 },
      { label: "+3000 koin JACKPOT", value: 3000, weight: 1.5, isJackpot: true },
      { label: "+5000 koin MEGA JACKPOT", value: 5000, weight: 0.5, isJackpot: true },
    ],
  },
];

// iOS Dark Vibrant: pakai class gradient dari index.css + hairline
const RARITY_GRAD: Record<string, string> = {
  common: "ios-grad-bronze",
  rare: "ios-grad-silver",
  epic: "ios-grad-gold",
  legendary: "ios-grad-diamond",
};

interface ScratchStats {
  total_buys: number;
  total_wins: number;
  jackpots: number;
  diamond_buys: number;
  achievements: string[];
}

const DEFAULT_STATS: ScratchStats = { total_buys: 0, total_wins: 0, jackpots: 0, diamond_buys: 0, achievements: [] };

interface AchievementDef {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  bonus: number;
  check: (s: ScratchStats) => boolean;
}

const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_win", label: "First Win", emoji: "🎯", desc: "Menang pertama kali", bonus: 10, check: (s) => s.total_wins >= 1 },
  { id: "high_roller", label: "High Roller", emoji: "💰", desc: "Beli 10 kartu total", bonus: 25, check: (s) => s.total_buys >= 10 },
  { id: "jackpot_hunter", label: "Jackpot Hunter", emoji: "👑", desc: "Dapat 1x JACKPOT", bonus: 50, check: (s) => s.jackpots >= 1 },
  { id: "diamond_master", label: "Diamond Master", emoji: "💎", desc: "Beli 5 Diamond Scratch", bonus: 100, check: (s) => s.diamond_buys >= 5 },
];

const COMBO_TIERS = [
  { min: 1, mult: 1.0, color: "from-slate-500 to-slate-600", label: "x1.0" },
  { min: 2, mult: 1.05, color: "from-blue-500 to-cyan-500", label: "x1.05" },
  { min: 3, mult: 1.1, color: "from-fuchsia-500 to-pink-500", label: "x1.1" },
  { min: 5, mult: 1.2, color: "from-orange-500 via-red-500 to-yellow-500", label: "x1.2 🔥" },
];

const COMBO_WINDOW_MS = 120_000; // 2 menit

function getComboTier(count: number) {
  return [...COMBO_TIERS].reverse().find((t) => count >= t.min) ?? COMBO_TIERS[0];
}

function todayWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

function pickPrize(card: Card) {
  const total = card.prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of card.prizes) {
    if (r < p.weight) return p;
    r -= p.weight;
  }
  return card.prizes[0];
}

export default function ScratchOffShop({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [scratching, setScratching] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ card: Card; prize: ReturnType<typeof pickPrize>; multiplier: number; isFree: boolean } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scratchPct, setScratchPct] = useState(0);
  const [activated, setActivated] = useState(false);
  const claimedRef = useRef(false);

  const [stats, setStats] = useState<ScratchStats>(DEFAULT_STATS);
  const [freeAvailable, setFreeAvailable] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const lastBuyAtRef = useRef<number>(0);
  const comboTimerRef = useRef<number | null>(null);
  const [unlockedAch, setUnlockedAch] = useState<AchievementDef | null>(null);

  // ==== Kartu berbayar (Premium / PRO / Limited) ====
  const [paidTiers, setPaidTiers] = useState<any[]>([]);
  const [userGems, setUserGems] = useState(0);
  const [userCoins, setUserCoins] = useState(0);
  const [buyingTier, setBuyingTier] = useState<string | null>(null);
  const [tierResult, setTierResult] = useState<any>(null);
  const [showPrizes, setShowPrizes] = useState<any>(null);

  const loadTiers = useCallback(async () => {
    if (!visitorId) return;
    const { data } = await supabase.functions.invoke("scratch-card", { body: { action: "tiers", visitorId } });
    if (data?.tiers) {
      setPaidTiers(data.tiers);
      setUserGems(data.user_gems || 0);
      setUserCoins(data.user_coins || 0);
    }
  }, [visitorId]);

  useEffect(() => { loadTiers(); }, [loadTiers]);

  async function buyTier(tierId: string, payment: "coin" | "gem") {
    if (buyingTier) return;
    setBuyingTier(tierId);
    try {
      const { data, error } = await supabase.functions.invoke("scratch-card", {
        body: { action: "buy_tier", visitorId, tier: tierId, payment },
      });
      if (error || data?.error) {
        toast({ title: "Gagal beli kartu", description: data?.error || "Coba lagi", variant: "destructive" });
        return;
      }
      setTierResult({ ...data.reward, tierId, payment, cost: data.cost });
      toast({ title: "🎉 Hadiah didapat!", description: data.reward?.label });
      loadTiers();
      onUpdate?.();
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setBuyingTier(null);
    }
  }


  const loadState = useCallback(async () => {
    if (!visitorId) return;
    const { data } = await supabase
      .from("daily_streaks")
      .select("scratch_stats, free_scratch_date")
      .eq("visitor_id", visitorId)
      .maybeSingle();
    if (data) {
      const s = (data.scratch_stats as unknown as ScratchStats) || DEFAULT_STATS;
      setStats({ ...DEFAULT_STATS, ...s });
      setFreeAvailable(data.free_scratch_date !== todayWIB());
    } else {
      setFreeAvailable(true);
    }
  }, [visitorId]);

  useEffect(() => { loadState(); }, [loadState]);

  // Reset combo kalau idle
  const resetComboTimer = useCallback(() => {
    if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current);
    comboTimerRef.current = window.setTimeout(() => setComboCount(0), COMBO_WINDOW_MS);
  }, []);

  useEffect(() => () => { if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current); }, []);

  async function checkAndApplyAchievements(newStats: ScratchStats, streakId: string): Promise<{ stats: ScratchStats; bonus: number; unlocked: AchievementDef | null }> {
    let bonus = 0;
    let unlocked: AchievementDef | null = null;
    const newAchievements = [...newStats.achievements];
    for (const a of ACHIEVEMENTS) {
      if (!newAchievements.includes(a.id) && a.check(newStats)) {
        newAchievements.push(a.id);
        bonus += a.bonus;
        if (!unlocked) unlocked = a; // tampilkan yang pertama
      }
    }
    const finalStats = { ...newStats, achievements: newAchievements };
    return { stats: finalStats, bonus, unlocked };
  }

  async function buyCard(card: Card, free = false) {
    if (!visitorId || scratching) return;
    const scratchKey = free ? `${card.id}-free` : card.id;
    setScratching(scratchKey);
    try {
      const { data: streak, error: selErr } = await supabase
        .from("daily_streaks")
        .select("id, streak_coins, free_scratch_date, scratch_stats")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (selErr) throw selErr;
      if (!streak) {
        toast({ title: "Belum ada streak", description: "Klaim streak harian dulu untuk dapat koin.", variant: "destructive" });
        setScratching(null); return;
      }
      const balance = streak.streak_coins || 0;

      if (free) {
        if (streak.free_scratch_date === todayWIB()) {
          toast({ title: "Sudah klaim hari ini", description: "Kartu gratis berikutnya besok ya!", variant: "destructive" });
          setScratching(null); return;
        }
        await supabase.from("daily_streaks").update({ free_scratch_date: todayWIB() }).eq("id", streak.id);
        setFreeAvailable(false);
      } else {
        if (balance < card.cost) {
          toast({ title: "Koin kurang", description: `Butuh ${card.cost} koin (kamu punya ${balance})`, variant: "destructive" });
          setScratching(null); return;
        }
        const { error: updErr } = await supabase
          .from("daily_streaks").update({ streak_coins: balance - card.cost }).eq("id", streak.id);
        if (updErr) throw updErr;
      }
      onUpdate?.();

      // Combo update (kartu berbayar saja)
      let nextCombo = comboCount;
      if (!free) {
        const now = Date.now();
        nextCombo = (now - lastBuyAtRef.current < COMBO_WINDOW_MS) ? comboCount + 1 : 1;
        setComboCount(nextCombo);
        lastBuyAtRef.current = now;
        resetComboTimer();
      }
      const multiplier = free ? 1.0 : getComboTier(nextCombo).mult;

      // Update total_buys + diamond_buys
      const baseStats = (streak.scratch_stats as unknown as ScratchStats) || DEFAULT_STATS;
      const newStats: ScratchStats = {
        ...DEFAULT_STATS, ...baseStats,
        total_buys: baseStats.total_buys + 1,
        diamond_buys: baseStats.diamond_buys + (card.id === "diamond" ? 1 : 0),
      };
      await supabase.from("daily_streaks").update({ scratch_stats: newStats as any }).eq("id", streak.id);
      setStats(newStats);

      const prize = pickPrize(card);
      setReveal({ card, prize, multiplier, isFree: free });
      setScratchPct(0);
      setActivated(false);
      claimedRef.current = false;
    } catch (e) {
      toast({ title: "Gagal beli kartu", description: e instanceof Error ? e.message : "Coba lagi", variant: "destructive" });
    } finally {
      setScratching(null);
    }
  }

  useEffect(() => {
    if (!reveal) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    cvs.width = rect.width * dpr;
    cvs.height = rect.height * dpr;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const grad = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    grad.addColorStop(0, "#94a3b8");
    grad.addColorStop(1, "#475569");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✋ GOSOK DI SINI", rect.width / 2, rect.height / 2);
  }, [reveal]);

  function scratchAt(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!reveal) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    if (Math.random() < 0.15) {
      const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
      let cleared = 0;
      const step = 60;
      for (let i = 3; i < data.length; i += 4 * step) {
        if (data[i] === 0) cleared++;
      }
      const total = data.length / (4 * step);
      const pct = (cleared / total) * 100;
      setScratchPct(pct);
      if (pct > 55 && !activated && !claimedRef.current) {
        claimedRef.current = true;
        setActivated(true);
        import("@/lib/daily-mission").then(m => m.trackDailyMission(visitorId, "scratch_card", 1)).catch(() => {});
        const finalPrize = Math.round(reveal.prize.value * reveal.multiplier);
        const isJackpot = !!reveal.prize.isJackpot;
        (async () => {
          try {
            const { data: s } = await supabase
              .from("daily_streaks")
              .select("id, streak_coins, scratch_stats")
              .eq("visitor_id", visitorId)
              .maybeSingle();
            if (!s) return;

            // Update stats: total_wins + jackpots
            const cur = (s.scratch_stats as unknown as ScratchStats) || DEFAULT_STATS;
            const updated: ScratchStats = {
              ...DEFAULT_STATS, ...cur,
              total_wins: cur.total_wins + 1,
              jackpots: cur.jackpots + (isJackpot ? 1 : 0),
            };
            const { stats: finalStats, bonus, unlocked } = await checkAndApplyAchievements(updated, s.id);

            const totalCredit = finalPrize + bonus;
            await supabase
              .from("daily_streaks")
              .update({
                streak_coins: (s.streak_coins || 0) + totalCredit,
                scratch_stats: finalStats as any,
              })
              .eq("id", s.id);

            setStats(finalStats);
            toast({
              title: `🎉 +${finalPrize} koin!`,
              description: reveal.multiplier > 1
                ? `${reveal.prize.label} × COMBO ${reveal.multiplier}x`
                : reveal.prize.label,
            });
            if (unlocked) {
              setTimeout(() => setUnlockedAch(unlocked), 800);
            }
            onUpdate?.();
          } catch (err) {
            toast({ title: "Gagal mencairkan hadiah", description: err instanceof Error ? err.message : "Coba lagi", variant: "destructive" });
          }
        })();
      }
    }
  }

  const tier = getComboTier(comboCount);
  const nextTier = COMBO_TIERS.find((t) => t.min > comboCount);
  const winRate = stats.total_buys > 0 ? Math.round((stats.total_wins / stats.total_buys) * 100) : 0;

  return (
    <div className="ios-card-vibrant p-3 sm:p-4 ios-tap-highlight">
      {/* Header - iOS large title style */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" style={{ color: "hsl(var(--ios-vibrant-pink))" }} />
          <h3 className="font-bold text-base sm:text-lg text-foreground tracking-tight">
            Scratch-Off Lottery
          </h3>
          <span className="ios-tint-pink text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">Jackpot</span>
        </div>
      </div>

      {/* Mini stats - iOS card row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="ios-surface-2 rounded-xl px-2 py-2 text-center border border-border/40">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Buys</p>
          <p className="text-sm font-bold text-foreground tabular-nums">{stats.total_buys}</p>
        </div>
        <div className="ios-surface-2 rounded-xl px-2 py-2 text-center border border-border/40">
          <p className="text-[9px] uppercase tracking-wider" style={{ color: "hsl(var(--ios-vibrant-green))" }}>Win Rate</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: "hsl(var(--ios-vibrant-green))" }}>{winRate}%</p>
        </div>
        <div className="ios-surface-2 rounded-xl px-2 py-2 text-center border border-border/40">
          <p className="text-[9px] uppercase tracking-wider" style={{ color: "hsl(var(--ios-vibrant-yellow))" }}>Jackpot</p>
          <p className="text-sm font-bold tabular-nums flex items-center justify-center gap-0.5" style={{ color: "hsl(var(--ios-vibrant-yellow))" }}>
            <Crown className="h-3 w-3" />{stats.jackpots}
          </p>
        </div>
      </div>

      {/* Combo bar - iOS style */}
      <div className="mb-3 ios-surface-2 rounded-xl border border-border/40 p-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Flame
              className={`h-3.5 w-3.5 ${comboCount >= 2 ? "animate-pulse" : ""}`}
              style={{ color: comboCount >= 2 ? "hsl(var(--ios-vibrant-orange))" : "hsl(var(--muted-foreground))" }}
            />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Combo</span>
            <span className="text-[11px] font-bold text-foreground">{tier.label}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {nextTier ? `${nextTier.min - comboCount} lagi → ${nextTier.label}` : "MAX"}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, hsl(var(--ios-vibrant-orange)), hsl(var(--ios-vibrant-pink)))" }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (comboCount / 5) * 100)}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Free Daily Card - iOS banner */}
      {freeAvailable && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-3 relative overflow-hidden rounded-2xl ios-grad-jackpot p-2.5 shadow-lg"
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.25), transparent)" }}
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-white drop-shadow animate-bounce" />
              <div>
                <p className="text-[11px] font-bold text-white">KARTU GRATIS HARI INI</p>
                <p className="text-[9px] text-white/85">Bronze Scratch - reset jam 00:00</p>
              </div>
            </div>
            <Button
              size="sm"
              disabled={scratching === "bronze-free"}
              onClick={() => buyCard({ ...CARDS[0] }, true)}
              className="h-7 px-3 text-[11px] bg-white text-neutral-900 hover:bg-white/90 font-bold rounded-full ios-pressable"
            >
              {scratching === "bronze-free" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Klaim"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Cards grid - iOS tile cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {CARDS.map((c) => (
          <motion.div
            key={c.id}
            whileTap={{ scale: 0.97 }}
            className={`relative overflow-hidden rounded-2xl ${RARITY_GRAD[c.rarity]} p-3 text-center shadow-md ios-tap-highlight`}
          >
            <div className="absolute -top-4 -right-4 text-6xl opacity-15 select-none">{c.emoji}</div>
            <div className="text-3xl mb-1 relative drop-shadow">{c.emoji}</div>
            <p className="font-bold text-[12px] text-white truncate drop-shadow">{c.name}</p>
            <span className="inline-block bg-black/30 text-white/95 text-[8px] h-4 leading-4 px-1.5 rounded-full my-1 font-semibold uppercase tracking-wider">
              {c.rarity}
            </span>
            <p className="text-[9px] text-white/85 mb-2">Max +{Math.max(...c.prizes.map(p => p.value))} 🪙</p>
            <Button
              size="sm"
              disabled={scratching === c.id}
              onClick={() => buyCard(c)}
              className="w-full h-7 text-[11px] bg-white/95 hover:bg-white text-neutral-900 font-bold rounded-full ios-pressable border-0"
            >
              {scratching === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                <><Coins className="h-3 w-3 mr-1" />{c.cost}</>
              )}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Kartu Berbayar (Premium/PRO/Limited) */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <p className="text-[11px] font-black text-foreground uppercase tracking-widest">Premium Tiers (Tanpa Batas)</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {paidTiers.map((t: any) => {
            const isBuying = buyingTier === t.id;
            const cost = t.coin_cost;
            const gemCost = t.gem_cost;
            
            let rarityColor = "from-slate-600 to-slate-800";
            if (t.id === "premium") rarityColor = "from-blue-600 to-indigo-900 shadow-[0_0_15px_rgba(37,99,235,0.4)]";
            if (t.id === "pro") rarityColor = "from-purple-600 to-pink-900 shadow-[0_0_15px_rgba(147,51,234,0.4)]";
            if (t.id === "limited") rarityColor = "from-amber-500 via-orange-600 to-red-800 shadow-[0_0_20px_rgba(217,119,6,0.5)] animate-pulse";

            return (
              <motion.div
                key={t.id}
                whileHover={{ scale: 1.02, y: -2 }}
                className={`relative overflow-hidden rounded-2xl p-4 border border-white/10 bg-gradient-to-br ${rarityColor} flex flex-col items-center text-center gap-2`}
              >
                <div className="text-4xl mb-1 drop-shadow-lg">{t.emoji}</div>
                <div className="font-black text-white text-[12px] uppercase tracking-tighter">{t.name}</div>
                <div className="text-[10px] text-white/80 leading-tight h-8 flex items-center justify-center">{t.desc}</div>
                
                <div className="mt-2 w-full space-y-2">
                  <Button
                    size="sm"
                    disabled={isBuying || userCoins < cost}
                    onClick={() => buyTier(t.id, "coin")}
                    className="w-full h-8 text-[10px] font-black bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md rounded-xl"
                  >
                    {isBuying ? <Loader2 className="w-3 h-3 animate-spin" /> : `${cost.toLocaleString()} 🪙`}
                  </Button>
                  <Button
                    size="sm"
                    disabled={isBuying || userGems < gemCost}
                    onClick={() => buyTier(t.id, "gem")}
                    className="w-full h-8 text-[10px] font-black bg-cyan-500/40 hover:bg-cyan-500/60 text-cyan-50 border-0 backdrop-blur-md rounded-xl"
                  >
                    {isBuying ? <Loader2 className="w-3 h-3 animate-spin" /> : `${gemCost.toLocaleString()} 💎`}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Achievement Badges - iOS list grid */}
      <div className="mt-3 ios-surface-2 rounded-2xl border border-border/40 p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Trophy className="h-3.5 w-3.5" style={{ color: "hsl(var(--ios-vibrant-yellow))" }} />
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">Achievement</p>
          <span className="text-[10px] text-muted-foreground tabular-nums">{stats.achievements.length}/{ACHIEVEMENTS.length}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = stats.achievements.includes(a.id);
            return (
              <div
                key={a.id}
                title={`${a.label} - ${a.desc} (+${a.bonus} koin)`}
                className={`rounded-xl p-1.5 text-center border transition-all ${
                  unlocked
                    ? "ios-tint-yellow border-transparent"
                    : "bg-secondary/40 border-border/40 grayscale opacity-50"
                }`}
              >
                <div className="text-lg leading-none">{a.emoji}</div>
                <p className="text-[8px] font-bold mt-0.5 truncate text-foreground">{a.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scratch reveal modal - iOS sheet */}
      <AnimatePresence>
        {reveal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => activated && setReveal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative max-w-xs w-full rounded-3xl ${RARITY_GRAD[reveal.card.rarity]} p-5 shadow-2xl`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-bold text-sm text-white drop-shadow">{reveal.card.emoji} {reveal.card.name}</p>
                  {reveal.isFree && (
                    <span className="bg-white text-foreground text-[9px] h-4 leading-4 px-1.5 rounded-full font-bold">FREE</span>
                  )}
                  {reveal.multiplier > 1 && (
                    <span
                      className="text-white text-[9px] h-4 leading-4 px-1.5 rounded-full font-bold animate-pulse"
                      style={{ background: "linear-gradient(90deg, hsl(var(--ios-vibrant-orange)), hsl(var(--ios-vibrant-pink)))" }}
                    >
                      COMBO {reveal.multiplier}x
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReveal(null)}
                  className="h-7 w-7 p-0 rounded-full bg-black/30 text-white hover:bg-black/50 ios-pressable"
                >
                  ✕
                </Button>
              </div>

              <div className="relative w-full h-48 rounded-2xl overflow-hidden ios-grad-jackpot shadow-inner">
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
                  <motion.div
                    animate={activated ? { scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] } : {}}
                    transition={{ duration: 0.6, repeat: activated ? 3 : 0 }}
                    className="text-5xl mb-2 drop-shadow-lg"
                  >
                    {reveal.prize.value >= 1000 ? "👑" : reveal.prize.value >= 500 ? "💎" : "🪙"}
                  </motion.div>
                  <p className="font-black text-xl text-white drop-shadow-lg">{reveal.prize.label}</p>
                  {reveal.multiplier > 1 && (
                    <p className="font-bold text-sm text-white/95 mt-1 drop-shadow">
                      = +{Math.round(reveal.prize.value * reveal.multiplier)} koin total!
                    </p>
                  )}
                </div>
                <canvas
                  ref={canvasRef}
                  onPointerMove={(e) => { if (e.buttons === 1 || e.pointerType === "touch") scratchAt(e); }}
                  onPointerDown={scratchAt}
                  className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                />
              </div>

              <p className="text-[11px] text-center text-white/95 mt-3 font-medium">
                {activated ? "✨ Hadiah sudah masuk ke saldo koin!" : `Gosok lebih dari 50% untuk klaim · ${Math.round(scratchPct)}%`}
              </p>

              {activated && (
                <Button
                  onClick={() => setReveal(null)}
                  className="w-full mt-3 bg-white text-neutral-900 hover:bg-white/95 font-bold rounded-full h-10 ios-pressable border-0"
                >
                  <Star className="h-4 w-4 mr-1" /> Selesai
                </Button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievement Unlock Popup */}
      <AnimatePresence>
        {unlockedAch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setUnlockedAch(null)}
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10, y: 50 }}
              animate={{ scale: 1, rotate: 0, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="relative max-w-xs w-full rounded-3xl bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 border-4 border-amber-200 p-6 text-center shadow-[0_0_60px_rgba(251,191,36,0.6)]"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 -z-10 rounded-3xl bg-gradient-conic from-amber-300 via-yellow-200 to-amber-300 opacity-50 blur-xl"
              />
              <p className="text-[10px] font-black text-amber-900 tracking-[0.3em] mb-1">ACHIEVEMENT UNLOCKED</p>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-7xl my-3"
              >
                {unlockedAch.emoji}
              </motion.div>
              <p className="font-black text-2xl text-amber-950">{unlockedAch.label}</p>
              <p className="text-xs text-amber-900/80 mt-1 mb-3">{unlockedAch.desc}</p>
              <div className="inline-flex items-center gap-1.5 bg-amber-950/30 rounded-full px-4 py-1.5">
                <Coins className="h-4 w-4 text-amber-100" />
                <span className="font-black text-amber-100">+{unlockedAch.bonus} koin bonus!</span>
              </div>
              <Button
                onClick={() => setUnlockedAch(null)}
                className="w-full mt-4 bg-amber-950/40 hover:bg-amber-950/60 text-white font-bold border border-amber-200/50"
              >
                <Target className="h-4 w-4 mr-1" /> Lanjut
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
