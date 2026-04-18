import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, Gift, Rocket } from "lucide-react";
import type { MysteryReward } from "./streakRewards";
import { getRarityColor, getRarityGlow, getRarityLabel } from "./streakRewards";

interface Props {
  reward: MysteryReward | null;
  onClose: () => void;
}

export default function MysteryRewardPopup({ reward, onClose }: Props) {
  return (
    <AnimatePresence>
      {reward && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[101] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Particles for legendary/epic */}
          {(reward.rarity === "legendary" || reward.rarity === "epic") && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 40 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    width: 4 + Math.random() * 6,
                    height: 4 + Math.random() * 6,
                    background: reward.rarity === "legendary" ? "#fbbf24" : "#c084fc",
                    borderRadius: "50%",
                    boxShadow: `0 0 10px ${reward.rarity === "legendary" ? "#fbbf24" : "#c084fc"}`,
                  }}
                  animate={{
                    y: [0, -100, 0],
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 2,
                  }}
                />
              ))}
            </div>
          )}

          <motion.div
            initial={{ scale: 0.3, rotateY: 180 }}
            animate={{ scale: 1, rotateY: 0 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 100 }}
            className="bg-card w-full max-w-xs rounded-3xl p-6 text-center space-y-4 relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Animated gradient bg */}
            <motion.div
              className={`absolute inset-0 bg-gradient-to-br ${getRarityColor(reward.rarity)}`}
              animate={{ opacity: [0.1, 0.25, 0.1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            {/* Shimmer */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)",
                backgroundSize: "200% 100%",
              }}
              animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />

            <div className="relative z-10 space-y-4">
              {/* Rarity badge */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={`inline-block px-3 py-1 rounded-full bg-gradient-to-r ${getRarityColor(reward.rarity)} shadow-lg ${getRarityGlow(reward.rarity)}`}
              >
                <span className="text-[10px] font-black tracking-widest text-white">{getRarityLabel(reward.rarity)}</span>
              </motion.div>

              {/* Mystery box opening */}
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  rotate: reward.rarity === "legendary" ? [0, 360] : [0, 5, -5, 0],
                }}
                transition={{
                  scale: { duration: 1.2, repeat: Infinity },
                  rotate: reward.rarity === "legendary" ? { duration: 4, repeat: Infinity, ease: "linear" } : { duration: 1.5, repeat: Infinity },
                }}
              >
                <span className="text-7xl block drop-shadow-2xl">{reward.emoji}</span>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Sparkles className="w-5 h-5 mx-auto mb-1 text-yellow-400 animate-pulse" />
                <h3 className="text-xl font-extrabold text-foreground flex items-center justify-center gap-2">
                  <Gift className="w-6 h-6 icon-3d-gift" strokeWidth={2.5} />
                  Mystery Reward!
                </h3>
              </motion.div>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className={`bg-gradient-to-r ${getRarityColor(reward.rarity)} rounded-2xl p-4 shadow-xl ${getRarityGlow(reward.rarity)}`}
              >
                <p className="text-xs font-bold text-white/90 mb-1">Kamu mendapat</p>
                <p className="text-xl font-extrabold text-white drop-shadow">{reward.label}</p>
              </motion.div>

              <p className="text-xs text-muted-foreground italic">"{reward.message}"</p>

              <Button
                onClick={onClose}
                className={`w-full bg-gradient-to-r ${getRarityColor(reward.rarity)} text-white font-bold shadow-lg`}
              >
                Mantap! 🚀
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
