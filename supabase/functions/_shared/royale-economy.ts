// Lucky Royale economy — single source of truth for prices, rarity odds and
// reward caps. Pure TypeScript (no Deno/npm imports) so the edge function and
// the vitest simulator share exactly the same logic.

export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";
export const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary", "mythic"];

export interface PoolPrize {
  kind: string;
  value: number;
  label: string;
  emoji: string;
  rarity: Rarity;
  weight: number;
  color: string;
  ultra?: boolean;
}

// ---------------------------------------------------------------- prices
export const SINGLE_COST_GEMS = 50;

/** Normal bundles: volume discount grows slowly, max 20% (40 gem/spin). */
export const NORMAL_BUNDLES: Array<{ count: number; cost: number; label: string; badge?: string }> = [
  { count: 5, cost: 240, label: "5 SPIN" },                       // -4%
  { count: 10, cost: 460, label: "10 SPIN", badge: "HEMAT" },     // -8%
  { count: 20, cost: 880, label: "20 SPIN", badge: "SUPER HEMAT" }, // -12%
  { count: 100, cost: 4250, label: "100 SPIN", badge: "MEGA" },   // -15%
  { count: 125, cost: 5250, label: "125 SPIN", badge: "ULTRA" },  // -16%
  { count: 200, cost: 8200, label: "200 SPIN", badge: "GOD PACK" }, // -18%
  { count: 500, cost: 20000, label: "500 SPIN", badge: "ULTIMATE" }, // -20%
];
/** Legacy "spin_bundle" action (5 spins) uses the 5-spin bundle price. */
export const LEGACY_BUNDLE5_COST = 240;

/** Daily discount (5×/day/pack): at most ~20–25% below the list price. */
export const NORMAL_DAILY_DISCOUNT: Record<number, number> = {
  1: 40, 5: 200, 10: 380, 20: 740, 100: 3700, 125: 4600, 200: 7200, 500: 18000,
};

/** Premium spins (Nyawa Premium only): 100 gem each, volume discount max 25%. */
export const PREMIUM_PACKS: Record<number, number> = {
  1: 100, 5: 480, 10: 920, 20: 1760, 50: 4250, 100: 8300, 200: 16000, 500: 38500, 1000: 75000,
};

// ---------------------------------------------------------------- odds
export type Mode = "normal" | "premium";
export const RARITY_RATES: Record<Mode, Record<Rarity, number>> = {
  normal: { common: 0.62, rare: 0.27, epic: 0.085, legendary: 0.022, mythic: 0.003 },
  premium: { common: 0.48, rare: 0.33, epic: 0.14, legendary: 0.042, mythic: 0.008 },
};
/** Lucky Hour moves 6 pts from common to rare/epic only. Legendary/mythic unchanged. */
export const LUCKY_HOUR_SHIFT = { fromCommon: 0.06, toRare: 0.045, toEpic: 0.015 };
/** Inside the mythic bucket, ultra jackpots get this share of their declared weight. */
export const ULTRA_JACKPOT_WEIGHT_FACTOR = 0.08;

export function ratesFor(mode: Mode, luckyHour: boolean): Record<Rarity, number> {
  const r = { ...RARITY_RATES[mode] };
  if (luckyHour) {
    r.common -= LUCKY_HOUR_SHIFT.fromCommon;
    r.rare += LUCKY_HOUR_SHIFT.toRare;
    r.epic += LUCKY_HOUR_SHIFT.toEpic;
  }
  return r;
}

// ---------------------------------------------------------------- rarity by value
// Rarity is derived from the actual reward size so a big prize can never sit
// in a frequent bucket. [common, rare, epic, legendary] upper bounds; above = mythic.
const TIERS: Record<string, [number, number, number, number]> = {
  extra_life: [3, 10, 20, 50],
  auto_hint: [3, 10, 20, 50],
  time_freeze: [2, 5, 10, 30],
  streak_freeze: [1, 3, 5, 10],
  streak_coins: [100, 500, 2000, 10000],
  gems: [20, 60, 150, 500],
  game_credits: [0, 3, 10, 50],
  game_balance: [0, 1000, 3500, 10000],
  spin_ticket_normal: [0, 1, 3, 10],
  spin_ticket_premium: [0, 0, 1, 3],
  lucky_token: [0, 1, 2, 4],
};
/** Values at/above these are "ultra jackpot" (kept, but nearly impossible). */
const ULTRA: Record<string, number> = {
  extra_life: 500, auto_hint: 500, time_freeze: 300, streak_freeze: 200,
  streak_coins: 100000, gems: 5000, game_credits: 500, game_balance: 15000,
};

