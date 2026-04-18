// Season Pass — Slot Machine Reward System
// Setiap tier punya 3 slot emoji (deterministik per visitor+tier+season).
// Kombinasi: 3 sama (JACKPOT) → reward penuh, 2 sama (LUMAYAN) → setengah, beda semua (HIBURAN) → minimum.

export type RewardKind =
  | "coins"      // streak coins
  | "gems"       // gems
  | "credits"    // game credits
  | "storage"    // music storage MB
  | "lives"      // extra_life power-up
  | "hints"      // auto_hint power-up
  | "time"       // time_freeze power-up
  | "balance";   // saldo Rupiah (premium-only besar)

export interface RewardDef {
  kind: RewardKind;
  emoji: string;        // ikon slot
  label: string;        // nama
  fullValue: number;    // jackpot 3-match
  partialValue: number; // 2-match
  minValue: number;     // beda semua
}

// Pool reward per kategori (slot icon).
export const REWARD_POOL: Record<RewardKind, RewardDef> = {
  coins:   { kind: "coins",   emoji: "🪙", label: "Streak Koin",   fullValue: 5,   partialValue: 2, minValue: 1 },
  gems:    { kind: "gems",    emoji: "💎", label: "Gems",          fullValue: 5,   partialValue: 2, minValue: 1 },
  credits: { kind: "credits", emoji: "🎮", label: "Kredit Game",   fullValue: 5,   partialValue: 2, minValue: 1 },
  storage: { kind: "storage", emoji: "💽", label: "Storage MB",    fullValue: 50,  partialValue: 20, minValue: 5 },
  lives:   { kind: "lives",   emoji: "❤️", label: "Nyawa Ekstra",  fullValue: 3,   partialValue: 1, minValue: 1 },
  hints:   { kind: "hints",   emoji: "💡", label: "Petunjuk",      fullValue: 3,   partialValue: 1, minValue: 1 },
  time:    { kind: "time",    emoji: "⏱️", label: "Time Freeze",   fullValue: 3,   partialValue: 1, minValue: 1 },
  balance: { kind: "balance", emoji: "💵", label: "Saldo (Rp)",    fullValue: 5000, partialValue: 2000, minValue: 500 },
};

// Free tiers: pool tanpa balance & gems besar
const FREE_KINDS: RewardKind[] = ["coins", "credits", "lives", "hints", "time", "storage"];
// Premium tiers: pool penuh termasuk gems & balance
const PREMIUM_KINDS: RewardKind[] = ["coins", "gems", "credits", "storage", "lives", "hints", "time", "balance"];

// Hash deterministik (FNV-1a) → konsisten per visitor+season+tier
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export interface SlotResult {
  reels: [RewardDef, RewardDef, RewardDef];
  matchType: "jackpot" | "partial" | "miss";
  primary: RewardDef;
  awardedValue: number;
  display: string; // contoh "🔔📱🔔"
}

export function rollSlot(visitorId: string, season: string, tier: number, isPremium: boolean): SlotResult {
  const pool = isPremium ? PREMIUM_KINDS : FREE_KINDS;
  const seedBase = `${visitorId}|${season}|${tier}|${isPremium ? "P" : "F"}`;
  const s1 = hash32(seedBase + "|r1");
  const s2 = hash32(seedBase + "|r2");
  const s3 = hash32(seedBase + "|r3");

  // Bias: tiap 3 tier ada peluang jackpot lebih tinggi
  const jackpotChance = isPremium ? (tier % 3 === 0 ? 0.5 : 0.18) : (tier % 5 === 0 ? 0.3 : 0.1);
  const partialChance = 0.45;

  const roll = (hash32(seedBase + "|outcome") % 1000) / 1000;
  const k1 = pick(pool, s1);
  let k2 = pick(pool, s2);
  let k3 = pick(pool, s3);

  let matchType: SlotResult["matchType"];
  if (roll < jackpotChance) {
    k2 = k1; k3 = k1;
    matchType = "jackpot";
  } else if (roll < jackpotChance + partialChance) {
    k2 = k1;
    if (k3.kind === k1.kind) k3 = pool[(s3 + 1) % pool.length] === k1 ? pool[(s3 + 2) % pool.length] : pick(pool, s3 + 1) as any;
    // ensure 3rd different
    while (REWARD_POOL[k3.kind].kind === k1.kind) k3 = pick(pool.map(p => REWARD_POOL[p]), s3 + 7);
    matchType = "partial";
  } else {
    // ensure all different
    if (k2.kind === k1.kind) k2 = pick(pool.map(p => REWARD_POOL[p]), s2 + 3);
    while (k3.kind === k1.kind || k3.kind === k2.kind) k3 = pick(pool.map(p => REWARD_POOL[p]), s3 + 11);
    matchType = "miss";
  }

  const primary = k1;
  const awardedValue =
    matchType === "jackpot" ? primary.fullValue :
    matchType === "partial" ? primary.partialValue :
    primary.minValue;

  return {
    reels: [k1, k2, k3],
    matchType,
    primary,
    awardedValue,
    display: `${k1.emoji}${k2.emoji}${k3.emoji}`,
  };
}

export function matchLabel(m: SlotResult["matchType"]): string {
  return m === "jackpot" ? "JACKPOT 3×" : m === "partial" ? "2× COCOK" : "HIBURAN";
}

export function matchColor(m: SlotResult["matchType"]): string {
  return m === "jackpot" ? "from-yellow-400 to-orange-500" :
         m === "partial" ? "from-cyan-400 to-blue-500" :
         "from-slate-400 to-slate-600";
}
