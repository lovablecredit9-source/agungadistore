import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy, Loader2, Lock, Check, Coins, Snowflake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Milestone {
  id: string;
  milestone_days: number;
  title: string;
  description: string;
  reward_type: string;
  reward_value: number;
  badge_icon: string;
  is_claimed: boolean;
  is_unlocked: boolean;
  progress: number;
}

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

export default function StreakMilestones({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [longest, setLongest] = useState(0);
  const [claiming, setClaiming] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.functions.invoke("claim-milestone", { body: { visitorId, action: "list" } });
    if (data) {
      setMilestones(data.milestones || []);
      setLongest(data.longestStreak || 0);
    }
  }

  useEffect(() => { if (visitorId) load(); /* eslint-disable-next-line */ }, [visitorId]);

  async function claim(m: Milestone) {
    setClaiming(m.id);
    const { data, error } = await supabase.functions.invoke("claim-milestone", { body: { visitorId, milestoneId: m.id } });
    if (error || data?.error) {
      toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: `${m.badge_icon} ${m.title}`, description: `+${m.reward_value} ${m.reward_type === "coins" ? "koin" : "freeze"}!` });
      load();
      onUpdate?.();
    }
    setClaiming(null);
  }

  if (milestones.length === 0) return null;

  return (
    <div className="cyber-card-cyan rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 icon-3d-trophy" strokeWidth={2.5} />
          <span className="text-xs font-black neon-text-cyan tracking-widest uppercase">Milestone Streak</span>
        </div>
        <span className="text-[10px] font-bold text-white/60 tabular-nums">Best: {longest} hari</span>
      </div>

      <div className="space-y-2">
        {milestones.map((m, i) => {
          const claimable = m.is_unlocked && !m.is_claimed;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`relative rounded-xl p-3 border ${
                m.is_claimed
                  ? "bg-emerald-950/40 border-emerald-500/30"
                  : claimable
                  ? "bg-gradient-to-r from-yellow-900/40 to-pink-900/40 border-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.3)]"
                  : "bg-black/30 border-white/10"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`text-3xl ${!m.is_unlocked ? "grayscale opacity-50" : ""}`}>
                  {m.badge_icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm truncate">{m.title}</span>
                    <span className="text-[10px] font-black text-yellow-300 tabular-nums whitespace-nowrap">{m.milestone_days}h</span>
                  </div>
                  <div className="text-[10px] text-white/60 line-clamp-1">{m.description}</div>
                  {!m.is_unlocked && (
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-cyan-400 to-pink-400" style={{ width: `${m.progress}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-black neon-text-yellow flex items-center gap-1 tabular-nums">
                    +{m.reward_value}
                    {m.reward_type === "coins" ? <Coins className="w-3 h-3" /> : <Snowflake className="w-3 h-3 text-cyan-300" />}
                  </span>
                  {m.is_claimed ? (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" strokeWidth={3} /> DIDAPAT
                    </span>
                  ) : claimable ? (
                    <Button
                      size="sm"
                      onClick={() => claim(m)}
                      disabled={claiming === m.id}
                      className="h-6 px-2 text-[10px] bg-gradient-to-r from-yellow-400 to-pink-500 text-black font-black"
                    >
                      {claiming === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "KLAIM"}
                    </Button>
                  ) : (
                    <Lock className="w-3 h-3 text-white/30" />
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
