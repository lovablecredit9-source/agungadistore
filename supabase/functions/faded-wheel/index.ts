import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// === MYSTERY BOX SYSTEM ===
// Spin → buka 1 box (random index dari 9). Hadiah ditentukan SAAT KLAIM (random dari pool).
// Setelah 9 box terbuka & diklaim semua → grid reset jadi 9 box baru.
type BoxPrize = {
  kind: "extra_life" | "auto_hint" | "time_freeze" | "streak_freeze" | "gems" | "game_credits" | "game_balance";
  value: number;
  label: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  weight: number;
};

// Pool hadiah Mystery Box — variatif: gem/hint/nyawa/kredit/saldo/freeze
// Range normal sesuai permintaan user, jackpot besar tetap ada tapi sangat jarang
const BOX_PRIZE_POOL: BoxPrize[] = [
  // === COMMON (sering) ===
  { kind: "auto_hint",     value: 50,    label: "💡 +50 Hint",            emoji: "💡", rarity: "common",    weight: 14 },
  { kind: "auto_hint",     value: 100,   label: "💡 +100 Hint",           emoji: "💡", rarity: "common",    weight: 10 },
  { kind: "extra_life",    value: 50,    label: "❤️ +50 Nyawa",           emoji: "❤️", rarity: "common",    weight: 14 },
  { kind: "extra_life",    value: 100,   label: "❤️ +100 Nyawa",          emoji: "❤️", rarity: "common",    weight: 10 },
  { kind: "extra_life",    value: 200,   label: "❤️ +200 Nyawa",          emoji: "❤️", rarity: "common",    weight: 6 },
  { kind: "time_freeze",   value: 5,     label: "⏱️ +5 Freeze",           emoji: "⏱️", rarity: "common",    weight: 12 },
  { kind: "time_freeze",   value: 10,    label: "⏱️ +10 Freeze",          emoji: "⏱️", rarity: "common",    weight: 8 },
  { kind: "time_freeze",   value: 20,    label: "⏱️ +20 Freeze",          emoji: "⏱️", rarity: "common",    weight: 4 },
  { kind: "streak_freeze", value: 5,     label: "🛡️ +5 Streak Freeze",    emoji: "🛡️", rarity: "common",    weight: 8 },
  { kind: "streak_freeze", value: 10,    label: "🛡️ +10 Streak Freeze",   emoji: "🛡️", rarity: "common",    weight: 5 },
  { kind: "streak_freeze", value: 20,    label: "🛡️ +20 Streak Freeze",   emoji: "🛡️", rarity: "common",    weight: 2.5 },
  { kind: "gems",          value: 100,   label: "💎 +100 Gem",            emoji: "💎", rarity: "common",    weight: 6 },
  { kind: "gems",          value: 200,   label: "💎 +200 Gem",            emoji: "💎", rarity: "common",    weight: 4 },
  { kind: "game_credits",  value: 50,    label: "🔑 +50 Kredit",          emoji: "🔑", rarity: "common",    weight: 6 },
  { kind: "game_credits",  value: 100,   label: "🔑 +100 Kredit",         emoji: "🔑", rarity: "common",    weight: 4 },
  { kind: "game_credits",  value: 200,   label: "🔑 +200 Kredit",         emoji: "🔑", rarity: "common",    weight: 2 },
  { kind: "game_balance",  value: 100,   label: "💵 +Rp 100 Saldo IN",    emoji: "💵", rarity: "common",    weight: 6 },
  { kind: "game_balance",  value: 200,   label: "💵 +Rp 200 Saldo IN",    emoji: "💵", rarity: "common",    weight: 4 },

  // === RARE (lumayan) ===
  { kind: "gems",          value: 500,   label: "💎 +500 Gem",            emoji: "💎", rarity: "rare",      weight: 1.8 },
  { kind: "auto_hint",     value: 300,   label: "💡 +300 Hint",           emoji: "💡", rarity: "rare",      weight: 1.5 },
  { kind: "extra_life",    value: 400,   label: "❤️ +400 Nyawa",          emoji: "❤️", rarity: "rare",      weight: 1.5 },
  { kind: "game_credits",  value: 500,   label: "🔑 +500 Kredit",         emoji: "🔑", rarity: "rare",      weight: 1.2 },
  { kind: "game_balance",  value: 500,   label: "💵 +Rp 500 Saldo IN",    emoji: "💵", rarity: "rare",      weight: 1.2 },
  { kind: "time_freeze",   value: 40,    label: "⏱️ +40 Freeze",          emoji: "⏱️", rarity: "rare",      weight: 1.0 },
  { kind: "streak_freeze", value: 40,    label: "🛡️ +40 Streak Freeze",   emoji: "🛡️", rarity: "rare",      weight: 0.8 },

  // === EPIC (jarang) ===
  { kind: "gems",          value: 1000,  label: "💎 +1.000 Gem",          emoji: "💎", rarity: "epic",      weight: 0.6 },
  { kind: "gems",          value: 2000,  label: "💎 +2.000 Gem",          emoji: "💎", rarity: "epic",      weight: 0.25 },
  { kind: "game_credits",  value: 1000,  label: "🔑 +1.000 Kredit",       emoji: "🔑", rarity: "epic",      weight: 0.4 },
  { kind: "game_balance",  value: 1000,  label: "💵 +Rp 1.000 Saldo IN",  emoji: "💵", rarity: "epic",      weight: 0.4 },
  { kind: "game_balance",  value: 2500,  label: "💵 +Rp 2.500 Saldo IN",  emoji: "💵", rarity: "epic",      weight: 0.18 },

  // === LEGENDARY (sangat jarang — JACKPOT) ===
  { kind: "gems",          value: 5000,  label: "🔥 +5.000 GEM JACKPOT",  emoji: "💎", rarity: "legendary", weight: 0.06 },
  { kind: "gems",          value: 10000, label: "👑 +10.000 GEM MEGA",    emoji: "💎", rarity: "legendary", weight: 0.012 },
  { kind: "game_credits",  value: 5000,  label: "🔥 +5.000 Kredit JACKPOT", emoji: "🔑", rarity: "legendary", weight: 0.04 },
  { kind: "game_balance",  value: 10000, label: "👑 +Rp 10.000 JACKPOT",  emoji: "💵", rarity: "legendary", weight: 0.025 },
  { kind: "game_balance",  value: 25000, label: "👑 +Rp 25.000 MEGA",     emoji: "💵", rarity: "legendary", weight: 0.005 },
];

