// Mystery reward generation logic
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface MysteryReward {
  type: "bonus_points" | "double_points" | "motivation" | "lucky_charm" | "freeze_token";
  value: number;
  label: string;
  emoji: string;
  rarity: Rarity;
  message: string;
}

const COMMON_REWARDS: Omit<MysteryReward, "rarity">[] = [
  { type: "bonus_points", value: 5, label: "+5 Poin Bonus", emoji: "✨", message: "Sedikit kejutan untuk kamu!" },
  { type: "bonus_points", value: 10, label: "+10 Poin Bonus", emoji: "💫", message: "Tetap semangat klaim besok!" },
  { type: "motivation", value: 0, label: "Pesan Motivasi", emoji: "💪", message: "Konsistensi adalah kunci kesuksesan!" },
  { type: "motivation", value: 0, label: "Pesan Inspiratif", emoji: "🌟", message: "Setiap hari adalah kesempatan baru!" },
];

const RARE_REWARDS: Omit<MysteryReward, "rarity">[] = [
  { type: "bonus_points", value: 25, label: "+25 Poin Bonus", emoji: "🎁", message: "Hadiah langka berhasil kamu dapat!" },
  { type: "bonus_points", value: 50, label: "+50 Poin Bonus", emoji: "💝", message: "Wow, lumayan besar nih!" },
  { type: "lucky_charm", value: 0, label: "Jimat Keberuntungan", emoji: "🍀", message: "Hari ini hari keberuntunganmu!" },
];

const EPIC_REWARDS: Omit<MysteryReward, "rarity">[] = [
  { type: "bonus_points", value: 100, label: "+100 Poin Bonus", emoji: "💎", message: "EPIC! Hadiah jarang banget!" },
  { type: "double_points", value: 2, label: "Double Streak Power", emoji: "⚡", message: "Streak kamu terasa 2x lebih kuat!" },
];

const LEGENDARY_REWARDS: Omit<MysteryReward, "rarity">[] = [
  { type: "bonus_points", value: 250, label: "+250 Poin LEGENDARY", emoji: "👑", message: "LEGENDARY! Selamat, kamu beruntung!" },
  { type: "freeze_token", value: 1, label: "🛡️ Streak Freeze Gratis", emoji: "🛡️", message: "Pelindung streak gratis untukmu!" },
];

// Probability: 60% common, 25% rare, 12% epic, 3% legendary
export function rollMysteryReward(): MysteryReward {
  const r = Math.random() * 100;
  if (r < 3) {
    const reward = LEGENDARY_REWARDS[Math.floor(Math.random() * LEGENDARY_REWARDS.length)];
    return { ...reward, rarity: "legendary" };
  }
  if (r < 15) {
    const reward = EPIC_REWARDS[Math.floor(Math.random() * EPIC_REWARDS.length)];
    return { ...reward, rarity: "epic" };
  }
  if (r < 40) {
    const reward = RARE_REWARDS[Math.floor(Math.random() * RARE_REWARDS.length)];
    return { ...reward, rarity: "rare" };
  }
  const reward = COMMON_REWARDS[Math.floor(Math.random() * COMMON_REWARDS.length)];
  return { ...reward, rarity: "common" };
}

export function getRarityColor(rarity: Rarity): string {
  switch (rarity) {
    case "legendary": return "from-yellow-400 via-amber-500 to-orange-600";
    case "epic": return "from-purple-500 via-fuchsia-500 to-pink-600";
    case "rare": return "from-blue-400 via-cyan-500 to-teal-500";
    default: return "from-slate-400 to-slate-600";
  }
}

export function getRarityGlow(rarity: Rarity): string {
  switch (rarity) {
    case "legendary": return "shadow-yellow-500/60";
    case "epic": return "shadow-purple-500/60";
    case "rare": return "shadow-blue-500/60";
    default: return "shadow-slate-500/30";
  }
}

export function getRarityLabel(rarity: Rarity): string {
  switch (rarity) {
    case "legendary": return "LEGENDARY";
    case "epic": return "EPIC";
    case "rare": return "RARE";
    default: return "COMMON";
  }
}

// Achievements catalog
export interface Achievement {
  id: string;
  label: string;
  description: string;
  emoji: string;
  check: (ctx: { currentStreak: number; longestStreak: number; totalClaims: number; claimHour: number; claimDay: number; totalBonus: number }) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_claim", label: "Langkah Pertama", description: "Klaim streak pertamamu", emoji: "🌱", check: (c) => c.totalClaims >= 1 },
  { id: "week_warrior", label: "Pejuang Mingguan", description: "Capai streak 7 hari", emoji: "⚔️", check: (c) => c.currentStreak >= 7 },
  { id: "month_master", label: "Master Bulanan", description: "Capai streak 30 hari", emoji: "🏅", check: (c) => c.currentStreak >= 30 },
  { id: "century_club", label: "Century Club", description: "Capai streak 100 hari", emoji: "💯", check: (c) => c.longestStreak >= 100 },
  { id: "early_bird", label: "Early Bird", description: "Klaim sebelum jam 7 pagi", emoji: "🐦", check: (c) => c.claimHour < 7 },
  { id: "night_owl", label: "Night Owl", description: "Klaim setelah jam 10 malam", emoji: "🦉", check: (c) => c.claimHour >= 22 },
  { id: "weekend_warrior", label: "Weekend Warrior", description: "Klaim di akhir pekan", emoji: "🎮", check: (c) => c.claimDay === 0 || c.claimDay === 6 },
  { id: "centurion_claims", label: "Centurion", description: "Total 100 klaim", emoji: "🛡️", check: (c) => c.totalClaims >= 100 },
  { id: "bonus_collector", label: "Pemburu Bonus", description: "Kumpulkan 500 poin bonus", emoji: "💰", check: (c) => c.totalBonus >= 500 },
  { id: "lucky_legendary", label: "Tersentuh Dewi Fortuna", description: "Dapat hadiah Legendary", emoji: "🌟", check: () => false }, // unlocked manually
];

export function checkNewAchievements(
  current: string[],
  ctx: { currentStreak: number; longestStreak: number; totalClaims: number; claimHour: number; claimDay: number; totalBonus: number }
): Achievement[] {
  return ACHIEVEMENTS.filter(a => !current.includes(a.id) && a.check(ctx));
}
