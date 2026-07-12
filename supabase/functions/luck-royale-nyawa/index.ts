import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: increment daily milestone spin counter (shared by free, normal, & premium spins)
async function bumpMilestoneSpin(admin: any, visitorId: string, addCount: number) {
  try {
    const dayWib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const { data: row } = await admin
      .from("premium_spin_daily_milestones")
      .select("id, spin_count, claimed_milestones")
      .eq("visitor_id", visitorId)
      .eq("day_wib", dayWib)
      .maybeSingle();
    if (row) {
      const newCount = Math.min(20, (row.spin_count || 0) + addCount);
      await admin.from("premium_spin_daily_milestones")
        .update({ spin_count: newCount }).eq("id", row.id);
    } else {
      await admin.from("premium_spin_daily_milestones").insert({
        visitor_id: visitorId,
        day_wib: dayWib,
        spin_count: Math.min(20, addCount),
        claimed_milestones: [],
      });
    }
  } catch (_e) { /* milestone non-blocking */ }
}

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
  { count: 500, cost: 15000, label: "500 SPIN", badge: "ULTIMATE" },
];

// === NYAWA PREMIUM PASS — Rp 50.000 / 30 hari ===
// Saat aktif: pool spin pakai PREMIUM_PRIZES (bobot rare+ jauh lebih besar, hadiah lebih mantap)
// + akses Premium Spin (gem) dengan pool jackpot variatif.
const NYAWA_PREMIUM_PRICE = 50000;
const NYAWA_PREMIUM_HOURS = 720; // 30 hari
function nyawaPremiumKey(visitorId: string) { return `lr_nyawa_premium_${visitorId}`; }
async function getNyawaPremium(admin: any, visitorId: string): Promise<{ activeUntil: string | null; purchasedAt: string | null }> {
  const { data } = await admin.from("admin_settings").select("setting_value").eq("setting_key", nyawaPremiumKey(visitorId)).maybeSingle();
  if (!data) return { activeUntil: null, purchasedAt: null };
  try { return JSON.parse(data.setting_value); } catch { return { activeUntil: null, purchasedAt: null }; }
}
async function setNyawaPremium(admin: any, visitorId: string, state: { activeUntil: string | null; purchasedAt: string | null }) {
  const value = JSON.stringify(state);
  const { data: existing } = await admin.from("admin_settings").select("id").eq("setting_key", nyawaPremiumKey(visitorId)).maybeSingle();
  if (existing) await admin.from("admin_settings").update({ setting_value: value }).eq("id", existing.id);
  else await admin.from("admin_settings").insert({ setting_key: nyawaPremiumKey(visitorId), setting_value: value });
}
function isNyawaPremiumActive(state: { activeUntil: string | null }): boolean {
  if (!state.activeUntil) return false;
  return new Date(state.activeUntil).getTime() > Date.now();
}
// Backwards compat — bundle 5 lama
const BUNDLE_COST_DIAMOND = 200;

// === DISKON HARIAN PAKET NORMAL ===
// Setiap akun (user_balance_id, atau visitor jika belum login) dapat 5x diskon
// per paket per hari. Reset 00:00 WIB. Berlaku untuk single (count=1) dan semua bundle.
const NORMAL_DISCOUNT_LIMIT_PER_DAY = 5;
const NORMAL_DISCOUNT_PRICES: Record<number, number> = {
  1: 25,
  5: 50,
  10: 100,
  20: 200,
  100: 2000,
  125: 2500,
  200: 3500,
  500: 7500,
};

// === SISTEM TIKET SPIN ===
// Tiket = SETARA 1 SPIN. 1 tiket Normal = 1 spin Normal (apapun ukuran paket).
// 1 tiket Premium = 1 spin Premium. Misal beli paket 5 spin & punya 5 tiket → 0 gem terpotong.
// Tiket DIDAPAT dari hadiah spin (drop di pool), BUKAN dibeli.
const TICKET_GEM_RATE: Record<"normal" | "premium", number> = { normal: 50, premium: 100 }; // legacy display only

