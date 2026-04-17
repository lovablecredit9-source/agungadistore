import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Trophy, Star, Gift, Zap, ShoppingCart, Loader2, Lock, X, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { rollMysteryReward, checkNewAchievements, type MysteryReward, type Achievement } from "./streak/streakRewards";
import MysteryRewardPopup from "./streak/MysteryRewardPopup";
import StreakLeaderboard from "./streak/StreakLeaderboard";
import AchievementBadges from "./streak/AchievementBadges";
import StreakFreezeCard from "./streak/StreakFreezeCard";

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

const MILESTONES = [
  { days: 3, label: "3 Hari", reward: "Pemula", tier: 1, emoji: "🔥" },
  { days: 7, label: "7 Hari", reward: "Rajin", tier: 1, emoji: "⚡" },
  { days: 14, label: "14 Hari", reward: "Konsisten", tier: 2, emoji: "💎" },
  { days: 30, label: "30 Hari", reward: "Master", tier: 2, emoji: "👑" },
  { days: 60, label: "60 Hari", reward: "Legend", tier: 3, emoji: "🏆" },
  { days: 100, label: "100 Hari", reward: "Diamond", tier: 3, emoji: "💠" },
  { days: 120, label: "120 Hari", reward: "Mythic", tier: 4, emoji: "🐉" },
  { days: 150, label: "150 Hari", reward: "Supreme", tier: 4, emoji: "⭐" },
  { days: 365, label: "1 Tahun", reward: "Immortal", tier: 5, emoji: "🌟" },
];

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

function getTierGlow(tier: number) {
  switch (tier) {
    case 1: return "shadow-orange-500/40";
    case 2: return "shadow-blue-500/40";
    case 3: return "shadow-purple-500/40";
    case 4: return "shadow-rose-500/40";
    case 5: return "shadow-yellow-500/40";
    default: return "shadow-orange-500/40";
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

// Midnight countdown
function useCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    function calc() {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
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

// SVG Emoji-style Fire Component 🔥
function EmojiFireSVG({ width = 36, height = 44, animated = true, gray = false }: { width?: number; height?: number; animated?: boolean; gray?: boolean }) {
  const Wrapper = animated ? motion.svg : 'svg';
  const animProps = animated ? {
    animate: { scaleY: [1, 1.06, 0.96, 1.04, 1], scaleX: [1, 0.97, 1.04, 0.98, 1] },
    transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const },
  } : {};

  if (gray) {
    return (
      <svg viewBox="0 0 36 36" width={width} height={height} style={{ opacity: 0.4 }}>
        <path d="M17.56 1.56c-.28-.45-.88-.45-1.12 0C14.86 4.36 6 18.56 6 24c0 6.63 4.92 12 11 12h2c6.08 0 11-5.37 11-12 0-5.44-8.86-19.64-10.44-22.44z" fill="#9ca3af"/>
        <path d="M18 8c-.2-.32-.64-.32-.82 0C16.08 10.08 10 19.6 10 24c0 4.42 3.36 8 7.5 8h1c4.14 0 7.5-3.58 7.5-8 0-4.4-6.08-13.92-7.18-16z" fill="#d1d5db"/>
        <ellipse cx="18" cy="28" rx="4" ry="5" fill="#e5e7eb"/>
      </svg>
    );
  }

  return (
    <Wrapper viewBox="0 0 36 36" width={width} height={height} {...animProps}
      style={{ filter: "drop-shadow(0 2px 4px rgba(255,100,0,0.3))" }}>
      {/* Outer flame - deep orange/red */}
      <path d="M17.56 1.56c-.28-.45-.88-.45-1.12 0C14.86 4.36 6 18.56 6 24c0 6.63 4.92 12 11 12h2c6.08 0 11-5.37 11-12 0-5.44-8.86-19.64-10.44-22.44z" fill="#F4900C"/>
      {/* Left highlight */}
      <path d="M18.5 3c-1 1.6-9.5 15.8-9.5 21 0 5.52 3.8 10 8.5 10.5C12.2 34 8 29.8 8 24.5 8 19 16.2 5.8 18.5 3z" fill="#FFAC33" opacity="0.7"/>
      {/* Mid flame - orange */}
      <path d="M18 8c-.2-.32-.64-.32-.82 0C16.08 10.08 10 19.6 10 24c0 4.42 3.36 8 7.5 8h1c4.14 0 7.5-3.58 7.5-8 0-4.4-6.08-13.92-7.18-16z" fill="#FFCC4D"/>
      {/* Inner core - yellow/white */}
      <ellipse cx="18" cy="28" rx="4" ry="5.5" fill="#FFEE93"/>
      <ellipse cx="18" cy="29" rx="2.5" ry="3.5" fill="#FFF4C8" opacity="0.8"/>
    </Wrapper>
  );
}

// Confetti particles for milestone popup
function ConfettiEffect() {
  const particles = Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 2,
    size: 4 + Math.random() * 8,
    color: ["#ff4500", "#ffd700", "#ff6b35", "#3b82f6", "#a855f7", "#ec4899", "#22c55e", "#06b6d4"][i % 8],
    rotation: Math.random() * 360,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: "-5%",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.id % 3 === 0 ? "50%" : p.id % 3 === 1 ? "2px" : "0",
            rotate: `${p.rotation}deg`,
          }}
          initial={{ y: 0, opacity: 1 }}
          animate={{
            y: [0, 500],
            x: [0, (p.id % 2 === 0 ? 30 : -30) * Math.random()],
            opacity: [1, 1, 0],
            rotate: [p.rotation, p.rotation + 360 * (p.id % 2 === 0 ? 1 : -1)],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

// Shimmer overlay for achieved milestones
function ShimmerEffect() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 55%, transparent 60%)",
          backgroundSize: "200% 100%",
        }}
        animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
      />
    </motion.div>
  );
}

