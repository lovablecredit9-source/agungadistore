import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mata uang spin — semua pakai gem
const SINGLE_COST_GEMS = 50;       // 1 spin = 50 gem
// Paket bundle (jumlah spin → biaya gem). Makin banyak makin hemat.
const BUNDLES: Array<{ count: number; cost: number; label: string; badge?: string }> = [
  { count: 5,   cost: 200,  label: "5 SPIN" },
  { count: 10,  cost: 300,  label: "10 SPIN", badge: "HEMAT" },
  { count: 20,  cost: 400,  label: "20 SPIN", badge: "SUPER HEMAT" },
  { count: 100, cost: 4000, label: "100 SPIN", badge: "MEGA" },
  { count: 125, cost: 5000, label: "125 SPIN", badge: "ULTRA" },
  { count: 200, cost: 7000, label: "200 SPIN", badge: "GOD PACK" },
];
// Backwards compat — bundle 5 lama
const BUNDLE_COST_DIAMOND = 200;

// Hadiah bobot NORMAL Luck Royale Nyawa — jangan dicampur dengan pool Mega/Combo.
type Prize = {
  kind: "extra_life" | "auto_hint" | "time_freeze" | "streak_freeze" | "streak_coins" | "gems";
  value: number;
  label: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  weight: number;
  color: string;
};

// Pool NORMAL Luck Royale sesuai tampilan utama: Gem tetap ada sampai 10K,
// bersama Nyawa, Hint, Time Freeze, dan Streak Freeze. Jangan dicampur dengan Mega/Combo.
const PRIZES: Prize[] = [
  // === COMMON (sering keluar) ===
  { kind: "auto_hint",     value: 2,     label: "+2 Hint Otomatis",        emoji: "💡", rarity: "common",    weight: 22,    color: "#94a3b8" },
  { kind: "extra_life",    value: 2,     label: "+2 Nyawa Ekstra",         emoji: "❤️", rarity: "common",    weight: 22,    color: "#ef4444" },
  { kind: "time_freeze",   value: 2,     label: "+2 Freeze 30s",           emoji: "⏱️", rarity: "common",    weight: 16,    color: "#0ea5e9" },
  { kind: "auto_hint",     value: 3,     label: "+3 Hint Otomatis",        emoji: "💡", rarity: "common",    weight: 14,    color: "#94a3b8" },
  { kind: "extra_life",    value: 3,     label: "+3 Nyawa Ekstra",         emoji: "❤️", rarity: "common",    weight: 14,    color: "#ef4444" },

  // === RARE ===
  { kind: "streak_freeze", value: 2,     label: "+2 Streak Freeze",        emoji: "🛡️", rarity: "rare",      weight: 12,    color: "#10b981" },
  { kind: "auto_hint",     value: 5,     label: "+5 Hint Otomatis",        emoji: "💡", rarity: "rare",      weight: 10,    color: "#06b6d4" },
  { kind: "extra_life",    value: 5,     label: "+5 Nyawa Ekstra",         emoji: "❤️", rarity: "rare",      weight: 10,    color: "#f43f5e" },
  { kind: "auto_hint",     value: 8,     label: "+8 Hint Otomatis",        emoji: "💡", rarity: "rare",      weight: 7,     color: "#06b6d4" },
  { kind: "extra_life",    value: 8,     label: "+8 Nyawa Ekstra",         emoji: "❤️", rarity: "rare",      weight: 7,     color: "#f43f5e" },
  { kind: "time_freeze",   value: 5,     label: "+5 Freeze 30s",           emoji: "⏱️", rarity: "rare",      weight: 7,     color: "#0ea5e9" },
  { kind: "streak_coins",  value: 200,   label: "🪙 +200 Streak Coin",      emoji: "🪙", rarity: "rare",      weight: 10,    color: "#f59e0b" },
  { kind: "streak_coins",  value: 500,   label: "🪙 +500 Streak Coin",      emoji: "🪙", rarity: "rare",      weight: 7,     color: "#f59e0b" },

  // === EPIC ===
  { kind: "auto_hint",     value: 12,    label: "💡 +12 Hint",             emoji: "💡", rarity: "epic",      weight: 5,     color: "#a855f7" },
  { kind: "extra_life",    value: 12,    label: "❤️ +12 Nyawa",            emoji: "❤️", rarity: "epic",      weight: 5,     color: "#a855f7" },
  { kind: "time_freeze",   value: 8,     label: "+8 Freeze 30s",           emoji: "⏱️", rarity: "epic",      weight: 4.5,   color: "#a855f7" },
  { kind: "streak_freeze", value: 4,     label: "+4 Streak Freeze",        emoji: "🛡️", rarity: "epic",      weight: 4.5,   color: "#ec4899" },
  { kind: "gems",          value: 100,   label: "💎 +100 Gem",             emoji: "💎", rarity: "epic",      weight: 3.5,   color: "#8b5cf6" },
  { kind: "auto_hint",     value: 20,    label: "💡 +20 Hint",             emoji: "💡", rarity: "epic",      weight: 2.8,   color: "#a855f7" },
  { kind: "extra_life",    value: 20,    label: "❤️ +20 Nyawa",            emoji: "❤️", rarity: "epic",      weight: 2.8,   color: "#a855f7" },
  { kind: "streak_coins",  value: 1500,  label: "🪙 +1.500 Streak Coin",    emoji: "🪙", rarity: "epic",      weight: 4,     color: "#fb923c" },
  { kind: "streak_coins",  value: 3000,  label: "🪙 +3.000 Streak Coin",    emoji: "🪙", rarity: "epic",      weight: 2.5,   color: "#fb923c" },

  // === LEGENDARY (susah) ===
  { kind: "extra_life",    value: 35,    label: "❤️ +35 Nyawa",            emoji: "❤️", rarity: "legendary", weight: 2,     color: "#fbbf24" },
  { kind: "auto_hint",     value: 35,    label: "💡 +35 Hint",             emoji: "💡", rarity: "legendary", weight: 2,     color: "#fbbf24" },
  { kind: "streak_freeze", value: 10,    label: "🛡️ +10 Streak Freeze",    emoji: "🛡️", rarity: "legendary", weight: 1.8,   color: "#f59e0b" },
  { kind: "gems",          value: 300,   label: "💎 +300 Gem",             emoji: "💎", rarity: "legendary", weight: 1.5,   color: "#facc15" },
  { kind: "extra_life",    value: 50,    label: "❤️ +50 Nyawa",            emoji: "❤️", rarity: "legendary", weight: 1.2,   color: "#fbbf24" },
  { kind: "auto_hint",     value: 50,    label: "💡 +50 Hint",             emoji: "💡", rarity: "legendary", weight: 1.2,   color: "#fbbf24" },
  { kind: "gems",          value: 500,   label: "💎 +500 Gem",             emoji: "💎", rarity: "legendary", weight: 0.9,   color: "#facc15" },
  { kind: "streak_coins",  value: 8000,  label: "🪙 +8.000 Streak Coin",    emoji: "🪙", rarity: "legendary", weight: 1.5,   color: "#fbbf24" },
  { kind: "streak_coins",  value: 20000, label: "🪙 +20.000 Streak Coin",   emoji: "🪙", rarity: "legendary", weight: 0.8,   color: "#fbbf24" },

  // === MYTHIC (sangat susah) ===
  { kind: "extra_life",    value: 80,    label: "🌈 +80 Nyawa",            emoji: "❤️", rarity: "mythic",    weight: 0.7,   color: "#f0abfc" },
  { kind: "auto_hint",     value: 80,    label: "🌈 +80 Hint",             emoji: "💡", rarity: "mythic",    weight: 0.7,   color: "#f0abfc" },
  { kind: "extra_life",    value: 150,   label: "🌟 +150 Nyawa",           emoji: "❤️", rarity: "mythic",    weight: 0.4,   color: "#f0abfc" },
  { kind: "auto_hint",     value: 150,   label: "🌟 +150 Hint",            emoji: "💡", rarity: "mythic",    weight: 0.4,   color: "#f0abfc" },
  { kind: "gems",          value: 800,   label: "💎 +800 Gem",             emoji: "💎", rarity: "mythic",    weight: 0.4,   color: "#fde68a" },
  { kind: "gems",          value: 2500,  label: "💎 +2.500 Gem",           emoji: "💎", rarity: "mythic",    weight: 0.15,  color: "#fde68a" },
  { kind: "extra_life",    value: 300,   label: "👑 +300 Nyawa GOD",       emoji: "❤️", rarity: "mythic",    weight: 0.12,  color: "#fef08a" },
  { kind: "auto_hint",     value: 300,   label: "👑 +300 Hint GOD",        emoji: "💡", rarity: "mythic",    weight: 0.12,  color: "#fef08a" },
  { kind: "gems",          value: 8000,  label: "💎 +8.000 Gem",           emoji: "💎", rarity: "mythic",    weight: 0.05,  color: "#fde68a" },
  { kind: "gems",          value: 10000, label: "👑 +10.000 Gem",          emoji: "💎", rarity: "mythic",    weight: 0.025, color: "#fef08a" },
  { kind: "streak_coins",  value: 50000, label: "🪙 +50.000 Streak Coin",   emoji: "🪙", rarity: "mythic",    weight: 0.3,   color: "#fde68a" },
  { kind: "streak_coins",  value: 150000,label: "👑 +150.000 Streak JACKPOT", emoji: "🪙", rarity: "mythic",  weight: 0.05,  color: "#fef08a" },

  // === MEGA JACKPOT (PALING SUSAH SEKALI — super rare) ===
  { kind: "gems",          value: 25000, label: "🔥 +25.000 Gem MEGA",     emoji: "💎", rarity: "mythic",    weight: 0.008, color: "#fef08a" },
  { kind: "gems",          value: 50000, label: "👑 +50.000 GEM JACKPOT",  emoji: "💎", rarity: "mythic",    weight: 0.002, color: "#fef08a" },
];

