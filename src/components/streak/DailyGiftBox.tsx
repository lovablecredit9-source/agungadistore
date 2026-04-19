import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Loader2, Lock, Check, Sparkles, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Reward {
  id: string;
  day_number: number;
  reward_type: string;
  reward_value: number;
  reward_label: string;
  icon: string;
  is_premium: boolean;
}

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

const MAX_DAY = 30;

export default function DailyGiftBox({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [today, setToday] = useState(1);
  const [todayClaimed, setTodayClaimed] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [openedReward, setOpenedReward] = useState<Reward | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        `gift-box-claim?action=status&visitorId=${visitorId}`,
        { method: "GET" as any },
      );
      if (error) throw error;
      setToday(data.today);
      setTodayClaimed(!!data.todayClaimed);
      setIsPremium(data.isPremium);
      setRewards(data.rewards || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const { data, error } = await supabase.functions.invoke("gift-box-claim?action=claim", {
        body: { visitorId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setOpenedReward((data as any).reward);
      toast({ title: "🎁 Hadiah Diterima!", description: (data as any).reward.reward_label });
      onUpdate?.();
      load();
      // Track weekly quest + daily mission
      import("@/lib/daily-mission").then(m => m.trackDailyMission(visitorId, "gift_box", 1)).catch(() => {});
      // Refresh power-ups cache (kalau hadiahnya power-up)
      import("@/components/games/gameStore").then(m => m.syncPowerUpsFromServer()).catch(() => {});
      window.dispatchEvent(new CustomEvent("power-ups-updated"));
    } catch (e) {
      toast({ title: "Gagal klaim", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return (
    <div className="cyber-card-pink rounded-2xl p-4 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-pink-300" />
    </div>
  );

  const visibleRewards = rewards.filter(r => r.is_premium === isPremium);

  return (
    <div className="cyber-card-pink rounded-2xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 icon-3d-gift" strokeWidth={2.5} />
          <span className="text-xs font-black neon-text-pink tracking-widest uppercase">Daily Gift Box</span>
          {isPremium && (
            <span className="text-[9px] font-black bg-gradient-to-r from-yellow-400 to-amber-500 text-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
              <Crown className="w-2.5 h-2.5" /> Premium
            </span>
          )}
        </div>
        <span className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Skip 1 hari = reset</span>
      </div>

      <div className="overflow-x-auto -mx-1 px-1 pb-1 scrollbar-hide">
        <div className="flex gap-1.5 min-w-max">
          {Array.from({ length: MAX_DAY }, (_, i) => i + 1).map(day => {
            const reward = visibleRewards.find(r => r.day_number === day);
            const isPast = day < today;
            const isToday = day === today;
            const isFuture = day > today;
            const claimed = isPast || (isToday && todayClaimed);
            return (
              <motion.div
                key={day}
                whileHover={isToday && !todayClaimed ? { scale: 1.05 } : {}}
                ref={isToday ? (el) => el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }) : undefined}
                className={`relative w-14 h-16 shrink-0 rounded-lg flex flex-col items-center justify-center text-center p-1 border transition ${
                  claimed
                    ? "bg-green-500/20 border-green-400/60"
                    : isToday
                    ? "bg-gradient-to-br from-pink-500/40 to-purple-600/40 border-pink-400 shadow-lg shadow-pink-500/40 ring-2 ring-pink-400/60 animate-pulse"
                    : "bg-black/40 border-white/10 opacity-60"
                }`}
              >
                <div className="text-[9px] font-black text-white/70 leading-none">D{day}</div>
                <div className="text-lg leading-none my-0.5">{reward?.icon ?? "💎"}</div>
                <div className="text-[8px] font-bold text-white/90 leading-none truncate max-w-full">
                  {reward?.reward_value ? `+${reward.reward_value}` : "?"}
                </div>
                {claimed && (
                  <div className="absolute top-0.5 right-0.5">
                    <Check className="w-2.5 h-2.5 text-green-300" strokeWidth={3} />
                  </div>
                )}
                {isFuture && (
                  <div className="absolute top-0.5 right-0.5">
                    <Lock className="w-2.5 h-2.5 text-white/40" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <Button
        onClick={handleClaim}
        disabled={claiming || todayClaimed}
        className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black h-10 text-xs tracking-wider uppercase"
      >
        {claiming ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuka...</>
        ) : todayClaimed ? (
          <><Check className="w-4 h-4 mr-2" /> Sudah Diklaim Hari Ini</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-2" /> Klaim Hadiah Hari Ke-{today}</>
        )}
      </Button>

      <AnimatePresence>
        {openedReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setOpenedReward(null)}
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.5 }}
              className="bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-700 rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl"
            >
              <div className="text-7xl mb-3">{openedReward.icon}</div>
              <div className="text-xs text-white/80 font-bold uppercase tracking-widest mb-1">Hari Ke-{openedReward.day_number}</div>
              <div className="text-xl font-black text-white mb-4">{openedReward.reward_label}</div>
              <Button onClick={() => setOpenedReward(null)} className="w-full bg-white text-purple-700 hover:bg-white/90 font-black">
                Mantap! 🎉
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
