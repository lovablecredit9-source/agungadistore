import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, milestoneId, action } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: streak } = await admin
      .from("daily_streaks")
      .select("id, current_streak, longest_streak, streak_coins, freeze_count")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    const userStreak = streak?.longest_streak || 0;

    const { data: milestones } = await admin
      .from("streak_milestones")
      .select("*")
      .eq("is_active", true)
      .order("milestone_days");

    const { data: claims } = await admin
      .from("streak_milestone_claims")
      .select("milestone_id")
      .eq("visitor_id", visitorId);
    const claimedSet = new Set((claims || []).map((c: any) => c.milestone_id));

    const enriched = (milestones || []).map((m: any) => ({
      ...m,
      is_claimed: claimedSet.has(m.id),
      is_unlocked: userStreak >= m.milestone_days,
      progress: Math.min(100, (userStreak / m.milestone_days) * 100),
    }));

    if (action === "list") {
      return Response.json({
        milestones: enriched,
        currentStreak: streak?.current_streak || 0,
        longestStreak: userStreak,
      }, { headers: corsHeaders });
    }

    // Claim action
    if (!milestoneId) return Response.json({ error: "milestoneId required" }, { status: 400, headers: corsHeaders });
    const target = enriched.find((m: any) => m.id === milestoneId);
    if (!target) return Response.json({ error: "Milestone tidak ditemukan" }, { status: 404, headers: corsHeaders });
    if (!target.is_unlocked) return Response.json({ error: `Belum unlock. Butuh streak ${target.milestone_days} hari (kamu: ${userStreak})` }, { status: 400, headers: corsHeaders });
    if (target.is_claimed) return Response.json({ error: "Sudah diklaim sebelumnya" }, { status: 400, headers: corsHeaders });

    // Apply reward
    const updates: any = {};
    if (target.reward_type === "coins") {
      updates.streak_coins = (streak!.streak_coins || 0) + target.reward_value;
    } else if (target.reward_type === "freeze") {
      updates.freeze_count = (streak!.freeze_count || 0) + target.reward_value;
    }
    if (Object.keys(updates).length > 0) {
      await admin.from("daily_streaks").update(updates).eq("id", streak!.id);
    }

    await admin.from("streak_milestone_claims").insert({ visitor_id: visitorId, milestone_id: milestoneId });

    await admin.from("notifications").insert({
      visitor_id: visitorId,
      title: `${target.badge_icon} Milestone: ${target.title}`,
      message: `Hadiah: ${target.reward_type === "coins" ? `+${target.reward_value} koin` : `+${target.reward_value} freeze`}`,
      type: "milestone",
    });

    return Response.json({ success: true, milestone: target }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