// Pool khusus MEGA/COMBO: boleh punya koin dan gem, tidak dipakai oleh Spin normal.
const MEGA_ARENA_PRIZES: Prize[] = [
  { kind: "auto_hint", value: 2, label: "Hint", emoji: "💡", rarity: "common", weight: 22, color: "#94a3b8" },
  { kind: "extra_life", value: 2, label: "Nyawa", emoji: "❤️", rarity: "common", weight: 20, color: "#ef4444" },
  { kind: "time_freeze", value: 2, label: "Time Freeze", emoji: "⏱️", rarity: "common", weight: 14, color: "#0ea5e9" },
  { kind: "gems", value: 5, label: "Gem", emoji: "💎", rarity: "common", weight: 10, color: "#8b5cf6" },
  { kind: "streak_coins", value: 100, label: "Koin Streak", emoji: "🪙", rarity: "rare", weight: 12, color: "#f59e0b" },
  { kind: "streak_freeze", value: 2, label: "Streak Freeze", emoji: "🛡️", rarity: "rare", weight: 8, color: "#10b981" },
  { kind: "gems", value: 15, label: "Gem", emoji: "💎", rarity: "rare", weight: 6, color: "#06b6d4" },
  { kind: "auto_hint", value: 8, label: "Hint", emoji: "💡", rarity: "epic", weight: 4, color: "#a855f7" },
  { kind: "extra_life", value: 8, label: "Nyawa", emoji: "❤️", rarity: "epic", weight: 4, color: "#ec4899" },
  { kind: "gems", value: 40, label: "Gem", emoji: "💎", rarity: "epic", weight: 2.5, color: "#8b5cf6" },
  { kind: "streak_coins", value: 1000, label: "Koin Streak", emoji: "🪙", rarity: "legendary", weight: 1.8, color: "#fbbf24" },
  { kind: "gems", value: 100, label: "Gem", emoji: "💎", rarity: "legendary", weight: 1, color: "#facc15" },
  { kind: "streak_coins", value: 5000, label: "JACKPOT Koin", emoji: "👑", rarity: "mythic", weight: 0.18, color: "#fef08a" },
  { kind: "gems", value: 300, label: "MEGA Gem", emoji: "💎", rarity: "mythic", weight: 0.12, color: "#e879f9" },
];

// === DAILY FREE SPIN — versi normal, tidak ikut pool Mega/Combo ===
const FREE_PRIZES: Prize[] = [
  { kind: "auto_hint",     value: 1,  label: "🎁 FREE +1 Hint",          emoji: "💡", rarity: "common", weight: 32, color: "#94a3b8" },
  { kind: "extra_life",    value: 1,  label: "🎁 FREE +1 Nyawa",         emoji: "❤️", rarity: "common", weight: 30, color: "#ef4444" },
  { kind: "time_freeze",   value: 1,  label: "🎁 FREE +1 Time Freeze",   emoji: "⏱️", rarity: "common", weight: 24, color: "#0ea5e9" },
  { kind: "streak_freeze", value: 1,  label: "🎁 FREE +1 Streak Freeze", emoji: "🛡️", rarity: "rare",   weight: 12, color: "#10b981" },
  { kind: "auto_hint",     value: 3,  label: "🎁 FREE +3 Hint",          emoji: "💡", rarity: "epic",   weight: 1.2, color: "#a855f7" },
  { kind: "extra_life",    value: 3,  label: "🎁 FREE +3 Nyawa",         emoji: "❤️", rarity: "epic",   weight: 1.0, color: "#f43f5e" },
  { kind: "streak_coins",  value: 50, label: "🎁 FREE +50 Streak Coin",  emoji: "🪙", rarity: "common", weight: 18,  color: "#f59e0b" },
  { kind: "streak_coins",  value: 150,label: "🎁 FREE +150 Streak Coin", emoji: "🪙", rarity: "rare",   weight: 6,   color: "#fb923c" },
];

function pickFromPool(pool: Prize[]): Prize & { index: number } {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i].weight;
    if (r <= 0) return { ...pool[i], index: i };
  }
  return { ...pool[0], index: 0 };
}

function pickPrize(luckyHourActive = false): Prize & { index: number } {
  const first = pickFromPool(PRIZES);
  // Lucky Hour: jika hasil common, reroll sekali (≈ +50% peluang dapat rare+)
  if (luckyHourActive && first.rarity === "common") {
    return pickFromPool(PRIZES);
  }
  return first;
}

// === LUCKY STREAK MULTIPLIER ===
function getStreakMultiplier(streakCount: number): number {
  if (streakCount < 3) return 1.0;
  const bonus = Math.floor(streakCount / 3) * 0.1;
  return Math.min(2.0, 1 + bonus);
}

// === LUCKY TOKEN SYSTEM ===
// Tiap 5 spin berbayar = +1 Lucky Token. Bisa ditukar hadiah pasti.
const TOKENS_PER_SPIN_THRESHOLD = 5; // 5 paid spin = 1 token

// === TOKEN SHOP ACCESS PASS ===
// FREE tier: bebas diklaim tanpa langganan.
// PREMIUM tier: wajib akses Rp 100.000 (30 hari).
// SUPER PREMIUM tier: wajib akses Rp 300.000 (30 hari) — hadiah jauh lebih mantap.
// ULTRA tier: wajib akses Rp 500.000 (30 hari) — hadiah PALING DAHSYAT.
const SHOP_ACCESS_PRICE = 100000;            // Rp 100.000 (Premium)
const SHOP_ACCESS_DAYS = 30;                 // berlaku 30 hari
const SUPER_SHOP_ACCESS_PRICE = 300000;      // Rp 300.000 (Super Premium)
const SUPER_SHOP_ACCESS_DAYS = 30;           // berlaku 30 hari
const ULTRA_SHOP_ACCESS_PRICE = 500000;      // Rp 500.000 (Ultra)
const ULTRA_SHOP_ACCESS_DAYS = 30;           // berlaku 30 hari

