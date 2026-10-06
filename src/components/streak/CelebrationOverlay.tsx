import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Gem, Zap, Star, Sparkles } from "lucide-react";
import type { StreakTier } from "./streakTiers";
import StreakFlame from "./StreakFlame";
import { useStreakMotion } from "./useStreakMotion";

interface Props {
  show: boolean;
  message?: string;
  onComplete?: () => void;
  /** When set, plays the tier-specific milestone cinematic */
  tier?: StreakTier;
  /** milestone day count shown big (e.g. 30) */
  days?: number;
  /** new title earned (e.g. "Master") */
  title?: string;
}

const COLORS = ["#fbbf24", "#ec4899", "#a855f7", "#06b6d4", "#10b981", "#f97316", "#ef4444"];

function EffectIcon({ tier }: { tier: StreakTier }) {
  const cls = "w-8 h-8";
  const style = { color: tier.accent, filter: `drop-shadow(0 0 10px ${tier.color})` };
  switch (tier.effect) {
    case "lightning": return <Zap className={cls} style={style} fill="currentColor" />;
    case "crown": return <Crown className={cls} style={style} fill="currentColor" />;
    case "crystal": case "diamond": return <Gem className={cls} style={style} />;
    case "star": return <Star className={cls} style={style} fill="currentColor" />;
    case "immortal": return <Sparkles className={cls} style={style} />;
    default: return null;
  }
}

export default function CelebrationOverlay({ show, message = "🎉 LUAR BIASA!", onComplete, tier, days, title }: Props) {
  const { reduced, particleFactor } = useStreakMotion();
  const cinematic = !!tier;
  const big = tier ? tier.level >= 7 : false;
  const immortal = tier?.effect === "immortal";
  const duration = immortal ? 7000 : cinematic ? 5200 : 3500;

  const palette = tier ? [tier.color, tier.accent, "#ffffff", ...(immortal ? ["#f472b6", "#67e8f9", "#a78bfa"] : [])] : COLORS;
  const confettiCount = Math.round((immortal ? 110 : big ? 80 : 56) * (particleFactor || 0.25));

  const particles = useMemo(
    () => (show ? Array.from({ length: confettiCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: palette[i % palette.length],
      delay: Math.random() * 0.6,
      rotate: Math.random() * 720,
      dur: 2.4 + Math.random() * 1.4,
      shard: tier && (tier.effect === "crystal" || tier.effect === "diamond") && i % 2 === 0,
    })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [show, confettiCount, tier?.id],
  );

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onComplete?.(), duration);
    return () => clearTimeout(t);
  }, [show, onComplete, duration]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={cinematic ? () => onComplete?.() : undefined}
          className={`fixed inset-0 z-[300] flex items-center justify-center overflow-hidden ${cinematic ? "pointer-events-auto" : "pointer-events-none"}`}
          role={cinematic ? "dialog" : undefined}
          aria-label={cinematic ? `Milestone ${days ?? ""} hari` : undefined}
        >
          {cinematic && tier && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ background: `radial-gradient(circle at 50% 42%, ${tier.color}40 0%, ${tier.bg}f2 45%, #000000f5 100%)` }}
            />
          )}

          {/* Light rays for big tiers */}
          {cinematic && tier && big && !reduced && (
            <div
              className="absolute w-[160vmax] h-[160vmax] stk-ring opacity-40 pointer-events-none"
              style={{ background: `repeating-conic-gradient(${tier.accent}33 0 4deg, transparent 4deg 22deg)` }}
            />
          )}

          {/* Confetti / shards */}
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ y: -80, x: `${p.x}vw`, rotate: 0, opacity: 1 }}
              animate={{ y: "110vh", rotate: p.rotate, opacity: [1, 1, 0] }}
              transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}
              className={`absolute left-0 top-0 ${p.shard ? "w-2 h-4" : "w-2.5 h-3.5 rounded-sm"}`}
              style={{
                background: p.color,
                boxShadow: `0 0 10px ${p.color}`,
                clipPath: p.shard ? "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" : undefined,
              }}
            />
          ))}

          {/* Fireworks */}
          {(!cinematic || (tier && tier.level >= 5)) && !reduced && [...Array(immortal ? 8 : 5)].map((_, i) => (
            <motion.div
              key={`fw-${i}`}
              className="absolute w-2 h-2 rounded-full pointer-events-none"
              style={{
                left: `${12 + ((i * 37) % 76)}%`,
                top: `${18 + ((i * 23) % 50)}%`,
                background: palette[i % palette.length],
                boxShadow: `0 0 60px 30px ${palette[i % palette.length]}`,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 1.2, delay: 0.6 + i * 0.35, repeat: immortal ? 2 : 1 }}
            />
          ))}

          {cinematic && tier ? (
            <motion.div
              className="streak-stage relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 14, delay: 0.15 }}
              onClick={e => e.stopPropagation()}
            >
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-2 mb-1"
              >
                <EffectIcon tier={tier} />
                <span className="text-[11px] font-black tracking-[0.3em] uppercase" style={{ color: tier.accent }}>
                  Milestone Tercapai
                </span>
              </motion.div>

              <motion.div
                initial={{ scale: 0.3 }}
                animate={{ scale: [0.3, 1.15, 1] }}
                transition={{ duration: 1, delay: 0.2 }}
              >
                <StreakFlame streak={tier.minDays} tier={tier} size={immortal ? 240 : big ? 220 : 190} burstKey={1} priority />
              </motion.div>

              {days !== undefined && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.3, 1], opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.6 }}
                  className="text-6xl font-black tabular-nums leading-none -mt-2"
                  style={{ color: tier.accent, textShadow: `0 0 24px ${tier.color}, 0 0 48px ${tier.color}88` }}
                >
                  {days} <span className="text-2xl align-middle">HARI</span>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="mt-3 rounded-2xl px-5 py-3 border relative overflow-hidden w-full"
                style={{ borderColor: `${tier.accent}66`, background: `linear-gradient(135deg, ${tier.color}33, ${tier.bg}cc)` }}
              >
                <span className="absolute inset-y-0 w-1/3 stk-shine" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent)" }} />
                <p className="stk-muted text-[10px] font-bold uppercase tracking-widest">Gelar Baru</p>
                <p className={`font-black ${immortal ? "text-3xl tracking-[0.2em]" : "text-2xl"}`} style={{ color: immortal ? tier.color : undefined }}>
                  {immortal ? "IMMORTAL" : title ?? tier.name}
                </p>
                <p className="stk-muted text-[11px] mt-0.5">{tier.emoji} {tier.name} terbuka</p>
              </motion.div>

              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6 }}
                onClick={() => onComplete?.()}
                className="mt-4 h-11 px-8 rounded-xl font-black text-sm active:scale-95 transition"
                style={{ background: `linear-gradient(90deg, ${tier.color}, ${tier.accent})`, color: tier.bg }}
              >
                Mantap!
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: [0, 1.3, 1], rotate: [-10, 5, 0] }}
              transition={{ type: "spring", damping: 12, delay: 0.2 }}
              className="relative z-10 text-center pointer-events-auto"
            >
              <div className="text-5xl md:text-7xl font-black bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(236,72,153,0.8)]">
                {message}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
