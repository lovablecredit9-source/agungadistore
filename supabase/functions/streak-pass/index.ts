import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getActiveSeason(admin: ReturnType<typeof createClient>) {
  const { data } = await admin
    .from("streak_pass_seasons")
    .select("*")
    .eq("is_active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getOrCreateProgress(admin: ReturnType<typeof createClient>, visitorId: string, seasonId: string) {
  const { data } = await admin
    .from("streak_pass_progress")
    .select("*")
    .eq("visitor_id", visitorId)
    .eq("season_id", seasonId)
    .maybeSingle();
  if (data) return data;
  const { data: created } = await admin
    .from("streak_pass_progress")
    .insert({ visitor_id: visitorId, season_id: seasonId, total_xp: 0 })
    .select()
    .single();
  return created;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "status";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "status") {
      const visitorId = url.searchParams.get("visitorId");
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ season: null, tiers: [], progress: null }, { headers: corsHeaders });
      const [{ data: tiers }, progress] = await Promise.all([
        admin.from("streak_pass_tiers").select("*").eq("season_id", season.id).order("tier_level", { ascending: true }),
        getOrCreateProgress(admin, visitorId, season.id),
      ]);
      return Response.json({ season, tiers: tiers ?? [], progress }, { headers: corsHeaders });
    }

    if (action === "claim_tier") {
      const { visitorId, tierLevel, track } = await req.json();
      if (!visitorId || !tierLevel || !track) return Response.json({ error: "visitorId, tierLevel, track required" }, { status: 400, headers: corsHeaders });
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ error: "Tidak ada season aktif" }, { status: 404, headers: corsHeaders });

      const { data: tier } = await admin
        .from("streak_pass_tiers")
        .select("*")
        .eq("season_id", season.id)
        .eq("tier_level", tierLevel)
        .maybeSingle();
      if (!tier) return Response.json({ error: "Tier tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const progress = await getOrCreateProgress(admin, visitorId, season.id);
      if ((progress.total_xp || 0) < tier.xp_required) {
        return Response.json({ error: "XP belum cukup" }, { status: 400, headers: corsHeaders });
      }

      const isPremiumTrack = track === "premium";
      if (isPremiumTrack && !progress.is_premium) {
        return Response.json({ error: "Butuh Streak Pass Premium" }, { status: 403, headers: corsHeaders });
      }

      const claimedField = isPremiumTrack ? "claimed_premium_tiers" : "claimed_free_tiers";
      const claimed: number[] = progress[claimedField] ?? [];
      if (claimed.includes(tierLevel)) {
        return Response.json({ error: "Tier sudah diklaim" }, { status: 400, headers: corsHeaders });
      }

      const rType = isPremiumTrack ? tier.premium_reward_type : tier.free_reward_type;
      const rValue = isPremiumTrack ? tier.premium_reward_value : tier.free_reward_value;
      const rLabel = isPremiumTrack ? tier.premium_reward_label : tier.free_reward_label;

      if (!rType) return Response.json({ error: "Tier ini tidak punya reward" }, { status: 400, headers: corsHeaders });

      // Apply
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (streak) {
        const updates: Record<string, unknown> = {};
        if (rType === "streak_coins") updates.streak_coins = (streak.streak_coins || 0) + rValue;
        else if (rType === "bonus_points") updates.total_bonus_points = (streak.total_bonus_points || 0) + rValue;
        else if (rType === "freeze_token") updates.freeze_count = (streak.freeze_count || 0) + rValue;
        if (Object.keys(updates).length > 0) await admin.from("daily_streaks").update(updates).eq("id", streak.id);
      }
      if (rType === "game_credit") {
        const { data: gc } = await admin.from("user_game_credits").select("id, credits").eq("visitor_id", visitorId).maybeSingle();
        if (gc) await admin.from("user_game_credits").update({ credits: (gc.credits || 0) + rValue }).eq("id", gc.id);
        else await admin.from("user_game_credits").insert({ visitor_id: visitorId, credits: rValue });
      }

      const newClaimed = [...claimed, tierLevel];
      await admin.from("streak_pass_progress").update({ [claimedField]: newClaimed }).eq("id", progress.id);

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🏅 Streak Pass Tier ${tierLevel}`,
        message: `${isPremiumTrack ? "💎 Premium: " : ""}${rLabel}`,
        type: "streak_pass",
      });

      return Response.json({ success: true, reward: { type: rType, value: rValue, label: rLabel } }, { headers: corsHeaders });
    }

    if (action === "buy_premium") {
      const { visitorId } = await req.json();
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ error: "Tidak ada season aktif" }, { status: 404, headers: corsHeaders });

      const progress = await getOrCreateProgress(admin, visitorId, season.id);
      if (progress.is_premium) return Response.json({ error: "Sudah Premium" }, { status: 400, headers: corsHeaders });

      // Check balance
      const { data: balance } = await admin.from("user_balances").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!balance) return Response.json({ error: "Login dulu untuk membeli Premium" }, { status: 401, headers: corsHeaders });
      if ((balance.balance || 0) < season.premium_price) {
        return Response.json({ error: `Saldo tidak cukup. Butuh Rp${Number(season.premium_price).toLocaleString("id-ID")}` }, { status: 400, headers: corsHeaders });
      }

      await admin.from("user_balances").update({ balance: balance.balance - season.premium_price }).eq("id", balance.id);
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        amount: -season.premium_price,
        type: "streak_pass_premium",
        description: `Streak Pass Premium - ${season.name}`,
      });
      await admin.from("streak_pass_progress").update({ is_premium: true, premium_purchased_at: new Date().toISOString() }).eq("id", progress.id);

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `💎 Streak Pass Premium Aktif!`,
        message: `Selamat! Kamu sekarang bisa klaim semua reward Premium di ${season.name}`,
        type: "streak_pass",
      });

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