// Item shop: Free (1-10) + Premium (20-60) + Super Premium (70-150) + Ultra (160-300, GOD-tier)
const TOKEN_SHOP: Array<{ code: string; name: string; cost: number; kind: string; value: number; rarity: string; emoji: string; tier: "free" | "premium" | "super_premium" | "ultra" }> = [
  // ============ FREE TIER (1-10 token, 10 item) ============
  { code: "tk_hint10",     name: "+10 Hint Otomatis",        cost: 1,   kind: "auto_hint",     value: 10,    rarity: "rare",      emoji: "💡", tier: "free" },
  { code: "tk_life10",     name: "+10 Nyawa Ekstra",         cost: 1,   kind: "extra_life",    value: 10,    rarity: "rare",      emoji: "❤️", tier: "free" },
  { code: "tk_freeze5",    name: "+5 Streak Freeze",         cost: 2,   kind: "streak_freeze", value: 5,     rarity: "rare",      emoji: "🛡️", tier: "free" },
  { code: "tk_coins500",   name: "🪙 +500 Streak Coin",       cost: 2,   kind: "streak_coins",  value: 500,   rarity: "rare",      emoji: "🪙", tier: "free" },
  { code: "tk_hint30",     name: "+30 Hint Otomatis",        cost: 3,   kind: "auto_hint",     value: 30,    rarity: "epic",      emoji: "💡", tier: "free" },
  { code: "tk_life30",     name: "+30 Nyawa Ekstra",         cost: 4,   kind: "extra_life",    value: 30,    rarity: "epic",      emoji: "❤️", tier: "free" },
  { code: "tk_freeze12",   name: "+12 Streak Freeze",        cost: 5,   kind: "streak_freeze", value: 12,    rarity: "epic",      emoji: "🛡️", tier: "free" },
  { code: "tk_coins1500",  name: "🪙 +1.500 Streak Coin",     cost: 6,   kind: "streak_coins",  value: 1500,  rarity: "epic",      emoji: "🪙", tier: "free" },
  { code: "tk_hint80",     name: "+80 Hint Otomatis",        cost: 8,   kind: "auto_hint",     value: 80,    rarity: "epic",      emoji: "💡", tier: "free" },
  { code: "tk_gems100",    name: "💎 +100 Gem",               cost: 10,  kind: "gems",          value: 100,   rarity: "epic",      emoji: "💎", tier: "free" },

  // ============ PREMIUM TIER (20-60 token, 40 item — HADIAH MANTAP) ============
  // Rasio Gem Premium: ~10 gem per token (30 token = 300 gem, makin tinggi makin hemat)
  // 20-25 token — Gem Premium awal
  { code: "pk_gem200",      name: "💎 +200 Gem Premium",            cost: 20, kind: "gems",          value: 200,    rarity: "legendary", emoji: "💎", tier: "premium" },
  { code: "pk_gem220",      name: "💎 +220 Gem Premium",            cost: 22, kind: "gems",          value: 220,    rarity: "legendary", emoji: "💎", tier: "premium" },
  { code: "pk_gem250",      name: "💎 +250 Gem Premium",            cost: 25, kind: "gems",          value: 250,    rarity: "legendary", emoji: "💎", tier: "premium" },
  { code: "pk_life200",     name: "❤️ MEGA +200 Nyawa",             cost: 20, kind: "extra_life",    value: 200,    rarity: "legendary", emoji: "❤️", tier: "premium" },
  { code: "pk_hint200",     name: "💡 MEGA +200 Hint",              cost: 20, kind: "auto_hint",     value: 200,    rarity: "legendary", emoji: "💡", tier: "premium" },
  { code: "pk_freeze50",    name: "🛡️ MEGA +50 Streak Freeze",      cost: 22, kind: "streak_freeze", value: 50,     rarity: "legendary", emoji: "🛡️", tier: "premium" },
  { code: "pk_coins10k",    name: "🪙 PREMIUM +10.000 Coin",        cost: 22, kind: "streak_coins",  value: 10000,  rarity: "legendary", emoji: "🪙", tier: "premium" },
  { code: "pk_coins15k",    name: "🪙 PREMIUM +15.000 Coin",        cost: 25, kind: "streak_coins",  value: 15000,  rarity: "legendary", emoji: "🪙", tier: "premium" },

  // 28-32 token — Bundle borongan
  { code: "pk_bundle_a",    name: "🎁 BUNDLE: +100 Nyawa & +100 Hint", cost: 28, kind: "extra_life", value: 100,   rarity: "legendary", emoji: "🎁", tier: "premium" },
  { code: "pk_bundle_a2",   name: "🎁 BUNDLE: +100 Hint & +30 Freeze", cost: 28, kind: "auto_hint",  value: 100,   rarity: "legendary", emoji: "🎁", tier: "premium" },
  { code: "pk_gem300",      name: "💎 +300 Gem Premium",            cost: 30, kind: "gems",          value: 300,    rarity: "legendary", emoji: "💎", tier: "premium" },
  { code: "pk_life300",     name: "❤️ ULTRA +300 Nyawa",            cost: 30, kind: "extra_life",    value: 300,    rarity: "legendary", emoji: "❤️", tier: "premium" },
  { code: "pk_hint300",     name: "💡 ULTRA +300 Hint",             cost: 30, kind: "auto_hint",     value: 300,    rarity: "legendary", emoji: "💡", tier: "premium" },
  { code: "pk_coins25k",    name: "🪙 ULTRA +25.000 Coin",          cost: 32, kind: "streak_coins",  value: 25000,  rarity: "legendary", emoji: "🪙", tier: "premium" },

  // 35-40 token — Tier ULTRA
  { code: "pk_gem400",      name: "💎 ULTRA +400 Gem",              cost: 35, kind: "gems",          value: 400,    rarity: "mythic",    emoji: "💎", tier: "premium" },
  { code: "pk_life500",     name: "❤️ ULTRA +500 Nyawa",            cost: 35, kind: "extra_life",    value: 500,    rarity: "mythic",    emoji: "❤️", tier: "premium" },
  { code: "pk_hint500",     name: "💡 ULTRA +500 Hint",             cost: 35, kind: "auto_hint",     value: 500,    rarity: "mythic",    emoji: "💡", tier: "premium" },
  { code: "pk_freeze100",   name: "🛡️ ULTRA +100 Freeze",           cost: 38, kind: "streak_freeze", value: 100,    rarity: "mythic",    emoji: "🛡️", tier: "premium" },
  { code: "pk_coins40k",    name: "🪙 ULTRA +40.000 Coin",          cost: 40, kind: "streak_coins",  value: 40000,  rarity: "mythic",    emoji: "🪙", tier: "premium" },
  { code: "pk_gem500",      name: "💎 MEGA +500 Gem",               cost: 40, kind: "gems",          value: 500,    rarity: "mythic",    emoji: "💎", tier: "premium" },

  // 42-50 token — Tier MEGA
  { code: "pk_life700",     name: "❤️ MEGA +700 Nyawa",             cost: 42, kind: "extra_life",    value: 700,    rarity: "mythic",    emoji: "❤️", tier: "premium" },
  { code: "pk_hint700",     name: "💡 MEGA +700 Hint",              cost: 42, kind: "auto_hint",     value: 700,    rarity: "mythic",    emoji: "💡", tier: "premium" },
  { code: "pk_gem600",      name: "💎 MEGA +600 Gem",               cost: 45, kind: "gems",          value: 600,    rarity: "mythic",    emoji: "💎", tier: "premium" },
  { code: "pk_coins60k",    name: "🪙 MEGA +60.000 Coin",           cost: 45, kind: "streak_coins",  value: 60000,  rarity: "mythic",    emoji: "🪙", tier: "premium" },
  { code: "pk_freeze150",   name: "🛡️ MEGA +150 Freeze",            cost: 48, kind: "streak_freeze", value: 150,    rarity: "mythic",    emoji: "🛡️", tier: "premium" },
  { code: "pk_life1000",    name: "❤️ GOD +1.000 Nyawa",            cost: 50, kind: "extra_life",    value: 1000,   rarity: "mythic",    emoji: "❤️", tier: "premium" },
  { code: "pk_hint1000",    name: "💡 GOD +1.000 Hint",             cost: 50, kind: "auto_hint",     value: 1000,   rarity: "mythic",    emoji: "💡", tier: "premium" },
  { code: "pk_gem800",      name: "💎 GOD +800 Gem",                cost: 50, kind: "gems",          value: 800,    rarity: "mythic",    emoji: "💎", tier: "premium" },

  // 52-60 token — Tier GOD/JACKPOT
  { code: "pk_coins80k",    name: "🪙 GOD +80.000 Coin",            cost: 52, kind: "streak_coins",  value: 80000,  rarity: "mythic",    emoji: "🪙", tier: "premium" },
  { code: "pk_freeze200",   name: "🛡️ GOD +200 Freeze",             cost: 55, kind: "streak_freeze", value: 200,    rarity: "mythic",    emoji: "🛡️", tier: "premium" },
  { code: "pk_gem1000",     name: "💎 GOD +1.000 Gem",              cost: 55, kind: "gems",          value: 1000,   rarity: "mythic",    emoji: "💎", tier: "premium" },
  { code: "pk_life1500",    name: "❤️ GOD +1.500 Nyawa",            cost: 56, kind: "extra_life",    value: 1500,   rarity: "mythic",    emoji: "❤️", tier: "premium" },
  { code: "pk_hint1500",    name: "💡 GOD +1.500 Hint",             cost: 56, kind: "auto_hint",     value: 1500,   rarity: "mythic",    emoji: "💡", tier: "premium" },
  { code: "pk_coins100k",   name: "🪙 GOD +100.000 Coin",           cost: 58, kind: "streak_coins",  value: 100000, rarity: "mythic",    emoji: "🪙", tier: "premium" },
  { code: "pk_gem1200",     name: "💎 JACKPOT +1.200 Gem",          cost: 60, kind: "gems",          value: 1200,   rarity: "mythic",    emoji: "💎", tier: "premium" },
  { code: "pk_life2000",    name: "❤️ JACKPOT +2.000 Nyawa",        cost: 60, kind: "extra_life",    value: 2000,   rarity: "mythic",    emoji: "❤️", tier: "premium" },
  { code: "pk_hint2000",    name: "💡 JACKPOT +2.000 Hint",         cost: 60, kind: "auto_hint",     value: 2000,   rarity: "mythic",    emoji: "💡", tier: "premium" },
  { code: "pk_freeze300",   name: "🛡️ JACKPOT +300 Freeze",         cost: 60, kind: "streak_freeze", value: 300,    rarity: "mythic",    emoji: "🛡️", tier: "premium" },

  // ============ SUPER PREMIUM TIER (70-150 token, hadiah MEGA — Rp 300k/bulan) ============
  // 70-80 token — Tier DIVINE
  { code: "sp_gem2100",     name: "💎 DIVINE +2.100 Gem",            cost: 70,  kind: "gems",          value: 2100,    rarity: "mythic", emoji: "💎", tier: "super_premium" },
  { code: "sp_life3000",    name: "❤️ DIVINE +3.000 Nyawa",          cost: 70,  kind: "extra_life",    value: 3000,    rarity: "mythic", emoji: "❤️", tier: "super_premium" },
  { code: "sp_hint3000",    name: "💡 DIVINE +3.000 Hint",           cost: 70,  kind: "auto_hint",     value: 3000,    rarity: "mythic", emoji: "💡", tier: "super_premium" },
  { code: "sp_freeze500",   name: "🛡️ DIVINE +500 Freeze",           cost: 75,  kind: "streak_freeze", value: 500,     rarity: "mythic", emoji: "🛡️", tier: "super_premium" },
  { code: "sp_coins150k",   name: "🪙 DIVINE +150.000 Coin",         cost: 75,  kind: "streak_coins",  value: 150000,  rarity: "mythic", emoji: "🪙", tier: "super_premium" },
  { code: "sp_gem2800",     name: "💎 DIVINE +2.800 Gem",            cost: 80,  kind: "gems",          value: 2800,    rarity: "mythic", emoji: "💎", tier: "super_premium" },

  // 85-100 token — Tier CELESTIAL
  { code: "sp_life5000",    name: "❤️ CELESTIAL +5.000 Nyawa",       cost: 85,  kind: "extra_life",    value: 5000,    rarity: "mythic", emoji: "❤️", tier: "super_premium" },
  { code: "sp_hint5000",    name: "💡 CELESTIAL +5.000 Hint",        cost: 85,  kind: "auto_hint",     value: 5000,    rarity: "mythic", emoji: "💡", tier: "super_premium" },
  { code: "sp_gem3500",     name: "💎 CELESTIAL +3.500 Gem",         cost: 90,  kind: "gems",          value: 3500,    rarity: "mythic", emoji: "💎", tier: "super_premium" },
  { code: "sp_coins250k",   name: "🪙 CELESTIAL +250.000 Coin",      cost: 95,  kind: "streak_coins",  value: 250000,  rarity: "mythic", emoji: "🪙", tier: "super_premium" },
  { code: "sp_freeze1000",  name: "🛡️ CELESTIAL +1.000 Freeze",      cost: 100, kind: "streak_freeze", value: 1000,    rarity: "mythic", emoji: "🛡️", tier: "super_premium" },
  { code: "sp_gem4500",     name: "💎 CELESTIAL +4.500 Gem",         cost: 100, kind: "gems",          value: 4500,    rarity: "mythic", emoji: "💎", tier: "super_premium" },

  // 110-130 token — Tier COSMIC
  { code: "sp_life8000",    name: "❤️ COSMIC +8.000 Nyawa",          cost: 110, kind: "extra_life",    value: 8000,    rarity: "mythic", emoji: "❤️", tier: "super_premium" },
  { code: "sp_hint8000",    name: "💡 COSMIC +8.000 Hint",           cost: 110, kind: "auto_hint",     value: 8000,    rarity: "mythic", emoji: "💡", tier: "super_premium" },
  { code: "sp_coins500k",   name: "🪙 COSMIC +500.000 Coin",         cost: 120, kind: "streak_coins",  value: 500000,  rarity: "mythic", emoji: "🪙", tier: "super_premium" },
  { code: "sp_gem6500",     name: "💎 COSMIC +6.500 Gem",            cost: 130, kind: "gems",          value: 6500,    rarity: "mythic", emoji: "💎", tier: "super_premium" },

  // 140-150 token — Tier OMEGA / MEGA JACKPOT
  { code: "sp_life15k",     name: "❤️ OMEGA +15.000 Nyawa",          cost: 140, kind: "extra_life",    value: 15000,   rarity: "mythic", emoji: "❤️", tier: "super_premium" },
  { code: "sp_hint15k",     name: "💡 OMEGA +15.000 Hint",           cost: 140, kind: "auto_hint",     value: 15000,   rarity: "mythic", emoji: "💡", tier: "super_premium" },
  { code: "sp_freeze2000",  name: "🛡️ OMEGA +2.000 Freeze",          cost: 145, kind: "streak_freeze", value: 2000,    rarity: "mythic", emoji: "🛡️", tier: "super_premium" },
  { code: "sp_coins1m",     name: "🪙 OMEGA +1.000.000 Coin",        cost: 150, kind: "streak_coins",  value: 1000000, rarity: "mythic", emoji: "🪙", tier: "super_premium" },
  { code: "sp_gem10k",      name: "💎 MEGA JACKPOT +10.000 Gem",     cost: 150, kind: "gems",          value: 10000,   rarity: "mythic", emoji: "💎", tier: "super_premium" },

  // ============ ULTRA TIER (160-300 token, hadiah PALING DAHSYAT — Rp 500k/bln) ============
  // === ABSOLUTE ===
  { code: "ul_gem15k",      name: "💎 ABSOLUTE +15.000 Gem",         cost: 160, kind: "gems",          value: 15000,    rarity: "mythic", emoji: "💎", tier: "ultra" },
  { code: "ul_life20k",     name: "❤️ ABSOLUTE +20.000 Nyawa",       cost: 160, kind: "extra_life",    value: 20000,    rarity: "mythic", emoji: "❤️", tier: "ultra" },
  { code: "ul_hint20k",     name: "💡 ABSOLUTE +20.000 Hint",        cost: 165, kind: "auto_hint",     value: 20000,    rarity: "mythic", emoji: "💡", tier: "ultra" },
  { code: "ul_freeze3000",  name: "🛡️ ABSOLUTE +3.000 Freeze",       cost: 170, kind: "streak_freeze", value: 3000,     rarity: "mythic", emoji: "🛡️", tier: "ultra" },
  { code: "ul_coins2m",     name: "🪙 ABSOLUTE +2.000.000 Coin",     cost: 175, kind: "streak_coins",  value: 2000000,  rarity: "mythic", emoji: "🪙", tier: "ultra" },

  // === ETERNAL ===
  { code: "ul_gem25k",      name: "💎 ETERNAL +25.000 Gem",          cost: 190, kind: "gems",          value: 25000,    rarity: "mythic", emoji: "💎", tier: "ultra" },
  { code: "ul_life35k",     name: "❤️ ETERNAL +35.000 Nyawa",        cost: 200, kind: "extra_life",    value: 35000,    rarity: "mythic", emoji: "❤️", tier: "ultra" },
  { code: "ul_hint35k",     name: "💡 ETERNAL +35.000 Hint",         cost: 200, kind: "auto_hint",     value: 35000,    rarity: "mythic", emoji: "💡", tier: "ultra" },
  { code: "ul_coins5m",     name: "🪙 ETERNAL +5.000.000 Coin",      cost: 220, kind: "streak_coins",  value: 5000000,  rarity: "mythic", emoji: "🪙", tier: "ultra" },
  { code: "ul_freeze5000",  name: "🛡️ ETERNAL +5.000 Freeze",        cost: 225, kind: "streak_freeze", value: 5000,     rarity: "mythic", emoji: "🛡️", tier: "ultra" },

  // === INFINITY ===
  { code: "ul_gem40k",      name: "💎 INFINITY +40.000 Gem",         cost: 240, kind: "gems",          value: 40000,    rarity: "mythic", emoji: "💎", tier: "ultra" },
  { code: "ul_life60k",     name: "❤️ INFINITY +60.000 Nyawa",       cost: 250, kind: "extra_life",    value: 60000,    rarity: "mythic", emoji: "❤️", tier: "ultra" },
  { code: "ul_hint60k",     name: "💡 INFINITY +60.000 Hint",        cost: 250, kind: "auto_hint",     value: 60000,    rarity: "mythic", emoji: "💡", tier: "ultra" },
  { code: "ul_coins10m",    name: "🪙 INFINITY +10.000.000 Coin",    cost: 265, kind: "streak_coins",  value: 10000000, rarity: "mythic", emoji: "🪙", tier: "ultra" },

  // === GODLIKE ULTRA JACKPOT ===
  { code: "ul_gem60k",      name: "💎 GODLIKE +60.000 Gem",          cost: 280, kind: "gems",          value: 60000,    rarity: "mythic", emoji: "💎", tier: "ultra" },
  { code: "ul_life100k",    name: "❤️ GODLIKE +100.000 Nyawa",       cost: 285, kind: "extra_life",    value: 100000,   rarity: "mythic", emoji: "❤️", tier: "ultra" },
  { code: "ul_hint100k",    name: "💡 GODLIKE +100.000 Hint",        cost: 285, kind: "auto_hint",     value: 100000,   rarity: "mythic", emoji: "💡", tier: "ultra" },
  { code: "ul_freeze10k",   name: "🛡️ GODLIKE +10.000 Freeze",       cost: 290, kind: "streak_freeze", value: 10000,    rarity: "mythic", emoji: "🛡️", tier: "ultra" },
  { code: "ul_gem100k",     name: "👑 ULTRA JACKPOT +100.000 Gem",   cost: 300, kind: "gems",          value: 100000,   rarity: "mythic", emoji: "👑", tier: "ultra" },
];

