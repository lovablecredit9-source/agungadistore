import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Trophy, Star, Gift, Zap, ShoppingCart, Loader2, Lock, X, Shield, Flame, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { rollMysteryReward, checkNewAchievements, type MysteryReward, type Achievement } from "./streak/streakRewards";
import MysteryRewardPopup from "./streak/MysteryRewardPopup";
import StreakLeaderboard from "./streak/StreakLeaderboard";
import AchievementBadges from "./streak/AchievementBadges";
import StreakFreezeCard from "./streak/StreakFreezeCard";
import CelebrationOverlay from "./streak/CelebrationOverlay";
import StreakFlame from "./streak/StreakFlame";
import { useStreakMotion } from "./streak/useStreakMotion";
import { MILESTONES, getStreakTier, getNextStreakTier, getMilestoneProgress, type Milestone, type StreakTier } from "./streak/streakTiers";
import { BanBanner, BanLock } from "@/components/BanBanner";

interface StreakData {
  id: string;
  visitor_id: string;
  last_claim_date: string;
  current_streak: number;
  longest_streak: number;
  total_claims: number;
  total_bonus_points?: number;
  freeze_count?: number;
  achievements?: string[];
}

function getTierColor(tier: number) {
  switch (tier) {
    case 1: return "from-orange-400 to-orange-600";
    case 2: return "from-blue-400 to-indigo-600";
    case 3: return "from-purple-400 to-pink-600";
    case 4: return "from-rose-500 to-red-700";
    case 5: return "from-yellow-300 via-amber-500 to-orange-600";
    default: return "from-orange-400 to-orange-600";
  }
}


function getWIBDate(date: Date = new Date()) {
  // Convert to WIB (UTC+7)
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split("T")[0];
}

function getToday() {
  return getWIBDate();
}

function isYesterday(dateStr: string) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateStr === getWIBDate(yesterday);
}

function isToday(dateStr: string) {
  return dateStr === getToday();
}

// Countdown to the next 00:00 WIB (UTC+7) — same reset the claim uses
function useCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    function calc() {
      const nowMs = Date.now();
      const wib = new Date(nowMs + 7 * 3600000);
      const nextWibMidnightUtc = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + 1) - 7 * 3600000;
      const diff = Math.max(0, nextWibMidnightUtc - nowMs);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, []);
  return timeLeft;
}

// Shimmer overlay for achieved milestones
function ShimmerEffect() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      <span className="absolute inset-y-0 w-1/3 stk-shine" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)" }} />
    </div>
  );
}

interface DailyStreakProps {
  visitorId: string;
}

