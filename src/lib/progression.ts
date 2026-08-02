import { supabase } from "@/integrations/supabase/client";

/* ============================================================
   SISTEM POIN & LEVEL
   ============================================================ */

/** XP kumulatif yang dibutuhkan untuk mencapai level tertentu. */
export function totalXpForLevel(level: number): number {
  const n = Math.max(1, level) - 1;
  // Kurva bertingkat: makin tinggi level makin besar kebutuhan XP
  return Math.round(50 * n * (n + 1) + 25 * n * n);
}

export function levelFromXp(xp: number): number {
  let lv = 1;
  while (lv < 200 && xp >= totalXpForLevel(lv + 1)) lv++;
  return lv;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const cur = totalXpForLevel(level);
  const next = totalXpForLevel(level + 1);
  const range = Math.max(1, next - cur);
  const gained = Math.max(0, xp - cur);
  return {
    level,
    curThreshold: cur,
    nextThreshold: next,
    gained,
    range,
    remaining: Math.max(0, next - xp),
    percent: Math.min(100, (gained / range) * 100),
  };
}

export const LEVEL_TITLES: { min: number; title: string; color: string }[] = [
  { min: 1, title: "Pemula", color: "from-slate-400 to-slate-600" },
  { min: 5, title: "Penjelajah", color: "from-emerald-400 to-teal-600" },
  { min: 10, title: "Petualang", color: "from-sky-400 to-blue-600" },
  { min: 20, title: "Veteran", color: "from-violet-400 to-purple-600" },
  { min: 35, title: "Master", color: "from-amber-400 to-orange-600" },
  { min: 50, title: "Grandmaster", color: "from-rose-400 to-red-600" },
  { min: 75, title: "Legenda", color: "from-fuchsia-400 via-purple-500 to-cyan-400" },
  { min: 100, title: "Mitos", color: "from-yellow-300 via-amber-400 to-rose-500" },
];

export function levelTitle(level: number) {
  return [...LEVEL_TITLES].reverse().find((t) => level >= t.min) || LEVEL_TITLES[0];
}

/** Hadiah otomatis saat naik level. */
export function levelUpReward(level: number): { gems: number; coins: number; label: string } {
  const gems = level % 10 === 0 ? 100 : level % 5 === 0 ? 40 : 10;
  const coins = level % 10 === 0 ? 1000 : level % 5 === 0 ? 400 : 100;
  const label = `${gems} Gem + ${coins.toLocaleString("id-ID")} Koin`;
  return { gems, coins, label };
}

/* ============================================================
   XP EVENT
   ============================================================ */

export type XpEvent =
  | "login"
  | "daily_claim"
  | "mission_complete"
  | "game_play"
  | "game_win"
  | "purchase"
  | "music_listen"
  | "chat_message"
  | "friend_added"
  | "spin"
  | "event_join"
  | "profile_update";

export const XP_TABLE: Record<XpEvent, number> = {
  login: 15,
  daily_claim: 25,
  mission_complete: 40,
  game_play: 8,
  game_win: 20,
  purchase: 60,
  music_listen: 5,
  chat_message: 2,
  friend_added: 30,
  spin: 6,
  event_join: 35,
  profile_update: 10,
};

/* ============================================================
   ACHIEVEMENT
   ============================================================ */

export type AchievementCategory = "pemula" | "sosial" | "koleksi" | "aktivitas" | "event";
export type Difficulty = "mudah" | "sedang" | "sulit" | "ekstrem";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: AchievementCategory;
  difficulty: Difficulty;
  target: number;
  event: XpEvent | "level" | "badge" | "achievement";
  rewardGems: number;
  rewardCoins: number;
  secret?: boolean;
}

export const CATEGORY_META: Record<AchievementCategory, { label: string; emoji: string; grad: string }> = {
  pemula: { label: "Pemula", emoji: "🌱", grad: "from-emerald-400 to-teal-600" },
  sosial: { label: "Sosial", emoji: "🤝", grad: "from-sky-400 to-blue-600" },
  koleksi: { label: "Koleksi", emoji: "💎", grad: "from-violet-400 to-purple-600" },
  aktivitas: { label: "Aktivitas", emoji: "⚡", grad: "from-amber-400 to-orange-600" },
  event: { label: "Event", emoji: "🎉", grad: "from-rose-400 to-pink-600" },
};