// === FREE DAILY TOKEN SHOP — bisa diklaim 1x per hari TANPA bayar token ===
const FREE_DAILY_SHOP: Array<{ code: string; name: string; kind: string; value: number; rarity: string; emoji: string }> = [
  { code: "fd_hint3",    name: "🎁 FREE +3 Hint Harian",      kind: "auto_hint",     value: 3,    rarity: "common", emoji: "💡" },
  { code: "fd_life3",    name: "🎁 FREE +3 Nyawa Harian",     kind: "extra_life",    value: 3,    rarity: "common", emoji: "❤️" },
  { code: "fd_freeze1",  name: "🎁 FREE +1 Streak Freeze",    kind: "streak_freeze", value: 1,    rarity: "rare",   emoji: "🛡️" },
  { code: "fd_coins100", name: "🎁 FREE +100 Streak Coin",    kind: "streak_coins",  value: 100,  rarity: "common", emoji: "🪙" },
];

// === SHOP ACCESS PASS — helpers (akses 30 hari) ===
// tier: "premium" (Rp 100k), "super_premium" (Rp 300k), atau "ultra" (Rp 500k)
type AccessTier = "premium" | "super_premium" | "ultra";
function shopAccessKey(visitorId: string, tier: AccessTier): string {
  if (tier === "ultra") return `lr_ultra_shop_access_${visitorId}`;
  if (tier === "super_premium") return `lr_super_shop_access_${visitorId}`;
  return `lr_shop_access_${visitorId}`;
}
async function getShopAccess(admin: any, visitorId: string, tier: AccessTier = "premium"): Promise<{ activeUntil: string | null; purchasedAt: string | null }> {
  const key = shopAccessKey(visitorId, tier);
  const { data } = await admin.from("admin_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  if (!data) return { activeUntil: null, purchasedAt: null };
  try { return JSON.parse(data.setting_value); } catch { return { activeUntil: null, purchasedAt: null }; }
}

async function setShopAccess(admin: any, visitorId: string, state: { activeUntil: string | null; purchasedAt: string | null }, tier: AccessTier = "premium") {
  const key = shopAccessKey(visitorId, tier);
  const value = JSON.stringify(state);
  const { data: existing } = await admin.from("admin_settings").select("id").eq("setting_key", key).maybeSingle();
  if (existing) await admin.from("admin_settings").update({ setting_value: value }).eq("id", existing.id);
  else await admin.from("admin_settings").insert({ setting_key: key, setting_value: value });
}

function isShopAccessActive(access: { activeUntil: string | null }): boolean {
  if (!access.activeUntil) return false;
  return new Date(access.activeUntil).getTime() > Date.now();
}

async function getFreeDailyState(admin: any, visitorId: string): Promise<Record<string, string>> {
  const key = `lr_free_daily_${visitorId}`;
  const { data } = await admin.from("admin_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  if (!data) return {};
  try { return JSON.parse(data.setting_value); } catch { return {}; }
}

async function setFreeDailyState(admin: any, visitorId: string, state: Record<string, string>) {
  const key = `lr_free_daily_${visitorId}`;
  const value = JSON.stringify(state);
  const { data: existing } = await admin.from("admin_settings").select("id").eq("setting_key", key).maybeSingle();
  if (existing) await admin.from("admin_settings").update({ setting_value: value }).eq("id", existing.id);
  else await admin.from("admin_settings").insert({ setting_key: key, setting_value: value });
}

async function getLuckyTokens(admin: any, visitorId: string): Promise<{ tokens: number; spinProgress: number }> {
  const key = `lucky_token_${visitorId}`;
  const { data } = await admin.from("admin_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  if (!data) return { tokens: 0, spinProgress: 0 };
  try {
    const obj = JSON.parse(data.setting_value);
    return { tokens: Number(obj.tokens || 0), spinProgress: Number(obj.spinProgress || 0) };
  } catch {
    return { tokens: 0, spinProgress: 0 };
  }
}

async function setLuckyTokens(admin: any, visitorId: string, tokens: number, spinProgress: number) {
  const key = `lucky_token_${visitorId}`;
  const value = JSON.stringify({ tokens, spinProgress });
  const { data: existing } = await admin.from("admin_settings").select("id").eq("setting_key", key).maybeSingle();
  if (existing) {
    await admin.from("admin_settings").update({ setting_value: value }).eq("id", existing.id);
  } else {
    await admin.from("admin_settings").insert({ setting_key: key, setting_value: value });
  }
}

// === MEGA JACKPOT POOL (komunitas) ===
// Pool gem global yang naik 5% dari tiap cost spin berbayar.
// Saat seseorang dapat Mythic → ada 25% chance pool dipecah & dibagikan ke pemain itu.
const POOL_KEY = "luck_royale_mega_jackpot_pool";
const POOL_SEED = 5000;
const POOL_CONTRIBUTION_PCT = 0.05; // 5% dari biaya spin masuk pool
const POOL_BREAK_CHANCE = 0.25;     // 25% chance pecah saat dapat Mythic
const POOL_MIN_BREAK = 3000;        // pool minimal sebelum bisa pecah

async function getMegaPool(admin: any): Promise<number> {
  const { data } = await admin.from("admin_settings").select("setting_value").eq("setting_key", POOL_KEY).maybeSingle();
  if (!data) {
    await admin.from("admin_settings").insert({ setting_key: POOL_KEY, setting_value: String(POOL_SEED) });
    return POOL_SEED;
  }
  return Number(data.setting_value || POOL_SEED);
}

async function setMegaPool(admin: any, value: number) {
  const { data } = await admin.from("admin_settings").select("id").eq("setting_key", POOL_KEY).maybeSingle();
  if (data) {
    await admin.from("admin_settings").update({ setting_value: String(Math.max(POOL_SEED, value)) }).eq("id", data.id);
  } else {
    await admin.from("admin_settings").insert({ setting_key: POOL_KEY, setting_value: String(Math.max(POOL_SEED, value)) });
  }
}

// Tambah qty ke streak_power_pack_inventory (inventory yang dipakai PowerPackShop)
async function addInventory(admin: any, visitorId: string, itemCode: string, qty: number) {
  const { data: inv } = await admin
    .from("streak_power_pack_inventory")
    .select("id, quantity")
    .eq("visitor_id", visitorId)
    .eq("item_code", itemCode)
    .maybeSingle();
  if (inv) {
    await admin
      .from("streak_power_pack_inventory")
      .update({ quantity: (inv.quantity || 0) + qty })
      .eq("id", inv.id);
  } else {
    await admin
      .from("streak_power_pack_inventory")
      .insert({ visitor_id: visitorId, item_code: itemCode, quantity: qty });
  }
}

async function applyPrize(admin: any, visitorId: string, p: Prize) {
  if (p.kind === "extra_life" || p.kind === "auto_hint" || p.kind === "time_freeze") {
    const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (!pu) {
      await admin.from("user_power_ups").insert({
        visitor_id: visitorId,
        extra_life: p.kind === "extra_life" ? p.value : 0,
        auto_hint: p.kind === "auto_hint" ? p.value : 0,
        time_freeze: p.kind === "time_freeze" ? p.value : 0,
      });
    } else {
      const cur = (pu[p.kind] as number) || 0;
      await admin.from("user_power_ups").update({ [p.kind]: cur + p.value }).eq("visitor_id", visitorId);
    }

    // Mirror ke inventory Power Pack supaya jumlah ikut bertambah
    const invMap: Record<string, string> = {
      extra_life: "nyawa",
      auto_hint: "hint",
      time_freeze: "freeze",
    };
    const code = invMap[p.kind];
    if (code) await addInventory(admin, visitorId, code, p.value);
  } else if (p.kind === "streak_freeze") {
    const { data: streak } = await admin.from("daily_streaks").select("id, freeze_count").eq("visitor_id", visitorId).maybeSingle();
    if (streak) {
      await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + p.value }).eq("id", streak.id);
    }
    await addInventory(admin, visitorId, "freeze", p.value);
  } else if (p.kind === "gems") {
    await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: p.value });
  } else if (p.kind === "streak_coins") {
    const { data: streak } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
    if (streak) {
      await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + p.value }).eq("id", streak.id);
    } else {
      await admin.from("daily_streaks").insert({ visitor_id: visitorId, streak_coins: p.value });
    }
  }
}

