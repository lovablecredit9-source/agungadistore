import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Target, Loader2, Check, Coins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface Quest {
  id: string;
  title: string;
  description: string;
  target_value: number;
  reward_coins: number;
  reward_xp: number;
  icon: string;
}

interface QProgress {
  quest_id: string;
  current_value: number;
  is_completed: boolean;
  claimed_at: string | null;
}

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

export default function WeeklyQuests({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [progress, setProgress] = useState<QProgress[]>([]);
  const [weekStart, setWeekStart] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        `weekly-quest?action=status&visitorId=${visitorId}`,
        { method: "GET" as any },
      );
      if (error) throw error;
      setQuests((data as any).quests || []);
      setProgress((data as any).progress || []);
      setWeekStart((data as any).weekStart);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  const handleClaim = async (questId: string) => {
    setClaiming(questId);
    try {
      const { data, error } = await supabase.functions.invoke("weekly-quest?action=claim", {
        body: { visitorId, questId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "🎯 Quest Selesai!", description: `+${(data as any).coins} Coins, +${(data as any).xp} XP Pass` });
      load();
      onUpdate?.();
    } catch (e) {
      toast({ title: "Gagal klaim", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setClaiming(null);
    }
  };

  if (loading) return (
    <div className="cyber-card-pink rounded-2xl p-4 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-pink-300" />
    </div>
  );

  const endDate = weekStart ? new Date(new Date(weekStart).getTime() + 6 * 24 * 3600 * 1000) : new Date();
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="cyber-card-pink rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 icon-3d-target" strokeWidth={2.5} />
          <span className="text-xs font-black neon-text-pink tracking-widest uppercase">Quest Mingguan</span>
        </div>
        <span className="text-[9px] font-bold text-white/60 uppercase tracking-wider">{daysLeft}h tersisa</span>
      </div>

      <div className="space-y-1.5">
        {quests.map(q => {
          const p = progress.find(x => x.quest_id === q.id);
          const cur = p?.current_value ?? 0;
          const completed = p?.is_completed ?? false;
          const claimed = !!p?.claimed_at;
          const pct = Math.min(100, (cur / q.target_value) * 100);

          return (
            <motion.div
              key={q.id}
              whileHover={{ scale: 1.005 }}
              className={`p-2 rounded-lg border ${
                claimed
                  ? "bg-green-500/10 border-green-400/50"
                  : completed
                  ? "bg-yellow-500/10 border-yellow-400/60 ring-1 ring-yellow-400/40"
                  : "bg-black/30 border-purple-500/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl shrink-0">{q.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-black text-white truncate">{q.title}</div>
                  <div className="text-[9px] text-white/60 truncate">{q.description}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-bold text-yellow-300 flex items-center gap-0.5">
                    <Coins className="w-2.5 h-2.5" /> {q.reward_coins}
                  </div>
                  <div className="text-[9px] font-bold text-cyan-300 flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> {q.reward_xp}xp
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={pct} className="h-1.5 flex-1" />
                <span className="text-[9px] font-black text-white/80 shrink-0">{cur}/{q.target_value}</span>
              </div>
              {completed && !claimed && (
                <Button
                  onClick={() => handleClaim(q.id)}
                  disabled={claiming === q.id}
                  className="w-full mt-1.5 h-7 text-[10px] font-black bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black uppercase tracking-wider"
                >
                  {claiming === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Klaim Sekarang"}
                </Button>
              )}
              {claimed && (
                <div className="mt-1 text-[9px] font-bold text-green-300 flex items-center gap-1">
                  <Check className="w-3 h-3" strokeWidth={3} /> Sudah diklaim
                </div>
              )}
            </motion.div>
          );
        })}
        {quests.length === 0 && (
          <div className="text-center text-xs text-white/50 py-3">Belum ada quest aktif minggu ini.</div>
        )}
      </div>
    </div>
  );
}
