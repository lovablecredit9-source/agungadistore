import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 9 hadiah grid: Mix Nyawa/Hint/Freeze + Jackpot Gem
type FadedPrize = {
  kind: "extra_life" | "auto_hint" | "time_freeze" | "streak_freeze" | "gems";
  value: number;
  label: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
};

const GRID_TEMPLATE: FadedPrize[] = [
  { kind: "extra_life",    value: 1,   label: "Nyawa x1",      emoji: "❤️", rarity: "common" },
  { kind: "auto_hint",     value: 2,   label: "Hint x2",       emoji: "💡", rarity: "common" },
  { kind: "time_freeze",   value: 2,   label: "Freeze 30s x2", emoji: "⏱️", rarity: "common" },
  { kind: "streak_freeze", value: 1,   label: "S.Freeze x1",   emoji: "🛡️", rarity: "rare" },
  { kind: "extra_life",    value: 3,   label: "Nyawa x3",      emoji: "❤️", rarity: "rare" },
  { kind: "auto_hint",     value: 5,   label: "Hint x5",       emoji: "💡", rarity: "rare" },
  { kind: "time_freeze",   value: 10,  label: "Freeze x10",    emoji: "⏱️", rarity: "epic" },
  { kind: "streak_freeze", value: 5,   label: "S.Freeze x5",   emoji: "🛡️", rarity: "epic" },
  { kind: "gems",          value: 100, label: "JACKPOT 💎100", emoji: "👑", rarity: "legendary" },
];

// Bonus tambahan berdasarkan jumlah spin di ronde saat ini (mirip Free Fire 8x/7x/6x)
const BONUS_THRESHOLDS = [
  { spins: 3, bonus: { kind: "auto_hint", value: 2, label: "Bonus +2 Hint", rarity: "rare" } },
  { spins: 5, bonus: { kind: "streak_freeze", value: 1, label: "Bonus +1 Streak Freeze", rarity: "epic" } },
  { spins: 7, bonus: { kind: "extra_life", value: 5, label: "Bonus +5 Nyawa", rarity: "epic" } },
  { spins: 9, bonus: { kind: "gems", value: 50, label: "Bonus +50 Gem", rarity: "legendary" } },
];

// Harga naik tiap spin: 50, 75, 100, 150, 200, 300, 400, 500, 700
const SPIN_COSTS = [50, 75, 100, 150, 200, 300, 400, 500, 700];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function freshGrid(): FadedPrize[] {
  return shuffle(GRID_TEMPLATE);
}

async function applyPrize(admin: any, visitorId: string, p: FadedPrize) {
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
    }
  } else if (p.kind === "gems") {
    await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: p.value });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, action, prizeIndex } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Ambil/buat state
    let { data: state } = await admin.from("faded_wheel_state").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (!state) {
      const newGrid = freshGrid();
      const { data: created } = await admin.from("faded_wheel_state").insert({
        visitor_id: visitorId,
        grid_prizes: newGrid,
        claimed_indexes: [],
        spins_in_round: 0,
        total_spins_lifetime: 0,
        current_round: 1,
      }).select().single();
      state = created;
    }

    const { data: gemsData } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
    const gems = Number(gemsData || 0);

    if (action === "check") {
      const claimed = state.claimed_indexes || [];
      const nextCost = SPIN_COSTS[Math.min(claimed.length, SPIN_COSTS.length - 1)];
      return Response.json({
        grid: state.grid_prizes,
        claimedIndexes: claimed,
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
      const claimed: number[] = state.claimed_indexes || [];
      const grid: FadedPrize[] = state.grid_prizes || [];
      const available = grid.map((_, i) => i).filter(i => !claimed.includes(i));
      if (available.length === 0) {
        return Response.json({ error: "Grid kosong, reset dulu!" }, { status: 400, headers: corsHeaders });
      }

      const cost = SPIN_COSTS[Math.min(claimed.length, SPIN_COSTS.length - 1)];
      if (gems < cost) {
        return Response.json({ error: `Butuh ${cost} 💎 Gem (kamu punya ${gems})` }, { status: 400, headers: corsHeaders });
      }

      // Pilih hadiah random dari yang tersedia (atau dari prizeIndex jika diberikan dan masih tersedia)
      let pickedIndex: number;
      if (typeof prizeIndex === "number" && available.includes(prizeIndex)) {
        pickedIndex = prizeIndex;
      } else {
        pickedIndex = available[Math.floor(Math.random() * available.length)];
      }

      // Kurangi gem
      try {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -cost });
      } catch {
        return Response.json({ error: "Gagal kurangi saldo" }, { status: 400, headers: corsHeaders });
      }

      const prize = grid[pickedIndex];
      await applyPrize(admin, visitorId, prize);

      const newClaimed = [...claimed, pickedIndex];
      const newSpinsInRound = state.spins_in_round + 1;
      const newTotalSpins = state.total_spins_lifetime + 1;

      // Cek bonus threshold
      const bonusUnlocked = BONUS_THRESHOLDS.find(b => b.spins === newSpinsInRound);
      if (bonusUnlocked) {
        await applyPrize(admin, visitorId, bonusUnlocked.bonus as any);
      }

      // Catat history
      await admin.from("luck_royale_nyawa_history").insert({
        visitor_id: visitorId,
        spin_type: "faded_wheel",
        reward_kind: prize.kind,
        reward_value: prize.value,
        reward_label: prize.label,
        rarity: prize.rarity,
        cost_currency: "gems",
        cost_amount: cost,
      });

      // Auto-reset grid jika sudah penuh
      let resetTriggered = false;
      let updatedState: any = {
        claimed_indexes: newClaimed,
        spins_in_round: newSpinsInRound,
        total_spins_lifetime: newTotalSpins,
      };
      if (newClaimed.length >= grid.length) {
        updatedState = {
          grid_prizes: freshGrid(),
          claimed_indexes: [],
          spins_in_round: 0,
          total_spins_lifetime: newTotalSpins,
          current_round: state.current_round + 1,
        };
        resetTriggered = true;
      }

      await admin.from("faded_wheel_state").update(updatedState).eq("id", state.id);

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      const nextCost = SPIN_COSTS[Math.min((updatedState.claimed_indexes || []).length, SPIN_COSTS.length - 1)];

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎡 Faded Wheel: ${prize.label}`,
        message: bonusUnlocked ? `+ Bonus: ${bonusUnlocked.bonus.label}` : `Sisa gem: ${gemsAfter || 0}`,
        type: "faded_wheel",
      });

      return Response.json({
        success: true,
        prize,
        prizeIndex: pickedIndex,
        bonus: bonusUnlocked ? bonusUnlocked.bonus : null,
        resetTriggered,
        gems: gemsAfter || 0,
        nextCost,
        newState: {
          grid: updatedState.grid_prizes || grid,
          claimedIndexes: updatedState.claimed_indexes,
          spinsInRound: updatedState.spins_in_round,
          totalSpinsLifetime: newTotalSpins,
          currentRound: updatedState.current_round || state.current_round,
        },
      }, { headers: corsHeaders });
    }

    if (action === "reset") {
      // Reset manual ronde (opsional, kembali ke spin_in_round 0)
      await admin.from("faded_wheel_state").update({
        grid_prizes: freshGrid(),
        claimed_indexes: [],
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
