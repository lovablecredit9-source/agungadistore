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
  // Common (~50%) — hadiah ringan, qty lebih besar
  { kind: "auto_hint",     value: 2,  label: "+2 Hint Otomatis",        emoji: "💡", rarity: "common",    weight: 18, color: "#94a3b8" },
  { kind: "extra_life",    value: 2,  label: "+2 Nyawa Ekstra",          emoji: "❤️", rarity: "common",    weight: 16, color: "#ef4444" },
  { kind: "time_freeze",   value: 2,  label: "+2 Time Freeze 30s",       emoji: "⏱️", rarity: "common",    weight: 15, color: "#0ea5e9" },
  // Rare (~28%)
  { kind: "streak_freeze", value: 2,  label: "+2 Streak Freeze",         emoji: "🛡️", rarity: "rare",      weight: 13, color: "#10b981" },
  { kind: "auto_hint",     value: 5,  label: "+5 Hint Otomatis",         emoji: "💡", rarity: "rare",      weight: 9,  color: "#06b6d4" },
  { kind: "extra_life",    value: 5,  label: "+5 Nyawa Ekstra",          emoji: "❤️", rarity: "rare",      weight: 7,  color: "#f43f5e" },
  // Epic (~14%)
  { kind: "time_freeze",   value: 8,  label: "+8 Time Freeze",           emoji: "⏱️", rarity: "epic",      weight: 5,  color: "#a855f7" },
  { kind: "streak_freeze", value: 4,  label: "+4 Streak Freeze",         emoji: "🛡️", rarity: "epic",      weight: 5,  color: "#ec4899" },
  { kind: "gems",          value: 400, label: "💎 +400 Gem",             emoji: "💎", rarity: "epic",      weight: 4,  color: "#8b5cf6" },
  // Legendary (~6%) — hadiah besar
  { kind: "extra_life",    value: 20, label: "🎰 JACKPOT +20 Nyawa",      emoji: "👑", rarity: "legendary", weight: 2.5,color: "#fbbf24" },
  { kind: "streak_freeze", value: 10, label: "🎰 LEGENDARY +10 Freeze",   emoji: "👑", rarity: "legendary", weight: 1.5,color: "#f59e0b" },
  { kind: "gems",          value: 1200, label: "💎 LEGENDARY +1.200 Gem", emoji: "💎", rarity: "legendary", weight: 1.5,color: "#facc15" },
  // Mythic (~1.2%) — pelangi, langka
  { kind: "gems",          value: 3000, label: "🌈 MYTHIC TREASURE +3.000 Gem", emoji: "🌈", rarity: "mythic", weight: 0.6,  color: "#e879f9" },
  { kind: "extra_life",    value: 50,   label: "🌈 MYTHIC VAULT +50 Nyawa",     emoji: "🌈", rarity: "mythic", weight: 0.3,  color: "#f0abfc" },
  // Grand Prize (~0.2%) — ultra rare pelangi
  { kind: "gems",          value: 8000,  label: "🌈 GRAND PRIZE +8.000 Gem",      emoji: "🌈", rarity: "mythic", weight: 0.12, color: "#22d3ee" },
  { kind: "gems",          value: 20000, label: "🌈 MEGA JACKPOT +20.000 Gem",    emoji: "🌈", rarity: "mythic", weight: 0.05, color: "#a78bfa" },
  { kind: "gems",          value: 50000, label: "🌈 ULTRA JACKPOT +50.000 Gem",   emoji: "🌈", rarity: "mythic", weight: 0.02, color: "#f472b6" },
];

// === DAILY FREE SPIN — pool hadiah lebih ringan, 100% kasih sesuatu ===
const FREE_PRIZES: Prize[] = [
  { kind: "auto_hint",     value: 1,  label: "🎁 FREE +1 Hint",          emoji: "💡", rarity: "common", weight: 30, color: "#94a3b8" },
  { kind: "extra_life",    value: 1,  label: "🎁 FREE +1 Nyawa",         emoji: "❤️", rarity: "common", weight: 28, color: "#ef4444" },
  { kind: "time_freeze",   value: 1,  label: "🎁 FREE +1 Time Freeze",   emoji: "⏱️", rarity: "common", weight: 22, color: "#0ea5e9" },
  { kind: "streak_freeze", value: 1,  label: "🎁 FREE +1 Streak Freeze", emoji: "🛡️", rarity: "rare",   weight: 12, color: "#10b981" },
  { kind: "gems",          value: 50, label: "💎 FREE +50 Gem",          emoji: "💎", rarity: "rare",   weight: 6,  color: "#8b5cf6" },
  { kind: "gems",          value: 200, label: "💎 FREE BONUS +200 Gem",  emoji: "💎", rarity: "epic",   weight: 1.8, color: "#a855f7" },
  { kind: "gems",          value: 1000, label: "🌈 FREE LEGENDARY +1.000 Gem", emoji: "🌈", rarity: "legendary", weight: 0.2, color: "#facc15" },
];

function pickFromPool(pool: Prize[]): Prize & { index: number } {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i].weight;
    if (r <= 0) return { ...pool[i], index: i };
  }
  return { ...pool[0], index: 0 };
}

function pickPrize(): Prize & { index: number } {
  return pickFromPool(PRIZES);
}

