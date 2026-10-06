import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight } from "lucide-react";
import { EmojiIcon } from "./emojiToIcon";
import StreakFlame from "./StreakFlame";
import { getStreakTier } from "./streakTiers";

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

const SEEN_KEY = (v: string) => `streak_avatar_stage_seen_${v}`;

export default function StreakAvatarEvolution({ visitorId, currentStreak, longestStreak }: Props) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [unlocked, setUnlocked] = useState<Stage | null>(null);

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

  const currentStage = stages.length ? ([...stages].reverse().find(s => longestStreak >= s.min_streak) || stages[0]) : null;
  const nextStage = stages.find(s => s.min_streak > longestStreak);

  // Unlock animation when the stage advanced since the last time this device saw it (visual only)
  useEffect(() => {
    if (!currentStage || !visitorId) return;
    try {
      const seen = localStorage.getItem(SEEN_KEY(visitorId));
      if (seen && seen !== currentStage.id) setUnlocked(currentStage);
      localStorage.setItem(SEEN_KEY(visitorId), currentStage.id);
    } catch { /* storage unavailable */ }
  }, [currentStage?.id, visitorId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentStage) return null;

  const progress = nextStage ? Math.min(100, ((longestStreak - currentStage.min_streak) / (nextStage.min_streak - currentStage.min_streak)) * 100) : 100;
  const tier = getStreakTier(Math.max(currentStage.min_streak, 1));
  const stageIndex = stages.findIndex(s => s.id === currentStage.id);

  return (
    <>
      <div
        className="streak-stage rounded-2xl p-4 relative overflow-hidden border-2"
        style={{
          borderColor: `${currentStage.color_to}aa`,
          background: `radial-gradient(120% 90% at 15% 30%, ${currentStage.color_from}66, ${tier.bg} 60%, #05050a)`,
          boxShadow: `0 10px 34px -12px ${currentStage.color_from}, inset 0 1px 0 rgba(255,255,255,.1)`,
        }}
      >
        <span className="absolute inset-y-0 w-1/3 stk-shine pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent)" }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative shrink-0">
            <StreakFlame streak={currentStage.min_streak} tier={tier} size={84} />
            <div
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl flex items-center justify-center border-2"
              style={{ background: `linear-gradient(135deg, ${currentStage.color_from}, ${currentStage.color_to})`, borderColor: tier.accent, boxShadow: `0 0 10px ${tier.color}` }}
            >
              <EmojiIcon emoji={currentStage.emoji} className="w-5 h-5 drop-shadow" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black tracking-widest uppercase flex items-center gap-1" style={{ color: tier.accent }}>
              <Sparkles className="w-3 h-3" /> Evolusi Streak · Tahap {stageIndex + 1}/{stages.length}
            </div>
            <div className="text-xl font-black truncate" style={{ textShadow: `0 0 14px ${tier.color}` }}>{currentStage.stage_name}</div>
            <div className="text-[10px] stk-muted truncate">{tier.emoji} {tier.name} · streak {currentStreak} hari</div>
            {nextStage ? (
              <>
                <div className="h-2 rounded-full overflow-hidden mt-1.5" style={{ background: "rgba(0,0,0,.4)" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1 }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${currentStage.color_from}, ${nextStage.color_to})`, boxShadow: `0 0 8px ${nextStage.color_from}` }}
                  />
                </div>
                <div className="text-[10px] font-bold mt-1 flex items-center gap-1 min-w-0">
                  <span className="shrink-0">{longestStreak}h</span>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  <EmojiIcon emoji={nextStage.emoji} className="w-3 h-3 shrink-0" />
                  <span className="truncate">{nextStage.stage_name} ({nextStage.min_streak}h)</span>
                </div>
              </>
            ) : (
              <div className="text-[10px] font-black mt-1 flex items-center gap-1" style={{ color: "#fde68a" }}>
                <Sparkles className="w-3 h-3" /> TINGKAT MAKSIMAL!
              </div>
            )}
          </div>
        </div>

        {/* Stage path */}
        {stages.length > 1 && (
          <div className="relative z-10 mt-3 flex items-center gap-1 overflow-x-auto pb-1">
            {stages.map((s, i) => {
              const reached = longestStreak >= s.min_streak;
              return (
                <div key={s.id} className="flex items-center shrink-0">
                  {i > 0 && <span className="w-3 h-0.5 rounded-full" style={{ background: reached ? s.color_from : "rgba(255,255,255,.15)" }} />}
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center border"
                    title={`${s.stage_name} · ${s.min_streak}h`}
                    style={reached
                      ? { background: `linear-gradient(135deg, ${s.color_from}, ${s.color_to})`, borderColor: s.id === currentStage.id ? "#fff" : "transparent", boxShadow: s.id === currentStage.id ? `0 0 10px ${s.color_from}` : undefined }
                      : { background: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.12)", filter: "grayscale(1)", opacity: 0.5 }}
                  >
                    <EmojiIcon emoji={s.emoji} className="w-4 h-4" />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unlock animation */}
      <AnimatePresence>
        {unlocked && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="streak-stage fixed inset-0 z-[120] flex items-center justify-center p-6"
            style={{ background: `radial-gradient(circle, ${unlocked.color_from}55 0%, rgba(0,0,0,.9) 60%)` }}
            onClick={() => setUnlocked(null)}
            role="dialog"
            aria-label="Evolusi baru terbuka"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 13 }}
              className="text-center max-w-xs"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-[11px] font-black tracking-[0.3em] uppercase" style={{ color: tier.accent }}>Evolusi Baru!</p>
              <div className="flex justify-center my-2">
                <StreakFlame streak={unlocked.min_streak} tier={tier} size={190} burstKey={1} />
              </div>
              <p className="text-3xl font-black" style={{ textShadow: `0 0 20px ${unlocked.color_from}` }}>{unlocked.stage_name}</p>
              <p className="stk-muted text-xs mt-1">Avatar, aura, dan gelar kamu naik tingkat</p>
              <button
                type="button"
                onClick={() => setUnlocked(null)}
                className="mt-4 h-11 px-8 rounded-xl font-black text-sm active:scale-95 transition"
                style={{ background: `linear-gradient(90deg, ${unlocked.color_from}, ${unlocked.color_to})`, color: "#fff" }}
              >
                Keren!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
