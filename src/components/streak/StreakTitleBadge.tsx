import { Crown, Flame, Star, Trophy, Gem, Sparkles, Award } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  currentStreak: number;
  longestStreak: number;
  size?: "sm" | "md" | "lg";
}

interface TitleTier {
  min: number;
  title: string;
  Icon: typeof Crown;
  gradient: string;
  glow: string;
}

const TIERS: TitleTier[] = [
  { min: 0, title: "Pendatang Baru", Icon: Sparkles, gradient: "from-slate-400 to-slate-600", glow: "shadow-slate-500/30" },
  { min: 3, title: "Pemula Api", Icon: Flame, gradient: "from-orange-400 to-red-500", glow: "shadow-orange-500/40" },
  { min: 7, title: "Pejuang Harian", Icon: Award, gradient: "from-amber-400 to-orange-600", glow: "shadow-amber-500/40" },
  { min: 14, title: "Petarung Konsisten", Icon: Star, gradient: "from-blue-400 to-indigo-600", glow: "shadow-blue-500/40" },
  { min: 30, title: "Master Streak", Icon: Trophy, gradient: "from-purple-400 to-pink-600", glow: "shadow-purple-500/40" },
  { min: 60, title: "Legenda Hidup", Icon: Crown, gradient: "from-rose-500 to-red-700", glow: "shadow-rose-500/50" },
  { min: 100, title: "Diamond Soul", Icon: Gem, gradient: "from-cyan-300 via-blue-400 to-indigo-600", glow: "shadow-cyan-400/50" },
  { min: 150, title: "Mythic Champion", Icon: Crown, gradient: "from-fuchsia-500 via-purple-600 to-indigo-700", glow: "shadow-fuchsia-500/50" },
  { min: 365, title: "Immortal", Icon: Sparkles, gradient: "from-yellow-300 via-amber-500 to-orange-600", glow: "shadow-yellow-500/60" },
];

export function getStreakTitle(streak: number): TitleTier {
  let tier = TIERS[0];
  for (const t of TIERS) if (streak >= t.min) tier = t;
  return tier;
}

export function getNextStreakTitle(streak: number): TitleTier | null {
  return TIERS.find((t) => t.min > streak) || null;
}

export default function StreakTitleBadge({ currentStreak, longestStreak, size = "md" }: Props) {
  const tier = getStreakTitle(longestStreak);
  const next = getNextStreakTitle(longestStreak);
  const Icon = tier.Icon;

  const sizes = {
    sm: { pad: "px-2.5 py-1", text: "text-xs", icon: "w-3 h-3" },
    md: { pad: "px-3 py-1.5", text: "text-sm", icon: "w-4 h-4" },
    lg: { pad: "px-4 py-2", text: "text-base", icon: "w-5 h-5" },
  }[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex flex-col items-center gap-1"
    >
      <div
        className={`inline-flex items-center gap-1.5 rounded-full ${sizes.pad} bg-gradient-to-r ${tier.gradient} text-white font-bold shadow-lg ${tier.glow} ${sizes.text}`}
      >
        <Icon className={`${sizes.icon} drop-shadow`} />
        <span>{tier.title}</span>
      </div>
      {next && size !== "sm" && (
        <p className="text-[10px] text-muted-foreground">
          Streak {next.min - longestStreak} hari lagi → <span className="font-semibold">{next.title}</span>
        </p>
      )}
    </motion.div>
  );
}
