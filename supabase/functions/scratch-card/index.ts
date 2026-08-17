// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function genVoucher() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 16 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

// Rebalanced: hadiah saldo lebih kecil, kredit/storage lebih banyak.
// Saldo masuk ke Saldo IN (game_balance).
const REWARDS = [
  // COMMON
  { type: "game_credits", value: 2, label: "2 Game Credits", rarity: "common", weight: 20 },
  { type: "game_credits", value: 5, label: "5 Game Credits", rarity: "common", weight: 16 },
  { type: "streak_coins", value: 500, label: "500 Koin Streak", rarity: "common", weight: 14 },
  { type: "streak_coins", value: 2000, label: "2.000 Koin Streak", rarity: "common", weight: 10 },
  { type: "game_balance", value: 200, label: "Saldo IN Rp 200", rarity: "common", weight: 9 },
  { type: "auto_hint", value: 3, label: "3 Hint Otomatis", rarity: "common", weight: 8 },
  { type: "extra_life", value: 3, label: "3 Nyawa Ekstra", rarity: "common", weight: 8 },
  // RARE
  { type: "gems", value: 20, label: "20 Gem", rarity: "rare", weight: 7 },
  { type: "gems", value: 50, label: "50 Gem", rarity: "rare", weight: 5 },
  { type: "streak_coins", value: 10000, label: "10.000 Koin Streak", rarity: "rare", weight: 5 },
  { type: "game_credits", value: 25, label: "25 Game Credits", rarity: "rare", weight: 5 },
  { type: "ticket_normal", value: 3, label: "3 Tiket Spin Normal", rarity: "rare", weight: 5 },
  { type: "firepass_badge", value: 25, label: "25 Badge Fire Pass", rarity: "rare", weight: 4 },
  { type: "time_freeze", value: 5, label: "5 Time Freeze", rarity: "rare", weight: 4 },
  { type: "game_balance", value: 500, label: "Saldo IN Rp 500", rarity: "rare", weight: 4 },
  // EPIC
  { type: "gems", value: 200, label: "200 Gem", rarity: "epic", weight: 3 },
  { type: "streak_coins", value: 50000, label: "50.000 Koin Streak", rarity: "epic", weight: 2.5 },
  { type: "ticket_premium", value: 3, label: "3 Tiket Spin Premium", rarity: "epic", weight: 2.5 },
  { type: "firepass_badge", value: 100, label: "100 Badge Fire Pass", rarity: "epic", weight: 2 },
  { type: "voucher", value: 2000, label: "Voucher Rp 2.000", rarity: "epic", weight: 2 },
  { type: "anon_voucher", value: 3, label: "Voucher Anon Chat 3 Hari", rarity: "epic", weight: 2 },
  { type: "quest_voucher", value: 5, label: "Voucher Premium Quest 5 Hari", rarity: "epic", weight: 1.6 },
  { type: "confess_voucher", value: 50, label: "Voucher Confess 50%", rarity: "epic", weight: 1.6 },
  { type: "server_luck", value: 6, label: "Jam Hoki 6 Jam", rarity: "epic", weight: 1.5 },
  // LEGENDARY
  { type: "gems", value: 1000, label: "1.000 Gem", rarity: "legendary", weight: 0.8 },
  { type: "streak_coins", value: 200000, label: "200.000 Koin Streak", rarity: "legendary", weight: 0.6 },
  { type: "firepass_badge", value: 300, label: "300 Badge Fire Pass", rarity: "legendary", weight: 0.5 },
  { type: "anon_voucher", value: 30, label: "Voucher Anon Chat 30 Hari", rarity: "legendary", weight: 0.5 },
  { type: "quest_voucher", value: 30, label: "Voucher Premium Quest 30 Hari", rarity: "legendary", weight: 0.4 },
  { type: "confess_voucher", value: 100, label: "Voucher Confess GRATIS 100%", rarity: "legendary", weight: 0.3 },
  { type: "game_balance", value: 1000, label: "Saldo IN Rp 1.000", rarity: "legendary", weight: 0.3 },
];

// ====== KARTU BERBAYAR (tanpa batas harian) ======
type Tier = {
  id: string;
  name: string;
  emoji: string;
  coin_cost: number;
  gem_cost: number;
  desc: string;
  pool: { type: string; value: number; label: string; rarity: string; weight: number }[];
};

