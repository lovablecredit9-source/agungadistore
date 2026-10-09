import { motion, AnimatePresence } from "framer-motion";
import { Lock, Award, PartyPopper, History } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ACHIEVEMENTS, type Achievement } from "./streakRewards";
import { Button } from "@/components/ui/button";
import { EmojiIcon } from "./emojiToIcon";

interface Props {
  visitorId?: string;
  unlockedIds: string[];
  newlyUnlocked: Achievement | null;
  onCloseNewly: () => void;
}

export default function AchievementBadges({ visitorId, unlockedIds, newlyUnlocked, onCloseNewly }: Props) {
  const [log, setLog] = useState<{ achievement_id: string; unlocked_at: string }[]>([]);
  const [showLog, setShowLog] = useState(false);
  useEffect(() => {
    if (!visitorId) return;
    supabase.functions.invoke("purchase-streak-plan", { body: { action: "achievement_log", visitorId } })
      .then(({ data }) => setLog((data as { log?: { achievement_id: string; unlocked_at: string }[] } | null)?.log || []));
  }, [visitorId, unlockedIds.length]);
  const unlockedCount = unlockedIds.filter((id) => ACHIEVEMENTS.some((a) => a.id === id)).length;
  const total = ACHIEVEMENTS.length;
  const progress = (unlockedCount / total) * 100;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="streak-premium-card rounded-3xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" /> Achievement Badges
          </h4>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-black text-primary">{unlockedCount}/{total}</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={unlockedCount} aria-valuemin={0} aria-valuemax={total} aria-label="Progres achievement">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1 }}
            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full"
          />
        </div>

        <div className="grid grid-cols-5 gap-2">
          {ACHIEVEMENTS.map((a, i) => {
            const unlocked = unlockedIds.includes(a.id);
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-center p-1 transition-all ${
                  unlocked
                    ? "badge-unlocked border border-primary/40"
                    : "bg-muted/30 border border-border/60 backdrop-blur-sm opacity-70"
                }`}
                title={`${a.label}: ${a.description}`}
              >
                {unlocked ? (
                  <motion.div
                    animate={{ rotate: [0, 8, -8, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, delay: i * 0.2 }}
                    className="leading-none"
                  >
                    <EmojiIcon emoji={a.emoji} className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <Lock className="w-4 h-4 text-muted-foreground/50" />
                )}
                <p className={`text-[8px] font-bold text-center mt-0.5 leading-tight line-clamp-2 ${unlocked ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {a.label}
                </p>
              </motion.div>
            );
          })}
        </div>

        <button type="button" onClick={() => setShowLog((v) => !v)} className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-border/60 px-3 text-[12px] font-black">
          <span className="flex items-center gap-1.5"><History className="h-4 w-4" /> 🏆 Achievement History</span><span className="text-muted-foreground">{log.length}</span>
        </button>
        {showLog && (
          <ul className="space-y-1.5">
            {log.length === 0 && <li className="text-center text-[11px] text-muted-foreground">Belum ada riwayat tercatat. Badge yang dibuka sebelum fitur ini tidak memiliki tanggal.</li>}
            {log.map((l) => {
              const a = ACHIEVEMENTS.find((x) => x.id === l.achievement_id);
              return (
                <li key={l.achievement_id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-[11px]">
                  <span className="min-w-0 truncate font-bold">{a ? a.label : l.achievement_id}</span>
                  <span className="shrink-0 text-muted-foreground">{new Date(l.unlocked_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · Terbuka</span>
                </li>
              );
            })}
          </ul>
        )}
      </motion.div>

      {/* Newly unlocked popup */}
      <AnimatePresence>
        {newlyUnlocked && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[102] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={onCloseNewly}
          >
            <motion.div
              initial={{ scale: 0.3, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 14 }}
              className="bg-card w-full max-w-xs rounded-3xl p-6 text-center space-y-4 relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 opacity-20"
                animate={{ opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />

              <div className="relative z-10 space-y-4">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 10 }}
                >
                  <EmojiIcon emoji={newlyUnlocked.emoji} className="w-20 h-20 mx-auto" />
                </motion.div>

                <div>
                  <p className="text-[10px] font-black text-primary tracking-widest">🏆 ACHIEVEMENT UNLOCKED</p>
                  <h3 className="text-xl font-extrabold mt-1">{newlyUnlocked.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{newlyUnlocked.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Badge koleksi — tidak ada hadiah tambahan.</p>
                </div>

                <Button
                  onClick={onCloseNewly}
                  className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-bold"
                >
                  Keren! <PartyPopper className="w-4 h-4 ml-1.5 icon-3d-party" strokeWidth={2.5} />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
