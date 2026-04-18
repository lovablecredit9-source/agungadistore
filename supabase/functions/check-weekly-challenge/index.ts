import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, eventType, increment = 1, claimChallengeId } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Claim reward
    if (claimChallengeId) {
      const { data: progress } = await admin
        .from("weekly_challenge_progress")
        .select("*, weekly_challenges(*)")
        .eq("challenge_id", claimChallengeId)
        .eq("visitor_id", visitorId)
        .maybeSingle();

      if (!progress) return Response.json({ error: "Belum ada progres" }, { headers: corsHeaders });
      if (progress.claimed_at) return Response.json({ error: "Reward sudah diklaim" }, { headers: corsHeaders });
      const ch = (progress as any).weekly_challenges;
      if (!ch || progress.current_value < ch.target_value) {
        return Response.json({ error: "Tantangan belum selesai" }, { headers: corsHeaders });
      }

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (streak) {
        await admin.from("daily_streaks").update({
          streak_coins: (streak.streak_coins || 0) + ch.reward_coins,
        }).eq("id", streak.id);
      }
      await admin.from("weekly_challenge_progress").update({
        claimed_at: new Date().toISOString(),
      }).eq("id", progress.id);

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🏆 Tantangan Selesai!`,
        message: `Kamu dapat ${ch.reward_coins} Streak Coins dari "${ch.title}"`,
        type: "weekly_challenge",
      });

      return Response.json({ success: true, reward_coins: ch.reward_coins }, { headers: corsHeaders });
    }

    // Update progress for active challenges matching eventType
    const { data: challenges } = await admin
      .from("weekly_challenges")
      .select("*")
      .eq("is_active", true)
      .eq("challenge_type", eventType)
      .lte("starts_at", new Date().toISOString())
      .gte("ends_at", new Date().toISOString());

    if (!challenges || challenges.length === 0) return Response.json({ updated: 0 }, { headers: corsHeaders });

    let updated = 0;
    for (const ch of challenges) {
      const { data: existing } = await admin
        .from("weekly_challenge_progress")
        .select("*")
        .eq("challenge_id", ch.id)
        .eq("visitor_id", visitorId)
        .maybeSingle();

      if (existing) {
        if (existing.is_completed) continue;
        const newVal = existing.current_value + increment;
        await admin.from("weekly_challenge_progress").update({
          current_value: newVal,
          is_completed: newVal >= ch.target_value,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await admin.from("weekly_challenge_progress").insert({
          challenge_id: ch.id,
          visitor_id: visitorId,
          current_value: increment,
          is_completed: increment >= ch.target_value,
        });
      }
      updated++;
    }

    return Response.json({ updated }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
