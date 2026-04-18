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

const PRIZES = [
  { type: "balance", value: 500, label: "Saldo Rp 500", rarity: "common", weight: 28 },
  { type: "balance", value: 1500, label: "Saldo Rp 1.500", rarity: "common", weight: 22 },
  { type: "gems", value: 10, label: "10 Gems", rarity: "common", weight: 18 },
  { type: "streak_coins", value: 20, label: "20 Coins", rarity: "common", weight: 12 },
  { type: "game_credits", value: 5, label: "5 Game Credits", rarity: "rare", weight: 10 },
  { type: "voucher", value: 5000, label: "Voucher Rp 5.000", rarity: "rare", weight: 6 },
  { type: "balance", value: 10000, label: "Saldo Rp 10.000", rarity: "epic", weight: 3 },
  { type: "voucher", value: 25000, label: "Voucher Rp 25.000", rarity: "legendary", weight: 1 },
];

function pickPrize() {
  const total = PRIZES.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of PRIZES) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return PRIZES[0];
}

async function getOrCreateTickets(visitorId: string) {
  let { data } = await supabase.from("lucky_draw_tickets").select("*").eq("visitor_id", visitorId).maybeSingle();
  if (!data) {
    const { data: created } = await supabase.from("lucky_draw_tickets").insert({ visitor_id: visitorId }).select().single();
    data = created;
  }
  return data!;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, visitorId } = body;
    if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 400, headers: corsHeaders });

    if (action === "status") {
      const tickets = await getOrCreateTickets(visitorId);
      return new Response(JSON.stringify({ tickets }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "buy") {
      const { packageId } = body;
      const { data: pkg } = await supabase.from("lucky_draw_ticket_packages").select("*").eq("id", packageId).eq("is_active", true).maybeSingle();
      if (!pkg) return new Response(JSON.stringify({ error: "Paket tidak ditemukan" }), { status: 404, headers: corsHeaders });

      // Deduct currency
      if (pkg.cost_currency === "gems") {
        const { data: prof } = await supabase.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
        if (!prof || (prof.gems || 0) < pkg.cost_amount) {
          return new Response(JSON.stringify({ error: "Gems tidak cukup" }), { status: 400, headers: corsHeaders });
        }
        await supabase.from("game_profiles").update({ gems: prof.gems - pkg.cost_amount }).eq("id", prof.id);
        await supabase.from("gem_transactions").insert({
          visitor_id: visitorId, amount: -pkg.cost_amount, type: "lucky_draw_buy",
          description: `Beli ${pkg.tickets} tiket Lucky Draw`,
        });
      } else {
        const { data: s } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (!s || (s.streak_coins || 0) < pkg.cost_amount) {
          return new Response(JSON.stringify({ error: "Coins tidak cukup" }), { status: 400, headers: corsHeaders });
        }
        await supabase.from("daily_streaks").update({ streak_coins: s.streak_coins - pkg.cost_amount }).eq("id", s.id);
      }

      const tickets = await getOrCreateTickets(visitorId);
      const { data: updated } = await supabase.from("lucky_draw_tickets").update({
        ticket_count: tickets.ticket_count + pkg.tickets,
        total_purchased: tickets.total_purchased + pkg.tickets,
      }).eq("id", tickets.id).select().single();

      return new Response(JSON.stringify({ success: true, tickets: updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "draw") {
      const tickets = await getOrCreateTickets(visitorId);
      if ((tickets.ticket_count || 0) < 1) {
        return new Response(JSON.stringify({ error: "Tidak punya tiket" }), { status: 400, headers: corsHeaders });
      }

      const prize = pickPrize();
      let voucherCode: string | null = null;

      if (prize.type === "voucher") {
        voucherCode = genVoucher();
        await supabase.from("game_discount_vouchers").insert({
          code: voucherCode, discount_amount: prize.value, max_uses: 1, is_active: true,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      } else if (prize.type === "balance") {
        await supabase.from("balance_transactions").insert({
          visitor_id: visitorId, amount: prize.value, type: "lucky_draw_win", description: prize.label,
        });
      } else if (prize.type === "gems") {
        const { data: p } = await supabase.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
        if (p) await supabase.from("game_profiles").update({ gems: (p.gems || 0) + prize.value }).eq("id", p.id);
        await supabase.from("gem_transactions").insert({ visitor_id: visitorId, amount: prize.value, type: "lucky_draw_win", description: prize.label });
      } else if (prize.type === "streak_coins") {
        const { data: s } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (s) await supabase.from("daily_streaks").update({ streak_coins: (s.streak_coins || 0) + prize.value }).eq("id", s.id);
      }

      await supabase.from("lucky_draw_tickets").update({
        ticket_count: tickets.ticket_count - 1,
        total_used: tickets.total_used + 1,
      }).eq("id", tickets.id);

      const { data: hist } = await supabase.from("lucky_draw_history").insert({
        visitor_id: visitorId,
        reward_type: prize.type, reward_value: prize.value, reward_label: prize.label, rarity: prize.rarity,
        voucher_code: voucherCode,
      }).select().single();

      return new Response(JSON.stringify({ success: true, prize: hist }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
