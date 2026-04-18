import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { EmojiIcon } from "./emojiToIcon";

interface Stage {
  id: string;
  min_streak: number;
  stage_name: string;
  emoji: string;
  color_from: string;
  color_to: string;
}

interface Props {
  visitorId: string;
  currentStreak: number;
  longestStreak: number;
}

export default function StreakAvatarEvolution({ visitorId, currentStreak, longestStreak }: Props) {
  const [stages, setStages] = useState<Stage[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("streak_avatar_stages")
        .select("*")
        .eq("is_active", true)
        .order("min_streak");
      setStages((data as Stage[]) || []);
    })();
  }, []);

  if (stages.length === 0) return null;

  const currentStage = [...stages].reverse().find(s => longestStreak >= s.min_streak) || stages[0];
  const nextStage = stages.find(s => s.min_streak > longestStreak);
  const progress = nextStage ? Math.min(100, ((longestStreak - currentStage.min_streak) / (nextStage.min_streak - currentStage.min_streak)) * 100) : 100;

  return (
    <div
      className="rounded-2xl p-4 relative overflow-hidden border border-white/20"
      style={{ background: `linear-gradient(135deg, ${currentStage.color_from}, ${currentStage.color_to})` }}
    >
      {/* Glow ring */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 flex items-center gap-4">
        <motion.div
          animate={{ y: [0, -6, 0], rotate: [-3, 3, -3], scale: [1, 1.06, 1] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/30 to-white/5 backdrop-blur-md flex items-center justify-center shadow-2xl ring-2 ring-white/40"
        >
          <EmojiIcon emoji={currentStage.emoji} className="w-10 h-10 drop-shadow-2xl" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black tracking-widest text-white/80 uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Evolusi Streak
          </div>
          <div className="text-xl font-black text-white drop-shadow truncate">{currentStage.stage_name}</div>
          {nextStage ? (
            <>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden mt-1.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-yellow-300 via-pink-300 to-cyan-300"
                />
              </div>
              <div className="text-[10px] font-bold text-white/90 mt-1 flex items-center gap-1">
                <span>{longestStreak}h →</span>
                <EmojiIcon emoji={nextStage.emoji} className="w-3 h-3" />
                <span className="truncate">{nextStage.stage_name} ({nextStage.min_streak}h)</span>
              </div>
            </>
          ) : (
            <div className="text-[10px] font-black text-yellow-200 mt-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> TINGKAT MAKSIMAL!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