// === LUCKY STREAK MULTIPLIER ===
// Hitung berapa spin berturut-turut yang dapat rare+ (rare/epic/legendary/mythic)
// Setiap 3 streak = +10% bonus pada nilai hadiah numerik (gems/nyawa/dll)
function getStreakMultiplier(streakCount: number): number {
  if (streakCount < 3) return 1.0;
  const bonus = Math.floor(streakCount / 3) * 0.1; // +10% per 3 streak
  return Math.min(2.0, 1 + bonus); // cap 2x
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

function getTodayWIB(): string {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  return wib.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, action, count: requestedCount } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = getTodayWIB();

    if (action === "check") {
      const { data: history } = await admin
        .from("luck_royale_nyawa_history")
        .select("id, reward_label, rarity, reward_kind, reward_value, spin_type, created_at")
        .eq("visitor_id", visitorId)
        .order("created_at", { ascending: false })
        .limit(20);
      const { data: gemsData } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });

      // Cek free spin hari ini
      const { data: freeUsed } = await admin
        .from("luck_royale_nyawa_history")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("spin_type", "free_daily")
        .gte("created_at", `${today}T00:00:00+07:00`)
        .lte("created_at", `${today}T23:59:59+07:00`)
        .limit(1);
      const freeSpinAvailable = !freeUsed || freeUsed.length === 0;

      // Hitung lucky streak (rare+ berturut-turut dari history terbaru)
      let luckyStreak = 0;
      const allHistory = history || [];
      for (const h of allHistory) {
        if (["rare", "epic", "legendary", "mythic"].includes(h.rarity)) {
          luckyStreak++;
        } else {
          break;
        }
      }

      return Response.json({
        history: allHistory,
        gems: gemsData || 0,
        prizes: PRIZES,
        singleCostGems: SINGLE_COST_GEMS,
        bundleCostDiamond: BUNDLE_COST_DIAMOND,
        bundles: BUNDLES,
        freeSpinAvailable,
        freePrizes: FREE_PRIZES,
        luckyStreak,
        streakMultiplier: getStreakMultiplier(luckyStreak),
      }, { headers: corsHeaders });
    }

    // === FREE DAILY SPIN ===
    if (action === "spin_free") {
      const { data: freeUsed } = await admin
        .from("luck_royale_nyawa_history")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("spin_type", "free_daily")
        .gte("created_at", `${today}T00:00:00+07:00`)
        .lte("created_at", `${today}T23:59:59+07:00`)
        .limit(1);
      if (freeUsed && freeUsed.length > 0) {
        return Response.json({ error: "Free spin hari ini sudah dipakai. Kembali besok!" }, { status: 400, headers: corsHeaders });
      }

      const prize = pickFromPool(FREE_PRIZES);
      await applyPrize(admin, visitorId, prize);
      await admin.from("luck_royale_nyawa_history").insert({
        visitor_id: visitorId,
        spin_type: "free_daily",
        reward_kind: prize.kind,
        reward_value: prize.value,
        reward_label: prize.label,
        rarity: prize.rarity,
        cost_currency: "free",
        cost_amount: 0,
      });

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎁 FREE Daily Spin!`,
        message: `Kamu dapat: ${prize.label}`,
        type: "luck_royale_nyawa",
      });

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({
        success: true,
        results: [prize],
        gems: gemsAfter || 0,
        prizes: PRIZES,
        isFree: true,
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

      // Hitung lucky streak saat ini
      const { data: histPre } = await admin
        .from("luck_royale_nyawa_history")
        .select("rarity")
        .eq("visitor_id", visitorId)
        .order("created_at", { ascending: false })
        .limit(20);
      let curStreak = 0;
      for (const h of histPre || []) {
        if (["rare", "epic", "legendary", "mythic"].includes(h.rarity)) curStreak++;
        else break;
      }

      const results: Array<Prize & { index: number; bonusApplied?: number }> = [];
      let totalBonusGems = 0;
      for (let i = 0; i < spinCount; i++) {
        const basePrize = pickPrize();
        const mult = getStreakMultiplier(curStreak);
        // Bonus hanya berlaku untuk gems & qty numerik > 1
        let finalValue = basePrize.value;
        let bonusApplied = 0;
        if (mult > 1.0) {
          finalValue = Math.round(basePrize.value * mult);
          bonusApplied = finalValue - basePrize.value;
          if (basePrize.kind === "gems") totalBonusGems += bonusApplied;
        }
        const prize: Prize = { ...basePrize, value: finalValue };
        await applyPrize(admin, visitorId, prize);
        results.push({ ...prize, index: basePrize.index, bonusApplied });

        await admin.from("luck_royale_nyawa_history").insert({
          visitor_id: visitorId,
          spin_type: spinType,
          reward_kind: prize.kind,
          reward_value: finalValue,
          reward_label: bonusApplied > 0 ? `${prize.label} (+${Math.round((mult - 1) * 100)}% streak bonus)` : prize.label,
          rarity: prize.rarity,
          cost_currency: currency,
          cost_amount: i === 0 ? cost : 0,
        });

        // Update streak counter live
        if (["rare", "epic", "legendary", "mythic"].includes(prize.rarity)) curStreak++;
        else curStreak = 0;
      }

      // Notifikasi ringkas
      const summary = results.map(r => r.label).join(", ");
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎰 Luck Royale Nyawa (${spinCount}x)${totalBonusGems > 0 ? ` 🔥 +${totalBonusGems} BONUS` : ""}`,
        message: summary.length > 200 ? summary.slice(0, 200) + "..." : summary,
        type: "luck_royale_nyawa",
      });

      const { data: gemsAfter } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });

      return Response.json({
        success: true,
        results,
        gems: gemsAfter || 0,
        prizes: PRIZES,
        luckyStreak: curStreak,
        streakMultiplier: getStreakMultiplier(curStreak),
        totalBonusGems,
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