const TIERS: Tier[] = [
  {
    id: "premium",
    name: "Kartu Premium",
    emoji: "🎫",
    coin_cost: 3000,
    gem_cost: 120,
    desc: "Hadiah menengah: gem, tiket, badge & voucher",
    pool: [
      { type: "streak_coins", value: 2000, label: "2.000 Koin Streak", rarity: "common", weight: 22 },
      { type: "streak_coins", value: 5000, label: "5.000 Koin Streak", rarity: "common", weight: 16 },
      { type: "game_credits", value: 10, label: "10 Game Credits", rarity: "common", weight: 12 },
      { type: "auto_hint", value: 10, label: "10 Hint Otomatis", rarity: "common", weight: 9 },
      { type: "extra_life", value: 10, label: "10 Nyawa Ekstra", rarity: "common", weight: 9 },
      { type: "time_freeze", value: 10, label: "10 Time Freeze", rarity: "common", weight: 7 },
      { type: "gems", value: 100, label: "100 Gem", rarity: "rare", weight: 7 },
      { type: "gems", value: 250, label: "250 Gem", rarity: "rare", weight: 5 },
      { type: "ticket_normal", value: 10, label: "10 Tiket Spin Normal", rarity: "rare", weight: 5 },
      { type: "firepass_badge", value: 50, label: "50 Badge Fire Pass", rarity: "rare", weight: 4 },
      { type: "server_luck", value: 6, label: "Jam Hoki 6 Jam", rarity: "rare", weight: 3 },
      { type: "ticket_premium", value: 3, label: "3 Tiket Spin Premium", rarity: "epic", weight: 3 },
      { type: "streak_coins", value: 25000, label: "25.000 Koin Streak", rarity: "epic", weight: 2.5 },
      { type: "anon_voucher", value: 3, label: "Voucher Anon Chat 3 Hari", rarity: "epic", weight: 2 },
      { type: "quest_voucher", value: 3, label: "Voucher Premium Quest 3 Hari", rarity: "epic", weight: 2 },
      { type: "confess_voucher", value: 50, label: "Voucher Confess 50%", rarity: "epic", weight: 1.5 },
      { type: "gems", value: 800, label: "800 Gem", rarity: "legendary", weight: 0.8 },
      { type: "firepass_badge", value: 200, label: "200 Badge Fire Pass", rarity: "legendary", weight: 0.6 },
    ],
  },
  {
    id: "pro",
    name: "Kartu PRO",
    emoji: "🔥",
    coin_cost: 12000,
    gem_cost: 400,
    desc: "Hadiah besar: badge banyak, voucher panjang & tiket premium",
    pool: [
      { type: "streak_coins", value: 10000, label: "10.000 Koin Streak", rarity: "common", weight: 20 },
      { type: "streak_coins", value: 20000, label: "20.000 Koin Streak", rarity: "common", weight: 14 },
      { type: "game_credits", value: 50, label: "50 Game Credits", rarity: "common", weight: 10 },
      { type: "auto_hint", value: 25, label: "25 Hint Otomatis", rarity: "common", weight: 8 },
      { type: "extra_life", value: 25, label: "25 Nyawa Ekstra", rarity: "common", weight: 8 },
      { type: "gems", value: 300, label: "300 Gem", rarity: "rare", weight: 8 },
      { type: "gems", value: 600, label: "600 Gem", rarity: "rare", weight: 6 },
      { type: "ticket_normal", value: 25, label: "25 Tiket Spin Normal", rarity: "rare", weight: 6 },
      { type: "ticket_premium", value: 8, label: "8 Tiket Spin Premium", rarity: "rare", weight: 5 },
      { type: "firepass_badge", value: 150, label: "150 Badge Fire Pass", rarity: "rare", weight: 5 },
      { type: "server_luck", value: 12, label: "Jam Hoki 12 Jam", rarity: "epic", weight: 4 },
      { type: "streak_coins", value: 100000, label: "100.000 Koin Streak", rarity: "epic", weight: 3 },
      { type: "anon_voucher", value: 10, label: "Voucher Anon Chat 10 Hari", rarity: "epic", weight: 3 },
      { type: "quest_voucher", value: 10, label: "Voucher Premium Quest 10 Hari", rarity: "epic", weight: 3 },
      { type: "confess_voucher", value: 75, label: "Voucher Confess 75%", rarity: "epic", weight: 2 },
      { type: "gems", value: 1500, label: "1.500 Gem", rarity: "legendary", weight: 1.2 },
      { type: "firepass_badge", value: 400, label: "400 Badge Fire Pass", rarity: "legendary", weight: 1 },
      { type: "anon_voucher", value: 30, label: "Voucher Anon Chat 30 Hari", rarity: "legendary", weight: 0.8 },
      { type: "quest_voucher", value: 30, label: "Voucher Premium Quest 30 Hari", rarity: "legendary", weight: 0.6 },
    ],
  },
  {
    id: "limited",
    name: "Kartu LIMITED",
    emoji: "👑",
    coin_cost: 40000,
    gem_cost: 1200,
    desc: "Hadiah sultan: Fire Pass Premium, voucher 1 tahun & mega gem",
    pool: [
      { type: "streak_coins", value: 50000, label: "50.000 Koin Streak", rarity: "common", weight: 18 },
      { type: "streak_coins", value: 100000, label: "100.000 Koin Streak", rarity: "common", weight: 12 },
      { type: "gems", value: 800, label: "800 Gem", rarity: "rare", weight: 10 },
      { type: "gems", value: 1500, label: "1.500 Gem", rarity: "rare", weight: 8 },
      { type: "game_credits", value: 150, label: "150 Game Credits", rarity: "rare", weight: 7 },
      { type: "ticket_premium", value: 20, label: "20 Tiket Spin Premium", rarity: "rare", weight: 6 },
      { type: "ticket_normal", value: 60, label: "60 Tiket Spin Normal", rarity: "rare", weight: 6 },
      { type: "firepass_badge", value: 300, label: "300 Badge Fire Pass", rarity: "epic", weight: 6 },
      { type: "server_luck", value: 24, label: "Jam Hoki 24 Jam", rarity: "epic", weight: 5 },
      { type: "streak_coins", value: 250000, label: "250.000 Koin Streak", rarity: "epic", weight: 4 },
      { type: "anon_voucher", value: 60, label: "Voucher Anon Chat 60 Hari", rarity: "epic", weight: 4 },
      { type: "quest_voucher", value: 60, label: "Voucher Premium Quest 60 Hari", rarity: "epic", weight: 3.5 },
      { type: "confess_voucher", value: 100, label: "Voucher Confess GRATIS 100%", rarity: "epic", weight: 3 },
      { type: "gems", value: 3000, label: "3.000 Gem", rarity: "legendary", weight: 2 },
      { type: "firepass_badge", value: 1000, label: "1.000 Badge Fire Pass", rarity: "legendary", weight: 1.5 },
      { type: "firepass_premium", value: 1, label: "Kartu Fire Pass Premium", rarity: "legendary", weight: 1.2 },
      { type: "anon_voucher", value: 365, label: "Voucher Anon Chat 1 TAHUN", rarity: "legendary", weight: 0.7 },
      { type: "quest_voucher", value: 365, label: "Voucher Premium Quest 1 TAHUN", rarity: "legendary", weight: 0.6 },
      { type: "game_balance", value: 5000, label: "Saldo IN Rp 5.000", rarity: "legendary", weight: 0.5 },
    ],
  },
];

