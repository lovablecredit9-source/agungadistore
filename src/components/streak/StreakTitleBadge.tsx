import { Crown, Flame, Star, Trophy, Gem, Sparkles, Award } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  currentStreak: number;
  longestStreak: number;
  size?: "sm" | "md" | "lg";
}

type FxKind = "soft" | "ember" | "sun" | "shine" | "royal" | "crown" | "diamond" | "mythic" | "phoenix";

interface TitleTier {
  min: number;
  title: string;
  Icon: typeof Crown;
  gradient: string;
  glow: string;
  ring: string;
  fx: FxKind;
}

const TIERS: TitleTier[] = [
  { min: 0, title: "Pendatang Baru", Icon: Sparkles, gradient: "from-slate-400 to-slate-600", glow: "shadow-slate-500/30", ring: "ring-slate-300/30", fx: "soft" },
  { min: 3, title: "Pemula Api", Icon: Flame, gradient: "from-orange-400 via-red-500 to-rose-500", glow: "shadow-orange-500/50", ring: "ring-orange-300/40", fx: "ember" },
  { min: 7, title: "Pejuang Harian", Icon: Award, gradient: "from-amber-300 via-orange-500 to-yellow-500", glow: "shadow-amber-500/50", ring: "ring-amber-300/50", fx: "sun" },
  { min: 14, title: "Petarung Konsisten", Icon: Star, gradient: "from-blue-400 via-indigo-500 to-violet-600", glow: "shadow-indigo-500/50", ring: "ring-blue-300/50", fx: "shine" },
  { min: 30, title: "Master Streak", Icon: Trophy, gradient: "from-purple-400 via-fuchsia-500 to-pink-600", glow: "shadow-fuchsia-500/50", ring: "ring-purple-300/50", fx: "royal" },
  { min: 60, title: "Legenda Hidup", Icon: Crown, gradient: "from-rose-500 via-red-600 to-amber-500", glow: "shadow-rose-500/60", ring: "ring-rose-300/60", fx: "crown" },
  { min: 100, title: "Diamond Soul", Icon: Gem, gradient: "from-cyan-300 via-sky-400 to-indigo-500", glow: "shadow-cyan-400/60", ring: "ring-cyan-200/60", fx: "diamond" },
  { min: 150, title: "Mythic Champion", Icon: Crown, gradient: "from-fuchsia-500 via-purple-600 to-indigo-700", glow: "shadow-fuchsia-500/70", ring: "ring-fuchsia-300/60", fx: "mythic" },
  { min: 365, title: "Immortal", Icon: Sparkles, gradient: "from-yellow-300 via-amber-500 to-rose-600", glow: "shadow-yellow-500/70", ring: "ring-yellow-200/70", fx: "phoenix" },
];

export function getStreakTitle(streak: number): TitleTier {
  let tier = TIERS[0];
  for (const t of TIERS) if (streak >= t.min) tier = t;
  return tier;
}

export function getNextStreakTitle(streak: number): TitleTier | null {
  return TIERS.find((t) => t.min > streak) || null;
}

/** Tier-specific decorative overlays. Pure CSS / framer-motion. */
function TierFX({ fx }: { fx: FxKind }) {
  switch (fx) {
    case "soft":
      return null;

    case "ember":
      // floating ember sparks
      return (
        <>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute bottom-0 left-1/2 h-1 w-1 rounded-full bg-yellow-200 shadow-[0_0_6px_2px_rgba(253,224,71,0.8)]"
              initial={{ y: 0, x: -2 + i * 4, opacity: 0 }}
              animate={{ y: -16, opacity: [0, 1, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
            />
          ))}
        </>
      );

    case "sun":
      // rotating warm halo
      return (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(255,255,255,0.0), rgba(255,255,255,0.45), rgba(255,255,255,0.0) 35%)",
            mixBlendMode: "overlay",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
      );

    case "shine":
      // diagonal sweep highlight
      return (
        <motion.span
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/60 to-transparent"
          initial={{ x: "-50%" }}
          animate={{ x: "350%" }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
        />
      );

    case "royal":
      // pulsing aura
      return (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full bg-fuchsia-300/40 blur-md"
          animate={{ opacity: [0.25, 0.65, 0.25], scale: [1, 1.08, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      );

    case "crown":
      // floating crown sparkles + heat shimmer
      return (
        <>
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(255,215,0,0.55), transparent 50%), radial-gradient(circle at 70% 60%, rgba(255,80,80,0.45), transparent 55%)",
              mixBlendMode: "screen",
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          />
          {[0, 1].map((i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute -top-1 left-1/2 text-[10px]"
              initial={{ opacity: 0, y: 0, x: -4 + i * 8 }}
              animate={{ opacity: [0, 1, 0], y: -10 }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6 }}
            >
              ✦
            </motion.span>
          ))}
        </>
      );

    case "diamond":
      // crystalline prism shimmer
      return (
        <>
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.85) 50%, transparent 70%)",
            }}
            initial={{ backgroundPositionX: "-200%" }}
            animate={{ backgroundPositionX: "200%" }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
          />
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-cyan-100/70"
            animate={{ boxShadow: ["0 0 0 0 rgba(165,243,252,0.0)", "0 0 0 4px rgba(165,243,252,0.35)", "0 0 0 0 rgba(165,243,252,0.0)"] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </>
      );

    case "mythic":
      // rainbow rotating border + inner glow
      return (
        <>
          <motion.span
            className="pointer-events-none absolute -inset-[2px] rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, #f0abfc, #818cf8, #22d3ee, #a78bfa, #f472b6, #f0abfc)",
              filter: "blur(4px)",
              opacity: 0.7,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full"
            animate={{ boxShadow: ["inset 0 0 8px rgba(255,255,255,0.4)", "inset 0 0 16px rgba(255,255,255,0.8)", "inset 0 0 8px rgba(255,255,255,0.4)"] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          />
        </>
      );

    case "phoenix":
      // flame ring + rising embers + golden shine
      return (
        <>
          <motion.span
            className="pointer-events-none absolute -inset-1 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, #fde047, #fb923c, #ef4444, #f59e0b, #fde047)",
              filter: "blur(6px)",
              opacity: 0.85,
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute bottom-0 h-1 w-1 rounded-full bg-amber-200 shadow-[0_0_8px_3px_rgba(253,224,71,0.9)]"
              style={{ left: `${20 + i * 18}%` }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: -22, opacity: [0, 1, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3, ease: "easeOut" }}
            />
          ))}
          <motion.span
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/70 to-transparent"
            initial={{ x: "-50%" }}
            animate={{ x: "350%" }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }}
          />
        </>
      );
  }
}

