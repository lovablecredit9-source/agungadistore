import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mata uang spin
const SINGLE_COST_GEMS = 50;       // 1 spin = 50 gem
const BUNDLE_COST_DIAMOND = 200;   // 5 spin = 200 diamond (lebih hemat dari 5x50)

// Hadiah bobot — fokus 3 item utama: extra_life, auto_hint, time_freeze, streak_freeze
type Prize = {
  kind: "extra_life" | "auto_hint" | "time_freeze" | "streak_freeze" | "gems" | "coins";
  value: number;
  label: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  weight: number;
  color: string;
};

const PRIZES: Prize[] = [
  // Common (60%)
  { kind: "auto_hint",   value: 1, label: "+1 Hint Otomatis",   emoji: "💡", rarity: "common",    weight: 22, color: "#94a3b8" },
  { kind: "extra_life",  value: 1, label: "+1 Nyawa Ekstra",     emoji: "❤️", rarity: "common",    weight: 20, color: "#ef4444" },
  { kind: "time_freeze", value: 1, label: "+1 Time Freeze 30s",  emoji: "⏱️", rarity: "common",    weight: 18, color: "#0ea5e9" },
  // Rare (28%)
  { kind: "streak_freeze", value: 1, label: "+1 Streak Freeze",  emoji: "🛡️", rarity: "rare",     weight: 14, color: "#10b981" },
  { kind: "auto_hint",   value: 3, label: "+3 Hint Otomatis",    emoji: "💡", rarity: "rare",      weight: 8,  color: "#06b6d4" },
  { kind: "extra_life",  value: 3, label: "+3 Nyawa Ekstra",     emoji: "❤️", rarity: "rare",      weight: 6,  color: "#f43f5e" },
  // Epic (10%)
  { kind: "time_freeze", value: 5, label: "+5 Time Freeze",      emoji: "⏱️", rarity: "epic",     weight: 5,  color: "#a855f7" },
  { kind: "streak_freeze", value: 2, label: "+2 Streak Freeze",  emoji: "🛡️", rarity: "epic",     weight: 3,  color: "#ec4899" },
  { kind: "gems",        value: 100, label: "+100 Gem",          emoji: "💎", rarity: "epic",      weight: 2,  color: "#8b5cf6" },
  // Legendary (2%)
  { kind: "extra_life",  value: 10, label: "🎰 JACKPOT +10 Nyawa", emoji: "👑", rarity: "legendary", weight: 1,  color: "#fbbf24" },
  { kind: "streak_freeze", value: 5, label: "🎰 LEGENDARY +5 Freeze", emoji: "👑", rarity: "legendary", weight: 1,  color: "#f59e0b" },
];

function pickPrize(): Prize & { index: number } {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PRIZES.length; i++) {
    r -= PRIZES[i].weight;
    if (r <= 0) return { ...PRIZES[i], index: i };
  }
  return { ...PRIZES[0], index: 0 };
}

async function applyPrize(admin: any, visitorId: string, p: Prize) {
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
    const { visitorId, action } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "check") {
      const { data: history } = await admin
        .from("luck_royale_nyawa_history")
        .select("id, reward_label, rarity, reward_kind, reward_value, spin_type, created_at")
        .eq("visitor_id", visitorId)
        .order("created_at", { ascending: false })
        .limit(20);
      const { data: gemsData } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({
        history: history || [],
        gems: gemsData || 0,
        prizes: PRIZES,
        singleCostGems: SINGLE_COST_GEMS,
        bundleCostDiamond: BUNDLE_COST_DIAMOND,
      }, { headers: corsHeaders });
    }

    if (action === "spin_single" || action === "spin_bundle") {
      const isBundle = action === "spin_bundle";
      const cost = isBundle ? BUNDLE_COST_DIAMOND : SINGLE_COST_GEMS;
      const currency = isBundle ? "diamond" : "gems";

      // Cek saldo gem (kita pakai 1 sumber: account gems untuk gems & diamond keduanya untuk simplifikasi)
      const { data: gemsData } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      const gems = Number(gemsData || 0);
      if (gems < cost) {
        return Response.json({
          error: `Butuh ${cost} ${currency === "diamond" ? "💎 Diamond" : "💎 Gem"} (kamu punya ${gems})`,
        }, { status: 400, headers: corsHeaders });
      }

      // Deduct
      try {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -cost });
      } catch (e) {
        return Response.json({ error: "Gagal mengurangi saldo" }, { status: 400, headers: corsHeaders });
      }

      const spinCount = isBundle ? 5 : 1;
      const results: Array<Prize & { index: number }> = [];
      for (let i = 0; i < spinCount; i++) {
        const prize = pickPrize();
        await applyPrize(admin, visitorId, prize);
        results.push(prize);
        await admin.from("luck_royale_nyawa_history").insert({
          visitor_id: visitorId,
          spin_type: isBundle ? "bundle5" : "single",
          reward_kind: prize.kind,
          reward_value: prize.value,
          reward_label: prize.label,
          rarity: prize.rarity,
          cost_currency: currency,
          cost_amount: i === 0 ? cost : 0, // biaya hanya pada baris pertama
        });
      }

      // Notifikasi ringkas
      const summary = results.map(r => r.label).join(", ");
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎰 Luck Royale Nyawa (${spinCount}x)`,
        message: summary.length > 200 ? summary.slice(0, 200) + "..." : summary,
        type: "luck_royale_nyawa",
      });

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });

      return Response.json({
        success: true,
        results,
        gems: gemsAfter || 0,
        prizes: PRIZES,
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
