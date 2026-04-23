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
];
// Backwards compat — bundle 5 lama
const BUNDLE_COST_DIAMOND = 200;

// Hadiah bobot — fokus 3 item utama: extra_life, auto_hint, time_freeze, streak_freeze
type Prize = {
  kind: "extra_life" | "auto_hint" | "time_freeze" | "streak_freeze" | "gems" | "coins";
  value: number;
  label: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  weight: number;
  color: string;
};

// Pool dirombak: Gem dibuat LANGKA (hoki-hokian) & nilainya dikecilkan.
// Hadiah utama = item power-up (nyawa/hint/freeze). Gem hanya muncul sesekali.
const PRIZES: Prize[] = [
  // Common (~58%) — hadiah ringan power-up, NO gem
  { kind: "auto_hint",     value: 2,  label: "+2 Hint Otomatis",        emoji: "💡", rarity: "common",    weight: 22, color: "#94a3b8" },
  { kind: "extra_life",    value: 2,  label: "+2 Nyawa Ekstra",          emoji: "❤️", rarity: "common",    weight: 20, color: "#ef4444" },
  { kind: "time_freeze",   value: 2,  label: "+2 Time Freeze 30s",       emoji: "⏱️", rarity: "common",    weight: 16, color: "#0ea5e9" },
  // Rare (~32%) — power-up qty lebih banyak, NO gem
  { kind: "streak_freeze", value: 2,  label: "+2 Streak Freeze",         emoji: "🛡️", rarity: "rare",      weight: 14, color: "#10b981" },
  { kind: "auto_hint",     value: 5,  label: "+5 Hint Otomatis",         emoji: "💡", rarity: "rare",      weight: 10, color: "#06b6d4" },
  { kind: "extra_life",    value: 5,  label: "+5 Nyawa Ekstra",          emoji: "❤️", rarity: "rare",      weight: 8,  color: "#f43f5e" },
  // Epic (~9%) — gem mulai muncul tapi kecil & jarang
  { kind: "time_freeze",   value: 8,  label: "+8 Time Freeze",           emoji: "⏱️", rarity: "epic",      weight: 4,  color: "#a855f7" },
  { kind: "streak_freeze", value: 4,  label: "+4 Streak Freeze",         emoji: "🛡️", rarity: "epic",      weight: 4,  color: "#ec4899" },
  { kind: "gems",          value: 100, label: "💎 +100 Gem",             emoji: "💎", rarity: "epic",      weight: 1.2, color: "#8b5cf6" },
  // Legendary (~2%) — hadiah besar power-up, gem tetap kecil & langka
  { kind: "extra_life",    value: 20, label: "🎰 JACKPOT +20 Nyawa",      emoji: "👑", rarity: "legendary", weight: 1.0, color: "#fbbf24" },
  { kind: "streak_freeze", value: 10, label: "🎰 LEGENDARY +10 Freeze",   emoji: "👑", rarity: "legendary", weight: 0.8, color: "#f59e0b" },
  { kind: "gems",          value: 300, label: "💎 LEGENDARY +300 Gem",    emoji: "👑", rarity: "legendary", weight: 0.4, color: "#facc15" },
  // Mythic (~0.4%) — pelangi, sangat langka
  { kind: "extra_life",    value: 50,   label: "🌈 MYTHIC VAULT +50 Nyawa",     emoji: "🌈", rarity: "mythic", weight: 0.25, color: "#f0abfc" },
  { kind: "gems",          value: 800,  label: "🌈 MYTHIC TREASURE +800 Gem",   emoji: "🌈", rarity: "mythic", weight: 0.12, color: "#e879f9" },
  // Grand Prize (~0.05%) — ultra rare, hoki banget
  { kind: "gems",          value: 2500, label: "🌈 GRAND PRIZE +2.500 Gem",     emoji: "🌈", rarity: "mythic", weight: 0.04, color: "#22d3ee" },
  { kind: "gems",          value: 8000, label: "🌈 MEGA JACKPOT +8.000 Gem",    emoji: "🌈", rarity: "mythic", weight: 0.012, color: "#a78bfa" },
];