function getTodayWIB(): string {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  return wib.toISOString().split("T")[0];
}

function getNowWIB(): { date: string; hour: number; minute: number; second: number; ms: number } {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  return {
    date: wib.toISOString().split("T")[0],
    hour: wib.getUTCHours(),
    minute: wib.getUTCMinutes(),
    second: wib.getUTCSeconds(),
    ms: wib.getUTCMilliseconds(),
  };
}

// === LUCKY HOUR (1 jam acak per hari, 8-22 WIB) ===
// Selama Lucky Hour aktif, peluang dapat hadiah rare+ naik via 1x reroll
// jika hasil pertama common.
const LUCKY_HOUR_KEY_PREFIX = "luck_royale_nyawa_lucky_hour:";
const LUCKY_HOUR_MIN = 8;
const LUCKY_HOUR_MAX = 22; // inclusive

async function getLuckyHourForDate(admin: any, date: string): Promise<number> {
  const key = LUCKY_HOUR_KEY_PREFIX + date;
  const { data } = await admin.from("admin_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  if (data?.setting_value != null) {
    const h = Number(data.setting_value);
    if (Number.isFinite(h) && h >= 0 && h <= 23) return h;
  }
  const range = LUCKY_HOUR_MAX - LUCKY_HOUR_MIN + 1;
  const hour = LUCKY_HOUR_MIN + Math.floor(Math.random() * range);
  await admin.from("admin_settings").insert({ setting_key: key, setting_value: String(hour) });
  return hour;
}

// === PAKET BELI JAM HOKI ===
// Diskon Rp 20.000 untuk pembelian "1 jam" pertama kali (sekali seumur hidup per visitor).
const LUCKY_HOUR_PACKAGES: Array<{ code: string; hours: number; price: number; firstPrice?: number; label: string; badge?: string }> = [
  { code: "lh_1h",   hours: 1,    price: 50000,  firstPrice: 20000, label: "1 Jam",     badge: "PERTAMA 20RB" },
  { code: "lh_5h",   hours: 5,    price: 100000, label: "5 Jam",     badge: "HEMAT" },
  { code: "lh_1d",   hours: 24,   price: 200000, label: "1 Hari",    badge: "POPULER" },
  { code: "lh_2d",   hours: 48,   price: 250000, label: "2 Hari",    badge: "SUPER HEMAT" },
  { code: "lh_1w",   hours: 168,  price: 500000, label: "1 Minggu",  badge: "MEGA HEMAT" },
];

const LH_EXT_PREFIX = "lrn_lh_ext:"; // value = ISO expiry timestamp
const LH_FIRST_PREFIX = "lrn_lh_first_used:"; // value = "1" jika sudah pakai diskon pertama

async function getBoostedUntil(admin: any, visitorId: string): Promise<string | null> {
  const { data } = await admin.from("admin_settings").select("setting_value").eq("setting_key", LH_EXT_PREFIX + visitorId).maybeSingle();
  const v = data?.setting_value;
  if (!v) return null;
  const t = Date.parse(v);
  if (!Number.isFinite(t) || t <= Date.now()) return null;
  return new Date(t).toISOString();
}