export default function DailyStreak({ visitorId }: DailyStreakProps) {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [showMilestone, setShowMilestone] = useState<Milestone | null>(null);
  const [pendingMilestone, setPendingMilestone] = useState<Milestone | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [claimFx, setClaimFx] = useState<{ key: number; from: number; to: number; tier: StreakTier } | null>(null);
  const { reduced: reducedMotion } = useStreakMotion();
  const [activeSub, setActiveSub] = useState<{plan_name: string; expires_at: string} | null>(null);
  const [buyingPlan, setBuyingPlan] = useState<number | null>(null);
  const [showPinForStreak, setShowPinForStreak] = useState(false);
  const [streakPinInput, setStreakPinInput] = useState("");
  const [pendingPlanDays, setPendingPlanDays] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState<{ days: number; name: string; price: number; discountedPrice?: number } | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [voucherApplied, setVoucherApplied] = useState(false);
  const [mysteryReward, setMysteryReward] = useState<MysteryReward | null>(null);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);
  const [buyingFreeze, setBuyingFreeze] = useState(false);
  const [showFreezePinModal, setShowFreezePinModal] = useState(false);
  const [freezePinInput, setFreezePinInput] = useState("");
  const countdown = useCountdown();
  const { toast } = useToast();

  const [AUTO_CLAIM_PLANS, setAutoClaimPlans] = useState<any[]>([]);
  const [flashSaleEnd, setFlashSaleEnd] = useState("");
  const [flashSaleLabel, setFlashSaleLabel] = useState("");

  // Process achievement queue one-by-one
  useEffect(() => {
    if (!newAchievement && achievementQueue.length > 0) {
      const [next, ...rest] = achievementQueue;
      setNewAchievement(next);
      setAchievementQueue(rest);
    }
  }, [newAchievement, achievementQueue]);

  const fetchStreakPackages = useCallback(async () => {
    // Fetch packages from DB
    const { data: pkgs } = await supabase.from("streak_packages" as any).select("*").eq("is_active", true).order("sort_order", { ascending: true });

    // Fetch flash sale settings
    const { data: settingsData } = await supabase.from("admin_settings").select("*");
    const settings: Record<string, string> = {};
    if (settingsData) (settingsData as any[]).forEach((s: any) => { settings[s.setting_key] = s.setting_value; });

    const fsEnd = settings.flash_sale_end || "";
    setFlashSaleEnd(fsEnd);
    setFlashSaleLabel(settings.flash_sale_label || "");

    const isFlashActive = fsEnd && new Date(fsEnd) > new Date();
    const streakDisc = parseInt(settings.promo_streak_discount || "0");

    const plans = (pkgs as any[] || []).map((p: any) => {
      const base = { id: p.id, name: p.name, days: p.days, price: p.price };
      if (isFlashActive && streakDisc > 0) {
        const discountedPrice = Math.max(0, Math.round(p.price * (1 - streakDisc / 100)));
        return { ...base, originalPrice: p.price, price: discountedPrice };
      }
      return base;
    });

    setAutoClaimPlans(plans.length > 0 ? plans : []);
  }, []);

  const fetchStreak = useCallback(async () => {
    const { data } = await supabase
      .from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
    setStreak(data ? (data as unknown as StreakData) : null);
  }, [visitorId]);

  const fetchSubscription = useCallback(async () => {
    const { data } = await supabase
      .from("streak_subscriptions" as any)
      .select("plan_name, expires_at")
      .eq("visitor_id", visitorId)
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveSub(data ? (data as any) : null);
  }, [visitorId]);

  useEffect(() => {
    fetchStreakPackages();
  }, [fetchStreakPackages]);

  useEffect(() => {
    setStreak(null);
    setActiveSub(null);
    setVoucherCode("");
    setVoucherDiscount(0);
    setVoucherError("");
    setVoucherApplied(false);
    setPendingPlanDays(null);
    setShowConfirm(null);
    setShowPinForStreak(false);
    setShowFreezePinModal(false);
    setStreakPinInput("");
    setFreezePinInput("");
    fetchStreak();
    fetchSubscription();
  }, [visitorId, fetchStreak, fetchSubscription]);

  function handlePlanClick(planDays: number) {
    const plan = AUTO_CLAIM_PLANS.find(p => p.days === planDays);
    if (!plan) return;
    const basePrice = plan.originalPrice ?? plan.price;
    const finalPrice = voucherDiscount > 0 ? Math.max(0, plan.price - voucherDiscount) : plan.price;
    const discountedPrice = finalPrice < basePrice ? finalPrice : undefined;
    setShowConfirm({ days: plan.days, name: plan.name, price: basePrice, discountedPrice });
  }

  async function applyVoucher() {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true);
    setVoucherError("");
    try {
      const { data, error } = await supabase
        .from("streak_discount_vouchers" as any)
        .select("*")
        .eq("code", voucherCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      const v = data as any;
      if (error || !v) {
        setVoucherError("Kode voucher tidak valid");
        setVoucherDiscount(0);
        setVoucherApplied(false);
      } else if (v.max_uses > 0 && v.used_count >= v.max_uses) {
        setVoucherError("Voucher sudah habis dipakai");
        setVoucherDiscount(0);
        setVoucherApplied(false);
      } else if (v.expires_at && new Date(v.expires_at) < new Date()) {
        setVoucherError("Voucher sudah expired");
        setVoucherDiscount(0);
        setVoucherApplied(false);
      } else {
        setVoucherDiscount(v.discount_amount);
        setVoucherApplied(true);
        setVoucherError("");
        toast({ title: "🎉 Voucher Berhasil!", description: `Diskon Rp${v.discount_amount.toLocaleString("id-ID")} diterapkan` });
      }
    } catch {
      setVoucherError("Gagal memvalidasi voucher");
    }
    setVoucherLoading(false);
  }

  function removeVoucher() {
    setVoucherCode("");
    setVoucherDiscount(0);
    setVoucherApplied(false);
    setVoucherError("");
  }

  function confirmPurchase() {
    if (!showConfirm) return;
    const days = showConfirm.days;
    setShowConfirm(null);
    setPendingPlanDays(days);
    setShowPinForStreak(true);
  }

  async function purchaseStreakPlan(planDays: number, pin?: string) {
    setBuyingPlan(planDays);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-streak-plan", {
        body: { visitorId, planDays, pin, voucherCode: voucherApplied ? voucherCode.trim() : undefined },
      });
      if (error || data?.error) {
        if (data?.needPin) {
          setPendingPlanDays(planDays);
          setShowPinForStreak(true);
          setBuyingPlan(null);
          return;
        }
        toast({ title: "Gagal", description: data?.error || "Gagal membeli paket", variant: "destructive" });
        return;
      }
      toast({
        title: "Berhasil!",
        description: data?.auto_claimed
          ? `Paket Auto-Klaim ${data.plan} aktif dan streak hari ini langsung diklaim otomatis`
          : `Paket Auto-Klaim ${data.plan} aktif sampai ${new Date(data.expires_at).toLocaleDateString("id-ID")}`
      });
      fetchSubscription();
      fetchStreak();
    } catch {
      toast({ title: "Error", description: "Koneksi gagal", variant: "destructive" });
    } finally {
      setBuyingPlan(null);
    }
  }

  function confirmStreakPin() {
    if (!pendingPlanDays || streakPinInput.length !== 6) return;
    setShowPinForStreak(false);
    purchaseStreakPlan(pendingPlanDays, streakPinInput);
    setStreakPinInput("");
    setPendingPlanDays(null);
  }
  const canClaim = !streak || !isToday(streak.last_claim_date);
  const streakBroken = streak && !isToday(streak.last_claim_date) && !isYesterday(streak.last_claim_date);

  // Apply mystery reward (only updates DB; UI state updated separately)
  async function applyMysteryReward(reward: MysteryReward, currentBonus: number, currentFreeze: number) {
    const updates: any = {};
    if (reward.type === "bonus_points" || reward.type === "double_points") {
      const points = reward.type === "double_points" ? reward.value * 10 : reward.value;
      updates.total_bonus_points = currentBonus + points;
    }
    if (reward.type === "freeze_token") {
      updates.freeze_count = currentFreeze + reward.value;
    }
    // Log reward
    await supabase.from("streak_rewards_log" as any).insert({
      visitor_id: visitorId,
      claim_date: getToday(),
      reward_type: reward.type,
      reward_value: reward.value,
      reward_label: reward.label,
      reward_emoji: reward.emoji,
      rarity: reward.rarity,
    });
    return updates;
  }

  async function claimStreak() {
    if (!canClaim) return;
    setClaiming(true);
    try {
      const reward = rollMysteryReward();
      const now = new Date();
      const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const claimHour = wibNow.getUTCHours();
      const claimDay = wibNow.getUTCDay();

      let updatedStreak: StreakData | null = null;
      let prevAchievements: string[] = streak?.achievements || [];
      let totalBonusAfter = streak?.total_bonus_points || 0;

      if (!streak) {
        const rewardUpdates = await applyMysteryReward(reward, 0, 0);
        const insertData: any = {
          visitor_id: visitorId,
          last_claim_date: getToday(),
          current_streak: 1,
          longest_streak: 1,
          total_claims: 1,
          ...rewardUpdates,
        };
        const { data, error } = await supabase.from("daily_streaks").insert(insertData).select().single();
        if (!error && data) {
          updatedStreak = data as unknown as StreakData;
          totalBonusAfter = updatedStreak.total_bonus_points || 0;
        }
      } else {
        const usedFreeze = streakBroken && (streak.freeze_count || 0) > 0;
        const effectiveStreak = usedFreeze ? streak.current_streak + 1 : (streakBroken ? 1 : streak.current_streak + 1);
        const newStreak = effectiveStreak;
        const newLongest = Math.max(streak.longest_streak, newStreak);
        const rewardUpdates = await applyMysteryReward(reward, streak.total_bonus_points || 0, streak.freeze_count || 0);
        const updateData: any = {
          last_claim_date: getToday(),
          current_streak: newStreak,
          longest_streak: newLongest,
          total_claims: streak.total_claims + 1,
          ...rewardUpdates,
        };
        if (usedFreeze) {
          updateData.freeze_count = Math.max(0, (rewardUpdates.freeze_count ?? streak.freeze_count ?? 0) - 1);
          updateData.freeze_used_at = getToday();
          toast({ title: "🛡️ Pelindung Streak Terpakai!", description: "Streak kamu diselamatkan dari putus!" });
        }
        const { data, error } = await supabase.from("daily_streaks").update(updateData).eq("id", streak.id).select().single();
        if (!error && data) {
          updatedStreak = data as unknown as StreakData;
          totalBonusAfter = updatedStreak.total_bonus_points || 0;
        }
      }

      if (updatedStreak) {
        const fromValue = streak?.current_streak || 0;
        const toValue = updatedStreak.current_streak;
        setStreak(updatedStreak);
        setJustClaimed(true);
        // Claim sequence: dim → flame burst → +1 DAY → old→new number
        const fxKey = Date.now();
        setBurstKey(fxKey);
        setClaimFx({ key: fxKey, from: fromValue, to: toValue, tier: getStreakTier(toValue) });
        setTimeout(() => setClaimFx(null), reducedMotion ? 600 : 2300);
        try { (await import("@/lib/daily-mission")).trackDailyMission(visitorId, "streak_claim", 1); } catch {}
        // Streak Shop boosts + Streak Plus bonus — validated & applied server-side
        supabase.functions.invoke("streak-shop-redeem", { body: { action: "claim_bonus", visitorId } }).then(({ data }) => {
          if (data?.bonus > 0) toast({ title: `🔥 Bonus +${data.bonus} Streak Coin`, description: (data.applied || []).join(" · ") });
        }).catch(() => {});

        // Reward appears after the claim sequence; milestone cinematic follows the reward
        const milestone = MILESTONES.find(m => m.days === toValue) ?? null;
        setPendingMilestone(milestone);
        setTimeout(() => setMysteryReward(reward), reducedMotion ? 700 : 2400);

        // Check new achievements
        const newAchs = checkNewAchievements(prevAchievements, {
          currentStreak: updatedStreak.current_streak,
          longestStreak: updatedStreak.longest_streak,
          totalClaims: updatedStreak.total_claims,
          claimHour,
          claimDay,
          totalBonus: totalBonusAfter,
        });
        // Auto-unlock legendary achievement if got legendary reward
        if (reward.rarity === "legendary" && !prevAchievements.includes("lucky_legendary")) {
          const legendary = { id: "lucky_legendary", label: "Tersentuh Dewi Fortuna", description: "Dapat hadiah Legendary", emoji: "🌟", check: () => true };
          newAchs.push(legendary as any);
        }
        if (newAchs.length > 0) {
          const newIds = [...prevAchievements, ...newAchs.map(a => a.id)];
          await supabase.from("daily_streaks").update({ achievements: newIds } as any).eq("id", updatedStreak.id);
          setStreak(prev => prev ? { ...prev, achievements: newIds } : prev);
          setAchievementQueue(prev => [...prev, ...newAchs]);
        }
      }
    } finally {
      setClaiming(false);
      setTimeout(() => setJustClaimed(false), 3000);
    }
  }

  function closeMysteryReward() {
    setMysteryReward(null);
    if (pendingMilestone) {
      setShowMilestone(pendingMilestone);
      setPendingMilestone(null);
    }
  }

  const closeMilestone = useCallback(() => setShowMilestone(null), []);

  // Buy streak freeze
  function handleBuyFreeze() {
    setShowFreezePinModal(true);
  }

  async function confirmBuyFreeze() {
    if (freezePinInput.length !== 6) return;
    setShowFreezePinModal(false);
    setBuyingFreeze(true);
    try {
      const { data, error } = await supabase.functions.invoke("buy-streak-freeze", {
        body: { visitorId, pin: freezePinInput },
      });
      if (error || data?.error) {
        if (data?.needPin) {
          toast({ title: "PIN Saldo Diperlukan", description: "Buat PIN saldo dulu di tab Plus → Saldo Saya untuk bisa beli pelindung.", variant: "destructive" });
        } else {
          toast({ title: "Gagal", description: data?.error || "Gagal membeli pelindung", variant: "destructive" });
        }
      } else {
        toast({ title: "🛡️ Berhasil!", description: `Pelindung streak ditambahkan! Total: ${data.freeze_count}` });
        fetchStreak();
      }
    } catch {
      toast({ title: "Error", description: "Koneksi gagal", variant: "destructive" });
    } finally {
      setBuyingFreeze(false);
      setFreezePinInput("");
    }
  }

  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;
  const totalClaims = streak?.total_claims || 0;

  // Visual tier: a broken streak (not yet reclaimed) visually shows its last value until claim.
  const tierInfo = getStreakTier(currentStreak);
  const nextTier = getNextStreakTier(currentStreak);
  const mp = getMilestoneProgress(currentStreak);
  const nextMilestone = mp.next ?? MILESTONES[MILESTONES.length - 1];
  const prevMilestone = mp.prev;
  const progress = mp.percent;

  // 7-day calendar
  const days: any[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayName = d.toLocaleDateString("id-ID", { weekday: "short" });
    const isClaimedDay = streak && (
      i === 0 ? isToday(streak.last_claim_date) : currentStreak > i && !streakBroken
    );
    days.push({ date: dateStr, dayName, day: d.getDate(), isClaimed: !!isClaimedDay, isToday: i === 0 });
  }

  return (
    <div className="space-y-4 p-4 pb-24 overflow-x-hidden">
      <BanBanner />
      <BanLock fallbackLabel="streak harian">
      {/* Hero Streak Card — premium progression stage */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="streak-stage relative overflow-hidden rounded-3xl border"
        style={{
          borderColor: `${tierInfo.color}55`,
          background: `radial-gradient(120% 70% at 50% 18%, ${tierInfo.color}38 0%, ${tierInfo.bg} 55%, #05050a 100%)`,
          boxShadow: `0 20px 50px -20px ${tierInfo.color}66, inset 0 1px 0 rgba(255,255,255,.08)`,
        }}
      >
        {/* glass sheen */}
        <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.07), transparent)" }} />
        {justClaimed && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0.45, 0] }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 30%, ${tierInfo.accent}88, transparent 60%)` }}
          />
        )}

        <div className="relative z-10 p-4 sm:p-6">
          {/* Tier header */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border min-w-0"
              style={{ borderColor: `${tierInfo.color}77`, background: `${tierInfo.color}22`, color: tierInfo.accent }}
            >
              <span>{tierInfo.emoji}</span>
              <span className="truncate">Lv {tierInfo.level} · {tierInfo.name}</span>
            </span>
            <span className="stk-muted text-[10px] font-bold uppercase tracking-widest shrink-0">Current Streak</span>
          </div>

          {/* Flame + Counter */}
          <div className="flex flex-col items-center">
            <motion.div animate={justClaimed ? { scale: [1, 1.18, 1] } : {}} transition={{ duration: 0.7 }}>
              <StreakFlame streak={currentStreak} size={176} burstKey={burstKey} priority />
            </motion.div>
            <div className="relative -mt-3 flex items-end gap-2">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={currentStreak}
                  initial={{ y: 24, scale: 0.6, opacity: 0 }}
                  animate={{ y: 0, scale: 1, opacity: 1 }}
                  exit={{ y: -24, opacity: 0 }}
                  transition={{ type: "spring", damping: 14 }}
                  className="text-6xl font-black tabular-nums leading-none"
                  style={{ color: "#fff", textShadow: `0 0 22px ${tierInfo.color}, 0 4px 18px rgba(0,0,0,.6)` }}
                >
                  {currentStreak}
                </motion.span>
              </AnimatePresence>
              <span className="text-sm font-black tracking-widest mb-1.5" style={{ color: tierInfo.accent }}>HARI</span>
            </div>
            {streakBroken && canClaim && streak && (
              <p className="text-[11px] font-bold mt-1" style={{ color: "#fca5a5" }}>Streak terputus — klaim untuk mulai lagi</p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {[
              { icon: <Trophy className="w-4 h-4" style={{ color: "#facc15" }} />, val: `${longestStreak}`, unit: "hari", label: "Best Streak" },
              { icon: <Star className="w-4 h-4" style={{ color: tierInfo.accent }} />, val: `${totalClaims}`, unit: "x", label: "Total Claim" },
              { icon: <Target className="w-4 h-4" style={{ color: tierInfo.color }} />, val: mp.next ? `${mp.next.days}` : "MAX", unit: mp.next ? "hari" : "", label: "Next Milestone" },
              { icon: <Sparkles className="w-4 h-4" style={{ color: "#c084fc" }} />, val: `${streak?.total_bonus_points || 0}`, unit: "poin", label: "Bonus" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.07 }}
                className="rounded-xl p-2.5 border min-w-0"
                style={{ background: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.08)", backdropFilter: "blur(6px)" }}
              >
                <div className="flex items-center gap-1.5 stk-muted text-[9px] font-bold uppercase tracking-wide">
                  {s.icon}<span className="truncate">{s.label}</span>
                </div>
                <p className="text-lg font-black tabular-nums mt-0.5 truncate">
                  {s.val} <span className="text-[10px] stk-muted font-bold">{s.unit}</span>
                </p>
              </motion.div>
            ))}
          </div>

          {/* Progress with milestone markers */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] mb-1.5 gap-2">
              <span className="stk-muted font-bold truncate">{prevMilestone ? `${prevMilestone.emoji} ${prevMilestone.days}h · ${prevMilestone.reward}` : "Mulai"}</span>
              <span className="font-black truncate" style={{ color: tierInfo.accent }}>{mp.next ? `${mp.next.emoji} ${mp.next.days}h · ${mp.next.reward}` : "Tier Maksimal"}</span>
            </div>
            <div className="relative h-3 rounded-full" style={{ background: "rgba(255,255,255,.08)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
                style={{ background: `linear-gradient(90deg, ${tierInfo.color}, ${tierInfo.accent})`, boxShadow: `0 0 12px ${tierInfo.color}` }}
              >
                <span className="absolute inset-y-0 w-1/3 stk-shine" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent)" }} />
              </motion.div>
              {[25, 50, 75].map(p => (
                <span key={p} className="absolute top-1/2 -translate-y-1/2 w-0.5 h-1.5 rounded-full" style={{ left: `${p}%`, background: "rgba(255,255,255,.25)" }} />
              ))}
              <motion.span
                initial={{ left: 0 }}
                animate={{ left: `calc(${progress}% - 7px)` }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2"
                style={{ background: "#fff", borderColor: tierInfo.color, boxShadow: `0 0 10px ${tierInfo.accent}` }}
              />
            </div>
            <p className="text-[10px] stk-muted mt-1.5 text-center">
              {mp.next ? <>{mp.remaining} hari lagi ke <span className="font-black text-[color:inherit]" style={{ color: "#fff" }}>{mp.next.reward}</span></> : "Semua milestone tercapai!"}
            </p>
          </div>

          {/* Next tier preview */}
          {nextTier && (
            <div className="mt-3 flex items-center gap-3 rounded-xl p-2.5 border" style={{ background: `${nextTier.color}14`, borderColor: `${nextTier.color}40` }}>
              <StreakFlame streak={nextTier.minDays} tier={nextTier} size={44} mini gray={false} />
              <div className="flex-1 min-w-0">
                <p className="stk-muted text-[9px] font-bold uppercase tracking-widest">Tier Berikutnya</p>
                <p className="text-sm font-black truncate" style={{ color: nextTier.accent }}>{nextTier.emoji} {nextTier.name}</p>
              </div>
              <span className="text-[11px] font-black tabular-nums shrink-0">{Math.max(0, nextTier.minDays - currentStreak)} hari</span>
            </div>
          )}

          {/* 7-day strip */}
          <div className="grid grid-cols-7 gap-1 mt-4">
            {days.map((d, i) => (
              <div key={i} className="flex flex-col items-center min-w-0">
                <span className="text-[9px] stk-muted font-bold">{d.dayName}</span>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black mt-0.5 border ${d.isToday && canClaim ? "stk-pulse" : ""}`}
                  style={
                    d.isClaimed
                      ? { background: `radial-gradient(circle, ${tierInfo.color}55, ${tierInfo.bg})`, borderColor: `${tierInfo.color}aa`, boxShadow: `0 0 10px ${tierInfo.color}66` }
                      : d.isToday
                        ? { borderColor: tierInfo.color, borderStyle: "dashed", color: tierInfo.accent }
                        : { borderColor: "rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.45)" }
                  }
                >
                  {d.isClaimed ? <StreakFlame streak={currentStreak} size={30} mini /> : d.day}
                </div>
              </div>
            ))}
          </div>

          {/* Countdown (reset 00:00 WIB) */}
          <div className="mt-4 rounded-xl p-2.5 text-center border" style={{ background: "rgba(0,0,0,.25)", borderColor: "rgba(255,255,255,.08)" }}>
            <p className="text-[10px] stk-muted font-bold">{canClaim ? "Sisa waktu klaim hari ini" : "Klaim berikutnya dalam"}</p>
            <p className="text-2xl font-black font-mono tracking-wider tabular-nums">{countdown}</p>
          </div>

          {/* Claim Button */}
          <motion.div whileTap={canClaim && !claiming ? { scale: 0.96 } : undefined} className="mt-3">
            <button
              type="button"
              onClick={claimStreak}
              disabled={!canClaim || claiming}
              className={`relative w-full h-14 rounded-2xl font-black text-sm tracking-wide overflow-hidden transition-all disabled:cursor-not-allowed ${canClaim && !claiming ? "stk-pulse hover:brightness-110" : ""}`}
              style={
                canClaim
                  ? { background: `linear-gradient(90deg, ${tierInfo.color}, ${tierInfo.accent}, ${tierInfo.color})`, color: tierInfo.bg, boxShadow: `0 10px 30px -8px ${tierInfo.color}`, ["--stk-c" as any]: `${tierInfo.color}88` }
                  : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }
              }
            >
              {canClaim && !claiming && (
                <span className="absolute inset-y-0 w-1/3 stk-shine pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)" }} />
              )}
              <span className="relative flex items-center justify-center gap-2">
                {claiming ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> MENGKLAIM...</>
                ) : !canClaim ? (
                  <motion.span key="done" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
                    <Check className="w-5 h-5" strokeWidth={3} /> SUDAH DIKLAIM
                  </motion.span>
                ) : streakBroken ? (
                  <><Flame className="w-5 h-5" strokeWidth={2.5} /> MULAI STREAK BARU</>
                ) : (
                  <><Flame className="w-5 h-5" strokeWidth={2.5} /> KLAIM STREAK HARI INI</>
                )}
              </span>
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* Claim sequence overlay */}
      <AnimatePresence>
        {claimFx && (
          <motion.div
            key={claimFx.key}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="streak-stage fixed inset-0 z-[99] flex flex-col items-center justify-center pointer-events-none overflow-hidden"
            style={{ background: `radial-gradient(circle at 50% 45%, ${claimFx.tier.color}33 0%, rgba(0,0,0,.82) 60%)` }}
          >
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: [0.5, 1.25, 1.1] }} transition={{ duration: 0.9 }}>
              <StreakFlame streak={claimFx.to} tier={claimFx.tier} size={200} burstKey={claimFx.key} priority />
            </motion.div>
            <motion.p
              initial={{ y: 10, opacity: 0, scale: 0.6 }}
              animate={{ y: [10, 0, -30], opacity: [0, 1, 0], scale: [0.6, 1.2, 1] }}
              transition={{ duration: 1.3, delay: 0.35, times: [0, 0.3, 1] }}
              className="absolute text-2xl font-black tracking-widest"
              style={{ color: claimFx.tier.accent, textShadow: `0 0 16px ${claimFx.tier.color}`, top: "34%" }}
            >
              {claimFx.to > claimFx.from ? "+1 DAY" : "STREAK BARU"}
            </motion.p>
            <div className="relative h-20 -mt-2 flex items-center justify-center">
              <motion.span
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -30, scale: 0.7 }}
                transition={{ delay: 0.7, duration: 0.4 }}
                className="absolute text-6xl font-black tabular-nums stk-muted"
              >
                🔥 {claimFx.from}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 30, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: [0.6, 1.35, 1] }}
                transition={{ delay: 0.95, duration: 0.6 }}
                className="absolute text-7xl font-black tabular-nums"
                style={{ textShadow: `0 0 26px ${claimFx.tier.color}, 0 0 60px ${claimFx.tier.color}88` }}
              >
                🔥 {claimFx.to}
              </motion.span>
            </div>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
              className="mt-2 text-xs font-black uppercase tracking-[0.3em]"
              style={{ color: claimFx.tier.accent }}
            >
              {claimFx.tier.emoji} {claimFx.tier.name}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>


      {/* NEW: Leaderboard Top 10 */}
      <StreakLeaderboard />

      {/* NEW: Achievement Badges */}
      <AchievementBadges
        unlockedIds={streak?.achievements || []}
        newlyUnlocked={newAchievement}
        onCloseNewly={() => setNewAchievement(null)}
      />

      {/* NEW: Streak Freeze Card */}
      <StreakFreezeCard
        freezeCount={streak?.freeze_count || 0}
        onBuy={handleBuyFreeze}
        buying={buyingFreeze}
        isStreakAtRisk={!!streak && !canClaim === false && (streak.freeze_count || 0) > 0}
      />

      {/* Milestones - Horizontal Fire Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card-strong rounded-2xl border p-4 space-y-3"
      >
        <h4 className="text-sm font-bold flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" /> Milestone Streak
          <motion.span
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="inline-flex"
          ><Sparkles className="w-4 h-4 icon-3d-sparkles" strokeWidth={2.5} /></motion.span>
        </h4>

        {/* Horizontal fire row like reference image */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center justify-start gap-0 min-w-max px-2">
            {MILESTONES.map((m, i) => {
              const achieved = currentStreak >= m.days;
              const isNext = !achieved && (i === 0 || currentStreak >= MILESTONES[i - 1].days);

              const mTier = getStreakTier(m.days);

              return (
                <div key={m.days} className="flex items-center">
                  {i > 0 && (
                    <div
                      className="w-5 h-[3px] rounded-full mx-0.5"
                      style={{ background: achieved ? `linear-gradient(90deg, ${getStreakTier(MILESTONES[i - 1].days).color}, ${mTier.color})` : "hsl(var(--muted-foreground) / 0.2)" }}
                    />
                  )}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="flex flex-col items-center"
                  >
                    <div
                      className={`relative flex items-center justify-center rounded-full ${isNext ? "stk-pulse" : ""}`}
                      style={{ width: 48, height: 48, background: achieved ? `radial-gradient(circle, ${mTier.color}33, transparent 70%)` : undefined, ["--stk-c" as any]: `${mTier.color}88` }}
                      title={`${m.label} · ${mTier.name}`}
                    >
                      <StreakFlame streak={m.days} tier={mTier} size={46} mini gray={!achieved} />
                    </div>
                    <span className={`text-[10px] font-bold mt-0.5 ${
                      achieved ? "text-foreground" : isNext ? "text-muted-foreground" : "text-muted-foreground/40"
                    }`}>
                      {m.days}d
                    </span>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed milestone list */}
        <div className="space-y-2">
          {MILESTONES.map((m, i) => {
            const achieved = currentStreak >= m.days;
            return (
              <motion.div
                key={m.days}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className={`flex items-center gap-3 rounded-xl p-2.5 transition-all ${
                  achieved ? "relative overflow-hidden" : "bg-muted/30 opacity-50"
                }`}
                style={achieved ? {
                  background: `linear-gradient(to right, hsl(var(--card)), hsl(var(--card)))`,
                  borderColor: 'hsl(var(--border))',
                } : undefined}
              >
                {achieved && <ShimmerEffect />}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  achieved ? `bg-gradient-to-br ${getTierColor(m.tier)} shadow-md` : "bg-muted"
                }`}>
                  {achieved ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground">{m.days}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                  <p className={`font-bold text-xs ${achieved ? "text-foreground" : "text-muted-foreground"}`}>{m.label} • {m.reward}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Auto-Klaim Streak Plans */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card-strong rounded-2xl border p-4 space-y-3"
      >
        <h4 className="text-sm font-bold flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" /> Paket Auto-Klaim Streak
        </h4>
        <p className="text-[10px] text-muted-foreground">
          Beli paket untuk klaim otomatis setiap tengah malam, streak tidak akan putus walau kamu tidak klik!
        </p>

        {activeSub && (() => {
          const expiresDate = new Date(activeSub.expires_at);
          const now = new Date();
          const remainingMs = expiresDate.getTime() - now.getTime();
          const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
          return (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-sm">
              <p className="font-bold text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Paket Aktif: {activeSub.plan_name}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Berlaku sampai: {expiresDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p className="text-xs font-bold text-green-700 mt-0.5">
                ⏳ Sisa {remainingDays} hari lagi
              </p>
            </div>
          );
        })()}

        {/* Voucher Input */}
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Kode Voucher Diskon"
            value={voucherCode}
            onChange={e => { setVoucherCode(e.target.value.toUpperCase()); if (voucherApplied) removeVoucher(); }}
            className="h-9 text-xs flex-1"
            disabled={voucherApplied}
          />
          {voucherApplied ? (
            <Button variant="outline" size="sm" className="h-9 text-xs text-destructive" onClick={removeVoucher}>
              <X className="w-3 h-3 mr-1" /> Hapus
            </Button>
          ) : (
            <Button size="sm" className="h-9 text-xs" onClick={applyVoucher} disabled={voucherLoading || !voucherCode.trim()}>
              {voucherLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Pakai"}
            </Button>
          )}
        </div>
        {voucherError && <p className="text-[10px] text-destructive font-medium">{voucherError}</p>}
        {voucherApplied && <p className="text-[10px] text-green-600 font-bold">✅ Diskon Rp{voucherDiscount.toLocaleString("id-ID")} aktif!</p>}

        {flashSaleEnd && new Date(flashSaleEnd) > new Date() && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
            <div>
              <p className="text-[10px] font-bold text-yellow-600 flex items-center gap-1"><Flame className="w-3 h-3 icon-3d-flame" strokeWidth={2.5} /> Flash Sale Aktif{flashSaleLabel ? ` - ${flashSaleLabel}` : ""}!</p>
              <p className="text-[9px] text-muted-foreground">Harga spesial berlaku sampai {new Date(flashSaleEnd).toLocaleString("id-ID")}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {AUTO_CLAIM_PLANS.map((plan: any) => {
            const hasPromo = plan.originalPrice && plan.originalPrice !== plan.price;
            const discounted = voucherDiscount > 0 ? Math.max(0, plan.price - voucherDiscount) : null;
            return (
              <Button
                key={plan.days}
                variant="outline"
                className="h-auto py-2.5 px-3 flex flex-col items-center gap-0.5 text-xs hover:border-primary/50 relative"
                disabled={buyingPlan === plan.days}
                onClick={() => handlePlanClick(plan.days)}
              >
                {buyingPlan === plan.days ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span className="font-extrabold text-sm">{plan.name}</span>
                    {hasPromo && !discounted && (
                      <div className="flex flex-col items-center">
                        <span className="text-muted-foreground text-[10px] line-through">Rp{plan.originalPrice.toLocaleString("id-ID")}</span>
                        <span className="text-green-600 font-bold">Rp{plan.price.toLocaleString("id-ID")}</span>
                      </div>
                    )}
                    {discounted !== null ? (
                      <div className="flex flex-col items-center">
                        <span className="text-muted-foreground text-[10px] line-through">Rp{(hasPromo ? plan.originalPrice : plan.price).toLocaleString("id-ID")}</span>
                        <span className="text-green-600 font-bold">Rp{discounted.toLocaleString("id-ID")}</span>
                      </div>
                    ) : !hasPromo && (
                      <span className="text-primary font-bold">Rp{plan.price.toLocaleString("id-ID")}</span>
                    )}
                  </>
                )}
              </Button>
            );
          })}
        </div>
      </motion.div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[94] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowConfirm(null)}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary" /> Konfirmasi Pembelian</h3>
              <button onClick={() => setShowConfirm(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-center space-y-1">
              <p className="text-sm text-muted-foreground">Paket Auto-Klaim</p>
              <p className="text-xl font-extrabold">{showConfirm.name}</p>
              {showConfirm.discountedPrice !== undefined ? (
                <div className="space-y-0.5">
                  <p className="text-sm text-muted-foreground line-through">Rp{showConfirm.price.toLocaleString("id-ID")}</p>
                  <p className="text-lg font-bold text-green-600">Rp{showConfirm.discountedPrice.toLocaleString("id-ID")}</p>
                </div>
              ) : (
                <p className="text-lg font-bold text-primary">Rp{showConfirm.price.toLocaleString("id-ID")}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">Apakah kamu yakin ingin membeli paket ini? Saldo akan dipotong otomatis.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(null)}>
                Tidak
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold" onClick={confirmPurchase}>
                Ya, Beli
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal for Streak */}
      {showPinForStreak && (
        <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPinForStreak(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Masukkan PIN</h3>
              <button onClick={() => setShowPinForStreak(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Masukkan PIN untuk konfirmasi pembelian paket streak</p>
            <Input type="password" inputMode="numeric" maxLength={6} placeholder="PIN" value={streakPinInput}
              onChange={e => setStreakPinInput(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.3em] font-bold"
              onKeyDown={e => { if (e.key === "Enter") confirmStreakPin(); }}
              autoFocus />
            <Button className="w-full h-11 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold gap-2"
              onClick={confirmStreakPin} disabled={streakPinInput.length !== 6}>
              <Lock className="w-4 h-4" /> Konfirmasi
            </Button>
          </div>
        </div>
      )}

      {/* Milestone cinematic (shared CelebrationOverlay, tier-specific) */}
      <CelebrationOverlay
        show={!!showMilestone}
        tier={showMilestone ? getStreakTier(showMilestone.days) : undefined}
        days={showMilestone?.days}
        title={showMilestone ? `${showMilestone.emoji} ${showMilestone.reward}` : undefined}
        onComplete={closeMilestone}
      />

      {/* Mystery Reward Popup */}
      <MysteryRewardPopup reward={mysteryReward} onClose={closeMysteryReward} />

      {/* Beli Streak Freeze: harga, sumber saldo & PIN diproses server */}
      <FreezePurchaseModal
        visitorId={visitorId}
        open={showFreezePinModal}
        onClose={() => setShowFreezePinModal(false)}
        onDone={(r) => { toast({ title: "🛡️ Berhasil!", description: `Pelindung streak ditambahkan! Total: ${r.freeze_count}${r.source_label ? ` · dibayar dari ${r.source_label}` : ""}` }); fetchStreak(); }}
        onError={(msg) => toast({ title: "Gagal", description: msg, variant: "destructive" })}
      />
      </BanLock>
    </div>
  );
}