async function getAccountKey(admin: any, visitorId: string): Promise<{ key: string; userBalanceId: string | null }> {
  const { data } = await admin
    .from("balance_login_history")
    .select("user_balance_id")
    .eq("visitor_id", visitorId)
    .order("logged_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ub = data?.user_balance_id || null;
  return { key: ub ? `ub:${ub}` : `v:${visitorId}`, userBalanceId: ub };
}

async function isRegisteredBalanceVisitor(admin: any, visitorId: string): Promise<boolean> {
  const { data } = await admin.rpc("is_registered_balance_visitor", { p_visitor_id: visitorId });
  return data === true;
}

// Cari voucher Lucky Royale (dari Roda Diskon) yang SEDANG aktif untuk akun ini.
// Jika aktif, diskon berlaku untuk SEMUA spin sampai active_expires_at.
async function getActiveLuckyVoucher(admin: any, visitorId: string, userBalanceId: string | null) {
  const nowIso = new Date().toISOString();
  let q = admin
    .from("discount_vouchers")
    .select("*")
    .eq("source", "lucky_spin")
    .not("active_expires_at", "is", null)
    .gt("active_expires_at", nowIso);
  if (userBalanceId) {
    q = q.or(`visitor_id.eq.${visitorId},user_balance_id.eq.${userBalanceId}`);
  } else {
    q = q.eq("visitor_id", visitorId);
  }
  const { data } = await q.order("active_expires_at", { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

async function getNormalDiscountUsage(admin: any, visitorId: string): Promise<Record<number, number>> {
  const { key } = await getAccountKey(admin, visitorId);
  const dayWib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const { data } = await admin
    .from("luck_normal_pack_discount_usage")
    .select("pack_count, used_count")
    .eq("account_key", key)
    .eq("day_wib", dayWib);
  const map: Record<number, number> = {};
  for (const r of data || []) map[Number(r.pack_count)] = Number(r.used_count) || 0;
  return map;
}

async function bumpNormalDiscountUsage(admin: any, visitorId: string, packCount: number): Promise<number> {
  const { key, userBalanceId } = await getAccountKey(admin, visitorId);
  const dayWib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const { data: row } = await admin
    .from("luck_normal_pack_discount_usage")
    .select("id, used_count")
    .eq("account_key", key)
    .eq("day_wib", dayWib)
    .eq("pack_count", packCount)
    .maybeSingle();
  if (row) {
    const next = (Number(row.used_count) || 0) + 1;
    await admin.from("luck_normal_pack_discount_usage")
      .update({ used_count: next, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    return next;
  } else {
    await admin.from("luck_normal_pack_discount_usage").insert({
      account_key: key,
      visitor_id: visitorId,
      user_balance_id: userBalanceId,
      day_wib: dayWib,
      pack_count: packCount,
      used_count: 1,
    });
    return 1;
  }
}

// === Ticket helpers ===
async function getTicketBalances(admin: any, visitorId: string): Promise<{ normal: number; premium: number }> {
  const { key } = await getAccountKey(admin, visitorId);
  const { data } = await admin
    .from("luck_spin_tickets")
    .select("ticket_type, balance")
    .eq("account_key", key);
  const out = { normal: 0, premium: 0 };
  for (const r of data || []) {
    if (r.ticket_type === "normal") out.normal = Number(r.balance) || 0;
    else if (r.ticket_type === "premium") out.premium = Number(r.balance) || 0;
  }
  return out;
}

async function adjustTickets(admin: any, visitorId: string, type: "normal" | "premium", delta: number, reason: string, meta?: any): Promise<number> {
  const { key, userBalanceId } = await getAccountKey(admin, visitorId);
  const { data: row } = await admin
    .from("luck_spin_tickets")
    .select("id, balance, total_purchased, total_used")
    .eq("account_key", key)
    .eq("ticket_type", type)
    .maybeSingle();
  let newBalance = (row?.balance || 0) + delta;
  if (newBalance < 0) throw new Error("INSUFFICIENT_TICKETS");
  if (row) {
    await admin.from("luck_spin_tickets").update({
      balance: newBalance,
      total_purchased: (row.total_purchased || 0) + (delta > 0 ? delta : 0),
      total_used: (row.total_used || 0) + (delta < 0 ? -delta : 0),
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
  } else {
    await admin.from("luck_spin_tickets").insert({
      account_key: key, visitor_id: visitorId, user_balance_id: userBalanceId,
      ticket_type: type, balance: newBalance,
      total_purchased: delta > 0 ? delta : 0, total_used: delta < 0 ? -delta : 0,
    });
  }
  await admin.from("luck_spin_ticket_log").insert({
    account_key: key, visitor_id: visitorId, ticket_type: type, delta, reason, meta: meta || null,
  });
  return newBalance;
}

// === PREMIUM TOKEN SHOP UNLOCK — auto 7 hari saat beli Nyawa Premium ===
// Membuka SEMUA tier di Token Shop (premium/super_premium/ultra) tanpa harus beli akses tier.
const PREMIUM_SHOP_UNLOCK_DAYS = 7;
function premiumShopUnlockKey(v: string) { return `lr_premium_shop_unlock_${v}`; }
async function getPremiumShopUnlock(admin: any, visitorId: string): Promise<{ activeUntil: string | null; grantedAt: string | null }> {
  const { data } = await admin.from("admin_settings").select("setting_value").eq("setting_key", premiumShopUnlockKey(visitorId)).maybeSingle();
  if (!data) return { activeUntil: null, grantedAt: null };
  try { return JSON.parse(data.setting_value); } catch { return { activeUntil: null, grantedAt: null }; }
}
async function setPremiumShopUnlock(admin: any, visitorId: string, state: { activeUntil: string | null; grantedAt: string | null }) {
  const value = JSON.stringify(state);
  const { data: existing } = await admin.from("admin_settings").select("id").eq("setting_key", premiumShopUnlockKey(visitorId)).maybeSingle();
  if (existing) await admin.from("admin_settings").update({ setting_value: value }).eq("id", existing.id);
  else await admin.from("admin_settings").insert({ setting_key: premiumShopUnlockKey(visitorId), setting_value: value });
}
function isPremiumShopUnlockActive(state: { activeUntil: string | null }): boolean {
  if (!state.activeUntil) return false;
  return new Date(state.activeUntil).getTime() > Date.now();
}

async function resolvePremiumShopUnlock(admin: any, visitorId: string): Promise<{ activeUntil: string | null; grantedAt: string | null }> {
  const current = await getPremiumShopUnlock(admin, visitorId);
  if (isPremiumShopUnlockActive(current)) return current;

  const premium = await getNyawaPremium(admin, visitorId);
  if (!isNyawaPremiumActive(premium)) return current;

  let baseMs = premium.purchasedAt ? new Date(premium.purchasedAt).getTime() : Date.now();
  if (!Number.isFinite(baseMs)) baseMs = Date.now();
  const repairedUntil = new Date(baseMs + PREMIUM_SHOP_UNLOCK_DAYS * 24 * 3600 * 1000).toISOString();
  if (new Date(repairedUntil).getTime() <= Date.now()) return current;

  const repaired = { activeUntil: repairedUntil, grantedAt: current.grantedAt || premium.purchasedAt || new Date().toISOString() };
  await setPremiumShopUnlock(admin, visitorId, repaired);
  return repaired;
}

// Cek apakah Server Luck booster sedang aktif (untuk Premium Spin pool selection)
async function isServerLuckActive(admin: any, visitorId: string): Promise<boolean> {
  try {
    const { data } = await admin.from("server_luck_boosters").select("active_until, active_tier").eq("visitor_id", visitorId).maybeSingle();
    if (!data || !data.active_until) return false;
    if (Number(data.active_tier || 1) < 2) return false;
    return new Date(data.active_until).getTime() > Date.now();
  } catch { return false; }
}

// Hadiah bobot NORMAL Luck Royale Nyawa — jangan dicampur dengan pool Mega/Combo.
type Prize = {
  kind: "extra_life" | "auto_hint" | "time_freeze" | "streak_freeze" | "streak_coins" | "gems" | "game_credits" | "game_balance";
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
  // TIKET NORMAL — 1 tiket = 1 spin Normal gratis
  { kind: "spin_ticket_normal" as any, value: 1, label: "🎫 +1 Tiket Spin Normal", emoji: "🎫", rarity: "rare",   weight: 4,     color: "#22d3ee" },
  { kind: "spin_ticket_normal" as any, value: 3, label: "🎫 +3 Tiket Spin Normal", emoji: "🎫", rarity: "epic",   weight: 1.2,   color: "#06b6d4" },
  { kind: "spin_ticket_normal" as any, value: 10, label: "🎫 +10 Tiket Spin Normal", emoji: "🎫", rarity: "legendary", weight: 0.25, color: "#fbbf24" },

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

  // === KREDIT GAME (Kunci Jawaban) ===
  { kind: "game_credits",  value: 1,     label: "🔑 +1 Kredit Game",        emoji: "🔑", rarity: "rare",      weight: 8,     color: "#22d3ee" },
  { kind: "game_credits",  value: 3,     label: "🔑 +3 Kredit Game",        emoji: "🔑", rarity: "rare",      weight: 5,     color: "#06b6d4" },
  { kind: "game_credits",  value: 5,     label: "🔑 +5 Kredit Game",        emoji: "🔑", rarity: "epic",      weight: 3,     color: "#a855f7" },
  { kind: "game_credits",  value: 10,    label: "🔑 +10 Kredit Game",       emoji: "🔑", rarity: "epic",      weight: 1.5,   color: "#a855f7" },
  { kind: "game_credits",  value: 25,    label: "🔑 +25 Kredit Game",       emoji: "🔑", rarity: "legendary", weight: 0.7,   color: "#fbbf24" },
  { kind: "game_credits",  value: 50,    label: "🔑 +50 Kredit Game",       emoji: "🔑", rarity: "legendary", weight: 0.3,   color: "#facc15" },
  { kind: "game_credits",  value: 100,   label: "🌟 +100 Kredit Game",      emoji: "🔑", rarity: "mythic",    weight: 0.12,  color: "#f0abfc" },
  { kind: "game_credits",  value: 250,   label: "👑 +250 Kredit JACKPOT",   emoji: "🔑", rarity: "mythic",    weight: 0.025, color: "#fef08a" },

  // === SALDO IN (Saldo dalam game) — nominal Rupiah kecil tapi lumayan biar rajin main ===
  { kind: "game_balance",  value: 200,   label: "💵 +Rp 200 Saldo IN",      emoji: "💵", rarity: "rare",      weight: 10,    color: "#34d399" },
  { kind: "game_balance",  value: 500,   label: "💵 +Rp 500 Saldo IN",      emoji: "💵", rarity: "rare",      weight: 7,     color: "#34d399" },
  { kind: "game_balance",  value: 1000,  label: "💵 +Rp 1.000 Saldo IN",    emoji: "💵", rarity: "rare",      weight: 4.5,   color: "#10b981" },
  { kind: "game_balance",  value: 2000,  label: "💵 +Rp 2.000 Saldo IN",    emoji: "💵", rarity: "epic",      weight: 2,     color: "#059669" },
  { kind: "game_balance",  value: 3500,  label: "💵 +Rp 3.500 Saldo IN",    emoji: "💵", rarity: "epic",      weight: 1,     color: "#a855f7" },
  { kind: "game_balance",  value: 5000,  label: "💸 +Rp 5.000 Saldo IN",    emoji: "💵", rarity: "legendary", weight: 0.45,  color: "#fbbf24" },
  { kind: "game_balance",  value: 10000, label: "💸 +Rp 10.000 Saldo IN",   emoji: "💵", rarity: "legendary", weight: 0.18,  color: "#facc15" },
  { kind: "game_balance",  value: 15000, label: "🌟 +Rp 15.000 Saldo IN",   emoji: "💵", rarity: "mythic",    weight: 0.05,  color: "#f0abfc" },


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
  // Kredit Game & Saldo IN versi free (kecil)
  { kind: "game_credits",  value: 1,  label: "🎁 FREE +1 Kredit Game",   emoji: "🔑", rarity: "rare",   weight: 5,   color: "#22d3ee" },
  { kind: "game_credits",  value: 2,  label: "🎁 FREE +2 Kredit Game",   emoji: "🔑", rarity: "epic",   weight: 1.2, color: "#a855f7" },
  { kind: "game_balance",  value: 200,label: "🎁 FREE +Rp 200 Saldo IN", emoji: "💵", rarity: "rare",   weight: 4,   color: "#34d399" },
  { kind: "game_balance",  value: 500,label: "🎁 FREE +Rp 500 Saldo IN", emoji: "💵", rarity: "epic",   weight: 1.0, color: "#10b981" },
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

function isSpinCreditPrize(kind: string): boolean {
  return kind === "lucky_token" || kind === "spin_ticket_normal" || kind === "spin_ticket_premium";
}

function pickNonSpinCreditPrize(pool: Prize[], luckyHourActive = false): Prize & { index: number } {
  const safePool = pool.filter((p) => !isSpinCreditPrize(String(p.kind)));
  if (safePool.length === 0) return pickFromPool(pool);
  const first = pickFromPool(safePool);
  if (luckyHourActive && first.rarity === "common") return pickFromPool(safePool);
  return first;
}

// === PREMIUM PRIZES — premium tetap mantap, tapi gem hanya +~6% dari normal ===
// Target owner: jangan bikin pemain farming 100K–260K gem dari batch besar.
// Gem premium dibuat kecil & jarang; jackpot besar dipindah jadi hadiah non-gem.
const PREMIUM_PRIZES: Prize[] = [
  // === COMMON (sering keluar — hadiah kecil, mayoritas bukan gem) ===
  { kind: "auto_hint",     value: 2,     label: "+2 Hint Otomatis",         emoji: "💡", rarity: "common",    weight: 22,    color: "#94a3b8" },
  { kind: "extra_life",    value: 2,     label: "+2 Nyawa Ekstra",          emoji: "❤️", rarity: "common",    weight: 22,    color: "#ef4444" },
  { kind: "time_freeze",   value: 2,     label: "+2 Freeze 30s",            emoji: "⏱️", rarity: "common",    weight: 18,    color: "#0ea5e9" },
  { kind: "auto_hint",     value: 3,     label: "+3 Hint Otomatis",         emoji: "💡", rarity: "common",    weight: 16,    color: "#94a3b8" },
  { kind: "extra_life",    value: 3,     label: "+3 Nyawa Ekstra",          emoji: "❤️", rarity: "common",    weight: 16,    color: "#ef4444" },
  { kind: "streak_coins",  value: 100,   label: "🪙 +100 Streak Coin",       emoji: "🪙", rarity: "common",    weight: 22,    color: "#f59e0b" },
  // GEM common — sering keluar tapi nominal kecil (sumber gem konsisten)
  { kind: "gems",          value: 50,    label: "💎 +50 Gem",                emoji: "💎", rarity: "common",    weight: 4,     color: "#8b5cf6" },
  { kind: "gems",          value: 100,   label: "💎 +100 Gem",               emoji: "💎", rarity: "common",    weight: 2.5,   color: "#8b5cf6" },
  { kind: "gems",          value: 200,   label: "💎 +200 Gem",               emoji: "💎", rarity: "common",    weight: 1.2,   color: "#8b5cf6" },

  // === RARE (lumayan — base konsisten) ===
  { kind: "streak_freeze", value: 3,     label: "+3 Streak Freeze",         emoji: "🛡️", rarity: "rare",      weight: 8,     color: "#10b981" },
  { kind: "auto_hint",     value: 6,     label: "+6 Hint Otomatis",         emoji: "💡", rarity: "rare",      weight: 7,     color: "#06b6d4" },
  { kind: "extra_life",    value: 6,     label: "+6 Nyawa Ekstra",          emoji: "❤️", rarity: "rare",      weight: 7,     color: "#f43f5e" },
  { kind: "auto_hint",     value: 10,    label: "+10 Hint Otomatis",        emoji: "💡", rarity: "rare",      weight: 5,     color: "#06b6d4" },
  { kind: "extra_life",    value: 10,    label: "+10 Nyawa Ekstra",         emoji: "❤️", rarity: "rare",      weight: 5,     color: "#f43f5e" },
  { kind: "time_freeze",   value: 6,     label: "+6 Freeze 30s",            emoji: "⏱️", rarity: "rare",      weight: 5,     color: "#0ea5e9" },
  { kind: "streak_coins",  value: 300,   label: "🪙 +300 Streak Coin",       emoji: "🪙", rarity: "rare",      weight: 6,     color: "#f59e0b" },
  { kind: "streak_coins",  value: 600,   label: "🪙 +600 Streak Coin",       emoji: "🪙", rarity: "rare",      weight: 4,     color: "#f59e0b" },
  // GEM rare — lumayan, kadang-kadang
  { kind: "gems",          value: 500,   label: "💎 +500 Gem PREMIUM",       emoji: "💎", rarity: "rare",      weight: 0.6,   color: "#8b5cf6" },
  { kind: "gems",          value: 1000,  label: "💎 +1.000 Gem PREMIUM",     emoji: "💎", rarity: "rare",      weight: 0.25,  color: "#8b5cf6" },
  { kind: "gems",          value: 2000,  label: "💎 +2.000 Gem PREMIUM",     emoji: "💎", rarity: "rare",      weight: 0.10,  color: "#8b5cf6" },
  { kind: "lucky_token" as any, value: 1, label: "🎟️ +1 Lucky Token",        emoji: "🎟️", rarity: "rare",      weight: 3,     color: "#22d3ee" },
  // TIKET PREMIUM — 1 tiket = 1 spin Premium gratis
  { kind: "spin_ticket_premium" as any, value: 1, label: "🎫 +1 Tiket Spin Premium", emoji: "🎫", rarity: "rare",   weight: 2.5,   color: "#f0abfc" },
  { kind: "spin_ticket_premium" as any, value: 3, label: "🎫 +3 Tiket Spin Premium", emoji: "🎫", rarity: "epic",   weight: 0.8,   color: "#e879f9" },
  { kind: "spin_ticket_premium" as any, value: 10, label: "🎫 +10 Tiket Spin Premium", emoji: "🎫", rarity: "legendary", weight: 0.15, color: "#fbbf24" },

  // === EPIC ===
  { kind: "auto_hint",     value: 15,    label: "💡 +15 Hint",              emoji: "💡", rarity: "epic",      weight: 5,     color: "#a855f7" },
  { kind: "extra_life",    value: 15,    label: "❤️ +15 Nyawa",             emoji: "❤️", rarity: "epic",      weight: 5,     color: "#a855f7" },
  { kind: "time_freeze",   value: 10,    label: "+10 Freeze 30s",           emoji: "⏱️", rarity: "epic",      weight: 4.5,   color: "#a855f7" },
  { kind: "streak_freeze", value: 5,     label: "+5 Streak Freeze",         emoji: "🛡️", rarity: "epic",      weight: 4.5,   color: "#ec4899" },
  // GEM epic — jarang, hadiah cukup besar
  { kind: "gems",          value: 5000,  label: "💎 +5.000 Gem PREMIUM",     emoji: "💎", rarity: "epic",      weight: 0.04,  color: "#8b5cf6" },
  { kind: "auto_hint",     value: 25,    label: "💡 +25 Hint",              emoji: "💡", rarity: "epic",      weight: 3,     color: "#a855f7" },
  { kind: "extra_life",    value: 25,    label: "❤️ +25 Nyawa",             emoji: "❤️", rarity: "epic",      weight: 3,     color: "#a855f7" },
  { kind: "streak_coins",  value: 2000,  label: "🪙 +2.000 Streak Coin",     emoji: "🪙", rarity: "epic",      weight: 4,     color: "#fb923c" },
  { kind: "streak_coins",  value: 3500,  label: "🪙 +3.500 Streak Coin",     emoji: "🪙", rarity: "epic",      weight: 2.5,   color: "#fb923c" },

  // === LEGENDARY ===
  { kind: "extra_life",    value: 40,    label: "❤️ +40 Nyawa",             emoji: "❤️", rarity: "legendary", weight: 2,     color: "#fbbf24" },
  { kind: "auto_hint",     value: 40,    label: "💡 +40 Hint",              emoji: "💡", rarity: "legendary", weight: 2,     color: "#fbbf24" },
  { kind: "streak_freeze", value: 12,    label: "🛡️ +12 Streak Freeze",     emoji: "🛡️", rarity: "legendary", weight: 1.8,   color: "#f59e0b" },
  // GEM legend/mythic dihapus dari pool utama agar tidak tembus 100K+ total gem
  { kind: "extra_life",    value: 60,    label: "❤️ +60 Nyawa",             emoji: "❤️", rarity: "legendary", weight: 1.2,   color: "#fbbf24" },
  { kind: "auto_hint",     value: 60,    label: "💡 +60 Hint",              emoji: "💡", rarity: "legendary", weight: 1.2,   color: "#fbbf24" },
  { kind: "streak_coins",  value: 10000, label: "🪙 +10.000 Streak Coin",    emoji: "🪙", rarity: "legendary", weight: 1.5,   color: "#fbbf24" },
  { kind: "streak_coins",  value: 22000, label: "🪙 +22.000 Streak Coin",    emoji: "🪙", rarity: "legendary", weight: 0.8,   color: "#fbbf24" },
  { kind: "lucky_token" as any, value: 2, label: "🎟️ +2 Lucky Token",        emoji: "🎟️", rarity: "legendary", weight: 0.8,   color: "#fbbf24" },
  // GEM legendary — sangat jarang
  { kind: "gems",          value: 10000, label: "💎 +10.000 Gem PREMIUM",    emoji: "💎", rarity: "legendary", weight: 0.015, color: "#facc15" },

  // === MYTHIC (susah tapi konsisten) ===
  { kind: "extra_life",    value: 100,   label: "🌈 +100 Nyawa",            emoji: "❤️", rarity: "mythic",    weight: 0.7,   color: "#f0abfc" },
  { kind: "auto_hint",     value: 100,   label: "🌈 +100 Hint",             emoji: "💡", rarity: "mythic",    weight: 0.7,   color: "#f0abfc" },
  { kind: "extra_life",    value: 180,   label: "🌟 +180 Nyawa",            emoji: "❤️", rarity: "mythic",    weight: 0.4,   color: "#f0abfc" },
  { kind: "auto_hint",     value: 180,   label: "🌟 +180 Hint",             emoji: "💡", rarity: "mythic",    weight: 0.4,   color: "#f0abfc" },
  { kind: "streak_coins",  value: 60000, label: "🪙 +60.000 Streak Coin",    emoji: "🪙", rarity: "mythic",    weight: 0.3,   color: "#fde68a" },
  // GEM mythic JACKPOT — super jarang, hadiah besar yang dinanti
  { kind: "gems",          value: 25000, label: "🔥 +25.000 GEM JACKPOT",    emoji: "💎", rarity: "mythic",    weight: 0.004, color: "#fef08a" },
  { kind: "gems",          value: 50000, label: "👑 +50.000 GEM MEGA",       emoji: "💎", rarity: "mythic",    weight: 0.0008, color: "#fef08a" },
];

function pickPrize(luckyHourActive = false, premiumActive = false): Prize & { index: number } {
  if (premiumActive) {
    // Pool premium konsisten: kadang dapat hadiah kecil (common), kadang lumayan, jarang besar
    const first = pickFromPool(PREMIUM_PRIZES);
    // Lucky Hour: hanya reroll kalau hasil common (sama seperti normal)
    if (luckyHourActive && first.rarity === "common") {
      return pickFromPool(PREMIUM_PRIZES);
    }
    return first;
  }
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
  // ============ FREE TIER (1-15 token, 26 item — bebas tukar tanpa langganan) ============
  // Cost rendah (1-3)
  { code: "tk_hint10",     name: "+10 Hint Otomatis",        cost: 1,   kind: "auto_hint",     value: 10,    rarity: "rare",      emoji: "💡", tier: "free" },
  { code: "tk_life10",     name: "+10 Nyawa Ekstra",         cost: 1,   kind: "extra_life",    value: 10,    rarity: "rare",      emoji: "❤️", tier: "free" },
  { code: "tk_tfreeze3",   name: "+3 Time Freeze",           cost: 1,   kind: "time_freeze",   value: 3,     rarity: "rare",      emoji: "⏱️", tier: "free" },
  { code: "tk_coins250",   name: "🪙 +250 Streak Coin",       cost: 1,   kind: "streak_coins",  value: 250,   rarity: "rare",      emoji: "🪙", tier: "free" },
  { code: "tk_freeze5",    name: "+5 Streak Freeze",         cost: 2,   kind: "streak_freeze", value: 5,     rarity: "rare",      emoji: "🛡️", tier: "free" },
  { code: "tk_coins500",   name: "🪙 +500 Streak Coin",       cost: 2,   kind: "streak_coins",  value: 500,   rarity: "rare",      emoji: "🪙", tier: "free" },
  { code: "tk_hint20",     name: "+20 Hint Otomatis",        cost: 2,   kind: "auto_hint",     value: 20,    rarity: "rare",      emoji: "💡", tier: "free" },
  { code: "tk_life20",     name: "+20 Nyawa Ekstra",         cost: 2,   kind: "extra_life",    value: 20,    rarity: "rare",      emoji: "❤️", tier: "free" },
  { code: "tk_credits50",  name: "🎮 +50 Game Credits",       cost: 2,   kind: "game_credits",  value: 50,    rarity: "rare",      emoji: "🎮", tier: "free" },
  { code: "tk_tfreeze8",   name: "+8 Time Freeze",           cost: 3,   kind: "time_freeze",   value: 8,     rarity: "epic",      emoji: "⏱️", tier: "free" },
  { code: "tk_hint30",     name: "+30 Hint Otomatis",        cost: 3,   kind: "auto_hint",     value: 30,    rarity: "epic",      emoji: "💡", tier: "free" },

  // Cost menengah (4-7)
  { code: "tk_life30",     name: "+30 Nyawa Ekstra",         cost: 4,   kind: "extra_life",    value: 30,    rarity: "epic",      emoji: "❤️", tier: "free" },
  { code: "tk_credits120", name: "🎮 +120 Game Credits",      cost: 4,   kind: "game_credits",  value: 120,   rarity: "epic",      emoji: "🎮", tier: "free" },
  { code: "tk_gems30",     name: "💎 +30 Gem",                cost: 4,   kind: "gems",          value: 30,    rarity: "epic",      emoji: "💎", tier: "free" },
  { code: "tk_freeze12",   name: "+12 Streak Freeze",        cost: 5,   kind: "streak_freeze", value: 12,    rarity: "epic",      emoji: "🛡️", tier: "free" },
  { code: "tk_bundle_a",   name: "🎁 +20 Hint & +20 Nyawa",  cost: 5,   kind: "auto_hint",     value: 20,    rarity: "epic",      emoji: "🎁", tier: "free" },
  { code: "tk_coins1500",  name: "🪙 +1.500 Streak Coin",     cost: 6,   kind: "streak_coins",  value: 1500,  rarity: "epic",      emoji: "🪙", tier: "free" },
  { code: "tk_tfreeze20",  name: "+20 Time Freeze",          cost: 6,   kind: "time_freeze",   value: 20,    rarity: "epic",      emoji: "⏱️", tier: "free" },
  { code: "tk_gems60",     name: "💎 +60 Gem",                cost: 6,   kind: "gems",          value: 60,    rarity: "epic",      emoji: "💎", tier: "free" },
  { code: "tk_credits250", name: "🎮 +250 Game Credits",      cost: 7,   kind: "game_credits",  value: 250,   rarity: "epic",      emoji: "🎮", tier: "free" },

  // Cost tinggi (8-15) — masih FREE
  { code: "tk_hint80",     name: "+80 Hint Otomatis",        cost: 8,   kind: "auto_hint",     value: 80,    rarity: "epic",      emoji: "💡", tier: "free" },
  { code: "tk_life80",     name: "+80 Nyawa Ekstra",         cost: 8,   kind: "extra_life",    value: 80,    rarity: "epic",      emoji: "❤️", tier: "free" },
  { code: "tk_freeze25",   name: "+25 Streak Freeze",        cost: 9,   kind: "streak_freeze", value: 25,    rarity: "epic",      emoji: "🛡️", tier: "free" },
  { code: "tk_gems100",    name: "💎 +100 Gem",               cost: 10,  kind: "gems",          value: 100,   rarity: "epic",      emoji: "💎", tier: "free" },
  { code: "tk_coins3000",  name: "🪙 +3.000 Streak Coin",     cost: 10,  kind: "streak_coins",  value: 3000,  rarity: "epic",      emoji: "🪙", tier: "free" },
  { code: "tk_credits500", name: "🎮 +500 Game Credits",      cost: 12,  kind: "game_credits",  value: 500,   rarity: "epic",      emoji: "🎮", tier: "free" },
  { code: "tk_mega_bundle",name: "🎁 MEGA: +50 Hint & +50 Nyawa & +5 Freeze", cost: 14, kind: "auto_hint", value: 50, rarity: "legendary", emoji: "🎁", tier: "free" },
  { code: "tk_gems150",    name: "💎 +150 Gem",               cost: 15,  kind: "gems",          value: 150,   rarity: "legendary", emoji: "💎", tier: "free" },

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
  } else if (p.kind === "game_credits") {
    // Tambah kredit game (kunci jawaban) ke akun aktif via RPC akumulatif
    try {
      await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: p.value });
    } catch (_) {
      // Fallback: upsert langsung ke baris visitor
      const { data: row } = await admin.from("user_game_credits").select("id, credits").eq("visitor_id", visitorId).maybeSingle();
      if (row) {
        await admin.from("user_game_credits").update({ credits: (row.credits || 0) + p.value, updated_at: new Date().toISOString() }).eq("id", row.id);
      } else {
        await admin.from("user_game_credits").insert({ visitor_id: visitorId, credits: p.value });
      }
    }
  } else if (p.kind === "game_balance") {
    // Tambah Saldo IN (game_balance) — nominal dalam Rupiah
    const { data: row } = await admin.from("game_balance").select("id, amount, total_earned").eq("visitor_id", visitorId).maybeSingle();
    if (row) {
      await admin.from("game_balance").update({
        amount: (row.amount || 0) + p.value,
        total_earned: (row.total_earned || 0) + p.value,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
    } else {
      await admin.from("game_balance").insert({
        visitor_id: visitorId,
        amount: p.value,
        total_earned: p.value,
        total_spent: 0,
      });
    }
  } else if (p.kind === "spin_ticket_normal") {
    await adjustTickets(admin, visitorId, "normal", p.value, "prize_drop", { label: p.label });
  } else if (p.kind === "spin_ticket_premium") {
    await adjustTickets(admin, visitorId, "premium", p.value, "prize_drop", { label: p.label });
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

    if (action !== "leaderboard" && !(await isRegisteredBalanceVisitor(admin, visitorId))) {
      return Response.json({ error: "Login akun saldo dulu untuk membuka Lucky Royale", loginRequired: true }, { status: 401, headers: corsHeaders });
    }

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
      const nyawaPremiumState = await getNyawaPremium(admin, visitorId);
      const nyawaPremiumActive = isNyawaPremiumActive(nyawaPremiumState);

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
        nyawaPremium: {
          isActive: nyawaPremiumActive,
          activeUntil: nyawaPremiumState.activeUntil,
          purchasedAt: nyawaPremiumState.purchasedAt,
          price: NYAWA_PREMIUM_PRICE,
          durationHours: NYAWA_PREMIUM_HOURS,
        },
        premiumShopUnlock: await (async () => {
          const u = await resolvePremiumShopUnlock(admin, visitorId);
          return {
            isActive: isPremiumShopUnlockActive(u),
            activeUntil: u.activeUntil,
            grantedAt: u.grantedAt,
            durationDays: PREMIUM_SHOP_UNLOCK_DAYS,
          };
        })(),
        normalDiscount: {
          limitPerDay: NORMAL_DISCOUNT_LIMIT_PER_DAY,
          prices: NORMAL_DISCOUNT_PRICES,
          usage: await getNormalDiscountUsage(admin, visitorId),
        },
        tickets: await getTicketBalances(admin, visitorId),
        ticketPacks: [],
        ticketRate: { normal: 1, premium: 1 },
        activeLuckyVoucher: await (async () => {
          const { userBalanceId } = await getAccountKey(admin, visitorId);
          const v = await getActiveLuckyVoucher(admin, visitorId, userBalanceId);
          return v ? { code: v.code, pct: Number(v.discount_amount) || 0, expiresAt: v.active_expires_at } : null;
        })(),
      }, { headers: corsHeaders });
    }

    if (action === "activate_lucky_voucher") {
      const vcode = String(body.voucherCode || "").trim().toUpperCase();
      if (!vcode) return Response.json({ error: "Masukkan kode voucher." }, { status: 400, headers: corsHeaders });
      const { userBalanceId: ubId } = await getAccountKey(admin, visitorId);

      // Jika sudah ada voucher aktif, jangan tumpuk.
      const existingActive = await getActiveLuckyVoucher(admin, visitorId, ubId);
      if (existingActive) {
        return Response.json({ error: `Masih ada voucher aktif (${existingActive.code}) sampai diskon berakhir.` }, { status: 400, headers: corsHeaders });
      }

      const { data: v } = await admin
        .from("discount_vouchers")
        .select("*")
        .eq("code", vcode)
        .eq("source", "lucky_spin")
        .maybeSingle();
      const ownsByVisitor = v && v.visitor_id === visitorId;
      const ownsByBalance = v && ubId && v.user_balance_id === ubId;
      if (!v || (!ownsByVisitor && !ownsByBalance)) {
        return Response.json({ error: "Voucher tidak ditemukan atau bukan milik akun kamu." }, { status: 400, headers: corsHeaders });
      }
      if (!v.is_active || (v.used_count || 0) >= (v.max_uses || 1)) {
        return Response.json({ error: "Voucher sudah dipakai/diaktifkan." }, { status: 400, headers: corsHeaders });
      }
      if (v.expires_at && new Date(v.expires_at) < new Date()) {
        return Response.json({ error: "Voucher sudah kadaluarsa (lewat batas aktivasi)." }, { status: 400, headers: corsHeaders });
      }

      const hours = Number(v.duration_hours) || 24;
      const activeExpires = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      await admin
        .from("discount_vouchers")
        .update({
          activated_at: new Date().toISOString(),
          active_expires_at: activeExpires,
          used_count: (v.used_count || 0) + 1,
          is_active: false,
        })
        .eq("id", v.id);

      await admin.rpc("create_notification", {
        p_visitor_id: visitorId,
        p_title: "🎟️ Voucher Lucky Royale Aktif",
        p_message: `Diskon ${v.discount_amount}% aktif untuk SEMUA spin selama ${hours % 24 === 0 ? hours / 24 + " hari" : hours + " jam"}!`,
        p_type: "success",
      });

      return Response.json({
        success: true,
        pct: Number(v.discount_amount) || 0,
        hours,
        expiresAt: activeExpires,
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

      await bumpMilestoneSpin(admin, visitorId, 1);

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
      const allowedKinds = new Set(["extra_life", "auto_hint", "time_freeze", "streak_freeze", "streak_coins", "gems", "game_credits", "game_balance"]);
      const kind = String(prize?.kind || "");
      const baseValue = Math.max(1, Math.min(1000000, Number(prize?.value) || 0));
      const mult = Math.max(1, Math.min(5, Number(multiplier) || 1));
      const value = baseValue * mult;
      if (!allowedKinds.has(kind)) return Response.json({ error: "Hadiah tidak valid" }, { status: 400, headers: corsHeaders });

      let finalCostGems = Math.max(0, Number(costGems) || 0);
      if (finalCostGems > 0) {
        const { userBalanceId } = await getAccountKey(admin, visitorId);
        const activeVoucher = await getActiveLuckyVoucher(admin, visitorId, userBalanceId);
        if (activeVoucher) {
          const pct = Math.max(0, Math.min(100, Number(activeVoucher.discount_amount) || 0));
          finalCostGems = Math.max(1, finalCostGems - Math.floor(finalCostGems * pct / 100));
        }
      }
      if (finalCostGems > 0) {
        const { data: haveGems } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
        if ((Number(haveGems) || 0) < finalCostGems) return Response.json({ error: `Butuh ${finalCostGems} gem` }, { status: 400, headers: corsHeaders });
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -finalCostGems });
      }

      await applyPrize(admin, visitorId, { ...prize, kind, value } as Prize);
      await admin.from("luck_royale_nyawa_history").insert({
        visitor_id: visitorId,
        spin_type: "mega_arena",
        reward_kind: kind,
        reward_value: value,
        reward_label: String(prize?.label || kind),
        rarity: String(prize?.rarity || "common"),
        cost_currency: finalCostGems > 0 ? "gems" : "free",
        cost_amount: finalCostGems,
      });
      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({ success: true, gems: gemsAfter || 0, awarded: { kind, value } }, { headers: corsHeaders });
    }

    // === PREMIUM SPIN BATCH — paket spin gem (1/5/10/20/50/100/200/500/1000) ===
    // Wajib Nyawa Premium aktif. Pool hadiah variatif (hint, nyawa, kredit, saldo, gem, streak coin, time freeze).
    if (action === "premium_spin_batch") {
      const PREMIUM_PACKS: Record<number, number> = {
        1: 100, 5: 300, 10: 500, 20: 800, 50: 2000, 100: 3000, 200: 5000, 500: 8000, 1000: 15000,
      };
      const reqCount = Number((body as any).count) || 0;
      const useFree = Boolean((body as any).useFree);
      if (useFree && reqCount !== 1) return Response.json({ error: "Free spin = 1x" }, { status: 400, headers: corsHeaders });
      if (!useFree && !PREMIUM_PACKS[reqCount]) return Response.json({ error: "Paket tidak valid" }, { status: 400, headers: corsHeaders });

      // Wajib Premium aktif
      const npState = await getNyawaPremium(admin, visitorId);
      if (!isNyawaPremiumActive(npState)) {
        return Response.json({ error: "Premium tidak aktif. Beli akses dulu (Rp 50.000 / 30 hari)." }, { status: 400, headers: corsHeaders });
      }

      const cost = useFree ? 0 : PREMIUM_PACKS[reqCount];
      // Tiket Premium dipakai DULU (1 tiket = 1 spin). Gem hanya menutup kekurangan saat tiket habis.
      const useTickets = !useFree;
      let ticketsUsed = 0;
      let luckyTokensUsedForSpin = 0;
      let costAfterTickets = cost;
      if (useTickets && reqCount > 0 && cost > 0) {
        const tb = await getTicketBalances(admin, visitorId);
        ticketsUsed = Math.min(tb.premium, reqCount);
        const preTokens = await getLuckyTokens(admin, visitorId);
        luckyTokensUsedForSpin = Math.min(preTokens.tokens, reqCount - ticketsUsed);
        const remainingSpins = reqCount - ticketsUsed - luckyTokensUsedForSpin;
        costAfterTickets = Math.ceil((cost * remainingSpins) / reqCount);
      }
      if (costAfterTickets > 0) {
        const { data: haveGems } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
        if ((Number(haveGems) || 0) < costAfterTickets) {
          return Response.json({ error: `Butuh ${costAfterTickets} 💎${ticketsUsed > 0 ? ` (+${ticketsUsed} 🎟️)` : ""} (kamu punya ${Number(haveGems) || 0})` }, { status: 400, headers: corsHeaders });
        }
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -costAfterTickets });
      }
      if (ticketsUsed > 0) {
        await adjustTickets(admin, visitorId, "premium", -ticketsUsed, "spin_premium", { reqCount, originalCost: cost, finalGemCost: costAfterTickets });
      }
      if (luckyTokensUsedForSpin > 0) {
        const ts = await getLuckyTokens(admin, visitorId);
        await setLuckyTokens(admin, visitorId, Math.max(0, ts.tokens - luckyTokensUsedForSpin), ts.spinProgress);
      }

      // Premium WAJIB pakai pool premium, tapi tetap dikontrol agar jackpot gem tidak gacor.
      // Server Luck hanya bantu hasil common sekali, bukan menaikkan rare/jackpot terus.
      const luckActive = await isServerLuckActive(admin, visitorId);
      const totalWeight = PREMIUM_PRIZES.reduce((s, p) => s + p.weight, 0);
      const rollOne = (): Prize => {
        let r = Math.random() * totalWeight;
        for (const p of PREMIUM_PRIZES) { r -= p.weight; if (r <= 0) return p; }
        return PREMIUM_PRIZES[0];
      };
      const rollPremiumOne = (): Prize => {
        const first = rollOne();
        return luckActive && first.rarity === "common" ? rollOne() : first;
      };
      const rollPremiumPaidOne = (): Prize => {
        if (ticketsUsed + luckyTokensUsedForSpin <= 0) return rollPremiumOne();
        const pool = PREMIUM_PRIZES.filter((p) => !isSpinCreditPrize(String(p.kind)));
        const total = pool.reduce((s, p) => s + p.weight, 0);
        let r = Math.random() * total;
        for (const p of pool) { r -= p.weight; if (r <= 0) return p; }
        return pool[0];
      };

      // 1) Roll semua hasil di memory dulu (cepat, tanpa I/O)
      const results: Array<{ kind: string; value: number; label: string; emoji: string; rarity: string; color: string }> = [];
      const aggByKind = new Map<string, { kind: string; value: number; sample: Prize }>();
      let tokenGain = 0;
      for (let i = 0; i < reqCount; i++) {
        const p = rollPremiumPaidOne();
        results.push({ kind: p.kind, value: p.value, label: p.label, emoji: p.emoji, rarity: p.rarity, color: p.color });
        if ((p.kind as any) === "lucky_token") {
          tokenGain += p.value;
          continue;
        }
        const cur = aggByKind.get(p.kind);
        if (cur) cur.value += p.value;
        else aggByKind.set(p.kind, { kind: p.kind, value: p.value, sample: p });
      }

      // 2) Apply hadiah teragregasi (1 RPC per kind)
      for (const a of aggByKind.values()) {
        const aggregated: Prize = { ...a.sample, value: a.value };
        await applyPrize(admin, visitorId, aggregated);
      }

      // 3) Batch insert history dalam 1 query
      const perSpinCost = useFree ? 0 : Math.floor(cost / reqCount);
      const spinTypeStr = useFree ? "premium_free" : `premium_pack${reqCount}`;
      const historyRows = results.map((p) => ({
        visitor_id: visitorId,
        spin_type: spinTypeStr,
        reward_kind: p.kind,
        reward_value: p.value,
        reward_label: p.label,
        rarity: p.rarity,
        cost_currency: useFree ? "free" : "gems",
        cost_amount: perSpinCost,
      }));
      // Insert dalam chunk untuk hindari payload terlalu besar (max 200/chunk)
      const CHUNK = 200;
      for (let i = 0; i < historyRows.length; i += CHUNK) {
        await admin.from("luck_royale_nyawa_history").insert(historyRows.slice(i, i + CHUNK));
      }

      // 4) Tambahkan Lucky Token — DISAMAKAN dengan Normal Spin:
      //    Tiap 5 paid spin = +1 token (5→1, 10→2, 20→4, 100→20, dst).
      //    Free spin tidak menghasilkan token otomatis. Token dari pool (jika ada) ditambahkan terpisah.
      const ts = await getLuckyTokens(admin, visitorId);
      let newProgress = ts.spinProgress;
      let autoTokens = 0;
      const gemPaidSpinCount = Math.max(0, reqCount - ticketsUsed - luckyTokensUsedForSpin);
      if (!useFree && gemPaidSpinCount > 0) {
        newProgress += gemPaidSpinCount;
        while (newProgress >= TOKENS_PER_SPIN_THRESHOLD) {
          autoTokens++;
          newProgress -= TOKENS_PER_SPIN_THRESHOLD;
        }
      }
      const totalTokenAdd = autoTokens + tokenGain;
      const newTokenTotal = Math.max(0, ts.tokens) + totalTokenAdd;
      await setLuckyTokens(admin, visitorId, newTokenTotal, newProgress);
      // Sertakan token otomatis ke field tokenGain agar UI menampilkan total perolehan
      const tokenGainTotal = totalTokenAdd;

      // 5) Tambah counter milestone harian (semua spin Luck Royale: normal + premium + free)
      await bumpMilestoneSpin(admin, visitorId, reqCount);

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({
        success: true,
        gems: gemsAfter || 0,
        results,
        count: reqCount,
        costGems: cost,
        luckyTokens: newTokenTotal,
        tokenGain: tokenGainTotal,
        luckyTokenProgress: newProgress,
        luckyTokenThreshold: TOKENS_PER_SPIN_THRESHOLD,
        luckActive,
        poolMode: luckActive ? "premium_lucky" : "premium",
        ticketsUsed,
        luckyTokensUsedForSpin,
        finalGemCost: costAfterTickets,
        tickets: await getTicketBalances(admin, visitorId),
      }, { headers: corsHeaders });
    }

    // ============= MILESTONE HADIAH GEM HARIAN PREMIUM SPIN =============
    if (action === "milestone_status") {
      const dayWib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
      const { data: row } = await admin
        .from("premium_spin_daily_milestones")
        .select("spin_count, claimed_milestones")
        .eq("visitor_id", visitorId)
        .eq("day_wib", dayWib)
        .maybeSingle();
      return Response.json({
        spinCount: row?.spin_count || 0,
        claimed: row?.claimed_milestones || [],
        milestones: [
          { spins: 2, gems: 50 },
          { spins: 5, gems: 200 },
          { spins: 10, gems: 500 },
          { spins: 20, gems: 1500 },
        ],
        cap: 20,
        dayWib,
      }, { headers: corsHeaders });
    }

    if (action === "milestone_claim") {
      const milestoneSpins = Number((body as any).milestone) || 0;
      const REWARDS: Record<number, number> = { 2: 50, 5: 200, 10: 500, 20: 1500 };
      if (!REWARDS[milestoneSpins]) {
        return Response.json({ error: "Milestone tidak valid" }, { status: 400, headers: corsHeaders });
      }
      const dayWib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
      const { data: row } = await admin
        .from("premium_spin_daily_milestones")
        .select("id, spin_count, claimed_milestones")
        .eq("visitor_id", visitorId)
        .eq("day_wib", dayWib)
        .maybeSingle();
      const spinCount = row?.spin_count || 0;
      const claimed: number[] = row?.claimed_milestones || [];
      if (spinCount < milestoneSpins) {
        return Response.json({ error: `Butuh ${milestoneSpins} spin (kamu baru ${spinCount})` }, { status: 400, headers: corsHeaders });
      }
      if (claimed.includes(milestoneSpins)) {
        return Response.json({ error: "Milestone ini sudah diklaim hari ini" }, { status: 400, headers: corsHeaders });
      }
      const gemReward = REWARDS[milestoneSpins];
      const newClaimed = [...claimed, milestoneSpins].sort((a, b) => a - b);
      if (row) {
        await admin.from("premium_spin_daily_milestones")
          .update({ claimed_milestones: newClaimed }).eq("id", row.id);
      } else {
        await admin.from("premium_spin_daily_milestones").insert({
          visitor_id: visitorId, day_wib: dayWib, spin_count: spinCount, claimed_milestones: newClaimed,
        });
      }
      await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: gemReward });
      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({
        success: true,
        gems: gemsAfter || 0,
        gemReward,
        milestone: milestoneSpins,
        claimed: newClaimed,
        spinCount,
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

      const tbBeforeCost = await getTicketBalances(admin, visitorId);
      const tokenBeforeCost = await getLuckyTokens(admin, visitorId);
      const freeSpinCredits = Math.min(spinCount, (tbBeforeCost.normal || 0) + (tokenBeforeCost.tokens || 0));
      const paidSpinCount = spinCount - freeSpinCredits;

      // Diskon harian tetap berlaku untuk porsi spin yang masih dibayar gem.
      // Jika sebagian spin tertutup tiket/token, harga diskon diprorata di bawah.
      const usageMap = await getNormalDiscountUsage(admin, visitorId);
      const usedToday = usageMap[spinCount] || 0;
      const discountPrice = NORMAL_DISCOUNT_PRICES[spinCount];
      let discountApplied = 0;
      let originalCost = cost;
      if (paidSpinCount > 0 && discountPrice != null && usedToday < NORMAL_DISCOUNT_LIMIT_PER_DAY && discountPrice < cost) {
        discountApplied = cost - discountPrice;
        cost = discountPrice;
      }

      // === Voucher Lucky Royale (dari Roda Diskon) — model AKTIVASI BERDURASI ===
      // Jika ada voucher yang sedang aktif, diskonnya berlaku untuk SEMUA spin
      // (single & pack) sampai waktu aktif berakhir. Tidak dikonsumsi per spin.
      let luckyVoucherApplied = 0;
      let luckyVoucherCode: string | null = null;
      const { userBalanceId: accountUbId } = await getAccountKey(admin, visitorId);
      const activeVoucher = await getActiveLuckyVoucher(admin, visitorId, accountUbId);
      if (activeVoucher) {
        const pct = Math.max(0, Math.min(100, Number(activeVoucher.discount_amount) || 0));
        luckyVoucherApplied = Math.floor(cost * pct / 100);
        cost = Math.max(1, cost - luckyVoucherApplied);
        luckyVoucherCode = activeVoucher.code;
      }


      const useTickets = true;
      const { data: gemsData } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      const gems = Number(gemsData || 0);

      let ticketsUsed = 0;
      let luckyTokensUsedForSpin = 0;
      let costAfterTickets = cost;
      if (useTickets && spinCount > 0) {
        ticketsUsed = Math.min(tbBeforeCost.normal, spinCount);
        luckyTokensUsedForSpin = Math.min(tokenBeforeCost.tokens, spinCount - ticketsUsed);
        const remainingSpins = spinCount - ticketsUsed - luckyTokensUsedForSpin;
        costAfterTickets = Math.ceil((cost * remainingSpins) / spinCount);
      }

      if (gems < costAfterTickets) {
        return Response.json({
          error: `Butuh ${costAfterTickets} 💎 Gem${ticketsUsed > 0 ? ` (+${ticketsUsed} 🎟️ tiket)` : ""} (kamu punya ${gems} gem)`,
        }, { status: 400, headers: corsHeaders });
      }

      if (gems < costAfterTickets) {
        return Response.json({
          error: `Butuh ${costAfterTickets} 💎 Gem${ticketsUsed > 0 ? ` (+${ticketsUsed} 🎟️ tiket)` : ""} (kamu punya ${gems} gem)`,
        }, { status: 400, headers: corsHeaders });
      }

      try {
        if (ticketsUsed > 0) {
          await adjustTickets(admin, visitorId, "normal", -ticketsUsed, "spin_normal", { spinCount, originalCost, finalGemCost: costAfterTickets });
        }
        if (luckyTokensUsedForSpin > 0) {
          const ts = await getLuckyTokens(admin, visitorId);
          await setLuckyTokens(admin, visitorId, Math.max(0, ts.tokens - luckyTokensUsedForSpin), ts.spinProgress);
        }
        if (costAfterTickets > 0) {
          await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -costAfterTickets });
        }
      } catch (e) {
        return Response.json({ error: "Gagal mengurangi saldo" }, { status: 400, headers: corsHeaders });
      }

      // Voucher Lucky Royale berbasis durasi: tidak dikonsumsi per spin.
      // Diskon tetap berlaku sampai active_expires_at lewat.

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
      const nyawaPremiumState = await getNyawaPremium(admin, visitorId);
      const nyawaPremiumActive = isNyawaPremiumActive(nyawaPremiumState);

      const results: Array<Prize & { index: number; bonusApplied?: number; jackpotWon?: number }> = [];
      let totalBonusGems = 0;
      let jackpotWonTotal = 0;
      for (let i = 0; i < spinCount; i++) {
        const basePrize = ticketsUsed + luckyTokensUsedForSpin > 0
          ? pickNonSpinCreditPrize(nyawaPremiumActive ? PREMIUM_PRIZES : PRIZES, luckyHourActive)
          : pickPrize(luckyHourActive, nyawaPremiumActive);
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
      const gemPaidSpinCount = Math.max(0, spinCount - ticketsUsed - luckyTokensUsedForSpin);
      if (overrideTokens != null && gemPaidSpinCount === spinCount) {
        // Bonus bundle hanya kalau semua spin dibayar gem, bukan tiket/token.
        earnedTokens = overrideTokens;
      } else if (gemPaidSpinCount > 0) {
        newProgress += gemPaidSpinCount;
        while (newProgress >= TOKENS_PER_SPIN_THRESHOLD) {
          earnedTokens++;
          newProgress -= TOKENS_PER_SPIN_THRESHOLD;
        }
      }
      const newTokens = Math.max(0, tokenState.tokens) + earnedTokens;
      await setLuckyTokens(admin, visitorId, newTokens, newProgress);

      const summary = results.map(r => r.label).join(", ");
      const titleExtras: string[] = [];
      if (totalBonusGems > 0) titleExtras.push(`🔥 +${totalBonusGems} streak`);
      if (jackpotWonTotal > 0) titleExtras.push(`💥 JACKPOT +${jackpotWonTotal}`);
      if (earnedTokens > 0) titleExtras.push(`🎟️ +${earnedTokens} Token`);
      // Counter milestone harian — semua spin Luck Royale terhitung (normal/bundle/pack)
      await bumpMilestoneSpin(admin, visitorId, spinCount);

      // Catat pemakaian diskon harian (jika diskon dipakai)
      let discountUsedAfter = usedToday;
      if (discountApplied > 0) {
        discountUsedAfter = await bumpNormalDiscountUsage(admin, visitorId, spinCount);
      }

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
        luckyVoucherApplied,
        luckyVoucherCode,
        megaJackpotPool: finalPool,
        luckyTokens: newTokens,
        luckyTokenProgress: newProgress,
        luckyTokenThreshold: TOKENS_PER_SPIN_THRESHOLD,
        earnedTokens,
        luckyTokensUsedForSpin,
        luckyHourActive,
        luckyHour: luckyHourActive ? luckyHourState.hour : luckyHourState.hour,
        normalDiscount: discountPrice != null ? {
          packCount: spinCount,
          originalCost,
          discountedCost: cost,
          discountApplied,
          usedToday: discountUsedAfter,
          limitPerDay: NORMAL_DISCOUNT_LIMIT_PER_DAY,
        } : null,
        ticketsUsed,
        finalGemCost: costAfterTickets,
        tickets: await getTicketBalances(admin, visitorId),
      }, { headers: corsHeaders });
    }

    // === BELI TIKET SPIN ===
    // === CONVERT TIKET → LUCKY TOKEN ===
    // Rate: 5 tiket Normal = 1 LT, 3 tiket Premium = 1 LT
    if (action === "convert_tickets") {
      const ticketType = ((body as any).ticketType || "normal") as "normal" | "premium";
      const amount = Math.max(1, Math.min(1000, Number((body as any).amount || 0)));
      const RATE: Record<"normal" | "premium", number> = { normal: 5, premium: 3 };
      const rate = RATE[ticketType];
      if (amount % rate !== 0) {
        return Response.json({ error: `Jumlah tiket harus kelipatan ${rate} (${rate} tiket = 1 Lucky Token)` }, { status: 400, headers: corsHeaders });
      }
      const tb = await getTicketBalances(admin, visitorId);
      if (tb[ticketType] < amount) {
        return Response.json({ error: `Tiket tidak cukup. Punya ${tb[ticketType]}, butuh ${amount}` }, { status: 400, headers: corsHeaders });
      }
      const tokensGained = Math.floor(amount / rate);
      try {
        await adjustTickets(admin, visitorId, ticketType, -amount, "convert_to_lucky_token", { tokensGained });
      } catch (e) {
        return Response.json({ error: "Gagal mengurangi tiket" }, { status: 400, headers: corsHeaders });
      }
      const ts = await getLuckyTokens(admin, visitorId);
      const newTokens = ts.tokens + tokensGained;
      await setLuckyTokens(admin, visitorId, newTokens, ts.spinProgress);
      const balances = await getTicketBalances(admin, visitorId);
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎟️ Tukar Tiket → Lucky Token`,
        message: `${amount} tiket ${ticketType} ditukar jadi ${tokensGained} Lucky Token (total: ${newTokens})`,
        type: "luck_royale_nyawa",
      });
      return Response.json({
        success: true,
        tickets: balances,
        luckyTokens: newTokens,
        luckyTokenProgress: ts.spinProgress,
        luckyTokenThreshold: TOKENS_PER_SPIN_THRESHOLD,
        converted: amount,
        gained: tokensGained,
      }, { headers: corsHeaders });
    }

    if (action === "buy_tickets") {
      return Response.json({ error: "Tiket tidak dijual. Tiket hanya didapat dari hadiah spin." }, { status: 400, headers: corsHeaders });
    }

    // === REDEEM LUCKY TOKEN ===
    if (action === "redeem_token") {
      const item = TOKEN_SHOP.find(i => i.code === itemCode);
      if (!item) return Response.json({ error: "Item tidak valid" }, { status: 400, headers: corsHeaders });

      // FREE tier: bebas. Tier lain: cek akses tier ATAU Premium Shop Unlock 7 hari.
      const premiumUnlockState = await resolvePremiumShopUnlock(admin, visitorId);
      const premiumUnlockOn = isPremiumShopUnlockActive(premiumUnlockState);

      if (!premiumUnlockOn) {
        if (item.tier === "premium") {
          const access = await getShopAccess(admin, visitorId, "premium");
          if (!isShopAccessActive(access)) {
            return Response.json({
              error: `Akses Premium belum aktif. Beli akses Rp ${SHOP_ACCESS_PRICE.toLocaleString("id-ID")} (berlaku ${SHOP_ACCESS_DAYS} hari) atau aktifkan Nyawa Premium (Rp 50.000) untuk unlock SEMUA tier 7 hari.`,
            }, { status: 403, headers: corsHeaders });
          }
        } else if (item.tier === "super_premium") {
          const superAccess = await getShopAccess(admin, visitorId, "super_premium");
          if (!isShopAccessActive(superAccess)) {
            return Response.json({
              error: `Akses Super Premium belum aktif. Beli akses Rp ${SUPER_SHOP_ACCESS_PRICE.toLocaleString("id-ID")} (berlaku ${SUPER_SHOP_ACCESS_DAYS} hari) atau aktifkan Nyawa Premium (Rp 50.000) untuk unlock SEMUA tier 7 hari.`,
            }, { status: 403, headers: corsHeaders });
          }
        } else if (item.tier === "ultra") {
          const ultraAccess = await getShopAccess(admin, visitorId, "ultra");
          if (!isShopAccessActive(ultraAccess)) {
            return Response.json({
              error: `Akses Ultra belum aktif. Beli akses Rp ${ULTRA_SHOP_ACCESS_PRICE.toLocaleString("id-ID")} (berlaku ${ULTRA_SHOP_ACCESS_DAYS} hari) atau aktifkan Nyawa Premium (Rp 50.000) untuk unlock SEMUA tier 7 hari.`,
            }, { status: 403, headers: corsHeaders });
          }
        }
      }
      // tier === "free" → langsung lanjut

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

    // === BUY NYAWA PREMIUM — Rp 50.000 / 1 hari, hadiah pool MANTAP JIWA ===
    if (action === "buy_nyawa_premium") {
      const pin = (body as any).pin as string | undefined;
      const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
      if (!pinRow) return Response.json({ error: "PIN belum dibuat. Buat PIN dulu di menu Profil.", needPin: true }, { status: 200, headers: corsHeaders });
      if (!pin) return Response.json({ error: "Masukkan PIN 6 digit", needPin: true }, { status: 200, headers: corsHeaders });
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 200, headers: corsHeaders });

      const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
      if (!ubId) return Response.json({ error: "Login akun saldo dulu untuk beli Nyawa Premium" }, { status: 400, headers: corsHeaders });
      const { data: balanceRow } = await admin.from("user_balances").select("id, balance, username").eq("id", ubId).maybeSingle();
      if (!balanceRow) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 400, headers: corsHeaders });
      if ((balanceRow.balance || 0) < NYAWA_PREMIUM_PRICE) {
        return Response.json({ error: `Saldo tidak cukup. Butuh Rp ${NYAWA_PREMIUM_PRICE.toLocaleString("id-ID")} (saldo: Rp ${(balanceRow.balance || 0).toLocaleString("id-ID")})` }, { status: 400, headers: corsHeaders });
      }

      // Akumulasi: kalau masih aktif, perpanjang dari sisa
      const existing = await getNyawaPremium(admin, visitorId);
      const baseMs = existing.activeUntil && new Date(existing.activeUntil).getTime() > Date.now()
        ? new Date(existing.activeUntil).getTime()
        : Date.now();
      const newUntilIso = new Date(baseMs + NYAWA_PREMIUM_HOURS * 3600 * 1000).toISOString();

      await admin.from("user_balances").update({ balance: (balanceRow.balance || 0) - NYAWA_PREMIUM_PRICE }).eq("id", balanceRow.id);
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        amount: -NYAWA_PREMIUM_PRICE,
        type: "purchase",
        description: `Nyawa Premium Luck Royale (30 hari)`,
      });
      await setNyawaPremium(admin, visitorId, { activeUntil: newUntilIso, purchasedAt: new Date().toISOString() });

      // Grant / perpanjang Premium Token Shop Unlock 7 hari (akumulasi)
      const existingUnlock = await getPremiumShopUnlock(admin, visitorId);
      const unlockBaseMs = existingUnlock.activeUntil && new Date(existingUnlock.activeUntil).getTime() > Date.now()
        ? new Date(existingUnlock.activeUntil).getTime()
        : Date.now();
      const unlockUntilIso = new Date(unlockBaseMs + PREMIUM_SHOP_UNLOCK_DAYS * 24 * 3600 * 1000).toISOString();
      await setPremiumShopUnlock(admin, visitorId, { activeUntil: unlockUntilIso, grantedAt: new Date().toISOString() });

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: "👑 Nyawa Premium Aktif!",
        message: `Premium Spin (30 hari) + Token Shop SEMUA tier (${PREMIUM_SHOP_UNLOCK_DAYS} hari) aktif sampai ${new Date(unlockUntilIso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.`,
        type: "luck_royale_nyawa",
      });

      return Response.json({
        success: true,
        balance: (balanceRow.balance || 0) - NYAWA_PREMIUM_PRICE,
        nyawaPremium: {
          isActive: true,
          activeUntil: newUntilIso,
          purchasedAt: new Date().toISOString(),
          price: NYAWA_PREMIUM_PRICE,
          durationHours: NYAWA_PREMIUM_HOURS,
        },
        premiumShopUnlock: {
          isActive: true,
          activeUntil: unlockUntilIso,
          grantedAt: new Date().toISOString(),
          durationDays: PREMIUM_SHOP_UNLOCK_DAYS,
        },
      }, { headers: corsHeaders });
    }

    if (action === "leaderboard") {
      // Ambil SELURUH history via paginasi agar total spin & jackpot AKURAT
      const all: Array<{ visitor_id: string; rarity: string; reward_label: string | null; created_at: string }> = [];
      const PAGE = 1000;
      for (let from = 0; from < 200000; from += PAGE) {
        const { data: page } = await admin
          .from("luck_royale_nyawa_history")
          .select("visitor_id, rarity, reward_label, created_at")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (!page || page.length === 0) break;
        all.push(...(page as any));
        if (page.length < PAGE) break;
      }
      const rows = all;

      // (rows == all entries)
      const visitorIds = Array.from(new Set(all.map(r => r.visitor_id))).filter(Boolean);

      // Map visitor_id -> user_balance_id (akun aktif terakhir)
      const ubMap = new Map<string, string | null>();
      if (visitorIds.length) {
        const { data: blh } = await admin
          .from("balance_login_history")
          .select("visitor_id, user_balance_id, logged_in_at")
          .in("visitor_id", visitorIds)
          .order("logged_in_at", { ascending: false });
        (blh || []).forEach(r => {
          if (!ubMap.has(r.visitor_id)) ubMap.set(r.visitor_id, r.user_balance_id);
        });
      }

      // Ambil username dari user_balances
      const ubIds = Array.from(new Set(Array.from(ubMap.values()).filter(Boolean) as string[]));
      const usernameMap = new Map<string, string>();
      if (ubIds.length) {
        const { data: ubs } = await admin
          .from("user_balances")
          .select("id, username")
          .in("id", ubIds);
        (ubs || []).forEach(u => usernameMap.set(u.id, u.username || "Anonim"));
      }

      const accountKey = (vid: string) => {
        const ub = ubMap.get(vid);
        return ub ? `ub:${ub}` : `v:${vid}`;
      };
      const accountName = (vid: string) => {
        const ub = ubMap.get(vid);
        if (ub) return usernameMap.get(ub) || "Anonim";
        return "Tamu";
      };
      // Mask username (sembunyikan tengah)
      const maskName = (name: string) => {
        if (!name || name.length <= 3) return name + "***";
        const visible = Math.min(3, Math.ceil(name.length / 2));
        return name.slice(0, visible) + "***";
      };

      // Top spinner — total spin (exclude free_daily? Tidak, semua dihitung)
      const spinAgg = new Map<string, { name: string; total: number; jackpots: number }>();
      // Top jackpot — Mythic & Legendary
      const jackpotAgg = new Map<string, { name: string; count: number; latestLabel: string; latestAt: string }>();

      for (const r of all) {
        const key = accountKey(r.visitor_id);
        const nm = maskName(accountName(r.visitor_id));

        const s = spinAgg.get(key) || { name: nm, total: 0, jackpots: 0 };
        s.total += 1;
        if (r.rarity === "mythic" || r.rarity === "legendary") s.jackpots += 1;
        spinAgg.set(key, s);

        if (r.rarity === "mythic" || r.rarity === "legendary") {
          const j = jackpotAgg.get(key) || { name: nm, count: 0, latestLabel: r.reward_label || "", latestAt: r.created_at };
          j.count += 1;
          if (Date.parse(r.created_at) > Date.parse(j.latestAt)) {
            j.latestLabel = r.reward_label || j.latestLabel;
            j.latestAt = r.created_at;
          }
          jackpotAgg.set(key, j);
        }
      }

      const topSpinners = Array.from(spinAgg.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 30);
      const topJackpots = Array.from(jackpotAgg.values())
        .sort((a, b) => b.count - a.count || Date.parse(b.latestAt) - Date.parse(a.latestAt))
        .slice(0, 30);

      return Response.json({
        success: true,
        topSpinners,
        topJackpots,
        totalEntriesScanned: all.length,
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