function rollPrize(): BoxPrize {
  const tw = BOX_PRIZE_POOL.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * tw;
  for (const p of BOX_PRIZE_POOL) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return BOX_PRIZE_POOL[0];
}

// Bonus tambahan berdasarkan jumlah box dibuka di ronde saat ini
const BONUS_THRESHOLDS = [
  { spins: 5, bonus: { kind: "auto_hint", value: 100, label: "Bonus +100 Hint", rarity: "rare" } },
  { spins: 10, bonus: { kind: "streak_freeze", value: 10, label: "Bonus +10 Streak Freeze", rarity: "epic" } },
  { spins: 15, bonus: { kind: "extra_life", value: 500, label: "Bonus +500 Nyawa", rarity: "epic" } },
  { spins: 20, bonus: { kind: "game_credits", value: 1000, label: "Bonus +1.000 Kredit", rarity: "epic" } },
  { spins: 25, bonus: { kind: "gems", value: 1500, label: "Bonus +1.500 Gem", rarity: "legendary" } },
  { spins: 30, bonus: { kind: "gems", value: 5000, label: "Bonus GRAND +5.000 Gem", rarity: "legendary" } },
];

// === 30 KOTAK ===
const GRID_SIZE = 30;

// Tier kotak (index 0-based)
const SPECIAL_INDEXES = [2, 5, 8, 12, 16, 19, 23, 27];        // minimal RARE
const LIMITED_INDEXES = [4, 11, 18, 25];                       // minimal EPIC
const SUPER_LIMITED_INDEXES = [9, 21, 29];                     // minimal LEGENDARY

function boxTier(i: number): "normal" | "special" | "limited" | "super_limited" {
  if (SUPER_LIMITED_INDEXES.includes(i)) return "super_limited";
  if (LIMITED_INDEXES.includes(i)) return "limited";
  if (SPECIAL_INDEXES.includes(i)) return "special";
  return "normal";
}

const RARITY_ORDER = ["common", "rare", "epic", "legendary"];

function rollPrizeForBox(i: number): BoxPrize {
  const tier = boxTier(i);
  const minRarity = tier === "super_limited" ? "legendary" : tier === "limited" ? "epic" : tier === "special" ? "rare" : "common";
  const minIdx = RARITY_ORDER.indexOf(minRarity);
  const pool = BOX_PRIZE_POOL.filter((p) => RARITY_ORDER.indexOf(p.rarity) >= minIdx);
  const list = pool.length ? pool : BOX_PRIZE_POOL;
  const tw = list.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * tw;
  for (const p of list) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return list[0];
}

// Harga naik tiap box dibuka (30 langkah)
const SPIN_COSTS = [
  50, 75, 100, 125, 150, 175, 200, 250, 300, 350,
  400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1250,
  1400, 1600, 1800, 2000, 2250, 2500, 2800, 3200, 3600, 4000,
];

