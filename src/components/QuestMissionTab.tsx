import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock3, Flame, Gamepad2, Gem, Gift, Loader2, Lock, Music2, ShoppingBag, Sparkles, Target, Trophy } from "lucide-react";
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
  icon: string;
  current_value: number;
  is_completed: boolean;
  claimed_at: string | null;
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
};

const targetTab: Record<string, string> = {
  game_play: "game",
  game_win: "game",
  game_points: "game",
  music_listen: "musik",
  purchase: "produk",
  spin_wheel: "rodadiskon",
  streak_claim: "streak",
  mystery_box: "streak",
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

function rewardText(mission: Pick<Mission, "reward_coins" | "reward_saldo_in" | "reward_gems">) {
  return [
    mission.reward_saldo_in > 0 ? `Saldo IN ${mission.reward_saldo_in}` : null,
    mission.reward_gems > 0 ? `${mission.reward_gems} Gem` : null,
    mission.reward_coins > 0 ? `${mission.reward_coins} Coin` : null,
  ].filter(Boolean).join(" • ");
}

export default function QuestMissionTab({ visitorId, isLoggedIn = false, onNavigate, onUpdate }: Props) {
  const { toast } = useToast();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(getResetCountdown());
  const today = useMemo(() => getWibDate(), []);

  const completed = missions.filter((mission) => mission.claimed_at).length;
  const ready = missions.filter((mission) => mission.is_completed && !mission.claimed_at).length;

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
      setMissions((rows || []).map((row) => {
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

  useEffect(() => {
    loadMissions();
    const timer = window.setInterval(() => setCountdown(getResetCountdown()), 30_000);
    return () => window.clearInterval(timer);
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
      const { data, error } = await supabase.functions.invoke("check-daily-challenge", {
        body: { visitorId, claimChallengeId: mission.id },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Gagal klaim reward");
      toast({ title: "🎯 Quest selesai!", description: `Kamu dapat ${rewardText(mission) || "reward"}.` });
      triggerGameBalanceRefresh();
      onUpdate?.();
      loadMissions();
    } catch (error) {
      toast({ title: "Gagal klaim", description: error instanceof Error ? error.message : "Coba lagi nanti.", variant: "destructive" });
    } finally {
      setClaiming(null);
    }
  }

  const events = [
    { title: "Double Gem Quest", desc: "Hadiah Gem misi harian jadi lebih tebal.", time: "Besok 00:00 WIB", image: musicBanner },
    { title: "Belanja Beruntun", desc: "Event belanja kecil dengan bonus Saldo IN.", time: "Segera dibuka", image: promoProductsImg },
    { title: "Game Rush Night", desc: "Main game, kumpulkan poin, rebut reward ekstra.", time: "Coming Soon", image: promoGameImg },
  ];

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
            <p className="text-xs text-muted-foreground leading-relaxed">Misi harian reset tiap 1 hari. Main, dengar musik, belanja, dan klaim hadiah kecil yang lumayan.</p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-background/70 border border-border p-2 text-center">
            <p className="text-[9px] text-muted-foreground font-bold uppercase">Selesai</p>
            <p className="text-lg font-black tabular-nums">{completed}/{missions.length || 0}</p>
          </div>
          <div className="rounded-2xl bg-background/70 border border-border p-2 text-center">
            <p className="text-[9px] text-muted-foreground font-bold uppercase">Reset</p>
            <p className="text-lg font-black tabular-nums">{countdown}</p>
          </div>
          <div className="rounded-2xl bg-background/70 border border-border p-2 text-center">
            <p className="text-[9px] text-muted-foreground font-bold uppercase">Reward</p>
            <p className="text-lg font-black">💎 + IN</p>
          </div>
        </div>
      </section>

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
          <h3 className="text-sm font-black flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Misi Hari Ini</h3>
          <span className="text-[10px] text-muted-foreground font-bold">Reset 00:00 WIB</span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : missions.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Belum ada quest aktif hari ini.</div>
        ) : missions.map((mission, index) => {
          const Icon = iconMap[mission.challenge_type] || Target;
          const pct = Math.min(100, (mission.current_value / Math.max(1, mission.target_value)) * 100);
          const claimed = !!mission.claimed_at;
          const readyToClaim = mission.is_completed && !claimed;
          return (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`rounded-2xl border p-3 bg-card ${claimed ? "border-primary/40" : readyToClaim ? "border-accent shadow-sm" : "border-border"}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center shrink-0 relative overflow-hidden">
                  <Icon className="w-5 h-5 text-primary" strokeWidth={2.4} />
                  <span className="absolute -right-1 -bottom-1 text-lg opacity-70">{mission.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black truncate">{mission.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{mission.description}</p>
                    </div>
                    <div className="text-right shrink-0 max-w-[116px]">
                      <p className="text-[10px] font-black text-primary leading-tight">{rewardText(mission)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={pct} className="h-2 flex-1" />
                    <span className="text-[10px] font-black tabular-nums text-muted-foreground">{Math.min(mission.current_value, mission.target_value)}/{mission.target_value}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {claimed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-primary"><Check className="w-4 h-4" strokeWidth={3} /> Sudah diklaim</span>
                ) : readyToClaim ? (
                  <Button disabled={claiming === mission.id} onClick={() => claimMission(mission)} className="h-9 flex-1 font-black">
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
        })}
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
    </div>
  );
}