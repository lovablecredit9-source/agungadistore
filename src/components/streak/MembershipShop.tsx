import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Crown, Coins, Wallet, Snowflake, Gem, Sparkles, Check, Gift, Lock, X } from "lucide-react";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  duration_days: number;
  price_idr: number;
  price_coins: number;
  bonus_multiplier: number;
  bonus_freeze_count: number;
  bonus_streak_coins: number;
  bonus_gems: number;
  daily_reward_coins?: number;
  icon: string;
  badge_color: string;
  is_featured: boolean;
}

interface ActiveMembership {
  id: string;
  plan_id: string;
  plan_name: string;
  expires_at: string;
  starts_at: string;
  bonus_multiplier: number;
}

interface DailyClaimInfo {
  available: boolean;
  claimed_today: boolean;
  coins_today: number;
  plan_name: string | null;
  next_unlock: string;
}

function formatDay(d: Date) {
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function useCountdown(targetIso?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!targetIso) return "";
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return "00:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Tema warna berdasar tier (warna dasar 1 plan)
function getTheme(plan?: Plan | null) {
  const days = plan?.duration_days || 0;
  if (days >= 30) {
    return {
      glow: "from-amber-400 via-yellow-500 to-orange-500",
      panel: "from-[#3a2a0d] via-[#4a2f0e] to-[#2a1d08]",
      border: "border-amber-400/60",
      accent: "text-amber-300",
      badge: "bg-amber-500/30 text-amber-100 border-amber-400/60",
      letter: "M",
      fusionId: "yellow" as const,
    };
  }
  if (days >= 7) {
    return {
      glow: "from-fuchsia-400 via-purple-500 to-violet-600",
      panel: "from-[#2a1340] via-[#3a1856] to-[#1f0d33]",
      border: "border-fuchsia-400/60",
      accent: "text-fuchsia-300",
      badge: "bg-fuchsia-500/30 text-fuchsia-100 border-fuchsia-400/60",
      letter: "W",
      fusionId: "purple" as const,
    };
  }
  return {
    glow: "from-cyan-400 via-sky-500 to-blue-600",
    panel: "from-[#0a1f3a] via-[#0e2c52] to-[#081a30]",
    border: "border-cyan-400/60",
    accent: "text-cyan-300",
    badge: "bg-cyan-500/30 text-cyan-100 border-cyan-400/60",
    letter: "T",
    fusionId: "blue" as const,
  };
}

// Tema fusion berdasarkan kombinasi membership AKTIF
// Biru saja → biru | Biru+Ungu → HIJAU NEON | Biru+Kuning → MERAH API
// Ungu saja → ungu | Kuning saja → kuning | Ungu+Kuning → ORANGE PLASMA
// Semua tiga aktif → RAINBOW PRISMATIC
function getFusionTheme(activePlans: Plan[], fallback: ReturnType<typeof getTheme>) {
  if (!activePlans || activePlans.length === 0) return { ...fallback, fusion: null as null | "green" | "red" | "orange" | "rainbow" };
  const ids = new Set(activePlans.map((p) => getTheme(p).fusionId));
  const hasBlue = ids.has("blue");
  const hasPurple = ids.has("purple");
  const hasYellow = ids.has("yellow");

  // Triple fusion → Rainbow prismatic
  if (hasBlue && hasPurple && hasYellow) {
    return {
      glow: "from-cyan-400 via-fuchsia-500 to-amber-400",
      panel: "from-[#1a1040] via-[#3a0f3a] to-[#3a2a0d]",
      border: "border-white/70",
      accent: "text-white",
      badge: "bg-white/20 text-white border-white/60",
      letter: "★",
      fusionId: "blue" as const,
      fusion: "rainbow" as const,
    };
  }
  // Biru + Ungu → Hijau neon
  if (hasBlue && hasPurple && !hasYellow) {
    return {
      glow: "from-emerald-400 via-green-500 to-lime-400",
      panel: "from-[#0a2e1a] via-[#0e3a1f] to-[#08220f]",
      border: "border-emerald-300/70",
      accent: "text-emerald-300",
      badge: "bg-emerald-500/30 text-emerald-100 border-emerald-400/60",
      letter: "G",
      fusionId: "blue" as const,
      fusion: "green" as const,
    };
  }
  // Biru + Kuning → Merah api
  if (hasBlue && hasYellow && !hasPurple) {
    return {
      glow: "from-red-500 via-rose-500 to-orange-500",
      panel: "from-[#3a0d0d] via-[#4a0e1a] to-[#2a0808]",
      border: "border-red-400/70",
      accent: "text-red-300",
      badge: "bg-red-500/30 text-red-100 border-red-400/60",
      letter: "R",
      fusionId: "yellow" as const,
      fusion: "red" as const,
    };
  }
  // Ungu + Kuning → Orange plasma
  if (hasPurple && hasYellow && !hasBlue) {
    return {
      glow: "from-orange-400 via-amber-500 to-pink-500",
      panel: "from-[#3a1a0d] via-[#4a1d1a] to-[#2a0d08]",
      border: "border-orange-300/70",
      accent: "text-orange-300",
      badge: "bg-orange-500/30 text-orange-100 border-orange-400/60",
      letter: "O",
      fusionId: "yellow" as const,
      fusion: "orange" as const,
    };
  }
  // Single → fallback ke tema plan terpilih
  return { ...fallback, fusion: null };
}

export default function MembershipShop({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [active, setActive] = useState<ActiveMembership[]>([]);
  const [coins, setCoins] = useState(0);
  const [gameBalance, setGameBalance] = useState(0);
  const [mainBalance, setMainBalance] = useState(0);
  const [pinDialog, setPinDialog] = useState<{ planId: string } | null>(null);
  const [pin, setPin] = useState("");
  const [dailyClaim, setDailyClaim] = useState<DailyClaimInfo | null>(null);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const countdown = useCountdown(dailyClaim?.next_unlock);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("purchase-membership", { body: { action: "list", visitorId } });
      const list: Plan[] = data?.plans || [];
      setPlans(list);
      setActive(data?.active_memberships || []);
      setCoins(data?.user_coins || 0);
      setGameBalance(data?.game_balance || 0);
      setMainBalance(data?.main_balance || 0);
      setDailyClaim(data?.daily_claim || null);
      // Auto pilih paket pertama / featured
      if (!selectedPlanId && list.length > 0) {
        const featured = list.find((p) => p.is_featured) || list[0];
        setSelectedPlanId(featured.id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (visitorId) load(); /* eslint-disable-next-line */ }, [visitorId]);

  const selected = useMemo(() => plans.find((p) => p.id === selectedPlanId) || plans[0], [plans, selectedPlanId]);
  const baseTheme = getTheme(selected);
  // Hitung tema fusion berdasar membership AKTIF user
  const activePlanObjects = useMemo(
    () => active.map((m) => plans.find((p) => p.id === m.plan_id)).filter(Boolean) as Plan[],
    [active, plans]
  );
  const theme = useMemo(() => getFusionTheme(activePlanObjects, baseTheme), [activePlanObjects, baseTheme]);
  const fusion = theme.fusion;
  const totalBalance = gameBalance + mainBalance;

  // Gabungan membership aktif untuk hitung sisa hari kalender
  const activeForSelected = useMemo(() => {
    if (!selected) return null;
    return active.find((m) => m.plan_id === selected.id) || null;
  }, [active, selected]);
  const activePlanIds = useMemo(() => new Set(active.map((m) => m.plan_id)), [active]);
  const todayRewardTotal = dailyClaim?.coins_today || 0;

  // Generate daftar tanggal untuk grid kalender hadiah harian (durasi paket terpilih)
  const calendarDays = useMemo(() => {
    if (!selected) return [];
    const total = selected.duration_days;
    const startWIB = new Date();
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(startWIB);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selected]);

  // Apakah hari ini (index 0) sudah klaim?
  const claimedToday = !!dailyClaim?.claimed_today;

  async function purchase(planId: string, pinValue?: string) {
    const busyKey = `${planId}-balance`;
    setBusy(busyKey);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-membership", {
        body: { action: "purchase", visitorId, planId, paymentSource: "auto", pin: pinValue },
      });
      if (error || data?.error) {
        if (data?.needPin) {
          setPinDialog({ planId });
          setBusy(null);
          return;
        }
        toast({ title: "Gagal", description: data?.error || error?.message || "Terjadi kesalahan", variant: "destructive" });
        return;
      }
      const bonus = data?.bonus;
      const bonusBits: string[] = [];
      if (bonus?.streak_coins) bonusBits.push(`+${bonus.streak_coins} Koin`);
      if (bonus?.instant_daily) bonusBits.push(`+${bonus.instant_daily} Hadiah Harian`);
      if (bonus?.gems) bonusBits.push(`+${bonus.gems} Gem`);
      if (bonus?.freeze) bonusBits.push(`+${bonus.freeze} Freeze`);
      toast({
        title: "🎉 Membership Aktif!",
        description: `${data?.plan_name}${bonusBits.length ? " · " + bonusBits.join(" · ") : ""}`,
      });
      setPinDialog(null);
      setPin("");
      await load();
      onUpdate?.();
    } finally {
      setBusy(null);
    }
  }

  async function claimDaily() {
    setClaimingDaily(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-membership", {
        body: { action: "daily-claim", visitorId },
      });
      if (error || data?.error) {
        toast({ title: "Gagal klaim", description: data?.error || error?.message || "Terjadi kesalahan", variant: "destructive" });
        return;
      }
      toast({
        title: "🎁 Hadiah Harian!",
        description: `+${data?.coins_awarded?.toLocaleString("id-ID")} Streak Coins`,
      });
      await load();
      onUpdate?.();
    } finally {
      setClaimingDaily(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/30 p-10 text-center">
        <Loader2 className="h-7 w-7 animate-spin mx-auto text-purple-300" />
      </div>
    );
  }

  if (!selected) {
    return <div className="text-center text-xs text-white/60 py-8">Belum ada paket membership</div>;
  }

  return (
    <div className="relative rounded-3xl overflow-hidden border-2 border-purple-500/40 bg-gradient-to-br from-[#1a0d2e] via-[#15102e] to-[#0d0820] shadow-[0_20px_60px_-15px_rgba(168,85,247,0.4)]">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute -top-12 -left-12 w-48 h-48 rounded-full bg-gradient-to-br ${theme.glow} opacity-20 blur-3xl`}
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 20, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className={`absolute -bottom-12 -right-12 w-56 h-56 rounded-full bg-gradient-to-br ${theme.glow} opacity-15 blur-3xl`}
        />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }} />
      </div>

      {/* TOP BAR */}
      <div className="relative flex items-center justify-between gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm border-b border-purple-500/30">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className="bg-gradient-to-r from-yellow-500/40 to-amber-500/40 text-yellow-100 border-yellow-400/60 gap-1 text-[10px] h-5 shadow-lg shadow-yellow-500/20">
            <Coins className="h-3 w-3" /> {coins.toLocaleString("id-ID")}
          </Badge>
          <Badge className="bg-gradient-to-r from-emerald-500/40 to-teal-500/40 text-emerald-100 border-emerald-400/60 gap-1 text-[10px] h-5 shadow-lg shadow-emerald-500/20">
            <Wallet className="h-3 w-3" /> Rp{totalBalance.toLocaleString("id-ID")}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {fusion && (
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{
                scale: [1, 1.08, 1],
                rotate: fusion === "rainbow" ? [0, 360] : 0,
              }}
              transition={{
                scale: { duration: 1.6, repeat: Infinity },
                rotate: fusion === "rainbow" ? { duration: 6, repeat: Infinity, ease: "linear" } : undefined,
              }}
              className={`flex items-center gap-1 rounded-full border-2 px-2 py-0.5 shadow-lg ${
                fusion === "green"
                  ? "bg-gradient-to-r from-emerald-500 via-green-400 to-lime-400 border-emerald-200/80 shadow-emerald-500/60"
                  : fusion === "red"
                  ? "bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 border-red-200/80 shadow-red-500/60"
                  : fusion === "orange"
                  ? "bg-gradient-to-r from-orange-500 via-amber-400 to-pink-500 border-orange-200/80 shadow-orange-500/60"
                  : "bg-[conic-gradient(from_0deg,#22d3ee,#a855f7,#fbbf24,#f43f5e,#22d3ee)] border-white/80 shadow-fuchsia-500/60"
              }`}
            >
              <Sparkles className="h-3 w-3 text-white drop-shadow" />
              <span className="text-[9px] font-black text-white uppercase tracking-widest drop-shadow">
                {fusion === "green" ? "Hijau Fusion" : fusion === "red" ? "Merah Fusion" : fusion === "orange" ? "Plasma" : "Prismatic"}
              </span>
            </motion.div>
          )}
          <motion.div
            animate={{
              boxShadow: fusion === "green"
                ? ["0 0 0px rgba(16,185,129,0.5)", "0 0 14px rgba(16,185,129,0.95)", "0 0 0px rgba(16,185,129,0.5)"]
                : fusion === "red"
                ? ["0 0 0px rgba(239,68,68,0.5)", "0 0 14px rgba(239,68,68,0.95)", "0 0 0px rgba(239,68,68,0.5)"]
                : fusion === "orange"
                ? ["0 0 0px rgba(249,115,22,0.5)", "0 0 14px rgba(249,115,22,0.95)", "0 0 0px rgba(249,115,22,0.5)"]
                : fusion === "rainbow"
                ? ["0 0 4px rgba(34,211,238,0.6)", "0 0 16px rgba(168,85,247,0.95)", "0 0 16px rgba(251,191,36,0.95)", "0 0 4px rgba(34,211,238,0.6)"]
                : ["0 0 0px rgba(168,85,247,0.5)", "0 0 12px rgba(168,85,247,0.8)", "0 0 0px rgba(168,85,247,0.5)"],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`flex items-center gap-1 rounded-full bg-gradient-to-r ${theme.glow} border border-white/60 px-2 py-0.5`}
          >
            <Crown className="h-3 w-3 text-white drop-shadow" />
            <span className="text-[9px] font-black text-white uppercase tracking-widest">Premium</span>
          </motion.div>
        </div>

      {/* MAIN AREA */}
      <div className="relative grid grid-cols-[1fr_96px] gap-2 p-2.5">
        <AnimatePresence mode="wait">
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, x: -10, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className={`relative rounded-2xl overflow-hidden border-2 ${theme.border} bg-gradient-to-br ${theme.panel} p-3 shadow-2xl`}
          >
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 left-0 h-px w-1/2 bg-gradient-to-r from-transparent via-white to-transparent"
            />

            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -15, 0], opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.4 }}
                  className="absolute"
                  style={{ left: `${15 + i * 22}%`, top: `${20 + (i % 2) * 40}%` }}
                >
                  <Sparkles className={`h-2 w-2 ${theme.accent}`} />
                </motion.div>
              ))}
            </div>

            <div className="relative text-center mb-2.5">
              <p className="text-[10px] text-white/85">
                <Sparkles className="h-2.5 w-2.5 inline -mt-0.5 text-white/60" /> Beli{" "}
                <span className="font-black text-white">Rp{selected.price_idr.toLocaleString("id-ID")}</span> dapatkan{" "}
                <Coins className="h-3 w-3 inline text-yellow-300 -mt-0.5" />{" "}
                <span className="font-black text-yellow-300">{selected.bonus_streak_coins.toLocaleString("id-ID")}</span>
              </p>
            </div>

            <div className="relative flex items-stretch gap-2.5">
              <div className="flex flex-col items-center justify-center min-w-[88px]">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className={`absolute -inset-2 rounded-full bg-gradient-to-r ${theme.glow} opacity-30 blur-md`}
                  />
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className={`relative w-16 h-16 rounded-2xl flex items-center justify-center border-2 ${theme.border} bg-gradient-to-br ${theme.glow} shadow-[0_8px_30px_rgba(0,0,0,0.5)]`}
                  >
                    <Crown className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={2.5} />
                    <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white/80 blur-[2px]" />
                  </motion.div>
                </div>
                <div className="mt-2 text-center">
                  <p className="text-[9px] font-black text-white/80 uppercase tracking-[0.15em] leading-tight">MEMBER</p>
                  <p className={`text-[11px] font-black ${theme.accent} uppercase tracking-wider leading-tight drop-shadow-[0_0_8px_currentColor]`}>
                    {selected.name.replace(/membership/i, "").trim() || `${selected.duration_days}H`}
                  </p>
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between bg-gradient-to-r from-yellow-500/10 to-transparent rounded-lg px-2 py-1.5 border border-yellow-400/20">
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-wide flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5 text-yellow-300" />Instan
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-black text-yellow-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.6)]">
                    <Coins className="h-3 w-3" />{selected.bonus_streak_coins.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-transparent rounded-lg px-2 py-1.5 border border-amber-400/20">
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-wide flex items-center gap-1">
                    <Gift className="h-2.5 w-2.5 text-amber-300" />Harian
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-black text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
                    <Coins className="h-3 w-3" />{(selected.daily_reward_coins || 0).toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-gradient-to-r from-fuchsia-500/10 to-transparent rounded-lg px-2 py-1.5 border border-fuchsia-400/20">
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-wide">Bonus</span>
                  <div className="flex items-center gap-1">
                    <Badge className="h-4 px-1 text-[9px] bg-gradient-to-r from-fuchsia-500/40 to-pink-500/40 text-fuchsia-100 border-fuchsia-400/50 font-black shadow-md shadow-fuchsia-500/20">x{selected.bonus_multiplier}</Badge>
                    {selected.bonus_gems > 0 && (
                      <Badge className="h-4 px-1 text-[9px] bg-gradient-to-r from-cyan-500/40 to-sky-500/40 text-cyan-100 border-cyan-400/50 gap-0.5 font-black shadow-md shadow-cyan-500/20"><Gem className="h-2.5 w-2.5" />{selected.bonus_gems}</Badge>
                    )}
                    {selected.bonus_freeze_count > 0 && (
                      <Badge className="h-4 px-1 text-[9px] bg-gradient-to-r from-sky-500/40 to-blue-500/40 text-sky-100 border-sky-400/50 gap-0.5 font-black shadow-md shadow-sky-500/20"><Snowflake className="h-2.5 w-2.5" />{selected.bonus_freeze_count}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-[9px] text-white/60 text-center pt-0.5">
                  Aktif <span className={`${theme.accent} font-black`}>{selected.duration_days} hari</span> setelah bayar
                </p>
              </div>
            </div>

            <motion.div whileTap={{ scale: 0.97 }} className="mt-3 relative">
              <Button
                size="lg"
                disabled={totalBalance < selected.price_idr || busy === `${selected.id}-balance`}
                onClick={() => purchase(selected.id)}
                className={`relative overflow-hidden w-full h-12 text-sm font-black uppercase tracking-widest bg-gradient-to-r ${theme.glow} hover:brightness-110 text-white shadow-[0_8px_25px_-5px_rgba(0,0,0,0.5)] disabled:opacity-50 border border-white/30`}
              >
                <motion.div
                  animate={{ x: ["-150%", "150%"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                />
                {busy === `${selected.id}-balance` ? (
                  <Loader2 className="h-5 w-5 animate-spin relative z-10" />
                ) : (
                  <span className="relative z-10 flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Rp{selected.price_idr.toLocaleString("id-ID")}
                  </span>
                )}
              </Button>
            </motion.div>

            {activeForSelected && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 flex items-center justify-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 rounded-full py-1 border border-emerald-400/30"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
                <span className="font-black uppercase tracking-wider">Aktif s.d. {new Date(activeForSelected.expires_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-col gap-1.5">
          {plans.map((p, idx) => {
            const t = getTheme(p);
            const isSel = p.id === selected.id;
            const isActivePlan = activePlanIds.has(p.id);
            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelectedPlanId(p.id)}
                className={`relative rounded-xl border-2 transition-all overflow-hidden text-left p-1.5 ${
                  isSel
                    ? `${t.border} bg-gradient-to-br ${t.panel} shadow-[0_4px_16px_rgba(0,0,0,0.4)] ring-2 ring-white/30`
                    : "border-white/10 bg-black/40 hover:bg-black/50 hover:border-white/20"
                }`}
              >
                {isSel && (
                  <motion.div
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 left-0 h-px w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent"
                  />
                )}
                {isActivePlan && (
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -left-0.5 -top-0.5 z-10 rounded-br-lg rounded-tl-lg border border-emerald-400/60 bg-gradient-to-br from-emerald-500/80 to-teal-500/80 px-1 py-0.5 text-[7px] font-black text-white shadow-md"
                  >
                    ON
                  </motion.div>
                )}
                <div className="flex items-center justify-end gap-0.5 mb-1">
                  <Coins className="h-2.5 w-2.5 text-yellow-300" />
                  <span className="text-[9px] font-black text-yellow-200">{p.bonus_streak_coins}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${t.glow} border ${t.border} shrink-0 shadow-md`}>
                    <Crown className="h-4 w-4 text-white drop-shadow" strokeWidth={2.5} />
                    {isSel && (
                      <div className={`absolute -inset-1 rounded-lg bg-gradient-to-br ${t.glow} opacity-40 blur-md -z-10`} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[9px] font-black uppercase truncate leading-tight ${isSel ? "text-white" : "text-white/80"}`}>
                      {p.name.replace(/membership/i, "").trim() || `${p.duration_days}H`}
                    </p>
                    <p className={`text-[8px] font-bold leading-tight ${isSel ? t.accent : "text-white/60"}`}>
                      Rp{(p.price_idr / 1000).toFixed(0)}K
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* HADIAH HARIAN */}
      <div className="relative px-2.5 pb-3">
        <div className="relative bg-black/50 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-3 overflow-hidden">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-16 bg-amber-500/20 blur-2xl rounded-full pointer-events-none" />

          <div className="relative flex items-center justify-between mb-2.5 flex-wrap gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <motion.div
                animate={{ scaleY: [1, 1.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="w-1 h-4 bg-gradient-to-b from-yellow-300 to-amber-500 rounded-sm shadow-[0_0_8px_rgba(251,191,36,0.8)]"
              />
              <p className="text-[11px] font-black text-white uppercase tracking-widest">Hadiah Harian</p>
              {todayRewardTotal > 0 && (
                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Badge className="h-5 border-amber-400/60 bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-[10px] font-black text-amber-100 shadow-md shadow-amber-500/30">
                    +{todayRewardTotal.toLocaleString("id-ID")}
                  </Badge>
                </motion.div>
              )}
            </div>
            {dailyClaim && dailyClaim.coins_today > 0 && !claimedToday && (
              <motion.div whileTap={{ scale: 0.94 }}>
                <Button
                  size="sm"
                  disabled={claimingDaily || !dailyClaim.available}
                  onClick={claimDaily}
                  className="relative overflow-hidden h-8 px-3 text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 hover:brightness-110 text-white shadow-lg shadow-orange-500/40 border border-white/20"
                >
                  <motion.div
                    animate={{ x: ["-100%", "150%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                  />
                  {claimingDaily ? <Loader2 className="h-3 w-3 animate-spin relative z-10" /> : <span className="relative z-10 flex items-center gap-1"><Gift className="h-3 w-3" />KLAIM</span>}
                </Button>
              </motion.div>
            )}
            {claimedToday && (
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/40 text-[10px] gap-1 h-7 font-black px-2">
                <Check className="h-3 w-3" strokeWidth={3} />
                <span className="font-mono tabular-nums text-[10px]">{countdown}</span>
              </Badge>
            )}
          </div>

          <p className="relative text-[9px] text-white/50 mb-2 flex items-center gap-1">
            <Lock className="h-2 w-2" />Reset tiap hari pukul <span className="text-yellow-300 font-black">00:00 WIB</span>
          </p>

          <div className="relative flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {calendarDays.map((d, idx) => {
              const isToday = idx === 0;
              const isLocked = idx > 0 || (isToday && claimedToday);
              const reward = isToday ? (todayRewardTotal || selected.daily_reward_coins || 0) : (selected.daily_reward_coins || 0);
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.015 }}
                  className={`relative shrink-0 w-[60px] rounded-xl border-2 overflow-hidden ${
                    isToday && !claimedToday
                      ? `${theme.border} bg-gradient-to-b ${theme.panel} shadow-[0_4px_15px_rgba(168,85,247,0.4)]`
                      : claimedToday && isToday
                      ? "border-emerald-400/60 bg-gradient-to-b from-emerald-900/40 to-emerald-950/40"
                      : "border-white/10 bg-black/40"
                  }`}
                >
                  {isToday && !claimedToday && (
                    <motion.div
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className={`absolute inset-0 bg-gradient-to-b ${theme.glow} opacity-20 pointer-events-none`}
                    />
                  )}
                  <div className={`relative text-center text-[9px] font-black py-0.5 ${
                    isToday ? `${theme.accent} bg-black/40` : "text-white/50"
                  }`}>
                    {isToday ? "HARI INI" : formatDay(d)}
                  </div>
                  <div className="relative h-12 flex items-center justify-center bg-gradient-to-b from-white/5 to-transparent">
                    {isLocked && !(claimedToday && isToday) ? (
                      <div className="flex flex-col items-center gap-0.5 opacity-40">
                        <Lock className="h-2.5 w-2.5 text-white/50" strokeWidth={2} />
                        <span className="text-[8px] font-bold text-white/40">+{reward}</span>
                      </div>
                    ) : !isLocked ? (
                      <motion.div
                        animate={{ y: [0, -2, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="flex flex-col items-center"
                      >
                        <Coins className="h-4 w-4 text-yellow-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.8)]" />
                        <span className="text-[9px] font-black text-yellow-200 mt-0.5">+{reward}</span>
                      </motion.div>
                    ) : null}
                    {claimedToday && isToday && (
                      <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/30 backdrop-blur-[1px]">
                        <Check className="h-6 w-6 text-emerald-200 drop-shadow-[0_0_8px_rgba(110,231,183,0.8)]" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <p className="relative text-[9px] text-center text-white/60 mt-2 font-bold">
            {active.length > 0
              ? <>✨ <span className="text-emerald-300">Member aktif!</span> Klaim sebelum <span className="text-yellow-300">00:00 WIB</span></>
              : <>🔒 Beli Membership untuk membuka hadiah harian</>
            }
          </p>
        </div>
      </div>

      {/* PIN DIALOG */}
      <Dialog open={!!pinDialog} onOpenChange={(open) => { if (!open) { setPinDialog(null); setPin(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-500" /> Verifikasi PIN
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Masukkan PIN saldo untuk menyelesaikan pembelian membership.</p>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="text-center text-lg tracking-widest"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPinDialog(null); setPin(""); }}>Batal</Button>
            <Button
              disabled={pin.length < 4 || !!busy}
              onClick={() => pinDialog && purchase(pinDialog.planId, pin)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
