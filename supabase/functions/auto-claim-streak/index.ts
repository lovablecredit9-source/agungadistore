import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const today = getToday();

    // Get all active subscriptions not expired
    const { data: activeSubs, error: subErr } = await admin
      .from("streak_subscriptions")
      .select("visitor_id")
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString());

    if (subErr || !activeSubs) {
      return Response.json({ error: "Gagal mengambil data langganan", details: subErr?.message }, { status: 500, headers: corsHeaders });
    }

    const visitorIds = [...new Set(activeSubs.map(s => s.visitor_id))];
    let claimed = 0;

    for (const visitorId of visitorIds) {
      // Check existing streak
      const { data: streak } = await admin
        .from("daily_streaks")
        .select("*")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      if (streak && streak.last_claim_date === today) {
        continue; // Already claimed today
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (!streak) {
        // Create new streak
        await admin.from("daily_streaks").insert({
          visitor_id: visitorId,
          last_claim_date: today,
          current_streak: 1,
          longest_streak: 1,
          total_claims: 1,
        });
        claimed++;
      } else {
        const isContinuous = streak.last_claim_date === yesterdayStr;
        const newStreak = isContinuous ? streak.current_streak + 1 : 1;
        const newLongest = Math.max(streak.longest_streak, newStreak);

        await admin.from("daily_streaks").update({
          last_claim_date: today,
          current_streak: newStreak,
          longest_streak: newLongest,
          total_claims: streak.total_claims + 1,
        }).eq("id", streak.id);
        claimed++;
      }
    }

    // Deactivate expired subscriptions
    await admin
      .from("streak_subscriptions")
      .update({ is_active: false })
      .eq("is_active", true)
      .lt("expires_at", new Date().toISOString());

    return Response.json({
      success: true,
      total_subscribers: visitorIds.length,
      claimed_today: claimed,
      date: today,
    }, { headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