async function getAccountKey(admin: any, visitorId: string): Promise<{ userBalanceId: string | null }> {
  const { data } = await admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
  return { userBalanceId: data?.user_balance_id || null };
}

async function applyLuckyVoucherDiscount(admin: any, visitorId: string, cost: number) {
  const nowIso = new Date().toISOString();
  const { userBalanceId } = await getAccountKey(admin, visitorId);
  let q = admin.from("discount_vouchers").select("code, discount_amount").eq("source", "lucky_spin").not("active_expires_at", "is", null).gt("active_expires_at", nowIso);
  q = userBalanceId ? q.or(`visitor_id.eq.${visitorId},user_balance_id.eq.${userBalanceId}`) : q.eq("visitor_id", visitorId);
  const { data: v } = await q.order("active_expires_at", { ascending: false }).limit(1).maybeSingle();
  const pct = Math.max(0, Math.min(100, Number(v?.discount_amount || 0)));
  const discount = pct > 0 ? Math.floor(cost * pct / 100) : 0;
  return { finalCost: Math.max(1, cost - discount), pct, code: v?.code || null };
}

async function applyPrize(admin: any, visitorId: string, p: { kind: string; value: number }) {
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
  } else if (p.kind === "streak_freeze") {
    const { data: streak } = await admin.from("daily_streaks").select("id, freeze_count").eq("visitor_id", visitorId).maybeSingle();
    if (streak) {
      await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + p.value }).eq("id", streak.id);
    } else {
      await admin.from("daily_streaks").insert({ visitor_id: visitorId, freeze_count: p.value });
    }
  } else if (p.kind === "gems") {
    await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: p.value });
  } else if (p.kind === "game_credits") {
    await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: p.value });
  } else if (p.kind === "game_balance") {
    // Tambah ke game_profiles.balance (saldo IN game)
    const { data: gp } = await admin.from("game_profiles").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
    if (gp) {
      await admin.from("game_profiles").update({ balance: (gp.balance || 0) + p.value }).eq("id", gp.id);
    } else {
      await admin.from("game_profiles").insert({ visitor_id: visitorId, display_name: "Anonim", balance: p.value });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, action, boxIndex } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Ambil/buat state
    let { data: state } = await admin.from("faded_wheel_state").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (!state) {
      const { data: created } = await admin.from("faded_wheel_state").insert({
        visitor_id: visitorId,
        grid_prizes: [],
        claimed_indexes: [],
        pending_claims: [],
        spins_in_round: 0,
        total_spins_lifetime: 0,
        current_round: 1,
      }).select().single();
      state = created;
    }

    const { data: gemsData } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
    const gems = Number(gemsData || 0);

    const claimed: number[] = state.claimed_indexes || [];
    const pending: Array<{ index: number }> = state.pending_claims || [];
    const occupiedIndexes = new Set([...claimed, ...pending.map((p) => p.index)]);
    const totalOpened = claimed.length + pending.length;
    const nextCost = SPIN_COSTS[Math.min(totalOpened, SPIN_COSTS.length - 1)];

    if (action === "check") {
      return Response.json({
        gridSize: GRID_SIZE,
        specialIndexes: SPECIAL_INDEXES,
        limitedIndexes: LIMITED_INDEXES,
        superLimitedIndexes: SUPER_LIMITED_INDEXES,
        claimedIndexes: claimed,
        pendingClaims: pending,
        spinsInRound: state.spins_in_round,
        totalSpinsLifetime: state.total_spins_lifetime,
        currentRound: state.current_round,
        nextCost,
        spinCosts: SPIN_COSTS,
        bonusThresholds: BONUS_THRESHOLDS,
        gems,
      }, { headers: corsHeaders });
    }

    if (action === "spin") {
      const available = Array.from({ length: GRID_SIZE }, (_, i) => i).filter((i) => !occupiedIndexes.has(i));
      if (available.length === 0) {
        return Response.json({ error: "Semua box sudah dibuka. Klaim dulu yang pending!" }, { status: 400, headers: corsHeaders });
      }

      const discounted = await applyLuckyVoucherDiscount(admin, visitorId, nextCost);
      if (gems < discounted.finalCost) {
        return Response.json({ error: `Butuh ${discounted.finalCost} 💎 Gem (kamu punya ${gems})` }, { status: 400, headers: corsHeaders });
      }

      // Pilih box random (atau pakai boxIndex jika valid)
      let pickedIndex: number;
      if (typeof boxIndex === "number" && available.includes(boxIndex)) {
        pickedIndex = boxIndex;
      } else {
        pickedIndex = available[Math.floor(Math.random() * available.length)];
      }

      // Kurangi gem
      try {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -discounted.finalCost });
      } catch {
        return Response.json({ error: "Gagal kurangi saldo gem" }, { status: 400, headers: corsHeaders });
      }

      // Tambah ke pending_claims (hadiah BELUM di-roll, akan di-roll saat klaim)
      const newPending = [...pending, { index: pickedIndex }];
      const newSpinsInRound = state.spins_in_round + 1;
      const newTotalSpins = state.total_spins_lifetime + 1;

      await admin.from("faded_wheel_state").update({
        pending_claims: newPending,
        spins_in_round: newSpinsInRound,
        total_spins_lifetime: newTotalSpins,
      }).eq("id", state.id);

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      const totalOpenedAfter = claimed.length + newPending.length;
      const nextCostAfter = SPIN_COSTS[Math.min(totalOpenedAfter, SPIN_COSTS.length - 1)];

      return Response.json({
        success: true,
        boxIndex: pickedIndex,
        pendingClaims: newPending,
        gems: gemsAfter || 0,
        nextCost: nextCostAfter,
        spinsInRound: newSpinsInRound,
        totalSpinsLifetime: newTotalSpins,
      }, { headers: corsHeaders });
    }

    if (action === "claim") {
      if (typeof boxIndex !== "number") {
        return Response.json({ error: "boxIndex required" }, { status: 400, headers: corsHeaders });
      }
      const idx = pending.findIndex((p) => p.index === boxIndex);
      if (idx === -1) {
        return Response.json({ error: "Box ini tidak siap diklaim" }, { status: 400, headers: corsHeaders });
      }

      // Roll random prize SEKARANG
      const prize = rollPrizeForBox(boxIndex);
      await applyPrize(admin, visitorId, prize);

      const newPending = pending.filter((_, i) => i !== idx);
      const newClaimed = [...claimed, boxIndex];

      // Cek bonus threshold (berdasarkan total box yang sudah diklaim di ronde ini)
      const claimedCountInRound = newClaimed.length;
      const bonusUnlocked = BONUS_THRESHOLDS.find((b) => b.spins === claimedCountInRound);
      if (bonusUnlocked) {
        await applyPrize(admin, visitorId, bonusUnlocked.bonus);
      }

      // Catat history
      await admin.from("luck_royale_nyawa_history").insert({
        visitor_id: visitorId,
        spin_type: "mystery_box",
        reward_kind: prize.kind,
        reward_value: prize.value,
        reward_label: prize.label,
        rarity: prize.rarity,
        cost_currency: "gems",
        cost_amount: 0, // gem sudah dikurangi saat spin
      });

      // Auto-reset jika semua box sudah diklaim semua
      let resetTriggered = false;
      let updatedState: any = {
        claimed_indexes: newClaimed,
        pending_claims: newPending,
      };
      if (newClaimed.length >= GRID_SIZE && newPending.length === 0) {
        updatedState = {
          claimed_indexes: [],
          pending_claims: [],
          spins_in_round: 0,
          current_round: state.current_round + 1,
        };
        resetTriggered = true;
      }

      await admin.from("faded_wheel_state").update(updatedState).eq("id", state.id);

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      const finalClaimed: number[] = updatedState.claimed_indexes || newClaimed;
      const finalPending: any[] = updatedState.pending_claims || newPending;
      const totalOpenedAfter = finalClaimed.length + finalPending.length;
      const nextCostAfter = SPIN_COSTS[Math.min(totalOpenedAfter, SPIN_COSTS.length - 1)];

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎁 Mystery Box: ${prize.label}`,
        message: bonusUnlocked ? `+ Bonus: ${bonusUnlocked.bonus.label}` : `Sisa gem: ${gemsAfter || 0}`,
        type: "mystery_box",
      });

      return Response.json({
        success: true,
        prize,
        boxIndex,
        bonus: bonusUnlocked ? bonusUnlocked.bonus : null,
        resetTriggered,
        gems: gemsAfter || 0,
        nextCost: nextCostAfter,
        claimedIndexes: finalClaimed,
        pendingClaims: finalPending,
        currentRound: updatedState.current_round || state.current_round,
        spinsInRound: updatedState.spins_in_round !== undefined ? updatedState.spins_in_round : state.spins_in_round,
      }, { headers: corsHeaders });
    }

    if (action === "reset") {
      await admin.from("faded_wheel_state").update({
        claimed_indexes: [],
        pending_claims: [],
        spins_in_round: 0,
        current_round: state.current_round + 1,
      }).eq("id", state.id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
