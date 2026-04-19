import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWIBDateStr(d?: Date): string {
  const wib = new Date((d ?? new Date()).getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split("T")[0];
}

function getWIBWeekStart(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(wib);
  monday.setUTCDate(wib.getUTCDate() + diff);
  return monday.toISOString().split("T")[0];
}

// MEMBER TIER calculation based on lifetime spending
function calculateTier(totalSpent: number): { tier: string; discount: number; icon: string; nextTier?: string; nextRequired?: number } {
  if (totalSpent >= 50000) return { tier: "Diamond", discount: 25, icon: "💎" };
  if (totalSpent >= 20000) return { tier: "Gold", discount: 15, icon: "🥇", nextTier: "Diamond", nextRequired: 50000 };
  if (totalSpent >= 5000) return { tier: "Silver", discount: 10, icon: "🥈", nextTier: "Gold", nextRequired: 20000 };
  if (totalSpent >= 1000) return { tier: "Bronze", discount: 5, icon: "🥉", nextTier: "Silver", nextRequired: 5000 };
  return { tier: "Newbie", discount: 0, icon: "🌱", nextTier: "Bronze", nextRequired: 1000 };
}

async function getDisplayName(admin: any, visitorId: string): Promise<string> {
  const sources = [
    admin.from("streak_profiles").select("username").eq("visitor_id", visitorId).maybeSingle(),
    admin.from("game_profiles").select("display_name").eq("visitor_id", visitorId).maybeSingle(),
    admin.from("user_balances").select("username").eq("visitor_id", visitorId).maybeSingle(),
  ];
  const results = await Promise.all(sources);
  for (const r of results) {
    const v = (r.data as any)?.username || (r.data as any)?.display_name;
    if (v) return v;
  }
  return `Pemain ${visitorId.slice(0, 4)}`;
}

async function getLifetimeSpent(admin: any, visitorId: string): Promise<number> {
  const [bundles, mystery, daily] = await Promise.all([
    admin.from("event_shop_bundle_purchases").select("cost_paid").eq("visitor_id", visitorId),
    admin.from("event_shop_mystery_openings").select("cost_paid").eq("visitor_id", visitorId),
    admin.from("event_shop_daily_purchases").select("cost_paid").eq("visitor_id", visitorId),
  ]);
  let total = 0;
  for (const r of [bundles, mystery, daily]) {
    (r.data ?? []).forEach((x: any) => { total += x.cost_paid || 0; });
  }
  return total;
}

async function pushActivity(admin: any, visitorId: string, action: string, itemName: string, itemIcon: string, rarity = "common") {
  const name = await getDisplayName(admin, visitorId);
  await admin.from("event_shop_activity_feed").insert({
    visitor_id: visitorId,
    display_name: name,
    action_type: action,
    item_name: itemName,
    item_icon: itemIcon,
    rarity,
  });
}

async function bumpSpender(admin: any, visitorId: string, amount: number) {
  const week = getWIBWeekStart();
  const { data: existing } = await admin
    .from("event_shop_top_spenders")
    .select("*")
    .eq("visitor_id", visitorId)
    .eq("week_start", week)
    .maybeSingle();
  if (existing) {
    await admin.from("event_shop_top_spenders").update({
      total_spent: (existing.total_spent || 0) + amount,
      purchase_count: (existing.purchase_count || 0) + 1,
    }).eq("id", existing.id);
  } else {
    await admin.from("event_shop_top_spenders").insert({
      visitor_id: visitorId,
      week_start: week,
      total_spent: amount,
      purchase_count: 1,
    });
  }
}

async function applyReward(admin: any, visitorId: string, type: string, value: number, streak: any) {
  if (type === "streak_coins") {
    await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + value }).eq("id", streak.id);
  } else if (type === "freeze") {
    await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + value }).eq("id", streak.id);
  } else if (type === "hint" || type === "life" || type === "time_freeze") {
    const col = type === "hint" ? "auto_hint" : type === "life" ? "extra_life" : "time_freeze";
    const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (pu) await admin.from("user_power_ups").update({ [col]: (pu[col] || 0) + value }).eq("visitor_id", visitorId);
    else await admin.from("user_power_ups").insert({ visitor_id: visitorId, [col]: value });
  } else if (type === "double_xp") {
    const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
    const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now()
      ? new Date(pu.double_xp_until).getTime() : Date.now();
    const newUntil = new Date(baseMs + value * 3600 * 1000).toISOString();
    if (pu) await admin.from("user_power_ups").update({ double_xp_until: newUntil }).eq("visitor_id", visitorId);
    else await admin.from("user_power_ups").insert({ visitor_id: visitorId, double_xp_until: newUntil });
  }
}