/** Per-tier icon animation. */
function getIconAnim(fx: FxKind) {
  switch (fx) {
    case "ember":
      return { animate: { scale: [1, 1.15, 1], rotate: [-3, 3, -3] }, transition: { duration: 1.2, repeat: Infinity } };
    case "sun":
      return { animate: { rotate: [0, 360] }, transition: { duration: 8, repeat: Infinity, ease: "linear" as const } };
    case "shine":
      return { animate: { scale: [1, 1.12, 1] }, transition: { duration: 1.6, repeat: Infinity } };
    case "royal":
      return { animate: { y: [0, -1.5, 0], rotate: [-4, 4, -4] }, transition: { duration: 2, repeat: Infinity } };
    case "crown":
      return { animate: { y: [0, -2, 0], scale: [1, 1.08, 1] }, transition: { duration: 1.8, repeat: Infinity } };
    case "diamond":
      return { animate: { rotate: [0, 8, -8, 0], scale: [1, 1.1, 1] }, transition: { duration: 2.4, repeat: Infinity } };
    case "mythic":
      return { animate: { rotate: [0, 360], scale: [1, 1.1, 1] }, transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const } };
    case "phoenix":
      return { animate: { scale: [1, 1.2, 1], rotate: [-6, 6, -6] }, transition: { duration: 1.4, repeat: Infinity } };
    default:
      return { animate: { scale: [1, 1.05, 1] }, transition: { duration: 2.4, repeat: Infinity } };
  }
}

export default function StreakTitleBadge({ currentStreak, longestStreak, size = "md" }: Props) {
  const tier = getStreakTitle(longestStreak);
  const next = getNextStreakTitle(longestStreak);
  const Icon = tier.Icon;
  const iconAnim = getIconAnim(tier.fx);

  const sizes = {
    sm: { pad: "px-2.5 py-1", text: "text-xs", icon: "w-3 h-3" },
    md: { pad: "px-3 py-1.5", text: "text-sm", icon: "w-4 h-4" },
    lg: { pad: "px-4 py-2", text: "text-base", icon: "w-5 h-5" },
  }[size];

  // High tiers get an extra outer ring wrap for bling
  const isHigh = ["crown", "diamond", "mythic", "phoenix"].includes(tier.fx);

  const badge = (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className={`relative inline-flex items-center gap-1.5 rounded-full overflow-hidden ${sizes.pad} bg-gradient-to-r ${tier.gradient} text-white font-bold shadow-lg ${tier.glow} ${sizes.text} ring-1 ${tier.ring}`}
    >
      <TierFX fx={tier.fx} />
      <motion.span className="relative z-10 inline-flex" {...iconAnim}>
        <Icon className={`${sizes.icon} drop-shadow`} />
      </motion.span>
      <span className="relative z-10 drop-shadow-sm whitespace-nowrap">{tier.title}</span>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex flex-col items-center gap-1"
    >
      {isHigh ? (
        <div className="relative p-[2px] rounded-full">
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{
              background:
                tier.fx === "phoenix"
                  ? "conic-gradient(from 0deg, #fde047, #fb923c, #ef4444, #fde047)"
                  : tier.fx === "mythic"
                  ? "conic-gradient(from 0deg, #f0abfc, #818cf8, #22d3ee, #f0abfc)"
                  : tier.fx === "diamond"
                  ? "conic-gradient(from 0deg, #a5f3fc, #ffffff, #38bdf8, #a5f3fc)"
                  : "conic-gradient(from 0deg, #fda4af, #fbbf24, #f43f5e, #fda4af)",
              filter: "blur(2px)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: tier.fx === "phoenix" ? 4 : 6, repeat: Infinity, ease: "linear" }}
          />
          <div className="relative">{badge}</div>
        </div>
      ) : (
        badge
      )}
      {next && size !== "sm" && (
        <p className="text-[10px] text-muted-foreground">
          Streak {next.min - longestStreak} hari lagi → <span className="font-semibold">{next.title}</span>
        </p>
      )}
    </motion.div>
  );
}
