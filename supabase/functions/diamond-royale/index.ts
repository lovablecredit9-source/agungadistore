import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SINGLE_COST = 30;     // gems per single spin
const MULTI_COST = 270;     // 10 spin: bonus 10% (vs 300)
const PITY_HARD = 80;       // tiap 80 spin -> jaminan legendary
const PITY_RARE = 10;       // tiap 10 spin tanpa rare+ -> jaminan rare+

type Rarity = "common" | "rare" | "epic" | "legendary";
type Prize = {
  kind: "gems" | "coins" | "freeze" | "title" | "skin";
  label: string;
  value: number;
  rarity: Rarity;
  weight: number;
  color: string;
};

const PRIZES: Prize[] = [
  { kind: "coins", label: "+500 Koin", value: 500, rarity: "common", weight: 30, color: "#94a3b8" },
  { kind: "coins", label: "+1.500 Koin", value: 1500, rarity: "common", weight: 22, color: "#64748b" },
  { kind: "coins", label: "+5.000 Koin", value: 5000, rarity: "rare", weight: 14, color: "#06b6d4" },
  { kind: "freeze", label: "+5 Streak Freeze", value: 5, rarity: "rare", weight: 10, color: "#10b981" },
  { kind: "gems", label: "+150 Gems", value: 150, rarity: "epic", weight: 8, color: "#a855f7" },
  { kind: "coins", label: "+15.000 Koin", value: 15000, rarity: "epic", weight: 6, color: "#ec4899" },
  { kind: "freeze", label: "+15 Streak Freeze", value: 15, rarity: "epic", weight: 4, color: "#f472b6" },
  { kind: "title", label: "👑 Title: Diamond Lord", value: 1, rarity: "legendary", weight: 2.5, color: "#fde047" },
  { kind: "gems", label: "🌟 +750 Gems MEGA JACKPOT", value: 750, rarity: "legendary", weight: 2, color: "#fbbf24" },
  { kind: "skin", label: "💎 Skin Avatar Mythic", value: 1, rarity: "legendary", weight: 1, color: "#fde047" },
  { kind: "coins", label: "🎰 +50.000 Koin GRAND PRIZE", value: 50000, rarity: "legendary", weight: 0.5, color: "#fde047" },
];

function pickWeighted(pool: Prize[]): Prize {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return pool[0];
}

function rollPrize(pityHard: number, pityRare: number): { prize: Prize; pityBreak: boolean } {
  if (pityHard >= PITY_HARD - 1) {
    return { prize: pickWeighted(PRIZES.filter(p => p.rarity === "legendary")), pityBreak: true };
  }
  if (pityRare >= PITY_RARE - 1) {
    return { prize: pickWeighted(PRIZES.filter(p => ["rare", "epic", "legendary"].includes(p.rarity))), pityBreak: true };
  }
  return { prize: pickWeighted(PRIZES), pityBreak: false };
}

async function applyPrize(admin: any, visitorId: string, prize: Prize) {
  if (prize.kind === "gems") {
    await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: prize.value });
  } else if (prize.kind === "coins") {
    const { data: streak } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
    if (streak) {
      await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + prize.value }).eq("id", streak.id);
    } else {
      await admin.from("daily_streaks").insert({ visitor_id: visitorId, streak_coins: prize.value, last_claim_date: new Date().toISOString().split("T")[0] });
    }
  } else if (prize.kind === "freeze") {
    const { data: streak } = await admin.from("daily_streaks").select("id, freeze_count").eq("visitor_id", visitorId).maybeSingle();
    if (streak) {
      await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + prize.value }).eq("id", streak.id);
    } else {
      await admin.from("daily_streaks").insert({ visitor_id: visitorId, freeze_count: prize.value, last_claim_date: new Date().toISOString().split("T")[0] });
    }
  }
  // title/skin: hanya catat di history (bisa dipakai untuk showcase)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, action, spinType } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Ensure state row
    let { data: state } = await admin.from("diamond_royale_state").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (!state) {
      const { data: created } = await admin.from("diamond_royale_state").insert({ visitor_id: visitorId }).select("*").single();
      state = created;
    }

    if (action === "check") {
      const { data: history } = await admin
        .from("diamond_royale_history").select("id, reward_label, rarity, reward_kind, reward_value, spin_type, is_pity_break, created_at")
        .eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(15);
      const { data: gems } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({
        state, history: history || [], prizes: PRIZES, gems: gems || 0,
        cost: { single: SINGLE_COST, multi: MULTI_COST }, pity: { hard: PITY_HARD, rare: PITY_RARE },
      }, { headers: corsHeaders });
    }

    // Spin action
    const count = spinType === "multi" ? 10 : 1;
    const cost = spinType === "multi" ? MULTI_COST : SINGLE_COST;

    const { data: gemsBefore } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
    if ((gemsBefore || 0) < cost) {
      return Response.json({ error: `Butuh ${cost} Gems (kamu punya ${gemsBefore || 0})` }, { status: 400, headers: corsHeaders });
    }

    // Deduct gems
    await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -cost });

    let pityHard = state.pity_counter || 0;
    let pityRare = state.rare_pity_counter || 0;
    let totalSpins = state.total_spins || 0;
    let totalLeg = state.total_legendary || 0;
    const results: any[] = [];

    for (let i = 0; i < count; i++) {
      const { prize, pityBreak } = rollPrize(pityHard, pityRare);
      await applyPrize(admin, visitorId, prize);
      pityHard = prize.rarity === "legendary" ? 0 : pityHard + 1;
      pityRare = ["rare", "epic", "legendary"].includes(prize.rarity) ? 0 : pityRare + 1;
      totalSpins += 1;
      if (prize.rarity === "legendary") totalLeg += 1;

      await admin.from("diamond_royale_history").insert({
        visitor_id: visitorId, spin_type: spinType || "single",
        cost_gems: i === 0 ? cost : 0,
        reward_kind: prize.kind, reward_label: prize.label, reward_value: prize.value,
        rarity: prize.rarity, is_pity_break: pityBreak,
      });
      results.push({ ...prize, pityBreak });
    }

    await admin.from("diamond_royale_state").update({
      pity_counter: pityHard, rare_pity_counter: pityRare,
      total_spins: totalSpins, total_legendary: totalLeg,
    }).eq("visitor_id", visitorId);

    const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });

    const summary = results.map(r => r.label).join(", ");
    await admin.from("notifications").insert({
      visitor_id: visitorId,
      title: `💎 Diamond Royale (${count}x)`,
      message: summary.length > 200 ? summary.slice(0, 200) + "..." : summary,
      type: "diamond_royale",
    });

    return Response.json({
      success: true, results,
      gemsAfter: gemsAfter || 0,
      state: { pity_counter: pityHard, rare_pity_counter: pityRare, total_spins: totalSpins, total_legendary: totalLeg },
    }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