// Floating sparkles around fire
function FloatingSparkles({ count = 6, tier = 1 }: { count?: number; tier?: number }) {
  const colors: Record<number, string> = { 1: "#ff6b35", 2: "#6366f1", 3: "#ec4899", 4: "#e11d48", 5: "#fbbf24" };
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: colors[tier] || colors[1],
            left: `${15 + Math.random() * 70}%`,
            top: `${10 + Math.random() * 60}%`,
            boxShadow: `0 0 6px ${colors[tier] || colors[1]}`,
          }}
          animate={{
            y: [0, -15, 0],
            x: [0, i % 2 === 0 ? 8 : -8, 0],
            opacity: [0, 1, 0],
            scale: [0, 1.2, 0],
          }}
          transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
        />
      ))}
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
  const [showMilestone, setShowMilestone] = useState<typeof MILESTONES[0] | null>(null);
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

  useEffect(() => {
    fetchStreakPackages();
  }, [fetchStreakPackages]);

  useEffect(() => {
    setStreak(null);
    setActiveSub(null);
    setPendingPlanDays(null);
    setShowConfirm(null);
    setShowPinForStreak(false);
    setShowFreezePinModal(false);
    setStreakPinInput("");
    setFreezePinInput("");
    fetchStreak();
    fetchSubscription();
  }, [visitorId, fetchStreak, fetchSubscription]);

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
    if (!pendingPlanDays || streakPinInput.length < 4) return;
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
        setStreak(updatedStreak);
        setJustClaimed(true);

        // Show mystery reward popup
        setTimeout(() => setMysteryReward(reward), 1200);

        // Check milestone
        checkMilestone(updatedStreak.current_streak);

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

  function checkMilestone(days: number) {
    const milestone = MILESTONES.find(m => m.days === days);
    if (milestone) { setShowMilestone(milestone); setTimeout(() => setShowMilestone(null), 4000); }
  }

  // Buy streak freeze
  function handleBuyFreeze() {
    setShowFreezePinModal(true);
  }

  async function confirmBuyFreeze() {
    if (freezePinInput.length < 4) return;
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

  const currentTier = MILESTONES.filter(m => m.days <= currentStreak).pop()?.tier || 1;
  const nextMilestone = MILESTONES.find(m => m.days > currentStreak) || MILESTONES[MILESTONES.length - 1];
  const prevMilestone = [...MILESTONES].reverse().find(m => m.days <= currentStreak);
  const progressStart = prevMilestone ? prevMilestone.days : 0;
  const progressEnd = nextMilestone.days;
  const progress = Math.min(100, ((currentStreak - progressStart) / (progressEnd - progressStart)) * 100);
  const fireIntensity = currentStreak >= 100 ? 3 : currentStreak >= 30 ? 2 : 1;

  // 7-day calendar
  const days = [];
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
    <div className="space-y-4 p-4 pb-24">
      {/* Hero Streak Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border glass-card-strong glow-border"
      >
        {/* Animated BG glow */}
        <div className={`absolute inset-0 bg-gradient-to-br ${getTierColor(currentTier)} opacity-[0.06]`} />
        {justClaimed && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 1.5 }}
            className={`absolute inset-0 bg-gradient-to-r ${getTierColor(currentTier)}`}
          />
        )}

        <div className="relative z-10 p-5">
          {/* Fire + Counter */}
          <div className="flex flex-col items-center mb-4">
            <motion.div
              animate={justClaimed ? { scale: [1, 1.4, 1] } : {}}
              transition={{ duration: 0.5 }}
            >
              <EmojiFireSVG width={currentStreak >= 60 ? 56 : currentStreak >= 14 ? 48 : 40} height={currentStreak >= 60 ? 68 : currentStreak >= 14 ? 58 : 48} />
            </motion.div>
            <motion.p
              key={currentStreak}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-5xl font-black mt-2 bg-gradient-to-r ${getTierColor(currentTier)} bg-clip-text text-transparent`}
            >
              {currentStreak}
            </motion.p>
            <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase">Hari Streak</p>
          </div>

          {/* 7-day Calendar */}
          <div className="grid grid-cols-7 gap-1.5 mb-4">
            {days.map((d, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-col items-center"
              >
                <span className="text-[9px] text-muted-foreground font-medium">{d.dayName}</span>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 transition-all ${
                  d.isClaimed
                    ? `bg-gradient-to-br ${getTierColor(currentTier)} text-white shadow-lg ${getTierGlow(currentTier)}`
                    : d.isToday
                      ? canClaim ? "border-2 border-dashed border-orange-500 text-orange-500" : "bg-orange-500/20 text-orange-500"
                      : "bg-muted/50 text-muted-foreground"
                }`}>
                  {d.isClaimed ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : d.day}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Progress to milestone */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[10px] mb-1.5">
              <span className="text-muted-foreground font-medium">{prevMilestone ? prevMilestone.reward : "Mulai"}</span>
              <span className="font-bold text-foreground">{nextMilestone.label} • {nextMilestone.reward}</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full bg-gradient-to-r ${getTierColor(currentTier)} rounded-full`}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {progressEnd - currentStreak} hari lagi ke <span className="font-bold">{nextMilestone.reward}</span>
            </p>
          </div>

          {/* Midnight Timer */}
          {!canClaim && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-muted/50 rounded-xl p-3 mb-3 text-center"
            >
              <p className="text-[10px] text-muted-foreground mb-1">Klaim berikutnya saat tengah malam</p>
              <p className="text-2xl font-black font-mono tracking-wider text-foreground">{countdown}</p>
            </motion.div>
          )}

          {/* Claim Button */}
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              onClick={claimStreak}
              disabled={!canClaim || claiming}
              className={`w-full h-12 font-bold gap-2 text-sm rounded-xl transition-all ${
                canClaim
                  ? `bg-gradient-to-r ${getTierColor(currentTier)} text-white shadow-xl ${getTierGlow(currentTier)} hover:shadow-2xl hover:scale-[1.01]`
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {claiming ? (
                <><Zap className="w-4 h-4 animate-spin" /> Mengklaim...</>
              ) : !canClaim ? (
                <><Check className="w-4 h-4" /> Sudah Diklaim Hari Ini</>
              ) : streakBroken ? (
                <span className="flex items-center gap-2">🔥 Mulai Streak Baru!</span>
              ) : (
                <span className="flex items-center gap-2">🔥 Klaim Hari Ini!</span>
              )}
            </Button>
          </motion.div>

          {streakBroken && canClaim && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-[10px] text-destructive text-center mt-2 font-medium"
            >
              Streak terputus! Klaim sekarang untuk mulai lagi.
            </motion.p>
          )}

          {/* Stats - 4 columns now with bonus points */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { icon: <EmojiFireSVG width={20} height={24} />, val: currentStreak, label: "Streak" },
              { icon: <Trophy className="w-4 h-4 text-yellow-500" />, val: longestStreak, label: "Terbaik" },
              { icon: <Star className="w-4 h-4 text-primary" />, val: totalClaims, label: "Total" },
              { icon: <Sparkles className="w-4 h-4 text-purple-500" />, val: streak?.total_bonus_points || 0, label: "Bonus" },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="bg-muted/40 rounded-xl p-2 text-center"
              >
                <div className="flex justify-center mb-1">{s.icon}</div>
                <p className="text-sm font-extrabold">{s.val}</p>
                <p className="text-[8px] text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

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
          >✨</motion.span>
        </h4>

        {/* Horizontal fire row like reference image */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center justify-start gap-0 min-w-max px-2">
            {MILESTONES.map((m, i) => {
              const achieved = currentStreak >= m.days;
              const isNext = !achieved && (i === 0 || currentStreak >= MILESTONES[i - 1].days);

              // Tier-specific SVG colors
              const tierSVGColors: Record<number, { outer: string; highlight: string; mid: string; inner: string; core: string; glow: string }> = {
                1: { outer: "#F4900C", highlight: "#FFAC33", mid: "#FFCC4D", inner: "#FFEE93", core: "#FFF4C8", glow: "rgba(255,149,0,0.35)" },
                2: { outer: "#3B82F6", highlight: "#60A5FA", mid: "#93C5FD", inner: "#BFDBFE", core: "#DBEAFE", glow: "rgba(59,130,246,0.35)" },
                3: { outer: "#A855F7", highlight: "#C084FC", mid: "#D8B4FE", inner: "#E9D5FF", core: "#F3E8FF", glow: "rgba(168,85,247,0.35)" },
                4: { outer: "#EF4444", highlight: "#F87171", mid: "#FCA5A5", inner: "#FECACA", core: "#FEE2E2", glow: "rgba(239,68,68,0.35)" },
                5: { outer: "#F59E0B", highlight: "#FBBF24", mid: "#FDE68A", inner: "#FEF3C7", core: "#FFFBEB", glow: "rgba(245,158,11,0.35)" },
              };
              const tc = tierSVGColors[m.tier] || tierSVGColors[1];

              return (
                <div key={m.days} className="flex items-center">
                  {i > 0 && (
                    <div className={`w-5 h-[3px] rounded-full mx-0.5 ${
                      achieved ? `bg-gradient-to-r ${getTierColor(m.tier)}` : "bg-muted-foreground/20"
                    }`} />
                  )}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="flex flex-col items-center"
                  >
                    <div className="relative flex items-center justify-center" style={{ width: 44, height: 50 }}>
                      {achieved ? (
                        <>
                          <motion.div
                            className="absolute rounded-full"
                            style={{ width: 36, height: 36, background: `radial-gradient(circle, ${tc.glow} 0%, transparent 70%)` }}
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.9, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <motion.svg
                            viewBox="0 0 36 36" width={34} height={40}
                            animate={{ scaleY: [1, 1.06, 0.96, 1.04, 1], scaleX: [1, 0.97, 1.04, 0.98, 1] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                            style={{ filter: `drop-shadow(0 2px 5px ${tc.glow})` }}
                          >
                            <path d="M17.56 1.56c-.28-.45-.88-.45-1.12 0C14.86 4.36 6 18.56 6 24c0 6.63 4.92 12 11 12h2c6.08 0 11-5.37 11-12 0-5.44-8.86-19.64-10.44-22.44z" fill={tc.outer}/>
                            <path d="M18.5 3c-1 1.6-9.5 15.8-9.5 21 0 5.52 3.8 10 8.5 10.5C12.2 34 8 29.8 8 24.5 8 19 16.2 5.8 18.5 3z" fill={tc.highlight} opacity="0.7"/>
                            <path d="M18 8c-.2-.32-.64-.32-.82 0C16.08 10.08 10 19.6 10 24c0 4.42 3.36 8 7.5 8h1c4.14 0 7.5-3.58 7.5-8 0-4.4-6.08-13.92-7.18-16z" fill={tc.mid}/>
                            <ellipse cx="18" cy="28" rx="4" ry="5.5" fill={tc.inner}/>
                            <ellipse cx="18" cy="29" rx="2.5" ry="3.5" fill={tc.core} opacity="0.8"/>
                          </motion.svg>
                          {/* Spark particles for achieved */}
                          {[0, 1].map(j => (
                            <motion.div
                              key={j}
                              className="absolute w-1 h-1 rounded-full"
                              style={{ backgroundColor: tc.highlight, bottom: "40%", left: j === 0 ? "15%" : "75%" }}
                              animate={{ y: [0, -14], opacity: [1, 0], scale: [1, 0.3] }}
                              transition={{ duration: 1, repeat: Infinity, delay: j * 0.5 + i * 0.1 }}
                            />
                          ))}
                        </>
                      ) : (
                        <EmojiFireSVG width={34} height={40} animated={false} gray />
                      )}
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
              <p className="text-[10px] font-bold text-yellow-600">🔥 Flash Sale Aktif{flashSaleLabel ? ` — ${flashSaleLabel}` : ""}!</p>
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
              onClick={confirmStreakPin} disabled={streakPinInput.length < 4}>
              <Lock className="w-4 h-4" /> Konfirmasi
            </Button>
          </div>
        </div>
      )}

      {/* Milestone Popup */}
      <AnimatePresence>
        {showMilestone && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          >
            <ConfettiEffect />
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-card w-full max-w-xs rounded-2xl p-6 text-center space-y-4 relative overflow-hidden"
            >
              <motion.div
                className={`absolute inset-0 bg-gradient-to-br ${getTierColor(showMilestone.tier)}`}
                animate={{ opacity: [0.05, 0.15, 0.05] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <ShimmerEffect />
              <div className="relative z-10 space-y-4">
                <div className="flex justify-center relative">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    <span className="text-6xl block">{showMilestone.emoji}</span>
                  </motion.div>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                      <EmojiFireSVG width={40} height={48} />
                    </motion.div>
                  </div>
                  <FloatingSparkles count={8} tier={showMilestone.tier} />
                </div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    <Sparkles className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
                  </motion.div>
                  <h3 className="text-xl font-extrabold">🎉 Milestone Tercapai!</h3>
                </motion.div>
                <p className="text-sm text-muted-foreground">
                  Kamu berhasil streak <span className="font-bold text-foreground">{showMilestone.label}</span>!
                </p>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className={`bg-gradient-to-r ${getTierColor(showMilestone.tier)} rounded-xl p-4 relative overflow-hidden`}
                >
                  <ShimmerEffect />
                  <p className="text-xs font-bold text-white/80 relative z-10">Gelar Baru</p>
                  <p className="text-2xl font-extrabold text-white relative z-10">{showMilestone.emoji} {showMilestone.reward}</p>
                </motion.div>
                <Button
                  onClick={() => setShowMilestone(null)}
                  className={`w-full bg-gradient-to-r ${getTierColor(showMilestone.tier)} text-white font-bold`}
                >
                  Mantap!
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NEW: Mystery Reward Popup */}
      <MysteryRewardPopup reward={mysteryReward} onClose={() => setMysteryReward(null)} />

      {/* NEW: PIN Modal for buying Streak Freeze */}
      {showFreezePinModal && (
        <div className="fixed inset-0 z-[96] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowFreezePinModal(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg flex items-center gap-2"><Shield className="w-5 h-5 text-cyan-500" /> Beli Pelindung Streak</h3>
              <button onClick={() => setShowFreezePinModal(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Masukkan PIN untuk konfirmasi pembelian Pelindung Streak (Rp 5.000)</p>
            <Input type="password" inputMode="numeric" maxLength={6} placeholder="PIN" value={freezePinInput}
              onChange={e => setFreezePinInput(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.3em] font-bold"
              onKeyDown={e => { if (e.key === "Enter") confirmBuyFreeze(); }}
              autoFocus />
            <Button className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold gap-2"
              onClick={confirmBuyFreeze} disabled={freezePinInput.length < 4}>
              <Shield className="w-4 h-4" /> Konfirmasi Beli
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