export function rarityForValue(kind: string, value: number, declared: Rarity): Rarity {
  const t = TIERS[kind];
  if (!t) return declared;
  if (value <= t[0]) return "common";
  if (value <= t[1]) return "rare";
  if (value <= t[2]) return "epic";
  if (value <= t[3]) return "legendary";
  return "mythic";
}

export function normalizePool<T extends PoolPrize>(pool: T[]): T[] {
  return pool.map((p) => {
    const rarity = rarityForValue(String(p.kind), Number(p.value), p.rarity);
    const ultra = ULTRA[String(p.kind)] != null && Number(p.value) >= ULTRA[String(p.kind)];
    return { ...p, rarity, ultra, weight: ultra ? p.weight * ULTRA_JACKPOT_WEIGHT_FACTOR : p.weight };
  });
}

// ---------------------------------------------------------------- picking
export type Rng = () => number;

export function pickRarity(rates: Record<Rarity, number>, rng: Rng): Rarity {
  let r = rng();
  for (const k of RARITIES) { r -= rates[k]; if (r < 0) return k; }
  return "common";
}

/** Rarity first (fixed odds), then weighted item inside that rarity. */
export function pickPrize<T extends PoolPrize>(pool: T[], mode: Mode, luckyHour: boolean, rng: Rng = Math.random): T & { index: number } {
  const want = pickRarity(ratesFor(mode, luckyHour), rng);
  // Fall back to the nearest LOWER rarity that has items (never upgrade).
  for (let i = RARITIES.indexOf(want); i >= 0; i--) {
    const bucket = pool.map((p, idx) => ({ p, idx })).filter((x) => x.p.rarity === RARITIES[i]);
    if (!bucket.length) continue;
    const total = bucket.reduce((s, x) => s + x.p.weight, 0);
    let r = rng() * total;
    for (const x of bucket) { r -= x.p.weight; if (r < 0) return { ...x.p, index: x.idx }; }
    const last = bucket[bucket.length - 1];
    return { ...last.p, index: last.idx };
  }
  return { ...pool[0], index: 0 };
}

export function isSpinCreditKind(kind: string): boolean {
  return kind === "lucky_token" || kind === "spin_ticket_normal" || kind === "spin_ticket_premium";
}

// ---------------------------------------------------------------- streak bonus
/** +5% per 3 consecutive rare+ results, capped at +20%. */
export function streakMultiplier(streak: number): number {
  if (streak < 3) return 1;
  return Math.min(1.2, 1 + Math.floor(streak / 3) * 0.05);
}
const STREAK_BONUS_KINDS = new Set(["extra_life", "auto_hint", "time_freeze", "streak_freeze", "streak_coins"]);
/** Only small consumables (common→epic) get the bonus; gems, money, tickets, jackpots never do. */
export function applyStreakBonus(p: { kind: string; value: number; rarity: Rarity }, streak: number): number {
  const m = streakMultiplier(streak);
  if (m <= 1 || !STREAK_BONUS_KINDS.has(String(p.kind)) || !["common", "rare", "epic"].includes(p.rarity)) return p.value;
  return Math.round(p.value * m);
}

// ---------------------------------------------------------------- mega pool
export const MEGA_POOL = { contributionPct: 0.05, breakChance: 0.25, minBreak: 3000, payoutPct: 0.7 };

// ---------------------------------------------------------------- daily milestones
/** Daily spin milestones (all spin types). Total ≈ 870 gem for 100 spins (~20% of the
 *  cheapest 100-spin price) so milestones can never fund the spins themselves. */
export const DAILY_MILESTONES: Array<{ spins: number; gems: number; credits?: number; coins?: number }> = [
  { spins: 2, gems: 5 },
  { spins: 5, gems: 15, coins: 100 },
  { spins: 10, gems: 30, credits: 1 },
  { spins: 20, gems: 60, coins: 300 },
  { spins: 30, gems: 90, credits: 2, coins: 400 },
  { spins: 50, gems: 150, credits: 3, coins: 600 },
  { spins: 75, gems: 220, credits: 4, coins: 800 },
  { spins: 100, gems: 300, credits: 5, coins: 1000 },
];

/** Maks diskon voucher spin (semua mode). Di atas ini voucher jam-an membuat spin untung pasti. */
export const MAX_SPIN_VOUCHER_PCT = 50;
export function clampVoucherPct(raw: unknown): number {
  const n = Number(raw) || 0;
  return Math.max(0, Math.min(MAX_SPIN_VOUCHER_PCT, n));
}
