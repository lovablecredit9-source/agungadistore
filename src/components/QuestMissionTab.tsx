import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock3, Flame, Gamepad2, Gem, Gift, Loader2, Lock, Music2, ShoppingBag, Sparkles, Target, Ticket, Trophy, Clover, CalendarDays, Rocket, Zap, Crown, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { triggerGameBalanceRefresh } from "@/components/games/GameBalance";
import musicBanner from "@/assets/music-banner.jpg";
import promoGameImg from "@/assets/promo-game.jpg";
import promoProductsImg from "@/assets/promo-products.jpg";

type Mission = {
  id: string;
  title: string;
  description: string;
  challenge_type: string;
  target_value: number;
  reward_coins: number;
  reward_saldo_in: number;
  reward_gems: number;
  reward_xp?: number;
  icon: string;
  difficulty: string;
  current_value: number;
  is_completed: boolean;
  claimed_at: string | null;
  period?: string;
  filter_group?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  is_pro_legend?: boolean;
  locked?: boolean;
  lockedText?: string;
};

type PremiumPlan = {
  id: string;
  code: string;
  name: string;
  description: string;
  duration_seconds: number | null;
  price_balance: number;
  price_saldo_in: number;
  is_permanent: boolean;
  is_promo: boolean;
};

type PremiumInfo = {
  is_active: boolean;
  plan_name: string | null;
  expires_at: string | null;
  is_permanent: boolean;
  seconds_left: number;
  can_trial: boolean;
};

type ProgressRow = {
  challenge_id: string;
  current_value: number;
  is_completed: boolean;
  claimed_at: string | null;
};

interface Props {
  visitorId: string;
  isLoggedIn?: boolean;
  onNavigate?: (tab: string) => void;
  onUpdate?: () => void;
}

const iconMap: Record<string, typeof Target> = {
  game_play: Gamepad2,
  game_win: Trophy,
  game_points: Gem,
  music_listen: Music2,
  purchase: ShoppingBag,
  spin_wheel: Sparkles,
  streak_claim: Flame,
  mystery_box: Gift,
  gift_box: Gift,
  scratch_card: Ticket,
  lucky_draw: Clover,
};

const targetTab: Record<string, string> = {
  game_play: "game",
  game_win: "game",
  game_points: "game",
  music_listen: "musik",
  purchase: "produk",
  spin_wheel: "rodadiskon",
  streak_claim: "streak",
  mystery_box: "streakshop",
  gift_box: "streak",
  scratch_card: "streak",
  lucky_draw: "game",
  quest_claim: "questmission",
};

const difficultyStyle: Record<string, string> = {
  mudah: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  normal: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  susah: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  ekstrem: "bg-gradient-to-r from-amber-500 to-fuchsia-600 text-white",
  mustahil: "bg-gradient-to-r from-fuchsia-600 via-rose-600 to-red-700 text-white shadow-sm animate-pulse",
};

const difficultyLabel: Record<string, string> = {
  mudah: "MUDAH",
  normal: "NORMAL",
  susah: "SUSAH",
  ekstrem: "★ EKSTREM",
  mustahil: "☠ MUSTAHIL",
};

function getWibDate() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split("T")[0];
}

function getResetCountdown() {
  const offset = 7 * 60 * 60 * 1000;
  const now = Date.now();
  const wib = new Date(now + offset);
  const nextMidnightUtc = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + 1) - offset;
  const diff = Math.max(0, nextMidnightUtc - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}j ${m}m`;
}

function getWeeklyCountdown() {
  const offset = 7 * 60 * 60 * 1000;
  const now = Date.now();
  const wib = new Date(now + offset);
  const day = wib.getUTCDay(); // 0=Sun
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextMondayUtc = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + daysUntilMonday) - offset;
  const diff = Math.max(0, nextMondayUtc - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  return `${d}h ${h}j`;
}

// Event spesial dibuka besok (jam 20:00 WIB / 13:00 UTC)
const SPECIAL_EVENT_START = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setUTCHours(13, 0, 0, 0);
  return d.getTime();
})();

function getEventCountdown() {
  const diff = Math.max(0, SPECIAL_EVENT_START - Date.now());
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { d, h, m, s, done: diff === 0 };
}

function formatSaldoIn(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatPremiumTime(info: PremiumInfo) {
  if (info.is_permanent) return "PERMANEN";
  if (!info.expires_at) return "BELUM AKTIF";
  const diff = Math.max(0, new Date(info.expires_at).getTime() - Date.now());
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${d}h ${h}j ${m}m ${s}d`;
}

