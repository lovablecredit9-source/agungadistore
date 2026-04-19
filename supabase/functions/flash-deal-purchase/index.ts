import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWIBDateStr(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split("T")[0];
}

// User dianggap Premium kalau punya Streak Pass Premium (season aktif) ATAU Game Season Pass Premium
async function checkPremium(admin: ReturnType<typeof createClient>, visitorId: string): Promise<boolean> {
  const { data: gamePass } = await admin
    .from("game_season_pass")
    .select("is_premium")
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (gamePass?.is_premium) return true;

  const { data: season } = await admin
    .from("streak_pass_seasons")
    .select("id")
    .eq("is_active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (season) {
    const { data: progress } = await admin
      .from("streak_pass_progress")
      .select("is_premium")
      .eq("visitor_id", visitorId)
      .eq("season_id", season.id)
      .maybeSingle();
    if (progress?.is_premium) return true;
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") ?? "list";
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
      if (body?.action) action = body.action;
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const visitorId = body?.visitorId || url.searchParams.get("visitorId");
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const today = getWIBDateStr();

    if (action === "list") {
      const [{ data: deals }, { data: redemptions }, isPremium, { data: prof }] = await Promise.all([
        admin.from("streak_flash_deals").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
        admin
          .from("flash_deal_redemptions")
          .select("deal_id")
          .eq("visitor_id", visitorId)
          .eq("redemption_date", today),
        checkPremium(admin, visitorId),
        admin.from("game_profiles").select("gems").eq("visitor_id", visitorId).maybeSingle(),
      ]);

      const claimedToday = new Set((redemptions ?? []).map((r: any) => r.deal_id));

      return Response.json({
        deals: (deals ?? []).map((d: any) => {
          const needsPremium = !!d.requires_premium;
          const claimed = claimedToday.has(d.id);
          const premiumOk = !needsPremium || isPremium;
          return {
            ...d,
            claimed_today: claimed,
            can_purchase: premiumOk && !claimed,
            locked_reason: !premiumOk ? "premium_required" : (claimed ? "daily_limit" : null),
          };
        }),
        is_premium: isPremium,
        user_gems: prof?.gems ?? 0,
        date: today,
      }, { headers: corsHeaders });
    }

    if (action === "purchase") {
      const { dealId, paymentMethod } = body;
      const payMethod = paymentMethod === "gem" ? "gem" : "coin";
      if (!dealId) return Response.json({ error: "dealId required" }, { status: 400, headers: corsHeaders });

      const { data: deal } = await admin.from("streak_flash_deals").select("*").eq("id", dealId).eq("is_active", true).maybeSingle();
      if (!deal) return Response.json({ error: "Flash deal tidak ditemukan" }, { status: 404, headers: corsHeaders });

      // Premium check
      if (deal.requires_premium) {
        const isPremium = await checkPremium(admin, visitorId);
        if (!isPremium) {
          return Response.json({ error: "Aktifkan Premium dulu (Streak Pass Premium atau Season Pass Premium) untuk beli flash deal ini!" }, { status: 403, headers: corsHeaders });
        }
      }

      // Daily limit check (combined for both payment methods)
      const { count: usedToday } = await admin
        .from("flash_deal_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("visitor_id", visitorId)
        .eq("deal_id", dealId)
        .eq("redemption_date", today);

      if ((usedToday ?? 0) >= (deal.daily_limit || 1)) {
        return Response.json({ error: `Hanya bisa beli ${deal.daily_limit}x per hari. Coba lagi besok!` }, { status: 400, headers: corsHeaders });
      }

      const coinCost = Math.floor(deal.original_cost * (1 - deal.discount_pct / 100));
      const gemCost = deal.cost_gems || 0;

      // Get streak (still needed for rewards)
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });

      let costPaid = 0;
      let costLabel = "";

      if (payMethod === "gem") {
        if (gemCost <= 0) {
          return Response.json({ error: "Deal ini belum tersedia untuk pembayaran Gem" }, { status: 400, headers: corsHeaders });
        }
        const { data: prof } = await admin.from("game_profiles").select("gems").eq("visitor_id", visitorId).maybeSingle();
        const userGems = prof?.gems ?? 0;
        if (userGems < gemCost) {
          return Response.json({ error: `Gem kurang. Butuh ${gemCost} 💎, kamu punya ${userGems} 💎` }, { status: 400, headers: corsHeaders });
        }
        costPaid = gemCost;
        costLabel = `${gemCost} 💎`;
      } else {
        if ((streak.streak_coins || 0) < coinCost) {
          return Response.json({ error: `Coins kurang. Butuh ${coinCost} 🪙, kamu punya ${streak.streak_coins || 0} 🪙` }, { status: 400, headers: corsHeaders });
        }
        costPaid = coinCost;
        costLabel = `${coinCost} 🪙`;
      }

      // Apply reward
      let rewardSummary = "";
      if (deal.reward_type === "streak_freeze") {
        await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + deal.reward_value }).eq("id", streak.id);
        rewardSummary = `+${deal.reward_value} Streak Freeze`;
      } else if (deal.reward_type === "double_xp") {
        const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
        const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now()
          ? new Date(pu.double_xp_until).getTime()
          : Date.now();
        const newUntil = new Date(baseMs + deal.reward_value * 3600 * 1000).toISOString();
        if (pu) await admin.from("user_power_ups").update({ double_xp_until: newUntil }).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, double_xp_until: newUntil });
        rewardSummary = `Double XP aktif ${deal.reward_value} jam`;
      } else if (deal.reward_type === "mystery_bundle") {
        const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
        const updates = {
          auto_hint: (pu?.auto_hint || 0) + 5,
          extra_life: (pu?.extra_life || 0) + 3,
        };
        if (pu) await admin.from("user_power_ups").update(updates).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...updates });
        rewardSummary = "+5 Hint Otomatis, +3 Nyawa Ekstra";
      } else if (deal.reward_type === "vip_pack") {
        const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
        const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now()
          ? new Date(pu.double_xp_until).getTime()
          : Date.now();
        const updates = {
          auto_hint: (pu?.auto_hint || 0) + 10,
          extra_life: (pu?.extra_life || 0) + 5,
          time_freeze: (pu?.time_freeze || 0) + 5,
          double_xp_until: new Date(baseMs + 12 * 3600 * 1000).toISOString(),
        };
        if (pu) await admin.from("user_power_ups").update(updates).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...updates });
        await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + 2 }).eq("id", streak.id);
        rewardSummary = "+10 Hint, +5 Nyawa, +5 Time Freeze, +2 Freeze, Double XP 12j";
      } else {
        return Response.json({ error: "Tipe hadiah tidak dikenal" }, { status: 400, headers: corsHeaders });
      }

      // Deduct payment
      if (payMethod === "gem") {
        const { data: prof } = await admin.from("game_profiles").select("gems").eq("visitor_id", visitorId).maybeSingle();
        await admin.from("game_profiles").update({ gems: (prof?.gems || 0) - costPaid }).eq("visitor_id", visitorId);
        await admin.from("gem_transactions").insert({
          visitor_id: visitorId,
          amount: -costPaid,
          type: "flash_deal",
          description: `Flash Deal: ${deal.name} (-${costPaid} 💎)`,
          reference_id: dealId,
        });
      } else {
        await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) - costPaid }).eq("id", streak.id);
      }

      // Log redemption
      await admin.from("flash_deal_redemptions").insert({
        visitor_id: visitorId,
        deal_id: dealId,
        redemption_date: today,
        cost_paid: costPaid,
        reward_type: deal.reward_type,
        reward_value: deal.reward_value,
        payment_method: payMethod,
      });

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `⚡ Flash Deal: ${deal.name}`,
        message: `${rewardSummary} — bayar ${costLabel}`,
        type: "flash_deal",
      });

      return Response.json({ success: true, cost: costPaid, payment_method: payMethod, costLabel, rewardSummary, deal }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