// Generate daily rotation if not exists
async function ensureDailyRotation(admin: any, dateStr: string) {
  const { data: existing } = await admin.from("event_shop_daily_active").select("id").eq("rotation_date", dateStr).limit(1);
  if (existing && existing.length > 0) return;
  const { data: pool } = await admin.from("event_shop_daily_rotation").select("*").eq("is_active", true);
  if (!pool || pool.length === 0) return;
  // Weighted random sampling 6 unique items
  const picked: any[] = [];
  const remaining = [...pool];
  for (let i = 0; i < 6 && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((s, x: any) => s + (x.rarity_weight || 1), 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (let j = 0; j < remaining.length; j++) {
      r -= (remaining[j].rarity_weight || 1);
      if (r <= 0) { idx = j; break; }
    }
    picked.push(remaining.splice(idx, 1)[0]);
  }
  const rows = picked.map((p, i) => ({
    rotation_date: dateStr,
    item_id: p.id,
    discount_pct: [0, 10, 20, 25, 30, 40][i] || 0,
    slot_order: i,
  }));
  await admin.from("event_shop_daily_active").insert(rows);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") ?? "overview";
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
      if (body?.action) action = body.action;
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const visitorId = body?.visitorId || url.searchParams.get("visitorId");
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const today = getWIBDateStr();
    const week = getWIBWeekStart();

    if (action === "overview") {
      await ensureDailyRotation(admin, today);
      const lifetimeSpent = await getLifetimeSpent(admin, visitorId);
      const tierInfo = calculateTier(lifetimeSpent);

      const [bundlesRes, boxesRes, dailyRes, dailyPurchRes, bundlePurchRes, wishlistRes, feedRes, spendersRes] = await Promise.all([
        admin.from("event_shop_bundles").select("*").eq("is_active", true).order("sort_order"),
        admin.from("event_shop_mystery_boxes").select("*").eq("is_active", true).order("sort_order"),
        admin.from("event_shop_daily_active").select("*, item:event_shop_daily_rotation(*)").eq("rotation_date", today).order("slot_order"),
        admin.from("event_shop_daily_purchases").select("item_id").eq("visitor_id", visitorId).eq("purchase_date", today),
        admin.from("event_shop_bundle_purchases").select("bundle_id").eq("visitor_id", visitorId).eq("week_start", week),
        admin.from("event_shop_wishlist").select("*").eq("visitor_id", visitorId),
        admin.from("event_shop_activity_feed").select("*").order("created_at", { ascending: false }).limit(20),
        admin.from("event_shop_top_spenders").select("*").eq("week_start", week).order("total_spent", { ascending: false }).limit(10),
      ]);

      const dailyClaimed = new Set((dailyPurchRes.data ?? []).map((r: any) => r.item_id));
      const bundleClaimedCount = new Map<string, number>();
      (bundlePurchRes.data ?? []).forEach((r: any) => {
        bundleClaimedCount.set(r.bundle_id, (bundleClaimedCount.get(r.bundle_id) || 0) + 1);
      });
      const wishlistSet = new Set((wishlistRes.data ?? []).map((w: any) => `${w.item_kind}:${w.item_id}`));

      // Enrich top spenders with names
      const spenderIds = (spendersRes.data ?? []).map((s: any) => s.visitor_id);
      const nameMap = new Map<string, string>();
      if (spenderIds.length > 0) {
        const [sp, gp, ub] = await Promise.all([
          admin.from("streak_profiles").select("visitor_id, username").in("visitor_id", spenderIds),
          admin.from("game_profiles").select("visitor_id, display_name").in("visitor_id", spenderIds),
          admin.from("user_balances").select("visitor_id, username").in("visitor_id", spenderIds),
        ]);
        sp.data?.forEach((p: any) => p.username && nameMap.set(p.visitor_id, p.username));
        ub.data?.forEach((p: any) => !nameMap.has(p.visitor_id) && p.username && nameMap.set(p.visitor_id, p.username));
        gp.data?.forEach((p: any) => !nameMap.has(p.visitor_id) && p.display_name && nameMap.set(p.visitor_id, p.display_name));
      }

      const applyDiscount = (price: number) => Math.max(1, Math.floor(price * (1 - tierInfo.discount / 100)));

      const bundles = (bundlesRes.data ?? []).map((b: any) => {
        const used = bundleClaimedCount.get(b.id) || 0;
        const finalPrice = applyDiscount(b.price_coins);
        const gemBase = b.cost_gems || 0;
        const finalGemPrice = gemBase > 0 ? Math.max(1, Math.floor(gemBase * (1 - tierInfo.discount / 100))) : 0;
        return {
          ...b,
          final_price: finalPrice,
          final_gem_price: finalGemPrice,
          tier_discount_pct: tierInfo.discount,
          weekly_used: used,
          can_buy: used < b.weekly_limit,
          is_wishlisted: wishlistSet.has(`bundle:${b.id}`),
        };
      });

      const mysteryBoxes = (boxesRes.data ?? []).map((b: any) => ({
        ...b,
        final_price: applyDiscount(b.price_coins),
        tier_discount_pct: tierInfo.discount,
        is_wishlisted: wishlistSet.has(`box:${b.id}`),
      }));

      const dailyItems = (dailyRes.data ?? []).map((d: any) => {
        const item = d.item;
        const baseAfterSlotDiscount = Math.floor(item.base_price_coins * (1 - d.discount_pct / 100));
        const finalPrice = applyDiscount(baseAfterSlotDiscount);
        return {
          slot_id: d.id,
          slot_discount_pct: d.discount_pct,
          slot_order: d.slot_order,
          item_id: item.id,
          name: item.name,
          icon: item.icon,
          reward_type: item.reward_type,
          reward_value: item.reward_value,
          reward_label: item.reward_label,
          base_price: item.base_price_coins,
          final_price: finalPrice,
          tier_discount_pct: tierInfo.discount,
          claimed: dailyClaimed.has(item.id),
          is_wishlisted: wishlistSet.has(`daily:${item.id}`),
        };
      });

      // Time until next rotation (next WIB midnight)
      const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const wibTomorrow = new Date(wibNow);
      wibTomorrow.setUTCDate(wibNow.getUTCDate() + 1);
      wibTomorrow.setUTCHours(0, 0, 0, 0);
      const secondsToReset = Math.floor((wibTomorrow.getTime() - wibNow.getTime()) / 1000);

      return Response.json({
        tier: tierInfo,
        lifetime_spent: lifetimeSpent,
        bundles,
        mystery_boxes: mysteryBoxes,
        daily_items: dailyItems,
        seconds_to_reset: secondsToReset,
        wishlist: wishlistRes.data ?? [],
        activity_feed: feedRes.data ?? [],
        top_spenders: (spendersRes.data ?? []).map((s: any, i: number) => ({
          rank: i + 1,
          visitor_id: s.visitor_id,
          display_name: nameMap.get(s.visitor_id) || `Pemain ${s.visitor_id.slice(0, 4)}`,
          total_spent: s.total_spent,
          purchase_count: s.purchase_count,
          is_me: s.visitor_id === visitorId,
        })),
      }, { headers: corsHeaders });
    }

    // BUY BUNDLE
    if (action === "buy_bundle") {
      const { bundleId, paymentMethod } = body;
      const payMethod = paymentMethod === "gem" ? "gem" : "coin";
      const { data: bundle } = await admin.from("event_shop_bundles").select("*").eq("id", bundleId).eq("is_active", true).maybeSingle();
      if (!bundle) return Response.json({ error: "Bundle tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const { count: usedCount } = await admin
        .from("event_shop_bundle_purchases")
        .select("id", { count: "exact", head: true })
        .eq("visitor_id", visitorId)
        .eq("bundle_id", bundleId)
        .eq("week_start", week);
      if ((usedCount ?? 0) >= bundle.weekly_limit) {
        return Response.json({ error: `Limit mingguan ${bundle.weekly_limit}x sudah tercapai` }, { status: 400, headers: corsHeaders });
      }

      const lifetimeSpent = await getLifetimeSpent(admin, visitorId);
      const tierInfo = calculateTier(lifetimeSpent);

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });

      let finalCost = 0;
      if (payMethod === "gem") {
        const gemBase = (bundle as any).cost_gems || 0;
        if (gemBase <= 0) return Response.json({ error: "Pembayaran gem belum tersedia untuk paket ini" }, { status: 400, headers: corsHeaders });
        finalCost = Math.max(1, Math.floor(gemBase * (1 - tierInfo.discount / 100)));
        const { data: gp } = await admin.from("game_profiles").select("gems").eq("visitor_id", visitorId).maybeSingle();
        const userGems = (gp as any)?.gems || 0;
        if (userGems < finalCost) {
          return Response.json({ error: `Gem tidak cukup. Butuh ${finalCost} 💎, kamu punya ${userGems} 💎.` }, { status: 400, headers: corsHeaders });
        }
        await admin.from("game_profiles").update({ gems: userGems - finalCost }).eq("visitor_id", visitorId);
        await admin.from("gem_transactions").insert({
          visitor_id: visitorId,
          amount: -finalCost,
          type: "shop",
          description: `Event Shop Bundle: ${bundle.name} (-${finalCost} 💎)`,
          reference_id: bundleId,
        });
      } else {
        finalCost = Math.max(1, Math.floor(bundle.price_coins * (1 - tierInfo.discount / 100)));
        if ((streak.streak_coins || 0) < finalCost) {
          return Response.json({ error: `Coins kurang. Butuh ${finalCost}, kamu punya ${streak.streak_coins || 0}` }, { status: 400, headers: corsHeaders });
        }
        await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) - finalCost }).eq("id", streak.id);
        streak.streak_coins = (streak.streak_coins || 0) - finalCost;
      }

      // Apply each item in bundle
      const contents = bundle.contents as any[];
      let currentStreak = streak;
      for (const item of contents) {
        await applyReward(admin, visitorId, item.type, item.value, currentStreak);
        if (item.type === "freeze") currentStreak.freeze_count = (currentStreak.freeze_count || 0) + item.value;
        if (item.type === "streak_coins") {
          currentStreak.streak_coins += item.value;
          await admin.from("daily_streaks").update({ streak_coins: currentStreak.streak_coins }).eq("id", streak.id);
        }
      }

      await admin.from("event_shop_bundle_purchases").insert({
        visitor_id: visitorId,
        bundle_id: bundleId,
        cost_paid: finalCost,
        week_start: week,
        contents_snapshot: bundle.contents,
        payment_method: payMethod,
      });

      if (payMethod === "coin") await bumpSpender(admin, visitorId, finalCost);
      await pushActivity(admin, visitorId, "bundle", bundle.name, bundle.icon, "epic");

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎁 Bundle: ${bundle.name}`,
        message: `Berhasil dibeli! Hemat ${tierInfo.discount}% (tier ${tierInfo.tier})`,
        type: "event_shop",
      });

      return Response.json({ success: true, cost: finalCost, paymentMethod: payMethod, contents }, { headers: corsHeaders });
    }

    // OPEN MYSTERY BOX
    if (action === "open_box") {
      const { boxId } = body;
      const { data: box } = await admin.from("event_shop_mystery_boxes").select("*").eq("id", boxId).eq("is_active", true).maybeSingle();
      if (!box) return Response.json({ error: "Mystery box tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const lifetimeSpent = await getLifetimeSpent(admin, visitorId);
      const tierInfo = calculateTier(lifetimeSpent);
      const finalCost = Math.max(1, Math.floor(box.price_coins * (1 - tierInfo.discount / 100)));

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });
      if ((streak.streak_coins || 0) < finalCost) {
        return Response.json({ error: `Coins kurang. Butuh ${finalCost}, kamu punya ${streak.streak_coins || 0}` }, { status: 400, headers: corsHeaders });
      }

      // Weighted draw
      const pool = box.rarity_pool as any[];
      const totalWeight = pool.reduce((s, p) => s + (p.weight || 1), 0);
      let r = Math.random() * totalWeight;
      let chosen = pool[0];
      for (const p of pool) {
        r -= (p.weight || 1);
        if (r <= 0) { chosen = p; break; }
      }

      // Deduct coins, then apply
      const newCoins = (streak.streak_coins || 0) - finalCost;
      await admin.from("daily_streaks").update({ streak_coins: newCoins }).eq("id", streak.id);
      await applyReward(admin, visitorId, chosen.reward_type, chosen.reward_value, { ...streak, streak_coins: newCoins });

      await admin.from("event_shop_mystery_openings").insert({
        visitor_id: visitorId,
        box_id: boxId,
        cost_paid: finalCost,
        rarity: chosen.rarity,
        reward_type: chosen.reward_type,
        reward_value: chosen.reward_value,
        reward_label: chosen.reward_label,
      });

      await bumpSpender(admin, visitorId, finalCost);
      await pushActivity(admin, visitorId, "mystery", `${box.name} → ${chosen.reward_label}`, chosen.icon || box.icon, chosen.rarity);

      if (chosen.rarity === "legendary") {
        await admin.from("notifications").insert({
          visitor_id: visitorId,
          title: `🌟 LEGENDARY DROP!`,
          message: `${box.name}: ${chosen.reward_label}`,
          type: "event_shop",
        });
      }

      return Response.json({ success: true, cost: finalCost, reward: chosen }, { headers: corsHeaders });
    }

    // BUY DAILY ROTATION ITEM
    if (action === "buy_daily") {
      const { itemId } = body;
      await ensureDailyRotation(admin, today);
      const { data: slot } = await admin
        .from("event_shop_daily_active")
        .select("*, item:event_shop_daily_rotation(*)")
        .eq("rotation_date", today)
        .eq("item_id", itemId)
        .maybeSingle();
      if (!slot) return Response.json({ error: "Item tidak tersedia hari ini" }, { status: 404, headers: corsHeaders });

      const { count: alreadyBought } = await admin
        .from("event_shop_daily_purchases")
        .select("id", { count: "exact", head: true })
        .eq("visitor_id", visitorId)
        .eq("item_id", itemId)
        .eq("purchase_date", today);
      if ((alreadyBought ?? 0) > 0) {
        return Response.json({ error: "Sudah dibeli hari ini, tunggu rotasi besok" }, { status: 400, headers: corsHeaders });
      }

      const lifetimeSpent = await getLifetimeSpent(admin, visitorId);
      const tierInfo = calculateTier(lifetimeSpent);
      const item = slot.item;
      const baseAfterSlot = Math.floor(item.base_price_coins * (1 - slot.discount_pct / 100));
      const finalCost = Math.max(1, Math.floor(baseAfterSlot * (1 - tierInfo.discount / 100)));

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });
      if ((streak.streak_coins || 0) < finalCost) {
        return Response.json({ error: `Coins kurang. Butuh ${finalCost}` }, { status: 400, headers: corsHeaders });
      }

      const newCoins = (streak.streak_coins || 0) - finalCost;
      await admin.from("daily_streaks").update({ streak_coins: newCoins }).eq("id", streak.id);
      await applyReward(admin, visitorId, item.reward_type, item.reward_value, { ...streak, streak_coins: newCoins });

      await admin.from("event_shop_daily_purchases").insert({
        visitor_id: visitorId,
        item_id: itemId,
        cost_paid: finalCost,
        purchase_date: today,
      });

      await bumpSpender(admin, visitorId, finalCost);
      await pushActivity(admin, visitorId, "daily", item.name, item.icon, "rare");

      return Response.json({ success: true, cost: finalCost, reward_label: item.reward_label }, { headers: corsHeaders });
    }

    // WISHLIST TOGGLE
    if (action === "toggle_wishlist") {
      const { itemKind, itemId } = body;
      const { data: existing } = await admin
        .from("event_shop_wishlist")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("item_kind", itemKind)
        .eq("item_id", itemId)
        .maybeSingle();
      if (existing) {
        await admin.from("event_shop_wishlist").delete().eq("id", existing.id);
        return Response.json({ success: true, wishlisted: false }, { headers: corsHeaders });
      }
      await admin.from("event_shop_wishlist").insert({
        visitor_id: visitorId,
        item_kind: itemKind,
        item_id: itemId,
      });
      return Response.json({ success: true, wishlisted: true }, { headers: corsHeaders });
    }

    // ============ NEW FEATURES ============

    // Helper: check VIP active
    const getVipStatus = async (vid: string) => {
      const { data } = await admin.from("event_shop_vip_pass").select("*").eq("visitor_id", vid).maybeSingle();
      if (!data) return { active: false, pass: null };
      const active = new Date(data.expires_at).getTime() > Date.now();
      return { active, pass: data };
    };

    // VIP applies extra 20% off on top
    const applyVipDiscount = (price: number, vipActive: boolean) =>
      vipActive ? Math.max(1, Math.floor(price * 0.8)) : price;

    // ============ SHOP EXTRAS OVERVIEW ============
    if (action === "extras_overview") {
      const lifetimeSpent = await getLifetimeSpent(admin, visitorId);
      const tierInfo = calculateTier(lifetimeSpent);
      const vip = await getVipStatus(visitorId);
      const applyDisc = (p: number) => Math.max(1, Math.floor(p * (1 - tierInfo.discount / 100)));

      const [flashRes, gachaRes, achRes, achPurchRes, flashPurchRes, vipFreeBoxRes, gachaHistRes] = await Promise.all([
        admin.from("event_shop_flash_deals").select("*").eq("is_active", true).gt("ends_at", new Date().toISOString()).order("sort_order"),
        admin.from("event_shop_gacha_items").select("*").eq("is_active", true),
        admin.from("event_shop_achievement_items").select("*").eq("is_active", true).order("sort_order"),
        admin.from("event_shop_achievement_purchases").select("item_id").eq("visitor_id", visitorId),
        admin.from("event_shop_flash_purchases").select("deal_id").eq("visitor_id", visitorId),
        Promise.resolve({ data: null }),
        admin.from("event_shop_gacha_history").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(5),
      ]);

      const flashBoughtSet = new Set((flashPurchRes.data ?? []).map((r: any) => r.deal_id));
      const achBoughtSet = new Set((achPurchRes.data ?? []).map((r: any) => r.item_id));

      const flashDeals = (flashRes.data ?? []).map((d: any) => {
        const finalPrice = applyVipDiscount(applyDisc(d.flash_price), vip.active);
        const remaining = Math.max(0, d.total_stock - d.sold_count);
        const secondsLeft = Math.max(0, Math.floor((new Date(d.ends_at).getTime() - Date.now()) / 1000));
        return {
          ...d,
          final_price: finalPrice,
          remaining,
          seconds_left: secondsLeft,
          already_bought: flashBoughtSet.has(d.id),
          can_buy: remaining > 0 && !flashBoughtSet.has(d.id) && secondsLeft > 0,
        };
      });

      const achievementItems = (achRes.data ?? []).map((a: any) => {
        const unlocked = lifetimeSpent >= a.unlock_threshold;
        const finalPrice = applyVipDiscount(applyDisc(a.price_coins), vip.active);
        return {
          ...a,
          final_price: finalPrice,
          unlocked,
          progress_pct: Math.min(100, Math.round((lifetimeSpent / a.unlock_threshold) * 100)),
          already_bought: achBoughtSet.has(a.id),
          can_buy: unlocked && !achBoughtSet.has(a.id),
        };
      });

      // Login calendar: 30-day cycle from first claim
      const { data: cycleStart } = await admin.from("event_shop_login_calendar")
        .select("cycle_start").eq("visitor_id", visitorId).order("cycle_start", { ascending: false }).limit(1).maybeSingle();
      
      const todayDate = new Date(today);
      let activeCycleStart = today;
      if (cycleStart) {
        const cs = new Date(cycleStart.cycle_start);
        const daysDiff = Math.floor((todayDate.getTime() - cs.getTime()) / (24 * 3600 * 1000));
        if (daysDiff < 30) activeCycleStart = cycleStart.cycle_start;
      }

      const { data: cycleClaims } = await admin.from("event_shop_login_calendar")
        .select("day_number").eq("visitor_id", visitorId).eq("cycle_start", activeCycleStart);
      const claimedDays = new Set((cycleClaims ?? []).map((c: any) => c.day_number));
      const currentDayInCycle = Math.min(30, Math.floor((todayDate.getTime() - new Date(activeCycleStart).getTime()) / (24 * 3600 * 1000)) + 1);

      // Login rewards table
      const loginRewards = Array.from({ length: 30 }, (_, i) => {
        const day = i + 1;
        let reward_type = "streak_coins", reward_value = 50, reward_label = "+50 Coins", icon = "🪙";
        if (day === 7) { reward_value = 500; reward_label = "+500 Coins"; icon = "💰"; }
        else if (day === 14) { reward_type = "freeze"; reward_value = 2; reward_label = "+2 Freeze"; icon = "❄️"; }
        else if (day === 21) { reward_type = "double_xp"; reward_value = 4; reward_label = "Double XP 4j"; icon = "⚡"; }
        else if (day === 30) { reward_value = 5000; reward_label = "+5000 Coins MEGA"; icon = "💎"; }
        else if (day % 5 === 0) { reward_value = 200; reward_label = "+200 Coins"; icon = "💰"; }
        else { reward_value = 50 + (day * 5); reward_label = `+${50 + day * 5} Coins`; }
        return {
          day,
          reward_type,
          reward_value,
          reward_label,
          icon,
          claimed: claimedDays.has(day),
          claimable: day <= currentDayInCycle && !claimedDays.has(day),
          is_today: day === currentDayInCycle,
          is_milestone: [7, 14, 21, 30].includes(day),
        };
      });

      // VIP free box availability
      let vipFreeBoxReady = false;
      if (vip.active) {
        const lastClaim = vip.pass?.free_box_last_claim;
        vipFreeBoxReady = !lastClaim || lastClaim < today;
      }

      return Response.json({
        tier: tierInfo,
        lifetime_spent: lifetimeSpent,
        vip: {
          active: vip.active,
          expires_at: vip.pass?.expires_at || null,
          free_box_ready: vipFreeBoxReady,
          price_coins: 5000,
          duration_days: 7,
        },
        flash_deals: flashDeals,
        gacha_items: (gachaRes.data ?? []),
        gacha_history: gachaHistRes.data ?? [],
        gacha_spin_cost: applyVipDiscount(applyDisc(300), vip.active),
        achievement_items: achievementItems,
        login_calendar: {
          cycle_start: activeCycleStart,
          current_day: currentDayInCycle,
          rewards: loginRewards,
        },
      }, { headers: corsHeaders });
    }

    // ============ FLASH DEAL BUY ============
    if (action === "buy_flash") {
      const { dealId } = body;
      const { data: deal } = await admin.from("event_shop_flash_deals").select("*").eq("id", dealId).eq("is_active", true).maybeSingle();
      if (!deal) return Response.json({ error: "Flash deal tidak ditemukan" }, { status: 404, headers: corsHeaders });
      if (new Date(deal.ends_at).getTime() < Date.now()) return Response.json({ error: "Flash deal sudah berakhir" }, { status: 400, headers: corsHeaders });
      if (deal.sold_count >= deal.total_stock) return Response.json({ error: "Stok habis" }, { status: 400, headers: corsHeaders });

      const { count: alreadyBought } = await admin.from("event_shop_flash_purchases")
        .select("id", { count: "exact", head: true }).eq("visitor_id", visitorId).eq("deal_id", dealId);
      if ((alreadyBought ?? 0) > 0) return Response.json({ error: "Sudah pernah dibeli" }, { status: 400, headers: corsHeaders });

      const lifetimeSpent = await getLifetimeSpent(admin, visitorId);
      const tierInfo = calculateTier(lifetimeSpent);
      const vip = await getVipStatus(visitorId);
      const finalCost = applyVipDiscount(Math.max(1, Math.floor(deal.flash_price * (1 - tierInfo.discount / 100))), vip.active);

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });
      if ((streak.streak_coins || 0) < finalCost) return Response.json({ error: `Coins kurang. Butuh ${finalCost}` }, { status: 400, headers: corsHeaders });

      const newCoins = streak.streak_coins - finalCost;
      await admin.from("daily_streaks").update({ streak_coins: newCoins }).eq("id", streak.id);
      await applyReward(admin, visitorId, deal.reward_type, deal.reward_value, { ...streak, streak_coins: newCoins });
      await admin.from("event_shop_flash_deals").update({ sold_count: deal.sold_count + 1 }).eq("id", dealId);
      await admin.from("event_shop_flash_purchases").insert({
        visitor_id: visitorId, deal_id: dealId, cost_paid: finalCost,
        reward_type: deal.reward_type, reward_value: deal.reward_value,
      });
      await bumpSpender(admin, visitorId, finalCost);
      await pushActivity(admin, visitorId, "flash", deal.name, deal.icon, "epic");
      return Response.json({ success: true, cost: finalCost, reward_label: deal.reward_label }, { headers: corsHeaders });
    }

    // ============ GACHA SPIN ============
    if (action === "gacha_spin") {
      const { isFree } = body;
      const { data: pool } = await admin.from("event_shop_gacha_items").select("*").eq("is_active", true);
      if (!pool || pool.length === 0) return Response.json({ error: "Gacha kosong" }, { status: 400, headers: corsHeaders });

      const lifetimeSpent = await getLifetimeSpent(admin, visitorId);
      const tierInfo = calculateTier(lifetimeSpent);
      const vip = await getVipStatus(visitorId);

      let finalCost = 0;
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });

      if (isFree) {
        if (!vip.active) return Response.json({ error: "Free spin hanya untuk VIP" }, { status: 403, headers: corsHeaders });
        if (vip.pass?.free_box_last_claim && vip.pass.free_box_last_claim >= today) {
          return Response.json({ error: "Free spin VIP sudah dipakai hari ini" }, { status: 400, headers: corsHeaders });
        }
        await admin.from("event_shop_vip_pass").update({ free_box_last_claim: today }).eq("visitor_id", visitorId);
      } else {
        finalCost = applyVipDiscount(Math.max(1, Math.floor(300 * (1 - tierInfo.discount / 100))), vip.active);
        if ((streak.streak_coins || 0) < finalCost) return Response.json({ error: `Coins kurang. Butuh ${finalCost}` }, { status: 400, headers: corsHeaders });
        await admin.from("daily_streaks").update({ streak_coins: streak.streak_coins - finalCost }).eq("id", streak.id);
      }

      // Weighted pick
      const totalWeight = pool.reduce((s: number, x: any) => s + (x.weight || 1), 0);
      let r = Math.random() * totalWeight;
      let chosen = pool[0];
      for (const p of pool) {
        r -= (p.weight || 1);
        if (r <= 0) { chosen = p; break; }
      }

      const updatedStreak = { ...streak, streak_coins: streak.streak_coins - finalCost };
      const rewardTypeMap: Record<string, string> = { auto_hint: "hint", extra_life: "life" };
      const mappedType = rewardTypeMap[chosen.reward_type] || chosen.reward_type;
      await applyReward(admin, visitorId, mappedType, chosen.reward_value, updatedStreak);

      await admin.from("event_shop_gacha_history").insert({
        visitor_id: visitorId, item_id: chosen.id, cost_paid: finalCost,
        rarity: chosen.rarity, reward_label: chosen.reward_label,
        reward_type: chosen.reward_type, reward_value: chosen.reward_value,
      });
      if (finalCost > 0) await bumpSpender(admin, visitorId, finalCost);
      await pushActivity(admin, visitorId, "gacha", chosen.name, chosen.icon, chosen.rarity);
      if (chosen.rarity === "legendary") {
        await admin.from("notifications").insert({
          visitor_id: visitorId, title: `🌟 LEGENDARY GACHA!`,
          message: `${chosen.name}: ${chosen.reward_label}`, type: "event_shop",
        });
      }
      return Response.json({ success: true, cost: finalCost, reward: chosen, isFree: !!isFree }, { headers: corsHeaders });
    }

    // ============ VIP PASS BUY ============
    if (action === "buy_vip") {
      const VIP_PRICE = 5000;
      const lifetimeSpent = await getLifetimeSpent(admin, visitorId);
      const tierInfo = calculateTier(lifetimeSpent);
      const finalCost = Math.max(1, Math.floor(VIP_PRICE * (1 - tierInfo.discount / 100)));
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });
      if ((streak.streak_coins || 0) < finalCost) return Response.json({ error: `Coins kurang. Butuh ${finalCost}` }, { status: 400, headers: corsHeaders });

      await admin.from("daily_streaks").update({ streak_coins: streak.streak_coins - finalCost }).eq("id", streak.id);

      const { data: existing } = await admin.from("event_shop_vip_pass").select("*").eq("visitor_id", visitorId).maybeSingle();
      const baseMs = existing && new Date(existing.expires_at).getTime() > Date.now()
        ? new Date(existing.expires_at).getTime() : Date.now();
      const newExpires = new Date(baseMs + 7 * 24 * 3600 * 1000).toISOString();
      if (existing) {
        await admin.from("event_shop_vip_pass").update({ expires_at: newExpires }).eq("visitor_id", visitorId);
      } else {
        await admin.from("event_shop_vip_pass").insert({ visitor_id: visitorId, expires_at: newExpires });
      }

      await bumpSpender(admin, visitorId, finalCost);
      await pushActivity(admin, visitorId, "vip", "VIP Membership Pass", "👑", "legendary");
      await admin.from("notifications").insert({
        visitor_id: visitorId, title: `👑 VIP Aktif!`,
        message: `Selamat! Diskon ekstra 20% + free gacha harian aktif 7 hari.`, type: "event_shop",
      });
      return Response.json({ success: true, cost: finalCost, expires_at: newExpires }, { headers: corsHeaders });
    }

    // ============ LOGIN CALENDAR CLAIM ============
    if (action === "claim_login_day") {
      const { day } = body;
      if (!day || day < 1 || day > 30) return Response.json({ error: "Hari tidak valid" }, { status: 400, headers: corsHeaders });

      // Find/create cycle
      const { data: lastCycle } = await admin.from("event_shop_login_calendar")
        .select("cycle_start").eq("visitor_id", visitorId).order("cycle_start", { ascending: false }).limit(1).maybeSingle();
      const todayDate = new Date(today);
      let cycleStart = today;
      if (lastCycle) {
        const cs = new Date(lastCycle.cycle_start);
        const daysDiff = Math.floor((todayDate.getTime() - cs.getTime()) / (24 * 3600 * 1000));
        if (daysDiff < 30) cycleStart = lastCycle.cycle_start;
      }
      const currentDay = Math.min(30, Math.floor((todayDate.getTime() - new Date(cycleStart).getTime()) / (24 * 3600 * 1000)) + 1);
      if (day > currentDay) return Response.json({ error: "Belum waktunya claim" }, { status: 400, headers: corsHeaders });

      const { data: existing } = await admin.from("event_shop_login_calendar")
        .select("id").eq("visitor_id", visitorId).eq("cycle_start", cycleStart).eq("day_number", day).maybeSingle();
      if (existing) return Response.json({ error: "Sudah diklaim" }, { status: 400, headers: corsHeaders });

      // Determine reward
      let reward_type = "streak_coins", reward_value = 50, reward_label = "+50 Coins";
      if (day === 7) { reward_value = 500; reward_label = "+500 Coins"; }
      else if (day === 14) { reward_type = "freeze"; reward_value = 2; reward_label = "+2 Freeze"; }
      else if (day === 21) { reward_type = "double_xp"; reward_value = 4; reward_label = "Double XP 4 jam"; }
      else if (day === 30) { reward_value = 5000; reward_label = "+5000 Coins MEGA"; }
      else if (day % 5 === 0) { reward_value = 200; reward_label = "+200 Coins"; }
      else { reward_value = 50 + (day * 5); reward_label = `+${50 + day * 5} Coins`; }

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });
      await applyReward(admin, visitorId, reward_type, reward_value, streak);

      await admin.from("event_shop_login_calendar").insert({
        visitor_id: visitorId, cycle_start: cycleStart, day_number: day,
        reward_type, reward_value, reward_label,
      });
      return Response.json({ success: true, reward_label, day }, { headers: corsHeaders });
    }

    // ============ ACHIEVEMENT ITEM BUY ============
    if (action === "buy_achievement") {
      const { itemId } = body;
      const { data: item } = await admin.from("event_shop_achievement_items").select("*").eq("id", itemId).eq("is_active", true).maybeSingle();
      if (!item) return Response.json({ error: "Item tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const lifetimeSpent = await getLifetimeSpent(admin, visitorId);
      if (lifetimeSpent < item.unlock_threshold) {
        return Response.json({ error: `Belum unlock! Butuh spending ${item.unlock_threshold.toLocaleString()} coins` }, { status: 403, headers: corsHeaders });
      }

      const { data: bought } = await admin.from("event_shop_achievement_purchases")
        .select("id").eq("visitor_id", visitorId).eq("item_id", itemId).maybeSingle();
      if (bought) return Response.json({ error: "Sudah dibeli sebelumnya" }, { status: 400, headers: corsHeaders });

      const tierInfo = calculateTier(lifetimeSpent);
      const vip = await getVipStatus(visitorId);
      const finalCost = applyVipDiscount(Math.max(1, Math.floor(item.price_coins * (1 - tierInfo.discount / 100))), vip.active);

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });
      if ((streak.streak_coins || 0) < finalCost) return Response.json({ error: `Coins kurang. Butuh ${finalCost}` }, { status: 400, headers: corsHeaders });

      const newCoins = streak.streak_coins - finalCost;
      await admin.from("daily_streaks").update({ streak_coins: newCoins }).eq("id", streak.id);
      await applyReward(admin, visitorId, item.reward_type, item.reward_value, { ...streak, streak_coins: newCoins });
      await admin.from("event_shop_achievement_purchases").insert({
        visitor_id: visitorId, item_id: itemId, cost_paid: finalCost,
        reward_type: item.reward_type, reward_value: item.reward_value,
      });
      await bumpSpender(admin, visitorId, finalCost);
      await pushActivity(admin, visitorId, "achievement", item.name, item.icon, "legendary");
      return Response.json({ success: true, cost: finalCost, reward_label: item.reward_label }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