function getQuestDeviceKey() {
  const key = "premium_quest_device_key_v1";
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}

function rewardText(mission: Pick<Mission, "reward_coins" | "reward_saldo_in" | "reward_gems">) {
  const rewards = [
    mission.reward_gems > 0 ? `${mission.reward_gems} Gem` : null,
    mission.reward_coins > 0 ? `${mission.reward_coins} Coin` : null,
    mission.reward_saldo_in > 0 ? `Saldo IN ${formatSaldoIn(mission.reward_saldo_in)}` : null,
  ].filter(Boolean);
  return rewards.join(" + ");
}

function RewardBadges({ mission }: { mission: Pick<Mission, "reward_coins" | "reward_saldo_in" | "reward_gems"> }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {mission.reward_gems > 0 && (
        <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-black leading-none text-accent-foreground whitespace-nowrap">
          💎 {mission.reward_gems} Gem
        </span>
      )}
      {mission.reward_coins > 0 && (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-black leading-none text-muted-foreground whitespace-nowrap">
          🪙 {mission.reward_coins} Coin
        </span>
      )}
      {mission.reward_saldo_in > 0 && (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black leading-none text-primary whitespace-nowrap">
          IN {formatSaldoIn(mission.reward_saldo_in)}
        </span>
      )}
    </div>
  );
}

