import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mata uang spin — semua pakai gem
const SINGLE_COST_GEMS = 50;       // 1 spin = 50 gem
// Paket bundle (jumlah spin → biaya gem). Makin banyak makin hemat.
const BUNDLES: Array<{ count: number; cost: number; label: string; badge?: string }> = [
  { count: 5,   cost: 200,  label: "5 SPIN" },
  { count: 10,  cost: 300,  label: "10 SPIN", badge: "HEMAT" },
  { count: 20,  cost: 400,  label: "20 SPIN", badge: "SUPER HEMAT" },
  { count: 100, cost: 4000, label: "100 SPIN", badge: "MEGA" },
  { count: 125, cost: 5000, label: "125 SPIN", badge: "ULTRA" },
];
// Backwards compat — bundle 5 lama
const BUNDLE_COST_DIAMOND = 200;

// Hadiah bobot — fokus 3 item utama: extra_life, auto_hint, time_freeze, streak_freeze
type Prize = {
  kind: "extra_life" | "auto_hint" | "time_freeze" | "streak_freeze" | "gems" | "coins";
  value: number;
  label: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  weight: number;
  color: string;
};

const PRIZES: Prize[] = [
  // Common (~55%) — hadiah ringan, sering muncul
  { kind: "auto_hint",     value: 1,  label: "+1 Hint Otomatis",        emoji: "💡", rarity: "common",    weight: 20, color: "#94a3b8" },
  { kind: "extra_life",    value: 1,  label: "+1 Nyawa Ekstra",          emoji: "❤️", rarity: "common",    weight: 18, color: "#ef4444" },
  { kind: "time_freeze",   value: 1,  label: "+1 Time Freeze 30s",       emoji: "⏱️", rarity: "common",    weight: 17, color: "#0ea5e9" },
  // Rare (~28%) — sesekali dapat
  { kind: "streak_freeze", value: 1,  label: "+1 Streak Freeze",         emoji: "🛡️", rarity: "rare",      weight: 13, color: "#10b981" },
  { kind: "auto_hint",     value: 3,  label: "+3 Hint Otomatis",         emoji: "💡", rarity: "rare",      weight: 9,  color: "#06b6d4" },
  { kind: "extra_life",    value: 3,  label: "+3 Nyawa Ekstra",          emoji: "❤️", rarity: "rare",      weight: 6,  color: "#f43f5e" },
  // Epic (~12%) — agak sulit
  { kind: "time_freeze",   value: 5,  label: "+5 Time Freeze",           emoji: "⏱️", rarity: "epic",      weight: 5,  color: "#a855f7" },
  { kind: "streak_freeze", value: 2,  label: "+2 Streak Freeze",         emoji: "🛡️", rarity: "epic",      weight: 4,  color: "#ec4899" },
  { kind: "gems",          value: 150, label: "+150 Gem",                emoji: "💎", rarity: "epic",      weight: 3,  color: "#8b5cf6" },
  // Legendary (~4%) — jarang, hadiah besar
  { kind: "extra_life",    value: 10, label: "🎰 JACKPOT +10 Nyawa",      emoji: "👑", rarity: "legendary", weight: 2,  color: "#fbbf24" },
  { kind: "streak_freeze", value: 5,  label: "🎰 LEGENDARY +5 Freeze",    emoji: "👑", rarity: "legendary", weight: 1,  color: "#f59e0b" },
  { kind: "gems",          value: 500, label: "💎 LEGENDARY +500 Gem",    emoji: "💎", rarity: "legendary", weight: 1,  color: "#facc15" },
  // Mythic (~0.5%) — pelangi, super langka
  { kind: "gems",          value: 1500, label: "🌈 MYTHIC TREASURE +1,500 Gem", emoji: "🌈", rarity: "mythic", weight: 0.3,  color: "#e879f9" },
  { kind: "extra_life",    value: 25,   label: "🌈 MYTHIC VAULT +25 Nyawa",     emoji: "🌈", rarity: "mythic", weight: 0.15, color: "#f0abfc" },
  // Grand Prize (~0.08%) — ultra rare pelangi
  { kind: "gems",          value: 5000,  label: "🌈 GRAND PRIZE +5,000 Gem",     emoji: "🌈", rarity: "mythic", weight: 0.05, color: "#22d3ee" },
  { kind: "gems",          value: 10000, label: "🌈 MEGA JACKPOT +10,000 Gem",   emoji: "🌈", rarity: "mythic", weight: 0.02, color: "#a78bfa" },
  { kind: "gems",          value: 20000, label: "🌈 ULTRA JACKPOT +20,000 Gem",  emoji: "🌈", rarity: "mythic", weight: 0.01, color: "#f472b6" },
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

// Tambah qty ke streak_power_pack_inventory (inventory yang dipakai PowerPackShop)
async function addInventory(admin: any, visitorId: string, itemCode: string, qty: number) {
  const { data: inv } = await admin
    .from("streak_power_pack_inventory")
    .select("id, quantity")
    .eq("visitor_id", visitorId)
    .eq("item_code", itemCode)
    .maybeSingle();
  if (inv) {
    await admin
      .from("streak_power_pack_inventory")
      .update({ quantity: (inv.quantity || 0) + qty })
      .eq("id", inv.id);
  } else {
    await admin
      .from("streak_power_pack_inventory")
      .insert({ visitor_id: visitorId, item_code: itemCode, quantity: qty });
  }
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

    // Mirror ke inventory Power Pack supaya jumlah ikut bertambah
    const invMap: Record<string, string> = {
      extra_life: "nyawa",
      auto_hint: "hint",
      time_freeze: "freeze", // freeze in-game ↔ inventory freeze
    };
    const code = invMap[p.kind];
    if (code) await addInventory(admin, visitorId, code, p.value);
  } else if (p.kind === "streak_freeze") {
    const { data: streak } = await admin.from("daily_streaks").select("id, freeze_count").eq("visitor_id", visitorId).maybeSingle();
    if (streak) {
      await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + p.value }).eq("id", streak.id);
    }
    // Tambah juga ke inventory Power Pack (item_code: freeze)
    await addInventory(admin, visitorId, "freeze", p.value);
  } else if (p.kind === "gems") {
    await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: p.value });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, action, count: requestedCount } = await req.json();
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
        bundles: BUNDLES,
      }, { headers: corsHeaders });
    }

    if (action === "spin_single" || action === "spin_bundle" || action === "spin_pack") {
      let spinCount = 1;
      let cost = SINGLE_COST_GEMS;
      let spinType = "single";

      if (action === "spin_bundle") {
        spinCount = 5;
        cost = BUNDLE_COST_DIAMOND;
        spinType = "bundle5";
      } else if (action === "spin_pack") {
        const pack = BUNDLES.find(b => b.count === Number(requestedCount));
        if (!pack) {
          return Response.json({ error: "Paket tidak valid" }, { status: 400, headers: corsHeaders });
        }
        spinCount = pack.count;
        cost = pack.cost;
        spinType = `pack${pack.count}`;
      }

      const currency = "gems";

      // Cek saldo gem
      const { data: gemsData } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      const gems = Number(gemsData || 0);
      if (gems < cost) {
        return Response.json({
          error: `Butuh ${cost} 💎 Gem (kamu punya ${gems})`,
        }, { status: 400, headers: corsHeaders });
      }

      // Deduct
      try {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -cost });
      } catch (e) {
        return Response.json({ error: "Gagal mengurangi saldo" }, { status: 400, headers: corsHeaders });
      }

      const results: Array<Prize & { index: number }> = [];
      for (let i = 0; i < spinCount; i++) {
        const prize = pickPrize();
        await applyPrize(admin, visitorId, prize);
        results.push(prize);
        await admin.from("luck_royale_nyawa_history").insert({
          visitor_id: visitorId,
          spin_type: spinType,
          reward_kind: prize.kind,
          reward_value: prize.value,
          reward_label: prize.label,
          rarity: prize.rarity,
          cost_currency: currency,
          cost_amount: i === 0 ? cost : 0,
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
