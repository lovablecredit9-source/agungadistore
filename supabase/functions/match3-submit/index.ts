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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { visitorId, score, moves, comboMax } = await req.json();
    if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 400, headers: corsHeaders });

    let payout: { type: string; value: number; label: string } = { type: "none", value: 0, label: "Belum dapat hadiah" };
    let voucherCode: string | null = null;

    if (score >= 5000) {
      payout = { type: "voucher", value: 15000, label: "Voucher Rp 15.000" };
      voucherCode = genVoucher();
      await supabase.from("game_discount_vouchers").insert({
        code: voucherCode, discount_amount: 15000, max_uses: 1, is_active: true,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
    } else if (score >= 2500) {
      payout = { type: "balance", value: 3000, label: "Saldo Rp 3.000" };
      await supabase.from("balance_transactions").insert({
        visitor_id: visitorId, amount: 3000, type: "match3_win", description: payout.label,
      });
    } else if (score >= 1000) {
      payout = { type: "gems", value: 15, label: "15 Gems" };
      const { data: prof } = await supabase.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
      if (prof) await supabase.from("game_profiles").update({ gems: (prof.gems || 0) + 15 }).eq("id", prof.id);
      await supabase.from("gem_transactions").insert({ visitor_id: visitorId, amount: 15, type: "match3_win", description: payout.label });
    } else if (score >= 300) {
      payout = { type: "streak_coins", value: 10, label: "10 Coins" };
      const { data: s } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
      if (s) await supabase.from("daily_streaks").update({ streak_coins: (s.streak_coins || 0) + 10 }).eq("id", s.id);
    }

    const { data } = await supabase.from("match3_scores").insert({
      visitor_id: visitorId, score, moves, combo_max: comboMax,
      payout_type: payout.type, payout_value: payout.value, payout_label: payout.label,
      voucher_code: voucherCode,
    }).select().single();

    return new Response(JSON.stringify({ success: true, payout, record: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