export const DIFFICULTY_META: Record<Difficulty, { label: string; color: string }> = {
  mudah: { label: "Mudah", color: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10" },
  sedang: { label: "Sedang", color: "text-sky-500 border-sky-500/40 bg-sky-500/10" },
  sulit: { label: "Sulit", color: "text-amber-500 border-amber-500/40 bg-amber-500/10" },
  ekstrem: { label: "Ekstrem", color: "text-rose-500 border-rose-500/40 bg-rose-500/10" },
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // Pemula
  { id: "first_login", name: "Langkah Pertama", description: "Masuk ke aplikasi pertama kali", emoji: "👋", category: "pemula", difficulty: "mudah", target: 1, event: "login", rewardGems: 5, rewardCoins: 100 },
  { id: "profile_setup", name: "Wajah Baru", description: "Perbarui profil kamu", emoji: "🪪", category: "pemula", difficulty: "mudah", target: 1, event: "profile_update", rewardGems: 10, rewardCoins: 150 },
  { id: "first_claim", name: "Hadiah Perdana", description: "Klaim hadiah harian pertama", emoji: "🎁", category: "pemula", difficulty: "mudah", target: 1, event: "daily_claim", rewardGems: 10, rewardCoins: 200 },
  { id: "first_game", name: "Coba Main", description: "Mainkan 1 game", emoji: "🎮", category: "pemula", difficulty: "mudah", target: 1, event: "game_play", rewardGems: 5, rewardCoins: 100 },
  { id: "level_5", name: "Naik Kelas", description: "Capai level 5", emoji: "⭐", category: "pemula", difficulty: "mudah", target: 5, event: "level", rewardGems: 25, rewardCoins: 500 },

  // Aktivitas
  { id: "login_7", name: "Rajin Mampir", description: "Login 7 kali", emoji: "📅", category: "aktivitas", difficulty: "mudah", target: 7, event: "login", rewardGems: 20, rewardCoins: 400 },
  { id: "login_30", name: "Pengguna Aktif", description: "Login 30 kali", emoji: "🔥", category: "aktivitas", difficulty: "sedang", target: 30, event: "login", rewardGems: 75, rewardCoins: 1500 },
  { id: "login_100", name: "Setia Selamanya", description: "Login 100 kali", emoji: "🏅", category: "aktivitas", difficulty: "sulit", target: 100, event: "login", rewardGems: 200, rewardCoins: 5000 },
  { id: "mission_10", name: "Pemburu Misi", description: "Selesaikan 10 misi", emoji: "🎯", category: "aktivitas", difficulty: "mudah", target: 10, event: "mission_complete", rewardGems: 30, rewardCoins: 600 },
  { id: "mission_50", name: "Ahli Misi", description: "Selesaikan 50 misi", emoji: "🧭", category: "aktivitas", difficulty: "sedang", target: 50, event: "mission_complete", rewardGems: 100, rewardCoins: 2000 },
  { id: "mission_200", name: "Raja Misi", description: "Selesaikan 200 misi", emoji: "👑", category: "aktivitas", difficulty: "ekstrem", target: 200, event: "mission_complete", rewardGems: 400, rewardCoins: 10000 },
  { id: "game_50", name: "Gamer Sejati", description: "Mainkan 50 game", emoji: "🕹️", category: "aktivitas", difficulty: "sedang", target: 50, event: "game_play", rewardGems: 60, rewardCoins: 1200 },
  { id: "game_win_25", name: "Sang Juara", description: "Menang 25 kali", emoji: "🏆", category: "aktivitas", difficulty: "sedang", target: 25, event: "game_win", rewardGems: 80, rewardCoins: 1600 },
  { id: "music_100", name: "Telinga Emas", description: "Dengarkan 100 lagu", emoji: "🎧", category: "aktivitas", difficulty: "sedang", target: 100, event: "music_listen", rewardGems: 60, rewardCoins: 1200 },
  { id: "spin_100", name: "Penantang Nasib", description: "Lakukan 100 spin", emoji: "🎰", category: "aktivitas", difficulty: "sulit", target: 100, event: "spin", rewardGems: 150, rewardCoins: 3000 },

  // Sosial
  { id: "friend_1", name: "Teman Baru", description: "Tambah 1 teman", emoji: "🙋", category: "sosial", difficulty: "mudah", target: 1, event: "friend_added", rewardGems: 15, rewardCoins: 300 },
  { id: "friend_10", name: "Ramah Sekali", description: "Punya 10 teman", emoji: "👥", category: "sosial", difficulty: "sedang", target: 10, event: "friend_added", rewardGems: 70, rewardCoins: 1400 },
  { id: "friend_50", name: "Sosialita", description: "Punya 50 teman", emoji: "🌐", category: "sosial", difficulty: "sulit", target: 50, event: "friend_added", rewardGems: 220, rewardCoins: 5500 },
  { id: "chat_100", name: "Tukang Ngobrol", description: "Kirim 100 pesan", emoji: "💬", category: "sosial", difficulty: "mudah", target: 100, event: "chat_message", rewardGems: 40, rewardCoins: 800 },
  { id: "chat_1000", name: "Legenda Obrolan", description: "Kirim 1.000 pesan", emoji: "📣", category: "sosial", difficulty: "sulit", target: 1000, event: "chat_message", rewardGems: 250, rewardCoins: 6000 },

  // Koleksi
  { id: "badge_5", name: "Kolektor Pemula", description: "Buka 5 badge", emoji: "🎖️", category: "koleksi", difficulty: "mudah", target: 5, event: "badge", rewardGems: 30, rewardCoins: 600 },
  { id: "badge_15", name: "Kolektor Badge", description: "Buka 15 badge", emoji: "🏵️", category: "koleksi", difficulty: "sedang", target: 15, event: "badge", rewardGems: 120, rewardCoins: 2400 },
  { id: "badge_all", name: "Kolektor Sejati", description: "Buka 25 badge", emoji: "💠", category: "koleksi", difficulty: "ekstrem", target: 25, event: "badge", rewardGems: 500, rewardCoins: 12000 },
  { id: "level_20", name: "Pendaki", description: "Capai level 20", emoji: "🧗", category: "koleksi", difficulty: "sedang", target: 20, event: "level", rewardGems: 120, rewardCoins: 2500 },
  { id: "level_50", name: "Puncak Tertinggi", description: "Capai level 50", emoji: "🗻", category: "koleksi", difficulty: "ekstrem", target: 50, event: "level", rewardGems: 600, rewardCoins: 15000 },

  // Event
  { id: "event_1", name: "Ikut Meriah", description: "Ikuti 1 event", emoji: "🎪", category: "event", difficulty: "mudah", target: 1, event: "event_join", rewardGems: 25, rewardCoins: 500 },
  { id: "event_5", name: "Pecinta Event", description: "Ikuti 5 event", emoji: "🎆", category: "event", difficulty: "sedang", target: 5, event: "event_join", rewardGems: 110, rewardCoins: 2200 },
  { id: "purchase_1", name: "Transaksi Pertama", description: "Lakukan 1 pembelian", emoji: "🛍️", category: "event", difficulty: "mudah", target: 1, event: "purchase", rewardGems: 20, rewardCoins: 400 },
  { id: "purchase_20", name: "Pelanggan Setia", description: "Lakukan 20 pembelian", emoji: "💳", category: "event", difficulty: "sulit", target: 20, event: "purchase", rewardGems: 300, rewardCoins: 7000 },

  // Rahasia
  { id: "secret_night_owl", name: "Kalong Malam", description: "Aktif di atas jam 1 pagi WIB", emoji: "🦉", category: "aktivitas", difficulty: "sedang", target: 1, event: "login", rewardGems: 88, rewardCoins: 1888, secret: true },
  { id: "secret_lucky", name: "Tangan Hoki", description: "Menang beruntun di spin", emoji: "🍀", category: "event", difficulty: "sulit", target: 3, event: "spin", rewardGems: 177, rewardCoins: 3777, secret: true },
];

export function achievementById(id: string) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/* ============================================================
   TIPE DATA
   ============================================================ */

export interface ProgressionRow {
  visitor_id: string;
  xp: number;
  level: number;
  weekly_xp: number;
  monthly_xp: number;
  total_activities: number;
}

export interface AchievementRow {
  achievement_id: string;
  progress: number;
  unlocked: boolean;
  unlocked_at: string | null;
  reward_claimed: boolean;
}

export interface RewardRow {
  id: string;
  source: string;
  title: string;
  description: string | null;
  reward_type: string;
  reward_amount: number;
  claimed: boolean;
  claimed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export const REWARD_SOURCES: Record<string, { label: string; emoji: string; grad: string }> = {
  level: { label: "Naik Level", emoji: "⭐", grad: "from-amber-400 to-orange-600" },
  achievement: { label: "Achievement", emoji: "🏆", grad: "from-violet-400 to-purple-600" },
  mission: { label: "Misi", emoji: "🎯", grad: "from-emerald-400 to-teal-600" },
  daily: { label: "Daily Reward", emoji: "🎁", grad: "from-sky-400 to-blue-600" },
  event: { label: "Event", emoji: "🎉", grad: "from-rose-400 to-pink-600" },
};

/* ============================================================
   API
   ============================================================ */

export async function fetchProgression(visitorId: string): Promise<ProgressionRow> {
  const { data } = await supabase
    .from("profile_progression")
    .select("visitor_id, xp, level, weekly_xp, monthly_xp, total_activities")
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (data) return data as ProgressionRow;
  const fresh = { visitor_id: visitorId, xp: 0, level: 1, weekly_xp: 0, monthly_xp: 0, total_activities: 0 };
  await supabase.from("profile_progression").insert(fresh);
  return fresh;
}

export async function fetchAchievements(visitorId: string): Promise<AchievementRow[]> {
  const { data } = await supabase
    .from("profile_achievements")
    .select("achievement_id, progress, unlocked, unlocked_at, reward_claimed")
    .eq("visitor_id", visitorId);
  return (data as AchievementRow[]) || [];
}

export async function fetchEquippedBadges(visitorId: string): Promise<string[]> {
  const { data } = await supabase
    .from("profile_equipped_badges")
    .select("badge_id, slot")
    .eq("visitor_id", visitorId)
    .order("slot", { ascending: true });
  return (data || []).map((r: any) => r.badge_id as string);
}

export const MAX_EQUIPPED_BADGES = 3;

export async function equipBadge(visitorId: string, badgeId: string, slot: number) {
  await supabase.from("profile_equipped_badges").insert({ visitor_id: visitorId, badge_id: badgeId, slot });
}

export async function unequipBadge(visitorId: string, badgeId: string) {
  await supabase.from("profile_equipped_badges").delete().eq("visitor_id", visitorId).eq("badge_id", badgeId);
}

export async function fetchLevelHistory(visitorId: string) {
  const { data } = await supabase
    .from("profile_level_history")
    .select("id, from_level, to_level, reward_summary, created_at")
    .eq("visitor_id", visitorId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data || [];
}

export async function fetchRewards(visitorId: string): Promise<RewardRow[]> {
  const { data } = await supabase
    .from("profile_reward_inbox")
    .select("id, source, title, description, reward_type, reward_amount, claimed, claimed_at, expires_at, created_at")
    .eq("visitor_id", visitorId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as RewardRow[]) || [];
}

export async function grantReward(
  visitorId: string,
  reward: { source: string; title: string; description?: string; reward_type: "gem" | "coin"; reward_amount: number; expires_at?: string | null },
) {
  await supabase.from("profile_reward_inbox").insert({
    visitor_id: visitorId,
    source: reward.source,
    title: reward.title,
    description: reward.description || null,
    reward_type: reward.reward_type,
    reward_amount: reward.reward_amount,
    expires_at: reward.expires_at || null,
  });
}

/** Klaim satu hadiah — mengkredit gem/koin lalu menandai sudah diklaim. */
export async function claimReward(visitorId: string, reward: RewardRow): Promise<boolean> {
  if (reward.claimed) return false;
  if (reward.expires_at && new Date(reward.expires_at).getTime() < Date.now()) return false;
  const { error: updErr } = await supabase
    .from("profile_reward_inbox")
    .update({ claimed: true, claimed_at: new Date().toISOString() })
    .eq("id", reward.id)
    .eq("claimed", false);
  if (updErr) return false;
  try {
    if (reward.reward_type === "gem") {
      await supabase.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: reward.reward_amount });
    } else {
      await supabase.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: reward.reward_amount });
    }
  } catch {
    /* kredit gagal — hadiah tetap tercatat diklaim, admin bisa cek riwayat */
  }
  return true;
}

