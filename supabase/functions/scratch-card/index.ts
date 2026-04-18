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

// Weighted reward pool (100% sum)
const REWARDS = [
  { type: "balance", value: 500, label: "Saldo Rp 500", rarity: "common", weight: 30 },
  { type: "balance", value: 1000, label: "Saldo Rp 1.000", rarity: "common", weight: 20 },
  { type: "gems", value: 5, label: "5 Gems", rarity: "common", weight: 15 },
  { type: "streak_coins", value: 10, label: "10 Streak Coins", rarity: "common", weight: 12 },
  { type: "game_credits", value: 3, label: "3 Game Credits", rarity: "rare", weight: 10 },
  { type: "voucher", value: 2000, label: "Voucher Rp 2.000", rarity: "rare", weight: 8 },
  { type: "balance", value: 5000, label: "Saldo Rp 5.000", rarity: "epic", weight: 4 },
  { type: "voucher", value: 10000, label: "Voucher Rp 10.000", rarity: "legendary", weight: 1 },
];

function pickReward() {
  const total = REWARDS.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of REWARDS) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return REWARDS[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, visitorId } = await req.json();
    if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 400, headers: corsHeaders });

    const today = new Date().toISOString().split("T")[0];

    if (action === "status") {
      const { data } = await supabase
        .from("scratch_card_claims")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("claim_date", today)
        .maybeSingle();
      return new Response(JSON.stringify({ claimed: !!data, today: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "claim") {
      // Re-check
      const { data: existing } = await supabase
        .from("scratch_card_claims")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("claim_date", today)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Sudah klaim hari ini" }), { status: 400, headers: corsHeaders });
      }

      const reward = pickReward();
      let voucherCode: string | null = null;

      if (reward.type === "voucher") {
        voucherCode = genVoucher();
        await supabase.from("game_discount_vouchers").insert({
          code: voucherCode,
          discount_amount: reward.value,
          max_uses: 1,
          is_active: true,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      } else if (reward.type === "balance") {
        await supabase.from("balance_transactions").insert({
          visitor_id: visitorId,
          amount: reward.value,
          type: "scratch_card",
          description: `Hadiah Scratch Card: ${reward.label}`,
        });
      } else if (reward.type === "gems") {
        await supabase.rpc("create_notification", {
          p_visitor_id: visitorId,
          p_title: "🎁 Scratch Card",
          p_message: `Kamu dapat ${reward.label}!`,
          p_type: "reward",
        });
        // game_profiles.gems update
        const { data: prof } = await supabase.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
        if (prof) {
          await supabase.from("game_profiles").update({ gems: (prof.gems || 0) + reward.value }).eq("id", prof.id);
        }
        await supabase.from("gem_transactions").insert({
          visitor_id: visitorId,
          amount: reward.value,
          type: "scratch_reward",
          description: reward.label,
        });
      } else if (reward.type === "streak_coins") {
        const { data: streak } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (streak) {
          await supabase.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + reward.value }).eq("id", streak.id);
        }
      }

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

      return new Response(JSON.stringify({ success: true, reward: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
