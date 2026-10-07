import type { StreakTier } from "./streakTiers";

export interface FlameShape {
  height: number;        // flame height in viewBox units (0..120)
  width: number;         // half-width of outer body
  sideTongues: { dx: number; w: number; h: number; lean: number }[];
  outerLayers: 1 | 2;
  sharp: boolean;        // crystalline tips (crystal / diamond)
  facet: boolean;        // faceted crystal/diamond core
  crown: boolean;        // crown energy tips
  twin: boolean;         // twin swirling main tongue (mythic / immortal)
  speed: number;         // animation duration multiplier (<1 = livelier)
  core: string;          // hot core colour
  outerTop: string;      // colour the outer flame fades into
}

/** Pure, deterministic flame geometry per tier — shape (not only colour) evolves with streak. */
export function getFlameShape(tier: StreakTier): FlameShape {
  const L = tier.level;
  const sideCount = [0, 0, 2, 2, 2, 3, 3, 4, 4, 5][L - 1] ?? 0;
  const height = 50 + L * 5.2;             // 55 → 102
  const width = 17 + L * 1.6;              // 18.6 → 33
  const sideTongues = Array.from({ length: sideCount }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2) + 1;
    return { dx: side * (width * 0.45 + rank * 4), w: width * (0.42 - rank * 0.06), h: height * (0.62 - rank * 0.1), lean: side * (5 + rank * 3) };
  });
  return {
    height, width, sideTongues,
    outerLayers: L >= 5 ? 2 : 1,
    sharp: tier.effect === "crystal" || tier.effect === "diamond",
    facet: ["crystal", "diamond", "immortal"].includes(tier.effect),
    crown: ["crown", "star", "immortal"].includes(tier.effect),
    twin: tier.effect === "dragon" || tier.effect === "immortal" || tier.effect === "inferno",
    speed: Math.max(0.68, 1.08 - L * 0.04),
    core: tier.effect === "diamond" || tier.effect === "crystal" ? "#f0fdff" : tier.effect === "dragon" ? "#fbe7ff" : "#fff8e1",
    outerTop: tier.effect === "immortal" ? "#c4b5fd" : tier.effect === "dragon" ? "#7c3aed" : tier.effect === "inferno" ? "#7f1d1d" : tier.color,
  };
}
