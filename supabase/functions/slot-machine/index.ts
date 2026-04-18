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

const SYMBOLS = ["🍒", "🍋", "🍇", "🔔", "⭐", "💎", "7️⃣"];

// Bobot per tier — makin mahal taruhan, simbol langka makin sering muncul (sedikit)
const WEIGHTS_BY_TIER: Record<string, number[]> = {
  hemat:  [32, 26, 20, 13, 6, 2, 1],
  sedang: [28, 24, 20, 14, 8, 4, 2],
  besar:  [25, 22, 19, 15, 10, 6, 3],
};

type Tier = "hemat" | "sedang" | "besar";

const TIER_COSTS: Record<Tier, number> = { hemat: 1, sedang: 5, besar: 10 };

function spinReel(tier: Tier) {
  const weights = WEIGHTS_BY_TIER[tier];
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[0];
}

// Payout dipisah per tier sesuai permintaan user
function calculatePayout(tier: Tier, reels: string[]) {
  const same3 = reels[0] === reels[1] && reels[1] === reels[2];
  const sym = reels[0];

  if (tier === "hemat") {
    // 1 kredit → jackpot saldo 1k, 500, 100, 10/5/2 kredit, zonk
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 1000, label: "JACKPOT! Saldo Game Rp 1.000" };
      if (sym === "💎") return { type: "game_balance", value: 500, label: "Saldo Game Rp 500" };
      if (sym === "⭐") return { type: "game_balance", value: 100, label: "Saldo Game Rp 100" };
      if (sym === "🔔") return { type: "game_credits", value: 10, label: "10 Credits" };
      if (sym === "🍇") return { type: "game_credits", value: 5, label: "5 Credits" };
      if (sym === "🍋") return { type: "game_credits", value: 2, label: "2 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 2, label: "2 Credits" };
    }
    // 2 cherry → 1 kredit kecil
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 1, label: "1 Credit" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  if (tier === "sedang") {
    // 5 kredit → utama saldo 2k, 1k, 500, 10 kredit + bonus storage/nyawa
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 2000, label: "JACKPOT! Saldo Game Rp 2.000" };
      if (sym === "💎") return { type: "game_balance", value: 1000, label: "Saldo Game Rp 1.000" };
      if (sym === "⭐") return { type: "game_balance", value: 500, label: "Saldo Game Rp 500" };
      if (sym === "🔔") return { type: "storage_mb", value: 50, label: "+50 MB Storage Musik" };
      if (sym === "🍇") return { type: "extra_life", value: 1, label: "+1 Nyawa Power-Up" };
      if (sym === "🍋") return { type: "game_credits", value: 10, label: "10 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 5, label: "5 Credits" };
    }
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 3, label: "3 Credits" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  // tier === "besar" → 10 kredit
  if (same3) {
    if (sym === "7️⃣") return { type: "game_balance", value: 5000, label: "MEGA JACKPOT! Saldo Game Rp 5.000" };
    if (sym === "💎") return { type: "game_balance", value: 2000, label: "Saldo Game Rp 2.000" };
    if (sym === "⭐") return { type: "game_balance", value: 2000, label: "Saldo Game Rp 2.000" };
    if (sym === "🔔") return { type: "storage_mb", value: 100, label: "+100 MB Storage Musik" };
    if (sym === "🍇") return { type: "extra_life", value: 2, label: "+2 Nyawa Power-Up" };
    if (sym === "🍋") return { type: "game_credits", value: 25, label: "25 Credits" };
    if (sym === "🍒") return { type: "game_credits", value: 15, label: "15 Credits" };
  }
  const cherries = reels.filter(r => r === "🍒").length;
  if (cherries === 2) return { type: "game_credits", value: 5, label: "5 Credits" };
  return { type: "none", value: 0, label: "Zonk! Coba lagi" };
}

async function applyPayout(visitorId: string, payout: { type: string; value: number; label: string }) {
  if (payout.type === "none") return;

  if (payout.type === "game_balance") {
    // upsert game_balance
    const { data: gb } = await supabase.from("game_balance").select("id, amount, total_earned").eq("visitor_id", visitorId).maybeSingle();
    if (gb) {
      await supabase.from("game_balance")
        .update({ amount: (gb.amount || 0) + payout.value, total_earned: (gb.total_earned || 0) + payout.value })
        .eq("id", gb.id);
    } else {
      await supabase.from("game_balance").insert({
        visitor_id: visitorId, amount: payout.value, total_earned: payout.value,
      });
    }
    await supabase.from("game_balance_transactions").insert({
      visitor_id: visitorId, amount: payout.value, type: "slot_win", description: `Slot Machine: ${payout.label}`,
    });
  } else if (payout.type === "game_credits") {
    const { data: gc } = await supabase.from("user_game_credits").select("id, credits").eq("visitor_id", visitorId).maybeSingle();
    if (gc) {
      await supabase.from("user_game_credits").update({ credits: (gc.credits || 0) + payout.value }).eq("id", gc.id);
    } else {
      await supabase.from("user_game_credits").insert({ visitor_id: visitorId, credits: payout.value });
    }
  } else if (payout.type === "storage_mb") {
    const { data: ms } = await supabase.from("user_music_storage").select("id, storage_mb").eq("visitor_id", visitorId).maybeSingle();
    if (ms) {
      await supabase.from("user_music_storage").update({ storage_mb: (ms.storage_mb || 0) + payout.value }).eq("id", ms.id);
    } else {
      const dummyVoucher = "SLOT-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      await supabase.from("user_music_storage").insert({ visitor_id: visitorId, storage_mb: payout.value, voucher_code: dummyVoucher });
    }
  } else if (payout.type === "extra_life") {
    const { data: pu } = await supabase.from("user_power_ups").select("id, extra_life").eq("visitor_id", visitorId).maybeSingle();
    if (pu) {
      await supabase.from("user_power_ups").update({ extra_life: (pu.extra_life || 0) + payout.value }).eq("id", pu.id);
    } else {
      await supabase.from("user_power_ups").insert({ visitor_id: visitorId, extra_life: payout.value });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { visitorId, tier: rawTier } = await req.json();
    const tier: Tier = (["hemat", "sedang", "besar"].includes(rawTier) ? rawTier : "hemat") as Tier;
    if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 400, headers: corsHeaders });

    const reels = [spinReel(tier), spinReel(tier), spinReel(tier)];
    const payout = calculatePayout(tier, reels);
    await applyPayout(visitorId, payout);

    const { data } = await supabase.from("slot_machine_history").insert({
      visitor_id: visitorId,
      reels,
      payout_type: payout.type,
      payout_value: payout.value,
      payout_label: payout.label,
      cost_credits: TIER_COSTS[tier],
    }).select().single();

    return new Response(JSON.stringify({ success: true, reels, payout, tier, cost: TIER_COSTS[tier], record: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
