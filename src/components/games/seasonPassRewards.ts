// Season Pass — Slot Machine Reward System (deterministik per visitor+season+tier)

export type RewardKind =
  | "coins" | "gems" | "credits" | "storage" | "lives" | "hints" | "time" | "balance";

export interface RewardDef {
  kind: RewardKind;
  emoji: string;
  label: string;
  fullValue: number;
  partialValue: number;
  minValue: number;
}

export const REWARD_POOL: Record<RewardKind, RewardDef> = {
  coins:   { kind: "coins",   emoji: "🪙", label: "Streak Koin",  fullValue: 5,    partialValue: 2,    minValue: 1 },
  gems:    { kind: "gems",    emoji: "💎", label: "Gems",         fullValue: 5,    partialValue: 2,    minValue: 1 },
  credits: { kind: "credits", emoji: "🎮", label: "Kredit Game",  fullValue: 5,    partialValue: 2,    minValue: 1 },
  storage: { kind: "storage", emoji: "💽", label: "Storage MB",   fullValue: 50,   partialValue: 20,   minValue: 5 },
  lives:   { kind: "lives",   emoji: "❤️", label: "Nyawa Ekstra", fullValue: 3,    partialValue: 1,    minValue: 1 },
  hints:   { kind: "hints",   emoji: "💡", label: "Petunjuk",     fullValue: 3,    partialValue: 1,    minValue: 1 },
  time:    { kind: "time",    emoji: "⏱️", label: "Time Freeze",  fullValue: 3,    partialValue: 1,    minValue: 1 },
  balance: { kind: "balance", emoji: "💵", label: "Saldo (Rp)",   fullValue: 5000, partialValue: 2000, minValue: 500 },
};

const FREE_POOL: RewardDef[]    = (["coins","credits","lives","hints","time","storage"] as RewardKind[]).map(k => REWARD_POOL[k]);
const PREMIUM_POOL: RewardDef[] = (["coins","gems","credits","storage","lives","hints","time","balance"] as RewardKind[]).map(k => REWARD_POOL[k]);

function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

const pick = <T,>(arr: T[], seed: number): T => arr[seed % arr.length];

export interface SlotResult {
  reels: [RewardDef, RewardDef, RewardDef];
  matchType: "jackpot" | "partial" | "miss";
  primary: RewardDef;
  awardedValue: number;
  display: string;
}

export function rollSlot(visitorId: string, season: string, tier: number, isPremium: boolean): SlotResult {
  const pool = isPremium ? PREMIUM_POOL : FREE_POOL;
  const seedBase = `${visitorId}|${season}|${tier}|${isPremium ? "P" : "F"}`;

  const jackpotChance = isPremium ? (tier % 3 === 0 ? 0.5 : 0.18) : (tier % 5 === 0 ? 0.3 : 0.1);
  const partialChance = 0.45;
  const roll = (hash32(seedBase + "|outcome") % 1000) / 1000;

  const k1 = pick(pool, hash32(seedBase + "|r1"));
  let k2 = pick(pool, hash32(seedBase + "|r2"));
  let k3 = pick(pool, hash32(seedBase + "|r3"));

  let matchType: SlotResult["matchType"];
  if (roll < jackpotChance) {
    k2 = k1; k3 = k1;
    matchType = "jackpot";
  } else if (roll < jackpotChance + partialChance) {
    k2 = k1;
    let salt = 1;
    while (k3.kind === k1.kind) { k3 = pick(pool, hash32(seedBase + "|r3s" + salt)); salt++; if (salt > 20) break; }
    matchType = "partial";
  } else {
    let salt = 1;
    while (k2.kind === k1.kind) { k2 = pick(pool, hash32(seedBase + "|r2s" + salt)); salt++; if (salt > 20) break; }
    salt = 1;
    while (k3.kind === k1.kind || k3.kind === k2.kind) { k3 = pick(pool, hash32(seedBase + "|r3m" + salt)); salt++; if (salt > 20) break; }
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

export const matchLabel = (m: SlotResult["matchType"]) =>
  m === "jackpot" ? "JACKPOT 3×" : m === "partial" ? "2× COCOK" : "HIBURAN";

export const matchColor = (m: SlotResult["matchType"]) =>
  m === "jackpot" ? "from-yellow-400 to-orange-500" :
  m === "partial" ? "from-cyan-400 to-blue-500" :
  "from-slate-400 to-slate-600";