function genCode(prefix: string) {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

async function applyExtraReward(type: string, value: number, visitorId: string): Promise<string | null> {
  if (type === "ticket_normal" || type === "ticket_premium") {
    const tType = type === "ticket_normal" ? "normal" : "premium";
    const { data: ubId } = await supabase.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
    const key = ubId ? `ub:${ubId}` : `v:${visitorId}`;
    const { data: row } = await supabase.from("luck_spin_tickets").select("*")
      .eq("account_key", key).eq("ticket_type", tType).maybeSingle();
    if (row) {
      await supabase.from("luck_spin_tickets").update({
        balance: (row.balance || 0) + value,
        total_purchased: (row.total_purchased || 0) + value,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
    } else {
      await supabase.from("luck_spin_tickets").insert({
        account_key: key, visitor_id: visitorId, user_balance_id: ubId || null,
        ticket_type: tType, balance: value, total_purchased: value,
      });
    }
    return null;
  }
  if (type === "firepass_badge") {
    const { data: season } = await supabase.from("fire_pass_seasons").select("id").eq("is_active", true).maybeSingle();
    if (!season) return null;
    const { data: prog } = await supabase.from("fire_pass_progress").select("id, badges")
      .eq("visitor_id", visitorId).eq("season_id", season.id).maybeSingle();
    if (prog) await supabase.from("fire_pass_progress").update({ badges: (prog.badges || 0) + value }).eq("id", prog.id);
    else await supabase.from("fire_pass_progress").insert({ visitor_id: visitorId, season_id: season.id, badges: value });
    return null;
  }
  if (type === "firepass_premium") {
    const { data: season } = await supabase.from("fire_pass_seasons").select("id").eq("is_active", true).maybeSingle();
    if (!season) return null;
    const { data: prog } = await supabase.from("fire_pass_progress").select("id, is_premium")
      .eq("visitor_id", visitorId).eq("season_id", season.id).maybeSingle();
    if (prog) await supabase.from("fire_pass_progress").update({ is_premium: true, premium_activated_at: new Date().toISOString() }).eq("id", prog.id);
    else await supabase.from("fire_pass_progress").insert({ visitor_id: visitorId, season_id: season.id, is_premium: true, premium_activated_at: new Date().toISOString() });
    return null;
  }
  if (type === "auto_hint" || type === "extra_life" || type === "time_freeze") {
    const { data: row } = await supabase.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (row) await supabase.from("user_power_ups").update({ [type]: Number(row[type] || 0) + value }).eq("visitor_id", visitorId);
    else await supabase.from("user_power_ups").insert({ visitor_id: visitorId, [type]: value });
    return null;
  }
  if (type === "server_luck") {
    const { data: row } = await supabase.from("server_luck_boosters").select("*").eq("visitor_id", visitorId).maybeSingle();
    const base = row?.active_until && new Date(row.active_until).getTime() > Date.now() ? new Date(row.active_until).getTime() : Date.now();
    const activeUntil = new Date(base + value * 3600_000).toISOString();
    if (row) await supabase.from("server_luck_boosters").update({ active_tier: Math.max(2, row.active_tier || 1), active_until: activeUntil, highest_tier_owned: Math.max(2, row.highest_tier_owned || 1), updated_at: new Date().toISOString() }).eq("id", row.id);
    else await supabase.from("server_luck_boosters").insert({ visitor_id: visitorId, active_tier: 2, active_until: activeUntil, highest_tier_owned: 2 });
    return null;
  }
  if (type === "anon_voucher") {
    const code = genCode("ANON");
    await supabase.from("anon_premium_vouchers").insert({ code, days: value, max_uses: 1, note: "Scratch Card" });
    return code;
  }
  if (type === "quest_voucher") {
    const code = genCode("PQ");
    await supabase.from("premium_quest_vouchers").insert({ code, duration_days: value, max_uses: 1, max_per_account: 1, note: "Scratch Card" });
    return code;
  }
  if (type === "confess_voucher") {
    const code = genCode("CFS");
    await supabase.from("confess_vouchers").insert({ code, discount_percent: value, max_uses: 1, note: "Scratch Card" });
    return code;
  }
  return null;
}

// Terapkan hadiah apa pun (mata uang + item) → mengembalikan kode voucher bila ada
async function grantReward(reward: { type: string; value: number; label: string }, visitorId: string): Promise<string | null> {
  if (reward.type === "voucher") {
    const code = genVoucher();
    await supabase.from("game_discount_vouchers").insert({
      code, discount_amount: reward.value, max_uses: 1, is_active: true,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    return code;
  }
  if (reward.type === "game_balance") {
    const { data: gb } = await supabase.from("game_balance").select("id, amount, total_earned").eq("visitor_id", visitorId).maybeSingle();
    if (gb) {
      await supabase.from("game_balance")
        .update({ amount: (gb.amount || 0) + reward.value, total_earned: (gb.total_earned || 0) + reward.value })
        .eq("id", gb.id);
    } else {
      await supabase.from("game_balance").insert({ visitor_id: visitorId, amount: reward.value, total_earned: reward.value });
    }
    await supabase.from("game_balance_transactions").insert({
      visitor_id: visitorId, amount: reward.value, type: "scratch_card", description: `Scratch Card: ${reward.label}`,
    });
    return null;
  }
  if (reward.type === "game_credits") {
    const { data: gc } = await supabase.from("user_game_credits").select("id, credits").eq("visitor_id", visitorId).maybeSingle();
    if (gc) await supabase.from("user_game_credits").update({ credits: (gc.credits || 0) + reward.value }).eq("id", gc.id);
    else await supabase.from("user_game_credits").insert({ visitor_id: visitorId, credits: reward.value });
    return null;
  }
  if (reward.type === "gems") {
    await supabase.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: reward.value });
    await supabase.from("gem_transactions").insert({
      visitor_id: visitorId, amount: reward.value, type: "scratch_reward", description: reward.label,
    });
    return null;
  }
  if (reward.type === "streak_coins") {
    const { data: streak } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
    if (streak) await supabase.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + reward.value }).eq("id", streak.id);
    else await supabase.from("daily_streaks").insert({ visitor_id: visitorId, streak_coins: reward.value });
    return null;
  }
  return await applyExtraReward(reward.type, reward.value, visitorId);
}

function pickFrom(pool: { weight: number }[]) {
  const total = pool.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of pool) {
    roll -= r.weight;
    if (roll <= 0) return r as any;
  }
  return pool[0] as any;
}