async function setBoostedUntil(admin: any, visitorId: string, iso: string): Promise<void> {
  const key = LH_EXT_PREFIX + visitorId;
  const { data: existing } = await admin.from("admin_settings").select("id").eq("setting_key", key).maybeSingle();
  if (existing?.id) {
    await admin.from("admin_settings").update({ setting_value: iso }).eq("id", existing.id);
  } else {
    await admin.from("admin_settings").insert({ setting_key: key, setting_value: iso });
  }
}

async function getFirstPurchaseUsed(admin: any, visitorId: string): Promise<boolean> {
  const { data } = await admin.from("admin_settings").select("setting_value").eq("setting_key", LH_FIRST_PREFIX + visitorId).maybeSingle();
  return data?.setting_value === "1";
}

async function setFirstPurchaseUsed(admin: any, visitorId: string): Promise<void> {
  const key = LH_FIRST_PREFIX + visitorId;
  const { data: existing } = await admin.from("admin_settings").select("id").eq("setting_key", key).maybeSingle();
  if (existing?.id) {
    await admin.from("admin_settings").update({ setting_value: "1" }).eq("id", existing.id);
  } else {
    await admin.from("admin_settings").insert({ setting_key: key, setting_value: "1" });
  }
}

async function isLuckyHourActive(admin: any, visitorId?: string): Promise<{ active: boolean; hour: number; date: string; nextActiveAt: string; boostedUntil: string | null; source: "free" | "purchased" | null }> {
  const now = getNowWIB();
  const hour = await getLuckyHourForDate(admin, now.date);
  const freeActive = now.hour === hour;

  let boostedUntil: string | null = null;
  if (visitorId) boostedUntil = await getBoostedUntil(admin, visitorId);
  const purchasedActive = !!boostedUntil && Date.parse(boostedUntil) > Date.now();

  const active = freeActive || purchasedActive;
  const source: "free" | "purchased" | null = active ? (freeActive ? "free" : "purchased") : null;

  // Hitung waktu mulai berikutnya (string ISO WIB +07:00) untuk jam free
  let nextDate = now.date;
  let nextHour = hour;
  if (now.hour >= hour) {
    const tomorrow = new Date(Date.now() + 7 * 3600 * 1000 + 24 * 3600 * 1000);
    nextDate = tomorrow.toISOString().split("T")[0];
    const t = await getLuckyHourForDate(admin, nextDate);
    nextHour = t;
  }
  const nextActiveAt = `${nextDate}T${String(nextHour).padStart(2, "0")}:00:00+07:00`;
  return { active, hour, date: now.date, nextActiveAt, boostedUntil, source };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { visitorId, action, count: requestedCount, itemCode, tier: requestedTier } = body;
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = getTodayWIB();

    if (action === "check") {
      const { data: history } = await admin
        .from("luck_royale_nyawa_history")
        .select("id, reward_label, rarity, reward_kind, reward_value, spin_type, created_at")
        .eq("visitor_id", visitorId)
        .order("created_at", { ascending: false })
        .limit(20);
      const { data: gemsData } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });

      const { data: freeUsed } = await admin
        .from("luck_royale_nyawa_history")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("spin_type", "free_daily")
        .gte("created_at", `${today}T00:00:00+07:00`)
        .lte("created_at", `${today}T23:59:59+07:00`)
        .limit(1);
      const freeSpinAvailable = !freeUsed || freeUsed.length === 0;

      let luckyStreak = 0;
      const allHistory = history || [];
      for (const h of allHistory) {
        if (["rare", "epic", "legendary", "mythic"].includes(h.rarity)) {
          luckyStreak++;
        } else {
          break;
        }
      }

      const tokenState = await getLuckyTokens(admin, visitorId);
      const megaPool = await getMegaPool(admin);
      const freeDailyState = await getFreeDailyState(admin, visitorId);
      const shopAccess = await getShopAccess(admin, visitorId, "premium");
      const shopAccessActive = isShopAccessActive(shopAccess);
      const superShopAccess = await getShopAccess(admin, visitorId, "super_premium");
      const superShopAccessActive = isShopAccessActive(superShopAccess);
      const ultraShopAccess = await getShopAccess(admin, visitorId, "ultra");
      const ultraShopAccessActive = isShopAccessActive(ultraShopAccess);
      const luckyHour = await isLuckyHourActive(admin, visitorId);
      const lhFirstUsed = await getFirstPurchaseUsed(admin, visitorId);

      // Build free daily shop with status (claimed today?)
      const freeDailyWithStatus = FREE_DAILY_SHOP.map(item => ({
        ...item,
        claimedToday: freeDailyState[item.code] === today,
      }));

      return Response.json({
        history: allHistory,
        gems: gemsData || 0,
        prizes: PRIZES,
        singleCostGems: SINGLE_COST_GEMS,
        bundleCostDiamond: BUNDLE_COST_DIAMOND,
        bundles: BUNDLES,
        freeSpinAvailable,
        freePrizes: FREE_PRIZES,
        megaArenaPrizes: MEGA_ARENA_PRIZES,
        luckyStreak,
        streakMultiplier: getStreakMultiplier(luckyStreak),
        luckyTokens: tokenState.tokens,
        luckyTokenProgress: tokenState.spinProgress,
        luckyTokenThreshold: TOKENS_PER_SPIN_THRESHOLD,
        megaJackpotPool: megaPool,
        tokenShop: TOKEN_SHOP,
        freeDailyShop: freeDailyWithStatus,
        shopAccess: {
          isActive: shopAccessActive,
          activeUntil: shopAccess.activeUntil,
          purchasedAt: shopAccess.purchasedAt,
          price: SHOP_ACCESS_PRICE,
          durationDays: SHOP_ACCESS_DAYS,
        },
        superShopAccess: {
          isActive: superShopAccessActive,
          activeUntil: superShopAccess.activeUntil,
          purchasedAt: superShopAccess.purchasedAt,
          price: SUPER_SHOP_ACCESS_PRICE,
          durationDays: SUPER_SHOP_ACCESS_DAYS,
        },
        ultraShopAccess: {
          isActive: ultraShopAccessActive,
          activeUntil: ultraShopAccess.activeUntil,
          purchasedAt: ultraShopAccess.purchasedAt,
          price: ULTRA_SHOP_ACCESS_PRICE,
          durationDays: ULTRA_SHOP_ACCESS_DAYS,
        },
        luckyHour: {
          active: luckyHour.active,
          hour: luckyHour.hour,
          date: luckyHour.date,
          nextActiveAt: luckyHour.nextActiveAt,
          rangeStart: LUCKY_HOUR_MIN,
          rangeEnd: LUCKY_HOUR_MAX,
          boostedUntil: luckyHour.boostedUntil,
          source: luckyHour.source,
        },
        luckyHourPackages: LUCKY_HOUR_PACKAGES.map(p => ({
          ...p,
          // Harga efektif: jika belum pernah klaim diskon pertama dan paket punya firstPrice → tampilkan firstPrice
          effectivePrice: (!lhFirstUsed && p.firstPrice != null) ? p.firstPrice : p.price,
          isFirstDiscountAvailable: !lhFirstUsed && p.firstPrice != null,
        })),
        luckyHourFirstDiscountUsed: lhFirstUsed,
      }, { headers: corsHeaders });
    }

    if (action === "spin_free") {
      const { data: freeUsed } = await admin
        .from("luck_royale_nyawa_history")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("spin_type", "free_daily")
        .gte("created_at", `${today}T00:00:00+07:00`)
        .lte("created_at", `${today}T23:59:59+07:00`)
        .limit(1);
      if (freeUsed && freeUsed.length > 0) {
        return Response.json({ error: "Free spin hari ini sudah dipakai. Kembali besok!" }, { status: 400, headers: corsHeaders });
      }

      const prize = pickFromPool(FREE_PRIZES);
      await applyPrize(admin, visitorId, prize);
      await admin.from("luck_royale_nyawa_history").insert({
        visitor_id: visitorId,
        spin_type: "free_daily",
        reward_kind: prize.kind,
        reward_value: prize.value,
        reward_label: prize.label,
        rarity: prize.rarity,
        cost_currency: "free",
        cost_amount: 0,
      });

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎁 FREE Daily Spin!`,
        message: `Kamu dapat: ${prize.label}`,
        type: "luck_royale_nyawa",
      });

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({
        success: true,
        results: [prize],
        gems: gemsAfter || 0,
        prizes: PRIZES,
        isFree: true,
      }, { headers: corsHeaders });
    }

    if (action === "mega_arena_award") {
      const { prize, costGems = 0, multiplier = 1 } = body;
      const allowedKinds = new Set(["extra_life", "auto_hint", "time_freeze", "streak_freeze", "streak_coins", "gems"]);
      const kind = String(prize?.kind || "");
      const baseValue = Math.max(1, Math.min(100000, Number(prize?.value) || 0));
      const mult = Math.max(1, Math.min(5, Number(multiplier) || 1));
      const value = baseValue * mult;
      if (!allowedKinds.has(kind)) return Response.json({ error: "Hadiah tidak valid" }, { status: 400, headers: corsHeaders });

      if (costGems > 0) {
        const { data: haveGems } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
        if ((Number(haveGems) || 0) < costGems) return Response.json({ error: `Butuh ${costGems} gem` }, { status: 400, headers: corsHeaders });
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -costGems });
      }

      await applyPrize(admin, visitorId, { ...prize, kind, value } as Prize);
      await admin.from("luck_royale_nyawa_history").insert({
        visitor_id: visitorId,
        spin_type: "mega_arena",
        reward_kind: kind,
        reward_value: value,
        reward_label: String(prize?.label || kind),
        rarity: String(prize?.rarity || "common"),
        cost_currency: costGems > 0 ? "gems" : "free",
        cost_amount: Math.max(0, Number(costGems) || 0),
      });
      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({ success: true, gems: gemsAfter || 0, awarded: { kind, value } }, { headers: corsHeaders });
    }

    if (action === "spin_single" || action === "spin_bundle" || action === "spin_pack") {
      let spinCount = 1;
      let cost = SINGLE_COST_GEMS;
      let spinType = "single";

      if (action === "spin_bundle") {
        spinCount = 5;
        cost = BUNDLE_COST_DIAMOND;
        spinType = "bundle5";
      } else if (action === "spin_pack") {
        const pack = BUNDLES.find(b => b.count === Number(requestedCount));
        if (!pack) {
          return Response.json({ error: "Paket tidak valid" }, { status: 400, headers: corsHeaders });
        }
        spinCount = pack.count;
        cost = pack.cost;
        spinType = `pack${pack.count}`;
      }

      const currency = "gems";

      const { data: gemsData } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      const gems = Number(gemsData || 0);
      if (gems < cost) {
        return Response.json({
          error: `Butuh ${cost} 💎 Gem (kamu punya ${gems})`,
        }, { status: 400, headers: corsHeaders });
      }

      try {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -cost });
      } catch (e) {
        return Response.json({ error: "Gagal mengurangi saldo" }, { status: 400, headers: corsHeaders });
      }

      // === Mega Jackpot Pool: kontribusi 5% dari biaya spin ===
      let pool = await getMegaPool(admin);
      pool += Math.floor(cost * POOL_CONTRIBUTION_PCT);
      await setMegaPool(admin, pool);

      const { data: histPre } = await admin
        .from("luck_royale_nyawa_history")
        .select("rarity")
        .eq("visitor_id", visitorId)
        .order("created_at", { ascending: false })
        .limit(20);
      let curStreak = 0;
      for (const h of histPre || []) {
        if (["rare", "epic", "legendary", "mythic"].includes(h.rarity)) curStreak++;
        else break;
      }

      const luckyHourState = await isLuckyHourActive(admin, visitorId);
      const luckyHourActive = luckyHourState.active;

      const results: Array<Prize & { index: number; bonusApplied?: number; jackpotWon?: number }> = [];
      let totalBonusGems = 0;
      let jackpotWonTotal = 0;
      for (let i = 0; i < spinCount; i++) {
        const basePrize = pickPrize(luckyHourActive);
        const mult = getStreakMultiplier(curStreak);
        let finalValue = basePrize.value;
        let bonusApplied = 0;
        if (mult > 1.0) {
          finalValue = Math.round(basePrize.value * mult);
          bonusApplied = finalValue - basePrize.value;
          if (basePrize.kind === "gems") totalBonusGems += bonusApplied;
        }
        const prize: Prize = { ...basePrize, value: finalValue };
        await applyPrize(admin, visitorId, prize);

        // === MEGA JACKPOT BREAK: kalau Mythic & lolos chance ===
        let jackpotWon = 0;
        if (prize.rarity === "mythic" && pool >= POOL_MIN_BREAK && Math.random() < POOL_BREAK_CHANCE) {
          jackpotWon = Math.floor(pool * 0.7); // pemain dapat 70% pool
          pool = pool - jackpotWon;
          await setMegaPool(admin, pool);
          await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: jackpotWon });
          jackpotWonTotal += jackpotWon;
        }

        results.push({ ...prize, index: basePrize.index, bonusApplied, jackpotWon });

        const labelParts: string[] = [prize.label];
        if (bonusApplied > 0) labelParts.push(`(+${Math.round((mult - 1) * 100)}% streak)`);
        if (jackpotWon > 0) labelParts.push(`💥 MEGA JACKPOT +${jackpotWon} Gem!`);
        await admin.from("luck_royale_nyawa_history").insert({
          visitor_id: visitorId,
          spin_type: spinType,
          reward_kind: prize.kind,
          reward_value: finalValue + jackpotWon,
          reward_label: labelParts.join(" "),
          rarity: jackpotWon > 0 ? "mythic" : prize.rarity,
          cost_currency: currency,
          cost_amount: i === 0 ? cost : 0,
        });

        if (["rare", "epic", "legendary", "mythic"].includes(prize.rarity)) curStreak++;
        else curStreak = 0;
      }

      // === LUCKY TOKEN: tiap 5 paid spin = +1 token ===
      // Bundle bonus: paket 20 spin = 5 token total (bonus +1 di atas perhitungan normal)
      const BUNDLE_TOKEN_OVERRIDE: Record<number, number> = {
        20: 5,   // 20 spin → 5 token (bukan 4)
        100: 25, // 100 spin → 25 token (bukan 20)
        125: 32, // 125 spin → 32 token (bukan 25)
        200: 55, // 200 spin → 55 token (bonus besar GOD PACK)
      };
      const tokenState = await getLuckyTokens(admin, visitorId);
      let newProgress = tokenState.spinProgress;
      let earnedTokens = 0;
      const overrideTokens = BUNDLE_TOKEN_OVERRIDE[spinCount];
      if (overrideTokens != null) {
        // Pakai override langsung; progress sisa tidak berubah
        earnedTokens = overrideTokens;
      } else {
        newProgress += spinCount;
        while (newProgress >= TOKENS_PER_SPIN_THRESHOLD) {
          earnedTokens++;
          newProgress -= TOKENS_PER_SPIN_THRESHOLD;
        }
      }
      const newTokens = tokenState.tokens + earnedTokens;
      await setLuckyTokens(admin, visitorId, newTokens, newProgress);

      const summary = results.map(r => r.label).join(", ");
      const titleExtras: string[] = [];
      if (totalBonusGems > 0) titleExtras.push(`🔥 +${totalBonusGems} streak`);
      if (jackpotWonTotal > 0) titleExtras.push(`💥 JACKPOT +${jackpotWonTotal}`);
      if (earnedTokens > 0) titleExtras.push(`🎟️ +${earnedTokens} Token`);
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎰 Luck Royale (${spinCount}x)${titleExtras.length ? " " + titleExtras.join(" ") : ""}`,
        message: summary.length > 200 ? summary.slice(0, 200) + "..." : summary,
        type: "luck_royale_nyawa",
      });

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      const finalPool = await getMegaPool(admin);

      return Response.json({
        success: true,
        results,
        gems: gemsAfter || 0,
        prizes: PRIZES,
        luckyStreak: curStreak,
        streakMultiplier: getStreakMultiplier(curStreak),
        totalBonusGems,
        jackpotWonTotal,
        megaJackpotPool: finalPool,
        luckyTokens: newTokens,
        luckyTokenProgress: newProgress,
        luckyTokenThreshold: TOKENS_PER_SPIN_THRESHOLD,
        earnedTokens,
        luckyHourActive,
        luckyHour: luckyHourActive ? luckyHourState.hour : luckyHourState.hour,
      }, { headers: corsHeaders });
    }

    // === REDEEM LUCKY TOKEN ===
    if (action === "redeem_token") {
      const item = TOKEN_SHOP.find(i => i.code === itemCode);
      if (!item) return Response.json({ error: "Item tidak valid" }, { status: 400, headers: corsHeaders });

      // FREE tier: bebas tanpa akses. Premium & Super Premium: wajib akses tier yang sesuai.
      if (item.tier === "premium") {
        const access = await getShopAccess(admin, visitorId, "premium");
        if (!isShopAccessActive(access)) {
          return Response.json({
            error: `Akses Premium belum aktif. Beli akses Rp ${SHOP_ACCESS_PRICE.toLocaleString("id-ID")} (berlaku ${SHOP_ACCESS_DAYS} hari) untuk tukar item Premium.`,
          }, { status: 403, headers: corsHeaders });
        }
      } else if (item.tier === "super_premium") {
        const superAccess = await getShopAccess(admin, visitorId, "super_premium");
        if (!isShopAccessActive(superAccess)) {
          return Response.json({
            error: `Akses Super Premium belum aktif. Beli akses Rp ${SUPER_SHOP_ACCESS_PRICE.toLocaleString("id-ID")} (berlaku ${SUPER_SHOP_ACCESS_DAYS} hari) untuk tukar item Super Premium.`,
          }, { status: 403, headers: corsHeaders });
        }
      } else if (item.tier === "ultra") {
        const ultraAccess = await getShopAccess(admin, visitorId, "ultra");
        if (!isShopAccessActive(ultraAccess)) {
          return Response.json({
            error: `Akses Ultra belum aktif. Beli akses Rp ${ULTRA_SHOP_ACCESS_PRICE.toLocaleString("id-ID")} (berlaku ${ULTRA_SHOP_ACCESS_DAYS} hari) untuk tukar item Ultra.`,
          }, { status: 403, headers: corsHeaders });
        }
      }
      // tier === "free" → langsung lanjut tanpa cek akses

      const tokenState = await getLuckyTokens(admin, visitorId);
      if (tokenState.tokens < item.cost) {
        return Response.json({
          error: `Butuh ${item.cost} 🎟️ Lucky Token (kamu punya ${tokenState.tokens})`,
        }, { status: 400, headers: corsHeaders });
      }

      // Apply prize
      const prize: Prize = {
        kind: item.kind as any,
        value: item.value,
        label: item.name,
        emoji: item.emoji,
        rarity: item.rarity as any,
        weight: 0,
        color: "#fbbf24",
      };
      await applyPrize(admin, visitorId, prize);

      // Deduct tokens
      const newTokens = tokenState.tokens - item.cost;
      await setLuckyTokens(admin, visitorId, newTokens, tokenState.spinProgress);

      // Log to history
      await admin.from("luck_royale_nyawa_history").insert({
        visitor_id: visitorId,
        spin_type: "token_redeem",
        reward_kind: item.kind,
        reward_value: item.value,
        reward_label: `🎟️ TOKEN: ${item.name}`,
        rarity: item.rarity,
        cost_currency: "lucky_token",
        cost_amount: item.cost,
      });

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎟️ Lucky Token Ditukar`,
        message: `Kamu dapat: ${item.name} (sisa ${newTokens} token)`,
        type: "luck_royale_nyawa",
      });

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({
        success: true,
        item,
        gems: gemsAfter || 0,
        luckyTokens: newTokens,
        luckyTokenProgress: tokenState.spinProgress,
        luckyTokenThreshold: TOKENS_PER_SPIN_THRESHOLD,
      }, { headers: corsHeaders });
    }

    // === FREE DAILY CLAIM (gratis 1x per hari per item) ===
    if (action === "claim_free_daily") {
      const item = FREE_DAILY_SHOP.find(i => i.code === itemCode);
      if (!item) return Response.json({ error: "Item tidak valid" }, { status: 400, headers: corsHeaders });

      const state = await getFreeDailyState(admin, visitorId);
      if (state[item.code] === today) {
        return Response.json({ error: "Sudah diklaim hari ini. Kembali besok!" }, { status: 400, headers: corsHeaders });
      }

      const prize: Prize = {
        kind: item.kind as any, value: item.value, label: item.name,
        emoji: item.emoji, rarity: item.rarity as any, weight: 0, color: "#10b981",
      };
      await applyPrize(admin, visitorId, prize);

      state[item.code] = today;
      await setFreeDailyState(admin, visitorId, state);

      await admin.from("luck_royale_nyawa_history").insert({
        visitor_id: visitorId,
        spin_type: "free_daily_claim",
        reward_kind: item.kind,
        reward_value: item.value,
        reward_label: `🎁 FREE: ${item.name}`,
        rarity: item.rarity,
        cost_currency: "free",
        cost_amount: 0,
      });

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({ success: true, item, gems: gemsAfter || 0 }, { headers: corsHeaders });
    }

    // === BUY TOKEN SHOP ACCESS — bayar saldo, akses 30 hari ===
    // Body opsional: { tier: "premium" | "super_premium" } — default "premium"
    if (action === "buy_shop_access") {
      const accessTier: AccessTier =
        requestedTier === "ultra" ? "ultra"
        : requestedTier === "super_premium" ? "super_premium"
        : "premium";
      const price =
        accessTier === "ultra" ? ULTRA_SHOP_ACCESS_PRICE
        : accessTier === "super_premium" ? SUPER_SHOP_ACCESS_PRICE
        : SHOP_ACCESS_PRICE;
      const days =
        accessTier === "ultra" ? ULTRA_SHOP_ACCESS_DAYS
        : accessTier === "super_premium" ? SUPER_SHOP_ACCESS_DAYS
        : SHOP_ACCESS_DAYS;
      const tierLabel =
        accessTier === "ultra" ? "Ultra"
        : accessTier === "super_premium" ? "Super Premium"
        : "Premium";

      const access = await getShopAccess(admin, visitorId, accessTier);
      if (isShopAccessActive(access)) {
        return Response.json({
          error: `Akses ${tierLabel} kamu masih aktif sampai ${new Date(access.activeUntil!).toLocaleString("id-ID")}`,
        }, { status: 400, headers: corsHeaders });
      }

      // Resolve account balance row
      const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
      if (!ubId) {
        return Response.json({ error: `Login akun saldo dulu untuk beli akses ${tierLabel}` }, { status: 400, headers: corsHeaders });
      }
      const { data: balanceRow } = await admin
        .from("user_balances")
        .select("id, balance, username")
        .eq("id", ubId)
        .maybeSingle();
      if (!balanceRow) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 400, headers: corsHeaders });
      if ((balanceRow.balance || 0) < price) {
        return Response.json({
          error: `Saldo tidak cukup. Butuh Rp ${price.toLocaleString("id-ID")} (saldo: Rp ${(balanceRow.balance || 0).toLocaleString("id-ID")})`,
        }, { status: 400, headers: corsHeaders });
      }

      // Potong saldo
      const newBalance = (balanceRow.balance || 0) - price;
      await admin.from("user_balances").update({ balance: newBalance }).eq("id", balanceRow.id);

      // Catat transaksi
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        amount: -price,
        type: "purchase",
        description: `Akses ${tierLabel} Token Shop Luck Royale (${days} hari)`,
      });

      // Aktifkan akses 30 hari
      const now = new Date();
      const activeUntil = new Date(now.getTime() + days * 86400000);
      await setShopAccess(admin, visitorId, {
        activeUntil: activeUntil.toISOString(),
        purchasedAt: now.toISOString(),
      }, accessTier);

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🔓 Akses ${tierLabel} Aktif`,
        message: `Akses ${days} hari berhasil dibeli. Berakhir: ${activeUntil.toLocaleString("id-ID")}`,
        type: "luck_royale_nyawa",
      });

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      const respKey =
        accessTier === "ultra" ? "ultraShopAccess"
        : accessTier === "super_premium" ? "superShopAccess"
        : "shopAccess";
      return Response.json({
        success: true,
        balance: newBalance,
        gems: gemsAfter || 0,
        tier: accessTier,
        [respKey]: {
          isActive: true,
          activeUntil: activeUntil.toISOString(),
          purchasedAt: now.toISOString(),
          price,
          durationDays: days,
        },
      }, { headers: corsHeaders });
    }

    // === BUY LUCKY HOUR — bayar saldo + PIN, perpanjang/aktifkan Jam Hoki ===
    if (action === "buy_lucky_hour") {
      const pkgCode = String(itemCode || "");
      const pkg = LUCKY_HOUR_PACKAGES.find(p => p.code === pkgCode);
      if (!pkg) return Response.json({ error: "Paket Jam Hoki tidak dikenal" }, { status: 400, headers: corsHeaders });

      const pin = (body as any).pin as string | undefined;

      // Verifikasi PIN (wajib)
      const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
      if (!pinRow) return Response.json({ error: "PIN belum dibuat. Buat PIN dulu di menu Profil.", needPin: true }, { status: 200, headers: corsHeaders });
      if (!pin) return Response.json({ error: "Masukkan PIN 6 digit", needPin: true }, { status: 200, headers: corsHeaders });
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 200, headers: corsHeaders });

      // Cek diskon pembelian pertama
      const firstUsed = await getFirstPurchaseUsed(admin, visitorId);
      const usingFirstDiscount = !firstUsed && pkg.firstPrice != null;
      const price = usingFirstDiscount ? (pkg.firstPrice as number) : pkg.price;

      // Resolve akun saldo
      const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
      if (!ubId) return Response.json({ error: "Login akun saldo dulu untuk beli Jam Hoki" }, { status: 400, headers: corsHeaders });

      const { data: balanceRow } = await admin
        .from("user_balances")
        .select("id, balance, username")
        .eq("id", ubId)
        .maybeSingle();
      if (!balanceRow) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 400, headers: corsHeaders });
      if ((balanceRow.balance || 0) < price) {
        return Response.json({
          error: `Saldo tidak cukup. Butuh Rp ${price.toLocaleString("id-ID")} (saldo: Rp ${(balanceRow.balance || 0).toLocaleString("id-ID")})`,
        }, { status: 400, headers: corsHeaders });
      }

      // Potong saldo
      const newBalance = (balanceRow.balance || 0) - price;
      await admin.from("user_balances").update({ balance: newBalance }).eq("id", balanceRow.id);

      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        amount: -price,
        type: "purchase",
        description: `Beli Jam Hoki Luck Royale (${pkg.label})${usingFirstDiscount ? " — DISKON PERTAMA" : ""}`,
      });

      // Akumulasi durasi: kalau masih ada sisa boost, tambahkan dari sisa itu;
      // kalau tidak, mulai dari sekarang.
      const existing = await getBoostedUntil(admin, visitorId);
      const baseMs = existing ? Date.parse(existing) : Date.now();
      const newUntilMs = baseMs + pkg.hours * 3600 * 1000;
      const newUntilIso = new Date(newUntilMs).toISOString();
      await setBoostedUntil(admin, visitorId, newUntilIso);

      // Tandai diskon pertama terpakai
      if (usingFirstDiscount) await setFirstPurchaseUsed(admin, visitorId);

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: "🍀 Jam Hoki Aktif!",
        message: `Kamu beli ${pkg.label} Jam Hoki seharga Rp ${price.toLocaleString("id-ID")}${usingFirstDiscount ? " (diskon pertama)" : ""}. Aktif sampai ${new Date(newUntilMs).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.`,
        type: "luck_royale_nyawa",
      });

      return Response.json({
        success: true,
        balance: newBalance,
        package: pkg,
        priceCharged: price,
        usedFirstDiscount: usingFirstDiscount,
        boostedUntil: newUntilIso,
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