export interface AwardResult {
  xpGained: number;
  newXp: number;
  oldLevel: number;
  newLevel: number;
  leveledUp: boolean;
  unlocked: AchievementDef[];
}

/**
 * Menambah XP + memperbarui progres achievement terkait.
 * Aman dipanggil dari mana saja (best-effort, tidak melempar error).
 */
export async function awardXp(
  visitorId: string | null | undefined,
  event: XpEvent,
  increment = 1,
): Promise<AwardResult | null> {
  if (!visitorId) return null;
  try {
    const inc = Math.max(1, Math.floor(increment));
    const xpGained = XP_TABLE[event] * inc;
    const current = await fetchProgression(visitorId);
    const newXp = Number(current.xp) + xpGained;
    const oldLevel = levelFromXp(Number(current.xp));
    const newLevel = levelFromXp(newXp);

    await supabase
      .from("profile_progression")
      .update({
        xp: newXp,
        level: newLevel,
        weekly_xp: Number(current.weekly_xp) + xpGained,
        monthly_xp: Number(current.monthly_xp) + xpGained,
        total_activities: Number(current.total_activities) + inc,
      })
      .eq("visitor_id", visitorId);

    // Hadiah tiap level yang dilewati
    if (newLevel > oldLevel) {
      for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
        const r = levelUpReward(lv);
        await grantReward(visitorId, { source: "level", title: `Hadiah Level ${lv}`, description: r.label, reward_type: "gem", reward_amount: r.gems });
        await grantReward(visitorId, { source: "level", title: `Bonus Koin Level ${lv}`, description: r.label, reward_type: "coin", reward_amount: r.coins });
      }
      await supabase.from("profile_level_history").insert({
        visitor_id: visitorId,
        from_level: oldLevel,
        to_level: newLevel,
        reward_summary: levelUpReward(newLevel).label,
      });
    }

    const unlocked = await bumpAchievements(visitorId, event, inc, newLevel);
    return { xpGained, newXp, oldLevel, newLevel, leveledUp: newLevel > oldLevel, unlocked };
  } catch (e) {
    console.warn("[progression] awardXp gagal:", e);
    return null;
  }
}