function pickReward() {
  return pickFrom(REWARDS);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, visitorId, tier: tierId, payment } = await req.json();
    if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 400, headers: corsHeaders });

    const today = new Date().toISOString().split("T")[0];
    const json = (b: any, status = 200) =>
      new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (action === "status") {
      const { data } = await supabase
        .from("scratch_card_claims")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("claim_date", today)
        .maybeSingle();
      return json({ claimed: !!data, today: data });
    }

    // Info tier berbayar + saldo user
    if (action === "tiers") {
      const [{ data: gems }, { data: streak }] = await Promise.all([
        supabase.rpc("get_account_gems", { p_visitor_id: visitorId }),
        supabase.from("daily_streaks").select("streak_coins").eq("visitor_id", visitorId).maybeSingle(),
      ]);
      return json({
        tiers: TIERS.map((t) => ({
          id: t.id, name: t.name, emoji: t.emoji, desc: t.desc,
          coin_cost: t.coin_cost, gem_cost: t.gem_cost,
          prizes: t.pool.map((p) => ({ label: p.label, rarity: p.rarity })),
        })),
        user_gems: Number(gems) || 0,
        user_coins: streak?.streak_coins || 0,
      });
    }

    // Beli kartu berbayar (tanpa batas harian)
    if (action === "buy_tier") {
      const tier = TIERS.find((t) => t.id === tierId);
      if (!tier) return json({ error: "Tier tidak valid" }, 400);
      const payMethod = payment === "gem" ? "gem" : "coin";

      const { data: streak } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();

      if (payMethod === "gem") {
        const { data: gems } = await supabase.rpc("get_account_gems", { p_visitor_id: visitorId });
        const have = Number(gems) || 0;
        if (have < tier.gem_cost) return json({ error: `Gem kurang. Butuh ${tier.gem_cost} 💎, kamu punya ${have} 💎` }, 400);
        const { error: gemErr } = await supabase.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -tier.gem_cost });
        if (gemErr) return json({ error: `Gagal potong Gem: ${gemErr.message}` }, 400);
        await supabase.from("gem_transactions").insert({
          visitor_id: visitorId, amount: -tier.gem_cost, type: "scratch_tier", description: `Beli ${tier.name}`,
        });
      } else {
        if (!streak) return json({ error: "Mulai streak harian dulu untuk dapat koin" }, 400);
        const coins = streak.streak_coins || 0;
        if (coins < tier.coin_cost) return json({ error: `Koin kurang. Butuh ${tier.coin_cost} 🪙, kamu punya ${coins} 🪙` }, 400);
        await supabase.from("daily_streaks").update({ streak_coins: coins - tier.coin_cost }).eq("id", streak.id);
      }

      const reward = pickFrom(tier.pool);
      const voucherCode = await grantReward(reward, visitorId);

      await supabase.rpc("create_notification", {
        p_visitor_id: visitorId,
        p_title: `${tier.emoji} ${tier.name}`,
        p_message: voucherCode ? `Kamu dapat ${reward.label}! Kode: ${voucherCode}` : `Kamu dapat ${reward.label}!`,
        p_type: "reward",
      });

      return json({
        success: true,
        tier: tier.id,
        payment: payMethod,
        cost: payMethod === "gem" ? tier.gem_cost : tier.coin_cost,
        reward: { ...reward, voucher_code: voucherCode },
      });
    }

    if (action === "claim") {
      // Re-check
      const { data: existing } = await supabase
        .from("scratch_card_claims")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("claim_date", today)
        .maybeSingle();
      if (existing) return json({ error: "Sudah klaim hari ini" }, 400);

      const reward = pickReward();
      const voucherCode = await grantReward(reward, visitorId);

      await supabase.rpc("create_notification", {
        p_visitor_id: visitorId,
        p_title: "🎁 Scratch Card Harian",
        p_message: voucherCode ? `Kamu dapat ${reward.label}! Kode: ${voucherCode}` : `Kamu dapat ${reward.label}!`,
        p_type: "reward",
      });

      const { data: inserted } = await supabase
        .from("scratch_card_claims")
        .insert({
          visitor_id: visitorId,
          claim_date: today,
          reward_type: reward.type,
          reward_value: reward.value,
          reward_label: reward.label,
          rarity: reward.rarity,
          voucher_code: voucherCode,
        })
        .select()
        .single();

      return json({ success: true, reward: inserted });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
