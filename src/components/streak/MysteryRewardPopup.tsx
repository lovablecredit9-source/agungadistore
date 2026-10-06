import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Rocket } from "lucide-react";
import type { MysteryReward, Rarity } from "./streakRewards";
import { getRarityLabel } from "./streakRewards";
import { useStreakMotion } from "./useStreakMotion";

interface Props {
  reward: MysteryReward | null;
  onClose: () => void;
}

const RARITY_STYLE: Record<Rarity, { c: string; a: string; bg: string; particles: number; rays: boolean }> = {
  common: { c: "#94a3b8", a: "#e2e8f0", bg: "#0f141c", particles: 6, rays: false },
  rare: { c: "#38bdf8", a: "#a5f3fc", bg: "#05131f", particles: 12, rays: false },
  epic: { c: "#c026d3", a: "#f0abfc", bg: "#16051c", particles: 22, rays: true },
  legendary: { c: "#f59e0b", a: "#fde68a", bg: "#1a1103", particles: 34, rays: true },
};

export default function MysteryRewardPopup({ reward, onClose }: Props) {
  const { reduced, particleFactor } = useStreakMotion();
  const st = reward ? RARITY_STYLE[reward.rarity] : RARITY_STYLE.common;
  const count = Math.round(st.particles * particleFactor);
  const parts = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      ang: (i / Math.max(1, count)) * Math.PI * 2,
      dist: 110 + ((i * 53) % 90),
      d: 1.2 + ((i * 17) % 10) / 10,
    })),
    [count],
  );

  return (
    <AnimatePresence>
      {reward && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[101] flex items-center justify-center p-4 overflow-hidden"
          style={{ background: `radial-gradient(circle at 50% 45%, ${st.c}33 0%, rgba(0,0,0,.88) 60%)` }}
          onClick={onClose}
          role="dialog"
          aria-label="Mystery Reward"
        >
          {st.rays && !reduced && (
            <div
              className="absolute w-[150vmax] h-[150vmax] stk-ring opacity-30 pointer-events-none"
              style={{ background: `repeating-conic-gradient(${st.a}33 0 5deg, transparent 5deg 24deg)` }}
            />
          )}

          <motion.div
            initial={{ scale: 0.3, rotateY: 180 }}
            animate={{ scale: 1, rotateY: 0 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", damping: 13, stiffness: 110 }}
            className="streak-stage w-full max-w-xs rounded-3xl p-6 text-center relative overflow-hidden border"
            style={{
              background: `linear-gradient(160deg, ${st.c}30, ${st.bg} 55%, #05050a)`,
              borderColor: `${st.c}88`,
              boxShadow: `0 0 40px ${st.c}55, inset 0 1px 0 rgba(255,255,255,.1)`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <span className="absolute inset-y-0 w-1/3 stk-shine pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)" }} />

            <div className="relative z-10 space-y-4">
              <motion.div
                initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                className="inline-block px-3 py-1 rounded-full border text-[10px] font-black tracking-[0.3em]"
                style={{ borderColor: st.a, color: st.a, background: `${st.c}33`, boxShadow: `0 0 14px ${st.c}` }}
              >
                {getRarityLabel(reward.rarity)}
              </motion.div>

              {/* Reward orb */}
              <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full stk-aura" style={{ background: `radial-gradient(circle, ${st.c}88 0%, ${st.c}22 45%, transparent 70%)` }} />
                <div
                  className="absolute inset-3 rounded-full stk-ring"
                  style={{
                    background: `conic-gradient(transparent 0 25%, ${st.a} 40%, transparent 55% 80%, ${st.c} 92%, transparent)`,
                    WebkitMask: "radial-gradient(circle, transparent 62%, #000 64%, #000 67%, transparent 69%)",
                    mask: "radial-gradient(circle, transparent 62%, #000 64%, #000 67%, transparent 69%)",
                  }}
                />
                {!reduced && parts.map((p, i) => (
                  <motion.span
                    key={i}
                    className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full"
                    style={{ background: i % 2 ? st.a : st.c, boxShadow: `0 0 8px ${st.c}` }}
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{ x: Math.cos(p.ang) * p.dist, y: Math.sin(p.ang) * p.dist, opacity: 0 }}
                    transition={{ duration: p.d, delay: 0.3, ease: "easeOut" }}
                  />
                ))}
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: [0, 1.3, 1], rotate: 0 }}
                  transition={{ delay: 0.25, duration: 0.6 }}
                  className="relative text-6xl"
                  style={{ filter: `drop-shadow(0 0 16px ${st.c})` }}
                >
                  {reward.emoji}
                </motion.span>
              </div>

              <motion.h3
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="text-lg font-black flex items-center justify-center gap-2"
              >
                <Gift className="w-5 h-5" style={{ color: st.a }} /> Mystery Reward!
              </motion.h3>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: "spring" }}
                className="rounded-2xl p-4 border"
                style={{ background: `linear-gradient(90deg, ${st.c}55, ${st.c}22)`, borderColor: `${st.a}55` }}
              >
                <p className="stk-muted text-[10px] font-bold uppercase tracking-widest mb-1">Kamu mendapat</p>
                <p className="text-xl font-black">{reward.label}</p>
              </motion.div>

              <p className="stk-muted text-xs italic">"{reward.message}"</p>

              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 transition"
                style={{ background: `linear-gradient(90deg, ${st.c}, ${st.a})`, color: st.bg }}
              >
                Mantap! <Rocket className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