/** Memperbarui progres achievement yang cocok dengan event. */
export async function bumpAchievements(
  visitorId: string,
  event: XpEvent | "level" | "badge",
  inc: number,
  levelValue?: number,
): Promise<AchievementDef[]> {
  const defs = ACHIEVEMENTS.filter((a) => a.event === event);
  if (!defs.length) return [];
  const rows = await fetchAchievements(visitorId);
  const unlocked: AchievementDef[] = [];

  for (const def of defs) {
    const row = rows.find((r) => r.achievement_id === def.id);
    if (row?.unlocked) continue;
    const nextProgress =
      def.event === "level" ? Math.max(row?.progress || 0, levelValue || 0) : (row?.progress || 0) + inc;
    const isUnlocked = nextProgress >= def.target;

    await supabase.from("profile_achievements").upsert(
      {
        visitor_id: visitorId,
        achievement_id: def.id,
        progress: Math.min(nextProgress, def.target),
        unlocked: isUnlocked,
        unlocked_at: isUnlocked ? new Date().toISOString() : null,
      },
      { onConflict: "visitor_id,achievement_id" },
    );

    if (isUnlocked) {
      unlocked.push(def);
      await grantReward(visitorId, {
        source: "achievement",
        title: `Achievement: ${def.name}`,
        description: def.description,
        reward_type: "gem",
        reward_amount: def.rewardGems,
      });
      await grantReward(visitorId, {
        source: "achievement",
        title: `Bonus Koin: ${def.name}`,
        description: def.description,
        reward_type: "coin",
        reward_amount: def.rewardCoins,
      });
    }
  }

  if (unlocked.length) {
    window.dispatchEvent(new CustomEvent("achievement-unlocked", { detail: unlocked }));
    // achievement badge counter
    const totalUnlocked = rows.filter((r) => r.unlocked).length + unlocked.length;
    await bumpBadgeCounter(visitorId, totalUnlocked);
  }
  return unlocked;
}

async function bumpBadgeCounter(visitorId: string, totalUnlocked: number) {
  const defs = ACHIEVEMENTS.filter((a) => a.event === "badge");
  for (const def of defs) {
    const isUnlocked = totalUnlocked >= def.target;
    await supabase.from("profile_achievements").upsert(
      {
        visitor_id: visitorId,
        achievement_id: def.id,
        progress: Math.min(totalUnlocked, def.target),
        unlocked: isUnlocked,
        unlocked_at: isUnlocked ? new Date().toISOString() : null,
      },
      { onConflict: "visitor_id,achievement_id" },
    );
  }
}