function MissionCard({
  mission,
  index,
  claiming,
  onClaim,
  onNavigate,
}: {
  mission: Mission;
  index: number;
  claiming: string | null;
  onClaim: (m: Mission) => void;
  onNavigate?: (tab: string) => void;
}) {
  const Icon = iconMap[mission.challenge_type] || Target;
  const pct = Math.min(100, (mission.current_value / Math.max(1, mission.target_value)) * 100);
  const claimed = !!mission.claimed_at;
  const readyToClaim = mission.is_completed && !claimed;
  const diff = mission.difficulty || "mudah";
  const locked = !!mission.locked;
  const lockedText = mission.lockedText || "Terkunci Event";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`relative overflow-hidden rounded-2xl border p-3 bg-card ${locked ? "opacity-55 saturate-50" : ""} ${claimed ? "border-primary/40" : readyToClaim ? "border-accent shadow-sm" : "border-border"}`}
    >
      {locked && <div className="absolute inset-0 z-10 bg-background/35 backdrop-blur-[1px]" />}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center shrink-0 relative overflow-hidden">
          <Icon className="w-5 h-5 text-primary" strokeWidth={2.4} />
          <span className="absolute -right-1 -bottom-1 text-lg opacity-70">{mission.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-black truncate">{mission.title}</p>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black leading-none ${difficultyStyle[diff] || difficultyStyle.mudah}`}>
                  {difficultyLabel[diff] || "MUDAH"}
                </span>
                {mission.is_pro_legend && <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-black leading-none text-amber-600">PRO LEGEND</span>}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{mission.description}</p>
            </div>
            <div className="text-right shrink-0 max-w-[142px]">
              <RewardBadges mission={mission} />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Progress value={pct} className="h-2 flex-1" />
            <span className="text-[10px] font-black tabular-nums text-muted-foreground">{Math.min(mission.current_value, mission.target_value)}/{mission.target_value}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {locked ? (
          <Button variant="secondary" disabled className="h-9 flex-1 font-black opacity-70">
            <Lock className="w-4 h-4 mr-2" /> {lockedText}
          </Button>
        ) : claimed ? (
          <span className="inline-flex items-center gap-1 text-xs font-black text-primary"><Check className="w-4 h-4" strokeWidth={3} /> Sudah diklaim</span>
        ) : readyToClaim ? (
          <Button disabled={claiming === mission.id} onClick={() => onClaim(mission)} className="h-9 flex-1 font-black">
            {claiming === mission.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Gift className="w-4 h-4 mr-2" /> Klaim Reward</>}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => onNavigate?.(targetTab[mission.challenge_type] || "beranda")} className="h-9 flex-1 font-bold">
            Mulai Misi
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default function QuestMissionTab({ visitorId, isLoggedIn = false, onNavigate, onUpdate }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"harian" | "mingguan" | "premium">("harian");
  const [periodFilter, setPeriodFilter] = useState<"all" | "daily" | "weekly" | "monthly" | "event">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "mudah" | "normal" | "susah" | "pro_legend">("all");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [weekly, setWeekly] = useState<Mission[]>([]);
  const [premiumMissions, setPremiumMissions] = useState<Mission[]>([]);
  const [premiumPlans, setPremiumPlans] = useState<PremiumPlan[]>([]);
  const [premiumInfo, setPremiumInfo] = useState<PremiumInfo>({ is_active: false, plan_name: null, expires_at: null, is_permanent: false, seconds_left: 0, can_trial: false });
  const [loading, setLoading] = useState(true);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [loadingPremium, setLoadingPremium] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [pinPlan, setPinPlan] = useState<PremiumPlan | null>(null);
  const [pin, setPin] = useState("");
  const [countdown, setCountdown] = useState(getResetCountdown());
  const [weeklyCountdown, setWeeklyCountdown] = useState(getWeeklyCountdown());
  const [eventCountdown, setEventCountdown] = useState(getEventCountdown());
  const today = useMemo(() => getWibDate(), []);

  const filteredPremium = useMemo(() => premiumMissions.filter((mission) => {
    const byPeriod = periodFilter === "all" || mission.period === periodFilter;
    const byDifficulty = difficultyFilter === "all"
      || (difficultyFilter === "pro_legend" ? mission.is_pro_legend : ["mudah", "normal"].includes(difficultyFilter) ? mission.difficulty === difficultyFilter : ["susah", "ekstrem", "mustahil"].includes(mission.difficulty || ""));
    return byPeriod && byDifficulty;
  }), [premiumMissions, periodFilter, difficultyFilter]);
  const premiumDisplayList = useMemo(() => filteredPremium.map((mission) => ({
    ...mission,
    locked: mission.locked || !premiumInfo.is_active,
    lockedText: !premiumInfo.is_active ? "Beli Premium Quest" : mission.lockedText,
  })), [filteredPremium, premiumInfo.is_active]);
  const activeList = tab === "harian" ? missions : tab === "mingguan" ? weekly : premiumDisplayList;
  const completed = activeList.filter((mission) => mission.claimed_at).length;
  const ready = activeList.filter((mission) => mission.is_completed && !mission.claimed_at && !mission.locked).length;

  async function loadMissions() {
    if (!visitorId) return;
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("daily_challenges")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;

      const challengeIds = (rows || []).map((row) => row.id);
      let progress: ProgressRow[] = [];
      if (challengeIds.length > 0) {
        const { data: progressRows } = await supabase
          .from("daily_challenge_progress")
          .select("challenge_id,current_value,is_completed,claimed_at")
          .eq("visitor_id", visitorId)
          .eq("challenge_date", today)
          .in("challenge_id", challengeIds);
        progress = (progressRows || []) as ProgressRow[];
      }

      const progressMap = new Map(progress.map((item) => [item.challenge_id, item]));
      setMissions((rows || []).map((row: any) => {
        const item = progressMap.get(row.id);
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          challenge_type: row.challenge_type,
          target_value: row.target_value,
          reward_coins: row.reward_coins || 0,
          reward_saldo_in: row.reward_saldo_in || 0,
          reward_gems: row.reward_gems || 0,
          icon: row.icon || "🎯",
          difficulty: row.difficulty || "mudah",
          current_value: item?.current_value || 0,
          is_completed: item?.is_completed || false,
          claimed_at: item?.claimed_at || null,
        };
      }));
    } catch (error) {
      toast({ title: "Quest belum bisa dimuat", description: error instanceof Error ? error.message : "Coba lagi nanti.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadWeekly() {
    if (!visitorId) return;
    setLoadingWeekly(true);
    try {
      const { data, error } = await supabase.functions.invoke("weekly-quest", {
        body: { action: "status", visitorId },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Gagal memuat");
      const quests: any[] = (data as any)?.quests || [];
      const progress: any[] = (data as any)?.progress || [];
      const progressMap = new Map(progress.map((p) => [p.quest_id, p]));
      setWeekly(quests.map((q) => {
        const item = progressMap.get(q.id);
        return {
          id: q.id,
          title: q.title,
          description: q.description,
          challenge_type: q.quest_type,
          target_value: q.target_value,
          reward_coins: q.reward_coins || 0,
          reward_saldo_in: q.reward_saldo_in || 0,
          reward_gems: q.reward_gems || 0,
          reward_xp: q.reward_xp || 0,
          icon: q.icon || "🎯",
          difficulty: q.difficulty || "normal",
          current_value: item?.current_value || 0,
          is_completed: item?.is_completed || false,
          claimed_at: item?.claimed_at || null,
        };
      }));
    } catch (error) {
      toast({ title: "Misi mingguan belum bisa dimuat", description: error instanceof Error ? error.message : "Coba lagi nanti.", variant: "destructive" });
    } finally {
      setLoadingWeekly(false);
    }
  }

  async function loadPremium() {
    if (!visitorId) return;
    setLoadingPremium(true);
    try {
      const { data, error } = await supabase.functions.invoke("premium-quest", {
        body: { action: "status", visitorId },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Gagal memuat premium quest");
      const quests: any[] = (data as any)?.quests || [];
      const progress: any[] = (data as any)?.progress || [];
      const progressMap = new Map(progress.map((p) => [p.quest_id, p]));
      const now = Date.now();
      setPremiumInfo(((data as any)?.info || { is_active: false, can_trial: false }) as PremiumInfo);
      setPremiumPlans(((data as any)?.plans || []) as PremiumPlan[]);
      setPremiumMissions(quests.map((q) => {
        const item = progressMap.get(q.id);
        const startsAt = q.starts_at ? new Date(q.starts_at).getTime() : 0;
        const endsAt = q.ends_at ? new Date(q.ends_at).getTime() : Number.MAX_SAFE_INTEGER;
        return {
          id: q.id,
          title: q.title,
          description: q.description,
          challenge_type: q.quest_type,
          target_value: q.target_value,
          reward_coins: q.reward_coins || 0,
          reward_saldo_in: q.reward_saldo_in || 0,
          reward_gems: q.reward_gems || 0,
          icon: q.icon || "👑",
          difficulty: q.difficulty || "susah",
          current_value: item?.current_value || 0,
          is_completed: item?.is_completed || false,
          claimed_at: item?.claimed_at || null,
          period: q.period || "daily",
          filter_group: q.filter_group || "premium",
          starts_at: q.starts_at || null,
          ends_at: q.ends_at || null,
          is_pro_legend: !!q.is_pro_legend,
          locked: startsAt > now || endsAt < now,
          lockedText: startsAt > now ? "Terkunci Besok" : endsAt < now ? "Event Selesai" : undefined,
        };
      }));
    } catch (error) {
      toast({ title: "Premium Quest belum bisa dimuat", description: error instanceof Error ? error.message : "Coba lagi nanti.", variant: "destructive" });
    } finally {
      setLoadingPremium(false);
    }
  }

  useEffect(() => {
    loadMissions();
    loadWeekly();
    loadPremium();
    const refreshQuestProgress = () => {
      loadMissions();
      loadWeekly();
      loadPremium();
    };
    const handleVisibility = () => {
      if (!document.hidden) refreshQuestProgress();
    };
    window.addEventListener("focus", refreshQuestProgress);
    document.addEventListener("visibilitychange", handleVisibility);
    const timer = window.setInterval(() => {
      setCountdown(getResetCountdown());
      setWeeklyCountdown(getWeeklyCountdown());
    }, 30_000);
    const eventTimer = window.setInterval(() => setEventCountdown(getEventCountdown()), 1000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(eventTimer);
      window.removeEventListener("focus", refreshQuestProgress);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId, today]);

  async function claimMission(mission: Mission) {
    if (!isLoggedIn) {
      toast({ title: "Login Saldo dulu", description: "Masuk ke akun saldo agar hadiah Quest Mission tersimpan." });
      onNavigate?.("saldo");
      return;
    }
    setClaiming(mission.id);
    try {
      if (tab === "harian") {
        const { data, error } = await supabase.functions.invoke("check-daily-challenge", {
          body: { visitorId, claimChallengeId: mission.id },
        });
        if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Gagal klaim reward");
      } else if (tab === "mingguan") {
        const { data, error } = await supabase.functions.invoke("weekly-quest", {
          body: { action: "claim", visitorId, questId: mission.id },
        });
        if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Gagal klaim reward");
      } else {
        const { data, error } = await supabase.functions.invoke("premium-quest", {
          body: { action: "claim", visitorId, questId: mission.id },
        });
        if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Gagal klaim reward");
      }
      toast({ title: "🎯 Quest selesai!", description: `Kamu dapat ${rewardText(mission) || "reward"}.` });
      triggerGameBalanceRefresh();
      onUpdate?.();
      tab === "harian" ? loadMissions() : tab === "mingguan" ? loadWeekly() : loadPremium();
    } catch (error) {
      toast({ title: "Gagal klaim", description: error instanceof Error ? error.message : "Coba lagi nanti.", variant: "destructive" });
    } finally {
      setClaiming(null);
    }
  }

  async function claimAll() {
    if (!isLoggedIn) {
      toast({ title: "Login Saldo dulu", description: "Masuk ke akun saldo agar hadiah Quest Mission tersimpan." });
      onNavigate?.("saldo");
      return;
    }
    const readyMissions = activeList.filter((m) => m.is_completed && !m.claimed_at && !m.locked);
    if (readyMissions.length === 0) return;
    setClaimingAll(true);
    let success = 0;
    try {
      for (const mission of readyMissions) {
        try {
          if (tab === "harian") {
            const { data, error } = await supabase.functions.invoke("check-daily-challenge", {
              body: { visitorId, claimChallengeId: mission.id },
            });
            if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
          } else if (tab === "mingguan") {
            const { data, error } = await supabase.functions.invoke("weekly-quest", {
              body: { action: "claim", visitorId, questId: mission.id },
            });
            if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
          } else {
            const { data, error } = await supabase.functions.invoke("premium-quest", {
              body: { action: "claim", visitorId, questId: mission.id },
            });
            if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
          }
          success++;
        } catch { /* skip failed */ }
      }
      if (success > 0) {
        toast({ title: "🎉 Klaim semua berhasil!", description: `${success} misi berhasil diklaim.` });
        triggerGameBalanceRefresh();
        onUpdate?.();
        tab === "harian" ? loadMissions() : tab === "mingguan" ? loadWeekly() : loadPremium();
      } else {
        toast({ title: "Gagal klaim", description: "Coba lagi nanti.", variant: "destructive" });
      }
    } finally {
      setClaimingAll(false);
    }
  }

  async function claimTrial() {
    if (!isLoggedIn) {
      toast({ title: "Login Saldo dulu", description: "Trial Premium Quest wajib akun saldo." });
      onNavigate?.("saldo");
      return;
    }
    setBuyingPlan("trial");
    try {
      const { data, error } = await supabase.functions.invoke("premium-quest", {
        body: { action: "trial", visitorId, deviceKey: getQuestDeviceKey() },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Gagal klaim trial");
      toast({ title: "👑 Trial aktif", description: "Premium Quest gratis 1 hari aktif." });
      loadPremium();
    } catch (error) {
      toast({ title: "Trial gagal", description: error instanceof Error ? error.message : "Coba lagi nanti.", variant: "destructive" });
    } finally {
      setBuyingPlan(null);
    }
  }

  async function submitPremiumPurchase() {
    if (!pinPlan) return;
    if (!isLoggedIn) {
      toast({ title: "Login Saldo dulu", description: "Premium Quest wajib akun saldo." });
      onNavigate?.("saldo");
      return;
    }
    if (pin.length !== 6) return toast({ title: "PIN harus 6 digit", variant: "destructive" });
    setBuyingPlan(pinPlan.id);
    try {
      const { data, error } = await supabase.functions.invoke("premium-quest", {
        body: { action: "purchase", visitorId, planId: pinPlan.id, pin, deviceKey: getQuestDeviceKey() },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Pembelian gagal");
      toast({ title: premiumInfo.is_active ? "👑 Premium Quest diperpanjang" : "👑 Premium Quest aktif", description: `${pinPlan.name} berhasil.` });
      setPinPlan(null);
      setPin("");
      loadPremium();
      triggerGameBalanceRefresh();
    } catch (error) {
      toast({ title: "Pembelian gagal", description: error instanceof Error ? error.message : "Coba lagi nanti.", variant: "destructive" });
    } finally {
      setBuyingPlan(null);
    }
  }


  const events = [
    { title: "Double Gem Quest", desc: "Hadiah Gem misi harian jadi lebih tebal.", time: "Besok 00:00 WIB", image: musicBanner },
    { title: "Belanja Beruntun", desc: "Event belanja kecil dengan bonus Saldo IN.", time: "Segera dibuka", image: promoProductsImg },
    { title: "Game Rush Night", desc: "Main game, kumpulkan poin, rebut reward ekstra.", time: "Coming Soon", image: promoGameImg },
    { title: "Weekend Saldo Blast", desc: "Selesaikan misi di akhir pekan, Saldo IN dilipatgandakan.", time: "Setiap Sabtu-Minggu", image: promoProductsImg },
    { title: "Spin & Scratch Fiesta", desc: "Putar roda & gosok kartu untuk hadiah kejutan spesial.", time: "Coming Soon", image: musicBanner },
    { title: "Streak Legend Week", desc: "Jaga streak seminggu penuh, buka reward Gem raksasa.", time: "Segera dibuka", image: promoGameImg },
  ];

  const isDaily = tab === "harian";
  const isWeekly = tab === "mingguan";
  const isPremiumTab = tab === "premium";
  const listLoading = isDaily ? loading : isWeekly ? loadingWeekly : loadingPremium;

  return (
    <div className="space-y-4 animate-fade-in pb-28">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/10 to-transparent" />
        <div className="relative flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shrink-0">
            <Target className="w-6 h-6" strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-black tracking-tight">Quest Mission</h2>
              {ready > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{ready} Klaim</span>}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">Normal Quest dan Premium Quest PRO LEGEND. Lagu wajib 2 menit per lagu berbeda, belanja bertahap, hadiah 💎 + 🪙 + IN.</p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-background/70 border border-border p-2 text-center">
            <p className="text-[9px] text-muted-foreground font-bold uppercase">Selesai</p>
            <p className="text-lg font-black tabular-nums">{completed}/{activeList.length || 0}</p>
          </div>
          <div className="rounded-2xl bg-background/70 border border-border p-2 text-center">
            <p className="text-[9px] text-muted-foreground font-bold uppercase">Reset</p>
            <p className="text-lg font-black tabular-nums">{isPremiumTab ? formatPremiumTime(premiumInfo) : isDaily ? countdown : weeklyCountdown}</p>
          </div>
          <div className="rounded-2xl bg-background/70 border border-border p-2 text-center">
            <p className="text-[9px] text-muted-foreground font-bold uppercase">Reward</p>
            <p className="text-lg font-black">💎 + 🪙 + IN</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-1">
        <button
          onClick={() => setTab("harian")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-black transition ${isDaily ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          <Sparkles className="w-4 h-4" /> Normal
        </button>
        <button
          onClick={() => setTab("mingguan")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-black transition ${isWeekly ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          <CalendarDays className="w-4 h-4" /> Mingguan
        </button>
        <button
          onClick={() => setTab("premium")}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-black transition ${isPremiumTab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          <Crown className="w-4 h-4" /> Premium
        </button>
      </div>

      {isPremiumTab && (
        <section className="space-y-3">
          <div className={`rounded-3xl border p-4 ${premiumInfo.is_active ? "border-amber-500/50 bg-amber-500/10" : "border-border bg-card"}`}>
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/15">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black">Premium Quest</p>
                  <span className={`rounded-full px-2 py-0.5 text-[8px] font-black ${premiumInfo.is_active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                    {premiumInfo.is_active ? "AKTIF" : "BELI"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{premiumInfo.is_active ? `${premiumInfo.plan_name} · ${formatPremiumTime(premiumInfo)}` : "Beli untuk membuka harian premium, mingguan premium, bulanan premium, dan PRO LEGEND."}</p>
              </div>
            </div>
            {!premiumInfo.is_active && premiumInfo.can_trial && (
              <Button onClick={claimTrial} disabled={buyingPlan === "trial"} className="mt-3 h-10 w-full font-black">
                {buyingPlan === "trial" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Gift className="mr-2 h-4 w-4" /> Klaim Gratis 1 Hari</>}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {premiumPlans.filter((plan) => plan.code !== "TRIAL_1D").map((plan) => (
              <div key={plan.id} className={`rounded-2xl border bg-card p-3 ${plan.is_promo || plan.is_permanent ? "border-amber-500/50" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-black">{plan.is_permanent ? "♾️ " : plan.is_promo ? "🔥 " : "👑 "}{plan.name}</p>
                  {plan.is_promo && <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[8px] font-black text-rose-600">PROMO</span>}
                </div>
                <p className="mt-1 text-sm font-black text-primary">{formatSaldoIn(plan.price_balance || plan.price_saldo_in)}</p>
                <p className="line-clamp-2 text-[10px] text-muted-foreground">{plan.description}</p>
                <Button size="sm" onClick={() => { setPinPlan(plan); setPin(""); }} disabled={buyingPlan === plan.id} className="mt-2 h-8 w-full text-[10px] font-black">
                  {premiumInfo.is_active ? "Perpanjang" : "Beli"}
                </Button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-1 rounded-2xl border border-border bg-card p-1">
            {[
              ["all", "Semua"], ["daily", "Harian"], ["weekly", "Mingguan"], ["monthly", "Bulanan"], ["event", "Event"],
            ].map(([value, label]) => (
              <button key={value} onClick={() => setPeriodFilter(value as typeof periodFilter)} className={`rounded-xl py-1.5 text-[10px] font-black ${periodFilter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1 rounded-2xl border border-border bg-card p-1">
            {[
              ["all", "All"], ["mudah", "Mudah"], ["normal", "Normal"], ["susah", "Susah"], ["pro_legend", "PRO"],
            ].map(([value, label]) => (
              <button key={value} onClick={() => setDifficultyFilter(value as typeof difficultyFilter)} className={`rounded-xl py-1.5 text-[10px] font-black ${difficultyFilter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{label}</button>
            ))}
          </div>
        </section>
      )}

      {!isLoggedIn && (
        <div className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
          <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black">Login Saldo untuk klaim</p>
            <p className="text-xs text-muted-foreground">Quest tetap kelihatan, tapi hadiah disimpan setelah kamu masuk.</p>
          </div>
          <Button size="sm" onClick={() => onNavigate?.("saldo")} className="font-bold">Login</Button>
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black flex items-center gap-2">
            {isDaily ? <Sparkles className="w-4 h-4 text-primary" /> : isWeekly ? <CalendarDays className="w-4 h-4 text-primary" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
            {isDaily ? "Misi Hari Ini" : isWeekly ? "Misi Minggu Ini" : "Premium Quest"}
          </h3>
          <span className="text-[10px] text-muted-foreground font-bold">{isDaily ? "Reset 00:00 WIB" : isWeekly ? "Reset Senin 00:00 WIB" : premiumInfo.is_active ? "Premium aktif" : "Belum beli"}</span>
        </div>

        <Button
          onClick={claimAll}
          disabled={ready === 0 || claimingAll}
          className={`w-full h-10 font-black transition-all ${ready === 0 ? "opacity-40 blur-[1px] pointer-events-none grayscale" : "bg-gradient-to-r from-accent to-primary text-primary-foreground shadow-sm"}`}
        >
          {claimingAll ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <><Gift className="w-4 h-4 mr-2" /> Klaim Semua{ready > 0 ? ` (${ready})` : ""}</>
          )}
        </Button>


        {listLoading ? (
          <div className="rounded-2xl border border-border bg-card p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : activeList.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Belum ada quest aktif.</div>
        ) : activeList.map((mission, index) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            index={index}
            claiming={claiming}
            onClaim={claimMission}
            onNavigate={onNavigate}
          />
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black flex items-center gap-2"><Rocket className="w-4 h-4 text-primary" /> Event Spesial</h3>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-accent text-accent-foreground uppercase tracking-wide">
            {eventCountdown.done ? "Live!" : "Segera"}
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-primary/40 p-4 shadow-sm"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/20 via-primary/15 to-amber-500/20" />
          <div className="relative">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                <Zap className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-black leading-tight">Premium Quest Rush</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Event besok khusus Premium Quest. Misi terlihat gelap sebelum aktif, lalu PRO LEGEND membuka hadiah 💎 + 🪙 + IN.
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {[
                { label: "Hari", value: eventCountdown.d },
                { label: "Jam", value: eventCountdown.h },
                { label: "Menit", value: eventCountdown.m },
                { label: "Detik", value: eventCountdown.s },
              ].map((unit) => (
                <div key={unit.label} className="rounded-2xl bg-background/70 border border-border py-2 text-center">
                  <p className="text-xl font-black tabular-nums leading-none">{String(unit.value).padStart(2, "0")}</p>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase mt-1">{unit.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-primary">
                <Clock3 className="w-3.5 h-3.5" />
                {new Date(SPECIAL_EVENT_START).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} • 20:00 WIB
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">
                💎 Hadiah Jumbo
              </span>
            </div>
          </div>
        </motion.div>
      </section>



      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black flex items-center gap-2"><Clock3 className="w-4 h-4 text-primary" /> Event Berikutnya</h3>
          <span className="text-[10px] text-muted-foreground font-bold">Terkunci</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {events.map((event) => (
            <div key={event.title} className="relative h-28 overflow-hidden rounded-2xl border border-border bg-card">
              <img src={event.image} alt={event.title} className="absolute inset-0 w-full h-full object-cover opacity-60" loading="lazy" />
              <div className="absolute inset-0 bg-background/75 backdrop-blur-[1px]" />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
              <div className="relative h-full p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-muted/80 border border-border flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black truncate">{event.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{event.desc}</p>
                  <p className="mt-1 text-[10px] font-black text-primary uppercase tracking-wide">{event.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {pinPlan && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onMouseDown={() => !buyingPlan && setPinPlan(null)}>
          <div className="w-full max-w-sm rounded-3xl border bg-card p-4 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/15">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-black">{premiumInfo.is_active ? "Perpanjang" : "Beli"} {pinPlan.name}</p>
                <p className="text-xs text-muted-foreground">Harga {formatSaldoIn(pinPlan.price_balance || pinPlan.price_saldo_in)}. Saldo IN dipakai dulu jika ada, lalu saldo biasa.</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label className="text-[11px] font-black text-muted-foreground">PIN Saldo 6 Digit</label>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                type="password"
                className="h-11 w-full rounded-2xl border bg-background px-3 text-center text-lg font-black tracking-[0.35em] outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={!!buyingPlan} onClick={() => setPinPlan(null)}>Batal</Button>
              <Button disabled={!!buyingPlan || pin.length !== 6} onClick={submitPremiumPurchase} className="font-black">
                {buyingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bayar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