// === DAILY FREE SPIN — pool hadiah lebih ringan, 100% kasih sesuatu ===
// Gem juga dibuat lebih jarang & kecil di sini.
const FREE_PRIZES: Prize[] = [
  { kind: "auto_hint",     value: 1,  label: "🎁 FREE +1 Hint",          emoji: "💡", rarity: "common", weight: 32, color: "#94a3b8" },
  { kind: "extra_life",    value: 1,  label: "🎁 FREE +1 Nyawa",         emoji: "❤️", rarity: "common", weight: 30, color: "#ef4444" },
  { kind: "time_freeze",   value: 1,  label: "🎁 FREE +1 Time Freeze",   emoji: "⏱️", rarity: "common", weight: 24, color: "#0ea5e9" },
  { kind: "streak_freeze", value: 1,  label: "🎁 FREE +1 Streak Freeze", emoji: "🛡️", rarity: "rare",   weight: 12, color: "#10b981" },
  { kind: "gems",          value: 25, label: "💎 FREE +25 Gem",          emoji: "💎", rarity: "rare",   weight: 1.5, color: "#8b5cf6" },
  { kind: "gems",          value: 80, label: "💎 FREE BONUS +80 Gem",    emoji: "💎", rarity: "epic",   weight: 0.4, color: "#a855f7" },
  { kind: "gems",          value: 300, label: "🌈 FREE LEGENDARY +300 Gem", emoji: "🌈", rarity: "legendary", weight: 0.08, color: "#facc15" },
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

function pickPrize(): Prize & { index: number } {
  return pickFromPool(PRIZES);
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
// Untuk bisa tukar token di Token Shop, user wajib unlock akses dengan saldo Rp 100.000.
// Akses aktif selama 30 hari. Setelah expired harus beli lagi.
const SHOP_ACCESS_PRICE = 100000;       // Rp 100.000
const SHOP_ACCESS_DAYS = 30;            // berlaku 30 hari

// 50 item: 10 Free (1-10 token) + 40 Premium (20-60 token, hadiah jauh lebih MANTAP)
const TOKEN_SHOP: Array<{ code: string; name: string; cost: number; kind: string; value: number; rarity: string; emoji: string; tier: "free" | "premium" }> = [
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
  // 20-25 token — Gem Premium besar
  { code: "pk_gem500",      name: "💎 +500 Gem Premium",            cost: 20, kind: "gems",          value: 500,    rarity: "legendary", emoji: "💎", tier: "premium" },
  { code: "pk_gem700",      name: "💎 +700 Gem Premium",            cost: 22, kind: "gems",          value: 700,    rarity: "legendary", emoji: "💎", tier: "premium" },
  { code: "pk_gem1000",     name: "💎 +1.000 Gem Premium",          cost: 25, kind: "gems",          value: 1000,   rarity: "legendary", emoji: "💎", tier: "premium" },
  { code: "pk_life200",     name: "❤️ MEGA +200 Nyawa",             cost: 20, kind: "extra_life",    value: 200,    rarity: "legendary", emoji: "❤️", tier: "premium" },
  { code: "pk_hint200",     name: "💡 MEGA +200 Hint",              cost: 20, kind: "auto_hint",     value: 200,    rarity: "legendary", emoji: "💡", tier: "premium" },
  { code: "pk_freeze50",    name: "🛡️ MEGA +50 Streak Freeze",      cost: 22, kind: "streak_freeze", value: 50,     rarity: "legendary", emoji: "🛡️", tier: "premium" },
  { code: "pk_coins10k",    name: "🪙 PREMIUM +10.000 Coin",        cost: 22, kind: "streak_coins",  value: 10000,  rarity: "legendary", emoji: "🪙", tier: "premium" },
  { code: "pk_coins15k",    name: "🪙 PREMIUM +15.000 Coin",        cost: 25, kind: "streak_coins",  value: 15000,  rarity: "legendary", emoji: "🪙", tier: "premium" },

  // 28-32 token — Bundle borongan
  { code: "pk_bundle_a",    name: "🎁 BUNDLE: +100 Nyawa & +100 Hint", cost: 28, kind: "extra_life", value: 100,   rarity: "legendary", emoji: "🎁", tier: "premium" },
  { code: "pk_bundle_a2",   name: "🎁 BUNDLE: +100 Hint & +30 Freeze", cost: 28, kind: "auto_hint",  value: 100,   rarity: "legendary", emoji: "🎁", tier: "premium" },
  { code: "pk_gem1500",     name: "💎 +1.500 Gem Premium",          cost: 30, kind: "gems",          value: 1500,   rarity: "legendary", emoji: "💎", tier: "premium" },
  { code: "pk_life300",     name: "❤️ ULTRA +300 Nyawa",            cost: 30, kind: "extra_life",    value: 300,    rarity: "legendary", emoji: "❤️", tier: "premium" },
  { code: "pk_hint300",     name: "💡 ULTRA +300 Hint",             cost: 30, kind: "auto_hint",     value: 300,    rarity: "legendary", emoji: "💡", tier: "premium" },
  { code: "pk_coins25k",    name: "🪙 ULTRA +25.000 Coin",          cost: 32, kind: "streak_coins",  value: 25000,  rarity: "legendary", emoji: "🪙", tier: "premium" },

  // 35-40 token — Tier ULTRA
  { code: "pk_gem2000",     name: "💎 ULTRA +2.000 Gem",            cost: 35, kind: "gems",          value: 2000,   rarity: "mythic",    emoji: "💎", tier: "premium" },
  { code: "pk_life500",     name: "❤️ ULTRA +500 Nyawa",            cost: 35, kind: "extra_life",    value: 500,    rarity: "mythic",    emoji: "❤️", tier: "premium" },
  { code: "pk_hint500",     name: "💡 ULTRA +500 Hint",             cost: 35, kind: "auto_hint",     value: 500,    rarity: "mythic",    emoji: "💡", tier: "premium" },
  { code: "pk_freeze100",   name: "🛡️ ULTRA +100 Freeze",           cost: 38, kind: "streak_freeze", value: 100,    rarity: "mythic",    emoji: "🛡️", tier: "premium" },
  { code: "pk_coins40k",    name: "🪙 ULTRA +40.000 Coin",          cost: 40, kind: "streak_coins",  value: 40000,  rarity: "mythic",    emoji: "🪙", tier: "premium" },
  { code: "pk_gem2500",     name: "💎 MEGA +2.500 Gem",             cost: 40, kind: "gems",          value: 2500,   rarity: "mythic",    emoji: "💎", tier: "premium" },

  // 42-50 token — Tier MEGA
  { code: "pk_life700",     name: "❤️ MEGA +700 Nyawa",             cost: 42, kind: "extra_life",    value: 700,    rarity: "mythic",    emoji: "❤️", tier: "premium" },
  { code: "pk_hint700",     name: "💡 MEGA +700 Hint",              cost: 42, kind: "auto_hint",     value: 700,    rarity: "mythic",    emoji: "💡", tier: "premium" },
  { code: "pk_gem3000",     name: "💎 MEGA +3.000 Gem",             cost: 45, kind: "gems",          value: 3000,   rarity: "mythic",    emoji: "💎", tier: "premium" },
  { code: "pk_coins60k",    name: "🪙 MEGA +60.000 Coin",           cost: 45, kind: "streak_coins",  value: 60000,  rarity: "mythic",    emoji: "🪙", tier: "premium" },
  { code: "pk_freeze150",   name: "🛡️ MEGA +150 Freeze",            cost: 48, kind: "streak_freeze", value: 150,    rarity: "mythic",    emoji: "🛡️", tier: "premium" },
  { code: "pk_life1000",    name: "❤️ GOD +1.000 Nyawa",            cost: 50, kind: "extra_life",    value: 1000,   rarity: "mythic",    emoji: "❤️", tier: "premium" },
  { code: "pk_hint1000",    name: "💡 GOD +1.000 Hint",             cost: 50, kind: "auto_hint",     value: 1000,   rarity: "mythic",    emoji: "💡", tier: "premium" },
  { code: "pk_gem4000",     name: "💎 GOD +4.000 Gem",              cost: 50, kind: "gems",          value: 4000,   rarity: "mythic",    emoji: "💎", tier: "premium" },

  // 52-60 token — Tier GOD/JACKPOT
  { code: "pk_coins80k",    name: "🪙 GOD +80.000 Coin",            cost: 52, kind: "streak_coins",  value: 80000,  rarity: "mythic",    emoji: "🪙", tier: "premium" },
  { code: "pk_freeze200",   name: "🛡️ GOD +200 Freeze",             cost: 55, kind: "streak_freeze", value: 200,    rarity: "mythic",    emoji: "🛡️", tier: "premium" },
  { code: "pk_gem5000",     name: "💎 GOD +5.000 Gem",              cost: 55, kind: "gems",          value: 5000,   rarity: "mythic",    emoji: "💎", tier: "premium" },
  { code: "pk_life1500",    name: "❤️ GOD +1.500 Nyawa",            cost: 56, kind: "extra_life",    value: 1500,   rarity: "mythic",    emoji: "❤️", tier: "premium" },
  { code: "pk_hint1500",    name: "💡 GOD +1.500 Hint",             cost: 56, kind: "auto_hint",     value: 1500,   rarity: "mythic",    emoji: "💡", tier: "premium" },
  { code: "pk_coins100k",   name: "🪙 GOD +100.000 Coin",           cost: 58, kind: "streak_coins",  value: 100000, rarity: "mythic",    emoji: "🪙", tier: "premium" },
  { code: "pk_gem6000",     name: "💎 JACKPOT +6.000 Gem",          cost: 60, kind: "gems",          value: 6000,   rarity: "mythic",    emoji: "💎", tier: "premium" },
  { code: "pk_life2000",    name: "❤️ JACKPOT +2.000 Nyawa",        cost: 60, kind: "extra_life",    value: 2000,   rarity: "mythic",    emoji: "❤️", tier: "premium" },
  { code: "pk_hint2000",    name: "💡 JACKPOT +2.000 Hint",         cost: 60, kind: "auto_hint",     value: 2000,   rarity: "mythic",    emoji: "💡", tier: "premium" },
  { code: "pk_freeze300",   name: "🛡️ JACKPOT +300 Freeze",         cost: 60, kind: "streak_freeze", value: 300,    rarity: "mythic",    emoji: "🛡️", tier: "premium" },
];

// === FREE DAILY TOKEN SHOP — bisa diklaim 1x per hari TANPA bayar token ===
const FREE_DAILY_SHOP: Array<{ code: string; name: string; kind: string; value: number; rarity: string; emoji: string }> = [
  { code: "fd_hint3",    name: "🎁 FREE +3 Hint Harian",      kind: "auto_hint",     value: 3,    rarity: "common", emoji: "💡" },
  { code: "fd_life3",    name: "🎁 FREE +3 Nyawa Harian",     kind: "extra_life",    value: 3,    rarity: "common", emoji: "❤️" },
  { code: "fd_freeze1",  name: "🎁 FREE +1 Streak Freeze",    kind: "streak_freeze", value: 1,    rarity: "rare",   emoji: "🛡️" },
  { code: "fd_coins100", name: "🎁 FREE +100 Streak Coin",    kind: "streak_coins",  value: 100,  rarity: "common", emoji: "🪙" },
];

// === SHOP ACCESS PASS — helpers (akses 30 hari Rp 100k) ===
async function getShopAccess(admin: any, visitorId: string): Promise<{ activeUntil: string | null; purchasedAt: string | null }> {
  const key = `lr_shop_access_${visitorId}`;
  const { data } = await admin.from("admin_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  if (!data) return { activeUntil: null, purchasedAt: null };
  try { return JSON.parse(data.setting_value); } catch { return { activeUntil: null, purchasedAt: null }; }
}

async function setShopAccess(admin: any, visitorId: string, state: { activeUntil: string | null; purchasedAt: string | null }) {
  const key = `lr_shop_access_${visitorId}`;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, action, count: requestedCount, itemCode } = await req.json();
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
      const shopAccess = await getShopAccess(admin, visitorId);
      const shopAccessActive = isShopAccessActive(shopAccess);

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

      const results: Array<Prize & { index: number; bonusApplied?: number; jackpotWon?: number }> = [];
      let totalBonusGems = 0;
      let jackpotWonTotal = 0;
      for (let i = 0; i < spinCount; i++) {
        const basePrize = pickPrize();
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
      const tokenState = await getLuckyTokens(admin, visitorId);
      let newProgress = tokenState.spinProgress + spinCount;
      let earnedTokens = 0;
      while (newProgress >= TOKENS_PER_SPIN_THRESHOLD) {
        earnedTokens++;
        newProgress -= TOKENS_PER_SPIN_THRESHOLD;
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
      }, { headers: corsHeaders });
    }

    // === REDEEM LUCKY TOKEN ===
    if (action === "redeem_token") {
      const item = TOKEN_SHOP.find(i => i.code === itemCode);
      if (!item) return Response.json({ error: "Item tidak valid" }, { status: 400, headers: corsHeaders });

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

    // === UNLOCK PREMIUM (bayar gem 1x untuk membuka akses) ===
    if (action === "unlock_premium") {
      const item = PREMIUM_SHOP.find(i => i.code === itemCode);
      if (!item) return Response.json({ error: "Item tidak valid" }, { status: 400, headers: corsHeaders });

      const state = await getPremiumState(admin, visitorId);
      if (state[item.code]?.unlockedAt) {
        return Response.json({ error: "Sudah unlock sebelumnya" }, { status: 400, headers: corsHeaders });
      }

      const { data: gemsData } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      const gems = Number(gemsData || 0);
      if (gems < item.unlockCostGems) {
        return Response.json({
          error: `Butuh ${item.unlockCostGems} 💎 Gem untuk unlock (kamu punya ${gems})`,
        }, { status: 400, headers: corsHeaders });
      }

      await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -item.unlockCostGems });
      state[item.code] = { unlockedAt: new Date().toISOString(), lastClaim: null };
      await setPremiumState(admin, visitorId, state);

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `👑 Premium Shop Unlocked`,
        message: `${item.name} terbuka — klaim hadiah pertama sekarang!`,
        type: "luck_royale_nyawa",
      });

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({ success: true, gems: gemsAfter || 0 }, { headers: corsHeaders });
    }

    // === CLAIM PREMIUM (setelah unlock, klaim periodik) ===
    if (action === "claim_premium") {
      const item = PREMIUM_SHOP.find(i => i.code === itemCode);
      if (!item) return Response.json({ error: "Item tidak valid" }, { status: 400, headers: corsHeaders });

      const state = await getPremiumState(admin, visitorId);
      const st = state[item.code];
      if (!st?.unlockedAt) {
        return Response.json({ error: "Item belum di-unlock" }, { status: 400, headers: corsHeaders });
      }

      const lastClaim = st.lastClaim ? new Date(st.lastClaim).getTime() : 0;
      const cooldownMs = item.cooldownDays * 86400000;
      const now = Date.now();
      if (now < lastClaim + cooldownMs) {
        const remainHours = Math.ceil((lastClaim + cooldownMs - now) / 3600000);
        return Response.json({ error: `Tunggu ${remainHours} jam lagi untuk klaim berikutnya` }, { status: 400, headers: corsHeaders });
      }

      const prize: Prize = {
        kind: item.kind as any, value: item.value, label: item.name,
        emoji: item.emoji, rarity: item.rarity as any, weight: 0, color: "#fbbf24",
      };
      await applyPrize(admin, visitorId, prize);

      state[item.code] = { ...st, lastClaim: new Date().toISOString() };
      await setPremiumState(admin, visitorId, state);

      await admin.from("luck_royale_nyawa_history").insert({
        visitor_id: visitorId,
        spin_type: "premium_claim",
        reward_kind: item.kind,
        reward_value: item.value,
        reward_label: `👑 PREMIUM: ${item.name}`,
        rarity: item.rarity,
        cost_currency: "premium",
        cost_amount: 0,
      });

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({ success: true, item, gems: gemsAfter || 0 }, { headers: corsHeaders });
    }

    // === BUY TOKENS WITH BALANCE — beli Lucky Token pakai saldo Rupiah ===
    if (action === "buy_tokens_with_balance") {
      const bundle = TOKEN_BUNDLES.find(b => b.code === itemCode);
      if (!bundle) return Response.json({ error: "Paket tidak valid" }, { status: 400, headers: corsHeaders });

      // Resolve account balance row dari visitor saat ini
      const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
      if (!ubId) {
        return Response.json({ error: "Login akun saldo dulu untuk beli paket token" }, { status: 400, headers: corsHeaders });
      }
      const { data: balanceRow } = await admin
        .from("user_balances")
        .select("id, balance, username")
        .eq("id", ubId)
        .maybeSingle();
      if (!balanceRow) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 400, headers: corsHeaders });
      if ((balanceRow.balance || 0) < bundle.price) {
        return Response.json({
          error: `Saldo tidak cukup. Butuh Rp ${bundle.price.toLocaleString("id-ID")} (saldo: Rp ${(balanceRow.balance || 0).toLocaleString("id-ID")})`,
        }, { status: 400, headers: corsHeaders });
      }

      // Potong saldo
      const newBalance = (balanceRow.balance || 0) - bundle.price;
      await admin.from("user_balances").update({ balance: newBalance }).eq("id", balanceRow.id);

      // Catat transaksi saldo
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        amount: -bundle.price,
        type: "purchase",
        description: `Beli Lucky Token: ${bundle.name} (+${bundle.tokens + bundle.bonus} token)`,
      });

      // Tambah token ke pemain
      const totalAdd = bundle.tokens + bundle.bonus;
      const tokenState = await getLuckyTokens(admin, visitorId);
      const newTokens = tokenState.tokens + totalAdd;
      await setLuckyTokens(admin, visitorId, newTokens, tokenState.spinProgress);

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎟️ ${totalAdd} Lucky Token Diterima`,
        message: `${bundle.name}: ${bundle.tokens} + ${bundle.bonus} bonus token berhasil ditambahkan!`,
        type: "luck_royale_nyawa",
      });

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({
        success: true,
        bundle,
        addedTokens: totalAdd,
        luckyTokens: newTokens,
        balance: newBalance,
        gems: gemsAfter || 0,
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
