// Single source of truth for streak milestones + visual evolution tiers.
// Milestone days are the same ones the Streak page has always used; the visual
// tiers simply map `current_streak` onto those thresholds (plus day 1 = start).
import flameSmall from "@/assets/streak/flame-small.webp";
import flameBurning from "@/assets/streak/flame-burning.webp";
import flameEnergy from "@/assets/streak/flame-energy.webp";
import flameCrystal from "@/assets/streak/flame-crystal.webp";
import flameRoyal from "@/assets/streak/flame-royal.webp";
import flameInferno from "@/assets/streak/flame-inferno.webp";
import flameDiamond from "@/assets/streak/flame-diamond.webp";
import flameMythic from "@/assets/streak/flame-mythic.webp";
import flameSupreme from "@/assets/streak/flame-supreme.webp";
import flameImmortal from "@/assets/streak/flame-immortal.webp";

export const MILESTONES = [
  { days: 3, label: "3 Hari", reward: "Pemula", tier: 1, emoji: "🔥" },
  { days: 7, label: "7 Hari", reward: "Rajin", tier: 1, emoji: "⚡" },
  { days: 14, label: "14 Hari", reward: "Konsisten", tier: 2, emoji: "💎" },
  { days: 30, label: "30 Hari", reward: "Master", tier: 2, emoji: "👑" },
  { days: 60, label: "60 Hari", reward: "Legend", tier: 3, emoji: "🏆" },
  { days: 100, label: "100 Hari", reward: "Diamond", tier: 3, emoji: "💠" },
  { days: 120, label: "120 Hari", reward: "Mythic", tier: 4, emoji: "🐉" },
  { days: 150, label: "150 Hari", reward: "Supreme", tier: 4, emoji: "⭐" },
  { days: 365, label: "1 Tahun", reward: "Immortal", tier: 5, emoji: "🌟" },
] as const;

export type Milestone = (typeof MILESTONES)[number];

export type TierEffect =
  | "ember" | "burn" | "lightning" | "crystal" | "crown"
  | "inferno" | "diamond" | "dragon" | "star" | "immortal";

export interface StreakTier {
  level: number;          // 1..10
  id: string;
  name: string;
  emoji: string;
  minDays: number;
  image: string;
  /** main energy colour (hex) */
  color: string;
  /** secondary/accent colour (hex) */
  accent: string;
  /** background tint for hero (hex) */
  bg: string;
  particles: number;      // base ember count (desktop); low-power halves it
  scale: number;          // flame size multiplier
  effect: TierEffect;
}

export const STREAK_TIERS: StreakTier[] = [
  { level: 1, id: "small", name: "Small Flame", emoji: "🔥", minDays: 0, image: flameSmall, color: "#ff9a3c", accent: "#ffd27a", bg: "#1a0d05", particles: 4, scale: 0.82, effect: "ember" },
  { level: 2, id: "burning", name: "Burning Flame", emoji: "🔥", minDays: 3, image: flameBurning, color: "#ff6a1f", accent: "#ffc04d", bg: "#1c0a04", particles: 6, scale: 0.88, effect: "burn" },
  { level: 3, id: "energy", name: "Energy Flame", emoji: "⚡", minDays: 7, image: flameEnergy, color: "#ffb020", accent: "#4da3ff", bg: "#0b0f22", particles: 8, scale: 0.92, effect: "lightning" },
  { level: 4, id: "crystal", name: "Crystal Flame", emoji: "💎", minDays: 14, image: flameCrystal, color: "#38bdf8", accent: "#a5f3fc", bg: "#04121f", particles: 8, scale: 0.95, effect: "crystal" },
  { level: 5, id: "royal", name: "Royal Flame", emoji: "👑", minDays: 30, image: flameRoyal, color: "#fbbf24", accent: "#fde68a", bg: "#1a1203", particles: 10, scale: 1, effect: "crown" },
  { level: 6, id: "inferno", name: "Inferno Flame", emoji: "🔥", minDays: 60, image: flameInferno, color: "#ef4444", accent: "#fb923c", bg: "#1f0505", particles: 12, scale: 1.04, effect: "inferno" },
  { level: 7, id: "diamond", name: "Diamond Flame", emoji: "💠", minDays: 100, image: flameDiamond, color: "#7dd3fc", accent: "#ffffff", bg: "#06121c", particles: 12, scale: 1.06, effect: "diamond" },
  { level: 8, id: "mythic", name: "Mythic Flame", emoji: "🐉", minDays: 120, image: flameMythic, color: "#c026d3", accent: "#a78bfa", bg: "#14051c", particles: 12, scale: 1.08, effect: "dragon" },
  { level: 9, id: "supreme", name: "Supreme Flame", emoji: "⭐", minDays: 150, image: flameSupreme, color: "#facc15", accent: "#fff7cc", bg: "#1a1504", particles: 14, scale: 1.1, effect: "star" },
  { level: 10, id: "immortal", name: "Immortal Flame", emoji: "🌟", minDays: 365, image: flameImmortal, color: "#fde68a", accent: "#e9d5ff", bg: "#16101f", particles: 16, scale: 1.14, effect: "immortal" },
];

/** Deterministic: same streak always returns the same tier. */
export function getStreakTier(streak: number): StreakTier {
  let t = STREAK_TIERS[0];
  for (const tier of STREAK_TIERS) if (streak >= tier.minDays) t = tier;
  return t;
}

export function getNextStreakTier(streak: number): StreakTier | null {
  return STREAK_TIERS.find(t => t.minDays > streak) ?? null;
}

export function getMilestoneProgress(streak: number) {
  const prev = [...MILESTONES].reverse().find(m => m.days <= streak) ?? null;
  const next = MILESTONES.find(m => m.days > streak) ?? null;
  const start = prev ? prev.days : 0;
  const end = next ? next.days : MILESTONES[MILESTONES.length - 1].days;
  const percent = next ? Math.max(0, Math.min(100, ((streak - start) / (end - start)) * 100)) : 100;
  return { prev, next, start, end, percent, remaining: next ? next.days - streak : 0 };
}

export function isMilestoneDay(days: number) {
  return MILESTONES.some(m => m.days === days);
}
