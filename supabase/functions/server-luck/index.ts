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

// Server Luck tier catalog — wajib beli berurutan (x2 → x6 → x8 → x10 → x20)
export const LUCK_TIERS = [
  { tier: 2,  name: "x2 Lumayan",      tagline: "Sedikit lebih hoki",
    durations: [
      { hours: 2,  price: 2000 },
      { hours: 6,  price: 5000 },
      { hours: 10, price: 8000 },
    ] },
  { tier: 6,  name: "x6 Mantap",       tagline: "Hoki naik signifikan",
    durations: [
      { hours: 2,  price: 12000 },
      { hours: 6,  price: 25000 },
      { hours: 10, price: 38000 },
    ] },
  { tier: 8,  name: "x8 Mantap+",      tagline: "Lebih sering jackpot",
    durations: [
      { hours: 2,  price: 20000 },
      { hours: 6,  price: 45000 },
      { hours: 10, price: 70000 },
    ] },
  { tier: 10, name: "x10 Luar Biasa",  tagline: "Hoki ekstrim",
    durations: [
      { hours: 2,  price: 35000 },
      { hours: 6,  price: 80000 },
      { hours: 10, price: 125000 },
    ] },
  { tier: 20, name: "x20 Plus Ultra",  tagline: "Semalam super hoki",
    durations: [
      { hours: 6,  price: 200000 },
      { hours: 10, price: 350000 },
    ] },
];

async function getOrCreateBooster(visitorId: string) {
  let { data } = await supabase.from("server_luck_boosters").select("*").eq("visitor_id", visitorId).maybeSingle();
  if (!data) {
    const { data: created } = await supabase.from("server_luck_boosters").insert({ visitor_id: visitorId }).select().single();
    data = created;
  }
  // expire if past — RESET highest_tier_owned ke 1 supaya wajib mulai dari x2 lagi
  if (data && data.active_until && new Date(data.active_until).getTime() < Date.now() && data.active_tier > 1) {
    const { data: updated } = await supabase.from("server_luck_boosters")
      .update({ active_tier: 1, active_until: null, highest_tier_owned: 1 }).eq("id", data.id).select().single();
    data = updated;
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
      const booster = await getOrCreateBooster(visitorId);
      return new Response(JSON.stringify({ booster, tiers: LUCK_TIERS }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "buy") {
      const { tier, hours, paymentSource = "auto" } = body;
      const tierDef = LUCK_TIERS.find(t => t.tier === tier);
      if (!tierDef) return new Response(JSON.stringify({ error: "Tier tidak valid" }), { status: 400, headers: corsHeaders });
      const durDef = tierDef.durations.find(d => d.hours === hours);
      if (!durDef) return new Response(JSON.stringify({ error: "Durasi tidak valid" }), { status: 400, headers: corsHeaders });

      const booster = await getOrCreateBooster(visitorId);

      // Wajib unlock berurutan: tier > highest_tier_owned + 1 lompatan tidak diizinkan
      const tierOrder = LUCK_TIERS.map(t => t.tier);
      const currentIdx = tierOrder.indexOf(booster.highest_tier_owned);
      const targetIdx = tierOrder.indexOf(tier);
      if (targetIdx > currentIdx + 1) {
        const required = LUCK_TIERS[currentIdx + 1];
        return new Response(JSON.stringify({
          error: `Wajib beli ${required.name} dulu sebelum upgrade ke ${tierDef.name}`,
        }), { status: 400, headers: corsHeaders });
      }

      // Saat booster masih aktif: tidak boleh beli tier LEBIH RENDAH dari yang sedang aktif
      const stillActive = booster.active_until && new Date(booster.active_until).getTime() > Date.now();
      if (stillActive && tier < booster.active_tier) {
        return new Response(JSON.stringify({
          error: `Booster x${booster.active_tier} masih aktif. Tidak bisa downgrade ke ${tierDef.name}. Tunggu habis atau beli tier lebih tinggi.`,
        }), { status: 400, headers: corsHeaders });
      }

      // Bayar: ambil dari Saldo IN (game_balance) dulu jika auto, lalu Saldo Utama
      const price = durDef.price;
      const { data: gb } = await supabase.from("game_balance").select("id, amount, total_spent").eq("visitor_id", visitorId).maybeSingle();
      const { data: ub } = await supabase.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
      const gameAmt = gb?.amount || 0;
      const mainAmt = ub?.balance || 0;

      // Saldo IN (game_balance) hanya untuk produk toko. Server Luck wajib Saldo Utama.
      let payFromGame = 0, payFromMain = 0;
      if (mainAmt < price) return new Response(JSON.stringify({ error: "Saldo Utama tidak cukup. Saldo IN tidak bisa dipakai untuk fitur ini." }), { status: 400, headers: corsHeaders });
      payFromMain = price;

      if (payFromGame > 0 && gb) {
        await supabase.from("game_balance").update({
          amount: gameAmt - payFromGame,
          total_spent: (gb.total_spent || 0) + payFromGame,
        }).eq("id", gb.id);
        await supabase.from("game_balance_transactions").insert({
          visitor_id: visitorId, amount: -payFromGame, type: "luck_buy",
          description: `Server Luck ${tierDef.name} ${hours}j`,
        });
      }
      if (payFromMain > 0 && ub) {
        await supabase.from("user_balances").update({ balance: mainAmt - payFromMain }).eq("id", ub.id);
        await supabase.from("balance_transactions").insert({
          visitor_id: visitorId, amount: -payFromMain, type: "luck_buy",
          description: `Server Luck ${tierDef.name} ${hours}j`,
        });
      }

      // Stack: jika tier sama & masih aktif, tambahkan durasi. Jika upgrade tier, reset waktu.
      const now = Date.now();
      const currentExpire = booster.active_until ? new Date(booster.active_until).getTime() : 0;
      const baseTime = (booster.active_tier === tier && currentExpire > now) ? currentExpire : now;
      const newExpire = new Date(baseTime + hours * 3600 * 1000).toISOString();

      const { data: updated } = await supabase.from("server_luck_boosters").update({
        active_tier: tier,
        active_until: newExpire,
        highest_tier_owned: Math.max(booster.highest_tier_owned, tier),
        total_purchases: booster.total_purchases + 1,
        total_spent: booster.total_spent + price,
      }).eq("id", booster.id).select().single();

      await supabase.from("server_luck_history").insert({
        visitor_id: visitorId, tier, duration_hours: hours, price, payment_source: paymentSource,
      });

      return new Response(JSON.stringify({ success: true, booster: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
