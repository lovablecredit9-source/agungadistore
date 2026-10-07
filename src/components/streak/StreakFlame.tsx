import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { getStreakTier, type StreakTier } from "./streakTiers";
import { useStreakMotion } from "./useStreakMotion";
import { LiveFlameSvg } from "./LiveFlameSvg";

interface Props {
  streak: number;
  /** override tier (e.g. avatar stage / milestone preview) */
  tier?: StreakTier;
  size?: number;
  /** increment to replay the claim burst */
  burstKey?: number;
  /** compact: no ring/particles (calendar, chips) */
  mini?: boolean;
  gray?: boolean;
  priority?: boolean;
  className?: string;
}

// tiny deterministic PRNG so particles are stable between renders
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function StreakFlameBase({ streak, tier: tierProp, size = 160, burstKey = 0, mini, gray, className = "" }: Props) {
  const tier = tierProp ?? getStreakTier(streak);
  const { reduced, particleFactor } = useStreakMotion();
  const embers = mini ? 0 : Math.round(tier.particles * particleFactor);

  const emberList = useMemo(
    () => Array.from({ length: embers }, (_, i) => ({
      x: 22 + seeded(i, tier.level) * 56,
      drift: (seeded(i, tier.level + 3) - 0.5) * 40,
      dur: 2.2 + seeded(i, tier.level + 7) * 2.2,
      delay: seeded(i, tier.level + 11) * 3,
      s: 2 + seeded(i, tier.level + 13) * 3,
    })),
    [embers, tier.level],
  );

  const flameSize = Math.round(size * (mini ? 1 : tier.scale));

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center ${className}`}
      style={{ width: size, height: size, ["--stk-c" as any]: tier.color, ["--stk-a" as any]: tier.accent }}
      aria-hidden
    >
      {/* Aura */}
      {!gray && (
        <div
          className={`absolute inset-[-12%] rounded-full ${reduced ? "" : "stk-aura"}`}
          style={{ background: `radial-gradient(circle, ${tier.color}66 0%, ${tier.color}22 38%, transparent 68%)`, filter: "blur(6px)" }}
        />
      )}

      {/* Energy rings */}
      {!mini && !gray && (
        <>
          <div
            className={`absolute inset-[4%] rounded-full ${reduced ? "" : "stk-ring"}`}
            style={{
              background: `conic-gradient(from 0deg, transparent 0 20%, ${tier.color} 32%, transparent 45% 70%, ${tier.accent} 82%, transparent 95%)`,
              WebkitMask: "radial-gradient(circle, transparent 64%, #000 65.5%, #000 67%, transparent 68.5%)",
              mask: "radial-gradient(circle, transparent 64%, #000 65.5%, #000 67%, transparent 68.5%)",
              opacity: 0.85,
            }}
          />
          {tier.level >= 5 && (
            <div
              className={`absolute inset-[-2%] rounded-full ${reduced ? "" : "stk-ring-rev"}`}
              style={{
                border: `1px dashed ${tier.accent}88`,
                boxShadow: `0 0 18px ${tier.color}44 inset`,
              }}
            />
          )}
          {tier.effect === "immortal" && (
            <div
              className={`absolute inset-[-8%] rounded-full ${reduced ? "" : "stk-ring"}`}
              style={{
                background: "conic-gradient(#f472b6, #fde68a, #67e8f9, #a78bfa, #f472b6)",
                WebkitMask: "radial-gradient(circle, transparent 66%, #000 67%, #000 68.5%, transparent 69.5%)",
                mask: "radial-gradient(circle, transparent 66%, #000 67%, #000 68.5%, transparent 69.5%)",
                opacity: 0.9,
              }}
            />
          )}
          {tier.effect === "star" && !reduced && (
            <div
              className="absolute inset-[-6%] stk-ring opacity-60"
              style={{ background: `repeating-conic-gradient(${tier.accent}55 0 2deg, transparent 2deg 30deg)`, WebkitMask: "radial-gradient(circle, #000 20%, transparent 70%)", mask: "radial-gradient(circle, #000 20%, transparent 70%)" }}
            />
          )}
        </>
      )}

      {/* Live procedural flame (layered SVG; each layer moves on its own timing) */}
      <div className="relative z-[1]" style={{ width: flameSize, height: flameSize * 1.12, marginTop: -flameSize * 0.12, filter: gray ? "none" : `drop-shadow(0 0 ${mini ? 3 : 12}px ${tier.color}99)` }}>
        <LiveFlameSvg tier={tier} animated={!reduced && !mini} gray={gray} />
      </div>

      {/* Lightning flashes (energy tier) */}
      {!mini && !reduced && tier.effect === "lightning" && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 z-[2] stk-bolt pointer-events-none">
          <path d="M70 12 L58 40 L68 42 L52 74" stroke={tier.accent} strokeWidth="2" fill="none" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${tier.accent})` }} />
          <path d="M28 20 L36 44 L28 46 L40 70" stroke={tier.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${tier.accent})` }} />
        </svg>
      )}

      {/* Embers */}
      {emberList.length > 0 && (
        <div className="absolute inset-0 z-[3] overflow-hidden rounded-full pointer-events-none">
          {emberList.map((e, i) => (
            <span
              key={i}
              className="stk-ember absolute rounded-full"
              style={{
                left: `${e.x}%`,
                bottom: "22%",
                width: e.s,
                height: e.s,
                background: i % 3 === 0 ? tier.accent : tier.color,
                boxShadow: `0 0 6px ${tier.color}`,
                ["--stk-drift" as any]: `${e.drift}px`,
                animationDuration: `${e.dur}s`,
                animationDelay: `${e.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Claim burst (Framer Motion, only on interaction) */}
      {burstKey > 0 && !reduced && (
        <div key={burstKey} className="absolute inset-0 z-[4] pointer-events-none">
          <motion.div
            className="absolute inset-[10%] rounded-full"
            style={{ border: `3px solid ${tier.accent}`, boxShadow: `0 0 30px ${tier.color}` }}
            initial={{ scale: 0.4, opacity: 1 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
          <motion.div
            className="absolute inset-[22%] rounded-full"
            style={{ background: `radial-gradient(circle, ${tier.accent} 0%, ${tier.color}88 40%, transparent 70%)` }}
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          {Array.from({ length: Math.max(8, Math.round(18 * particleFactor)) }).map((_, i, arr) => {
            const ang = (i / arr.length) * Math.PI * 2;
            const dist = size * (0.55 + seeded(i, burstKey) * 0.35);
            return (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{ width: 5, height: 5, marginLeft: -2.5, marginTop: -2.5, background: i % 2 ? tier.accent : tier.color, boxShadow: `0 0 8px ${tier.color}` }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, opacity: 0, scale: 0.3 }}
                transition={{ duration: 1 + seeded(i, 5) * 0.4, ease: "easeOut" }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

const StreakFlame = memo(StreakFlameBase);
export default StreakFlame;
