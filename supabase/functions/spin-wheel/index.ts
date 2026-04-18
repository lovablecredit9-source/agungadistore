import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPIN_COST = 50;

// Weighted prizes
const PRIZES = [
  { type: "coins", value: 10, label: "+10 Koin", rarity: "common", weight: 30, color: "#94a3b8" },
  { type: "coins", value: 25, label: "+25 Koin", rarity: "common", weight: 22, color: "#64748b" },
  { type: "coins", value: 75, label: "+75 Koin", rarity: "rare", weight: 15, color: "#06b6d4" },
  { type: "coins", value: 150, label: "+150 Koin", rarity: "rare", weight: 10, color: "#0ea5e9" },
  { type: "freeze", value: 1, label: "+1 Streak Freeze", rarity: "rare", weight: 8, color: "#10b981" },
  { type: "coins", value: 300, label: "+300 Koin", rarity: "epic", weight: 7, color: "#a855f7" },
  { type: "freeze", value: 2, label: "+2 Streak Freeze", rarity: "epic", weight: 5, color: "#ec4899" },
  { type: "coins", value: 1000, label: "🎰 JACKPOT! +1000 Koin", rarity: "legendary", weight: 2, color: "#fbbf24" },
  { type: "coins", value: 0, label: "Coba Lagi Besok 😅", rarity: "common", weight: 1, color: "#475569" },
];

function pickPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PRIZES.length; i++) {
    r -= PRIZES[i].weight;
    if (r <= 0) return { ...PRIZES[i], index: i };
  }
  return { ...PRIZES[0], index: 0 };
}

function getToday() {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  return wib.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, action } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = getToday();

    if (action === "check") {
      const { data: spins } = await admin
        .from("spin_wheel_history")
        .select("id, reward_label, rarity, reward_type, reward_value, created_at")
        .eq("visitor_id", visitorId)
        .eq("spin_date", today)
        .order("created_at", { ascending: false })
        .limit(1);
      return Response.json({
        spinsToday: spins?.length || 0,
        lastSpin: spins?.[0] || null,
        prizes: PRIZES,
        cost: SPIN_COST,
      }, { headers: corsHeaders });
    }

    // Spin action
    const { data: existing } = await admin
      .from("spin_wheel_history")
      .select("id")
      .eq("visitor_id", visitorId)
      .eq("spin_date", today)
      .limit(1);
    if (existing && existing.length > 0) {
      return Response.json({ error: "Hari ini sudah spin. Kembali besok!" }, { status: 400, headers: corsHeaders });
    }

    const { data: streak } = await admin
      .from("daily_streaks")
      .select("id, streak_coins, freeze_count")
      .eq("visitor_id", visitorId)
      .maybeSingle();
    if (!streak) return Response.json({ error: "Mulai streak harian dulu!" }, { status: 400, headers: corsHeaders });
    if ((streak.streak_coins || 0) < SPIN_COST) {
      return Response.json({ error: `Butuh ${SPIN_COST} koin untuk spin (kamu punya ${streak.streak_coins || 0})` }, { status: 400, headers: corsHeaders });
    }

    const prize = pickPrize();

    // Deduct cost & apply reward
    let newCoins = (streak.streak_coins || 0) - SPIN_COST;
    let newFreeze = streak.freeze_count || 0;
    if (prize.type === "coins") newCoins += prize.value;
    if (prize.type === "freeze") newFreeze += prize.value;

    await admin.from("daily_streaks").update({ streak_coins: newCoins, freeze_count: newFreeze }).eq("id", streak.id);

    await admin.from("spin_wheel_history").insert({
      visitor_id: visitorId,
      spin_date: today,
      reward_type: prize.type,
      reward_value: prize.value,
      reward_label: prize.label,
      rarity: prize.rarity,
      cost_coins: SPIN_COST,
    });

    await admin.from("notifications").insert({
      visitor_id: visitorId,
      title: `🎰 Spin Wheel: ${prize.label}`,
      message: `Sisa koin: ${newCoins}`,
      type: "spin_wheel",
    });

    return Response.json({
      success: true,
      prize,
      prizeIndex: prize.index,
      newCoins,
      newFreeze,
      prizes: PRIZES,
    }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
