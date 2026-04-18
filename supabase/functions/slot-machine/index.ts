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
const WEIGHTS = [30, 25, 20, 15, 6, 3, 1];

function spinReel() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    roll -= WEIGHTS[i];
    if (roll <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[0];
}

function genVoucher() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 16 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

function calculatePayout(reels: string[]) {
  // Three of a kind
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    const sym = reels[0];
    if (sym === "7️⃣") return { type: "voucher", value: 25000, label: "JACKPOT! Voucher Rp 25.000" };
    if (sym === "💎") return { type: "balance", value: 10000, label: "Saldo Rp 10.000" };
    if (sym === "⭐") return { type: "gems", value: 50, label: "50 Gems" };
    if (sym === "🔔") return { type: "balance", value: 3000, label: "Saldo Rp 3.000" };
    if (sym === "🍇") return { type: "streak_coins", value: 30, label: "30 Coins" };
    if (sym === "🍋") return { type: "game_credits", value: 5, label: "5 Credits" };
    if (sym === "🍒") return { type: "game_credits", value: 3, label: "3 Credits" };
  }
  // Two cherries
  const cherries = reels.filter(r => r === "🍒").length;
  if (cherries === 2) return { type: "game_credits", value: 1, label: "1 Credit" };
  return { type: "none", value: 0, label: "Coba lagi!" };
}

async function applyPayout(visitorId: string, payout: { type: string; value: number; label: string }) {
  let voucherCode: string | null = null;
  if (payout.type === "none") return null;

  if (payout.type === "voucher") {
    voucherCode = genVoucher();
    await supabase.from("game_discount_vouchers").insert({
      code: voucherCode, discount_amount: payout.value, max_uses: 1, is_active: true,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
  } else if (payout.type === "balance") {
    await supabase.from("balance_transactions").insert({
      visitor_id: visitorId, amount: payout.value, type: "slot_win", description: `Slot Machine: ${payout.label}`,
    });
  } else if (payout.type === "gems") {
    const { data: prof } = await supabase.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
    if (prof) await supabase.from("game_profiles").update({ gems: (prof.gems || 0) + payout.value }).eq("id", prof.id);
    await supabase.from("gem_transactions").insert({ visitor_id: visitorId, amount: payout.value, type: "slot_win", description: payout.label });
  } else if (payout.type === "streak_coins") {
    const { data: s } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
    if (s) await supabase.from("daily_streaks").update({ streak_coins: (s.streak_coins || 0) + payout.value }).eq("id", s.id);
  }
  return voucherCode;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { visitorId } = await req.json();
    if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 400, headers: corsHeaders });

    const reels = [spinReel(), spinReel(), spinReel()];
    const payout = calculatePayout(reels);
    const voucherCode = await applyPayout(visitorId, payout);

    const { data } = await supabase.from("slot_machine_history").insert({
      visitor_id: visitorId,
      reels,
      payout_type: payout.type,
      payout_value: payout.value,
      payout_label: payout.label,
      cost_credits: 1,
      voucher_code: voucherCode,
    }).select().single();

    return new Response(JSON.stringify({ success: true, reels, payout, record: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
