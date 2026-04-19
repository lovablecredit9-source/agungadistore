import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function todayStr() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split("T")[0];
}

async function applyReward(admin: any, visitorId: string, type: string, value: number, streak: any) {
  if (type === "coins") {
    await admin.from("daily_streaks").update({ streak_coins: (streak?.streak_coins || 0) + value }).eq("visitor_id", visitorId);
    return;
  }
  if (type === "streak_freeze") {
    await admin.from("daily_streaks").update({ freeze_count: (streak?.freeze_count || 0) + value }).eq("visitor_id", visitorId);
    return;
  }
  // power-ups
  const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
  const updates: Record<string, any> = {};
  if (type === "double_xp") {
    const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now()
      ? new Date(pu.double_xp_until).getTime() : Date.now();
    updates.double_xp_until = new Date(baseMs + value * 3600 * 1000).toISOString();
  } else if (["auto_hint", "extra_life", "time_freeze"].includes(type)) {
    updates[type] = (pu?.[type] || 0) + value;
  } else { return; }
  if (pu) await admin.from("user_power_ups").update(updates).eq("visitor_id", visitorId);
  else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...updates });
}

async function deductInput(admin: any, visitorId: string, type: string, amount: number, streak: any, pu: any): Promise<string | null> {
  if (type === "coins") {
    if ((streak?.streak_coins || 0) < amount) return "Coins tidak cukup";
    await admin.from("daily_streaks").update({ streak_coins: streak.streak_coins - amount }).eq("visitor_id", visitorId);
    return null;
  }
  if (type === "streak_freeze") {
    if ((streak?.freeze_count || 0) < amount) return "Streak Freeze tidak cukup";
    await admin.from("daily_streaks").update({ freeze_count: streak.freeze_count - amount }).eq("visitor_id", visitorId);
    return null;
  }
  if (["auto_hint", "extra_life", "time_freeze"].includes(type)) {
    if (!pu || (pu[type] || 0) < amount) return `${type} tidak cukup`;
    await admin.from("user_power_ups").update({ [type]: pu[type] - amount }).eq("visitor_id", visitorId);
    return null;
  }
  return "Tipe input tidak didukung";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") ?? "list";
    let body: any = {};
    if (req.method === "POST") { try { body = await req.json(); } catch { body = {}; } if (body?.action) action = body.action; }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const visitorId = body?.visitorId || url.searchParams.get("visitorId");
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
    const today = todayStr();

    // ============ LIST ALL ============
    if (action === "list") {
      const [seasons, recipes, skins, groupItems] = await Promise.all([
        admin.from("streak_battle_pass_seasons").select("*").eq("is_active", true).order("starts_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("streak_tradein_recipes").select("*").eq("is_active", true).order("sort_order"),
        admin.from("streak_limited_skins").select("*").eq("is_active", true).gt("ends_at", new Date().toISOString()).order("sort_order"),
        admin.from("streak_group_buy_items").select("*").eq("is_active", true).order("sort_order"),
      ]);

      let bp: any = null;
      if (seasons.data) {
        const [tiers, progress] = await Promise.all([
          admin.from("streak_battle_pass_tiers").select("*").eq("season_id", seasons.data.id).order("tier_number"),
          admin.from("streak_battle_pass_progress").select("*").eq("visitor_id", visitorId).eq("season_id", seasons.data.id).maybeSingle(),
        ]);
        bp = { season: seasons.data, tiers: tiers.data || [], progress: progress.data || { total_spent_coins: 0, is_premium: false, claimed_free_tiers: [], claimed_premium_tiers: [] } };
      }

      // tradein daily usage
      const { data: tradeUsage } = await admin.from("streak_tradein_history").select("recipe_id").eq("visitor_id", visitorId).eq("trade_date", today);
      const tradeMap: Record<string, number> = {};
      (tradeUsage || []).forEach((r: any) => { tradeMap[r.recipe_id] = (tradeMap[r.recipe_id] || 0) + 1; });

      // user owned skins
      const { data: ownedSkins } = await admin.from("streak_skin_purchases").select("skin_id, is_equipped").eq("visitor_id", visitorId);
      const ownedMap = new Set((ownedSkins || []).map((s: any) => s.skin_id));

      // group buy: count buyers today per item
      const itemIds = (groupItems.data || []).map((i: any) => i.id);
      let buyersMap: Record<string, number> = {};
      let userBoughtToday = new Set<string>();
      if (itemIds.length) {
        const { data: gbToday } = await admin.from("streak_group_buy_purchases").select("item_id, visitor_id").in("item_id", itemIds).eq("purchase_date", today);
        (gbToday || []).forEach((r: any) => {
          buyersMap[r.item_id] = (buyersMap[r.item_id] || 0) + 1;
          if (r.visitor_id === visitorId) userBoughtToday.add(r.item_id);
        });
      }

      const groupItemsWithStats = (groupItems.data || []).map((it: any) => {
        const buyers = buyersMap[it.id] || 0;
        let discount = 0;
        if (buyers >= it.tier3_buyers) discount = it.tier3_discount_pct;
        else if (buyers >= it.tier2_buyers) discount = it.tier2_discount_pct;
        else if (buyers >= it.tier1_buyers) discount = it.tier1_discount_pct;
        const cost = Math.floor(it.base_cost_coins * (1 - discount / 100));
        return { ...it, buyers_today: buyers, current_discount_pct: discount, current_cost: cost, already_bought_today: userBoughtToday.has(it.id) };
      });

      return Response.json({
        battle_pass: bp,
        tradein: { recipes: recipes.data || [], usage_today: tradeMap },
        skins: (skins.data || []).map((s: any) => ({ ...s, owned: ownedMap.has(s.id) })),
        group_buy: groupItemsWithStats,
        date: today,
      }, { headers: corsHeaders });
    }

    // ============ BATTLE PASS: BUY PREMIUM ============
    if (action === "bp_buy_premium") {
      const { seasonId } = body;
      const { data: season } = await admin.from("streak_battle_pass_seasons").select("*").eq("id", seasonId).eq("is_active", true).maybeSingle();
      if (!season) return Response.json({ error: "Season tidak ditemukan" }, { status: 404, headers: corsHeaders });
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });
      if ((streak.streak_coins || 0) < season.premium_cost_coins) return Response.json({ error: `Butuh ${season.premium_cost_coins} coins` }, { status: 400, headers: corsHeaders });

      const { data: existing } = await admin.from("streak_battle_pass_progress").select("*").eq("visitor_id", visitorId).eq("season_id", seasonId).maybeSingle();
      if (existing?.is_premium) return Response.json({ error: "Premium sudah aktif" }, { status: 400, headers: corsHeaders });

      await admin.from("daily_streaks").update({ streak_coins: streak.streak_coins - season.premium_cost_coins }).eq("visitor_id", visitorId);
      if (existing) {
        await admin.from("streak_battle_pass_progress").update({ is_premium: true, premium_purchased_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await admin.from("streak_battle_pass_progress").insert({ visitor_id: visitorId, season_id: seasonId, is_premium: true, premium_purchased_at: new Date().toISOString() });
      }
      await admin.from("notifications").insert({ visitor_id: visitorId, title: "🌟 Battle Pass Premium Aktif!", message: "Sekarang kamu bisa klaim semua reward premium!", type: "battle_pass" });
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // ============ BATTLE PASS: CLAIM TIER ============
    if (action === "bp_claim_tier") {
      const { seasonId, tierNumber, track } = body; // track: 'free' | 'premium'
      const { data: tier } = await admin.from("streak_battle_pass_tiers").select("*").eq("season_id", seasonId).eq("tier_number", tierNumber).maybeSingle();
      if (!tier) return Response.json({ error: "Tier tidak ditemukan" }, { status: 404, headers: corsHeaders });
      const { data: progress } = await admin.from("streak_battle_pass_progress").select("*").eq("visitor_id", visitorId).eq("season_id", seasonId).maybeSingle();
      const totalSpent = progress?.total_spent_coins || 0;
      if (totalSpent < tier.required_spent_coins) return Response.json({ error: `Belum cukup. Butuh belanja ${tier.required_spent_coins} coins (kamu: ${totalSpent})` }, { status: 400, headers: corsHeaders });

      const claimedKey = track === "premium" ? "claimed_premium_tiers" : "claimed_free_tiers";
      const claimed: number[] = progress?.[claimedKey] || [];
      if (claimed.includes(tierNumber)) return Response.json({ error: "Tier ini sudah diklaim" }, { status: 400, headers: corsHeaders });
      if (track === "premium" && !progress?.is_premium) return Response.json({ error: "Beli Premium dulu untuk klaim track premium" }, { status: 403, headers: corsHeaders });

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      const rewardType = track === "premium" ? tier.premium_reward_type : tier.free_reward_type;
      const rewardValue = track === "premium" ? tier.premium_reward_value : tier.free_reward_value;
      const rewardLabel = track === "premium" ? tier.premium_reward_label : tier.free_reward_label;
      await applyReward(admin, visitorId, rewardType, rewardValue, streak);

      const newClaimed = [...claimed, tierNumber];
      if (progress) {
        await admin.from("streak_battle_pass_progress").update({ [claimedKey]: newClaimed }).eq("id", progress.id);
      } else {
        await admin.from("streak_battle_pass_progress").insert({ visitor_id: visitorId, season_id: seasonId, [claimedKey]: newClaimed });
      }
      return Response.json({ success: true, rewardLabel }, { headers: corsHeaders });
    }

    // ============ TRADE-IN ============
    if (action === "tradein") {
      const { recipeId } = body;
      const { data: recipe } = await admin.from("streak_tradein_recipes").select("*").eq("id", recipeId).eq("is_active", true).maybeSingle();
      if (!recipe) return Response.json({ error: "Resep tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const { count: usedToday } = await admin.from("streak_tradein_history").select("id", { count: "exact", head: true }).eq("visitor_id", visitorId).eq("recipe_id", recipeId).eq("trade_date", today);
      if ((usedToday ?? 0) >= recipe.daily_limit) return Response.json({ error: `Limit harian ${recipe.daily_limit}x tercapai` }, { status: 400, headers: corsHeaders });

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
      const err = await deductInput(admin, visitorId, recipe.input_type, recipe.input_amount, streak, pu);
      if (err) return Response.json({ error: err }, { status: 400, headers: corsHeaders });

      const { data: streak2 } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      await applyReward(admin, visitorId, recipe.output_type, recipe.output_amount, streak2);
      await admin.from("streak_tradein_history").insert({ visitor_id: visitorId, recipe_id: recipeId, input_type: recipe.input_type, input_amount: recipe.input_amount, output_type: recipe.output_type, output_amount: recipe.output_amount, trade_date: today });
      return Response.json({ success: true, message: `Trade berhasil: ${recipe.output_label}` }, { headers: corsHeaders });
    }

    // ============ BUY SKIN ============
    if (action === "buy_skin") {
      const { skinId } = body;
      const { data: skin } = await admin.from("streak_limited_skins").select("*").eq("id", skinId).eq("is_active", true).maybeSingle();
      if (!skin) return Response.json({ error: "Skin tidak ditemukan" }, { status: 404, headers: corsHeaders });
      if (new Date(skin.ends_at).getTime() < Date.now()) return Response.json({ error: "Skin sudah berakhir" }, { status: 400, headers: corsHeaders });
      if (skin.sold_count >= skin.total_stock) return Response.json({ error: "Stok habis" }, { status: 400, headers: corsHeaders });

      const { data: existing } = await admin.from("streak_skin_purchases").select("id").eq("visitor_id", visitorId).eq("skin_id", skinId).maybeSingle();
      if (existing) return Response.json({ error: "Kamu sudah punya skin ini" }, { status: 400, headers: corsHeaders });

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if ((streak?.streak_coins || 0) < skin.cost_coins) return Response.json({ error: `Butuh ${skin.cost_coins} coins` }, { status: 400, headers: corsHeaders });

      await admin.from("daily_streaks").update({ streak_coins: streak.streak_coins - skin.cost_coins }).eq("visitor_id", visitorId);
      await admin.from("streak_skin_purchases").insert({ visitor_id: visitorId, skin_id: skinId, cost_paid: skin.cost_coins });
      await admin.from("streak_limited_skins").update({ sold_count: skin.sold_count + 1 }).eq("id", skinId);

      // Track BP spend
      await trackBpSpend(admin, visitorId, skin.cost_coins);
      return Response.json({ success: true, message: `🎉 ${skin.name} berhasil dibeli!` }, { headers: corsHeaders });
    }

    // ============ GROUP BUY ============
    if (action === "group_buy") {
      const { itemId } = body;
      const { data: item } = await admin.from("streak_group_buy_items").select("*").eq("id", itemId).eq("is_active", true).maybeSingle();
      if (!item) return Response.json({ error: "Item tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const { data: existing } = await admin.from("streak_group_buy_purchases").select("id").eq("visitor_id", visitorId).eq("item_id", itemId).eq("purchase_date", today).maybeSingle();
      if (existing) return Response.json({ error: "Kamu sudah beli item ini hari ini" }, { status: 400, headers: corsHeaders });

      const { count: buyers } = await admin.from("streak_group_buy_purchases").select("id", { count: "exact", head: true }).eq("item_id", itemId).eq("purchase_date", today);
      let discount = 0;
      const b = buyers || 0;
      if (b >= item.tier3_buyers) discount = item.tier3_discount_pct;
      else if (b >= item.tier2_buyers) discount = item.tier2_discount_pct;
      else if (b >= item.tier1_buyers) discount = item.tier1_discount_pct;
      const cost = Math.floor(item.base_cost_coins * (1 - discount / 100));

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if ((streak?.streak_coins || 0) < cost) return Response.json({ error: `Butuh ${cost} coins` }, { status: 400, headers: corsHeaders });

      await admin.from("daily_streaks").update({ streak_coins: streak.streak_coins - cost }).eq("visitor_id", visitorId);
      const { data: streak2 } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      await applyReward(admin, visitorId, item.reward_type, item.reward_value, streak2);
      await admin.from("streak_group_buy_purchases").insert({ visitor_id: visitorId, item_id: itemId, cost_paid: cost, discount_pct_applied: discount, purchase_date: today });

      await trackBpSpend(admin, visitorId, cost);
      return Response.json({ success: true, cost, discount, message: `${item.reward_label} (diskon ${discount}%)` }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});

// helper - track BP spend on active season
async function trackBpSpend(admin: any, visitorId: string, amount: number) {
  const { data: season } = await admin.from("streak_battle_pass_seasons").select("id").eq("is_active", true).order("starts_at", { ascending: false }).limit(1).maybeSingle();
  if (!season) return;
  const { data: progress } = await admin.from("streak_battle_pass_progress").select("*").eq("visitor_id", visitorId).eq("season_id", season.id).maybeSingle();
  if (progress) {
    await admin.from("streak_battle_pass_progress").update({ total_spent_coins: (progress.total_spent_coins || 0) + amount }).eq("id", progress.id);
  } else {
    await admin.from("streak_battle_pass_progress").insert({ visitor_id: visitorId, season_id: season.id, total_spent_coins: amount });
  }
}
