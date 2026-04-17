import { motion, AnimatePresence } from "framer-motion";
import { Lock, Award } from "lucide-react";
import { ACHIEVEMENTS, type Achievement } from "./streakRewards";
import { Button } from "@/components/ui/button";

interface Props {
  unlockedIds: string[];
  newlyUnlocked: Achievement | null;
  onCloseNewly: () => void;
}

export default function AchievementBadges({ unlockedIds, newlyUnlocked, onCloseNewly }: Props) {
  const unlockedCount = unlockedIds.length;
  const total = ACHIEVEMENTS.length;
  const progress = (unlockedCount / total) * 100;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="glass-card-strong rounded-2xl border p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-500" /> Achievement Badges
          </h4>
          <span className="text-[10px] font-bold text-muted-foreground">{unlockedCount}/{total}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
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
                    ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 shadow-md"
                    : "bg-muted/40 border border-border opacity-60"
                }`}
                title={`${a.label}: ${a.description}`}
              >
                {unlocked ? (
                  <motion.div
                    animate={{ rotate: [0, 8, -8, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, delay: i * 0.2 }}
                    className="text-xl leading-none"
                  >
                    {a.emoji}
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
                  <span className="text-7xl block">{newlyUnlocked.emoji}</span>
                </motion.div>

                <div>
                  <p className="text-[10px] font-black text-purple-500 tracking-widest">ACHIEVEMENT UNLOCKED</p>
                  <h3 className="text-xl font-extrabold mt-1">{newlyUnlocked.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{newlyUnlocked.description}</p>
                </div>

                <Button
                  onClick={onCloseNewly}
                  className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-bold"
                >
                  Keren! 🎉
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
