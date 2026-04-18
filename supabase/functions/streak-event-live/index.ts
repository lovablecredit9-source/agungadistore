import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWIBWeekStart(): Date {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(wib);
  monday.setUTCDate(wib.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  // back to UTC instant
  return new Date(monday.getTime() - 7 * 60 * 60 * 1000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const weekStart = getWIBWeekStart();
    const weekStartIso = weekStart.toISOString();

    // REAL participant counts (this week)
    const [streakRes, claimsRes, questsClaimedRes, allTimeRes] = await Promise.all([
      // active streak users this week
      admin
        .from("daily_streaks")
        .select("visitor_id", { count: "exact", head: true })
        .gte("updated_at", weekStartIso),
      // total streak claims this week (sum of total_claims diff is hard; use updated_at as proxy)
      admin
        .from("daily_streaks")
        .select("total_claims")
        .gte("updated_at", weekStartIso),
      // weekly quest progresses started this week (real engagement)
      admin
        .from("weekly_quest_progress")
        .select("visitor_id", { count: "exact", head: true })
        .eq("week_start", weekStart.toISOString().split("T")[0]),
      // all time daily_streaks rows = total registered streak players
      admin
        .from("daily_streaks")
        .select("visitor_id", { count: "exact", head: true }),
    ]);

    const weeklyParticipants = streakRes.count ?? 0;
    const totalRegistered = allTimeRes.count ?? 0;
    const questEngaged = questsClaimedRes.count ?? 0;
    const totalClaimsWeek = (claimsRes.data ?? []).reduce((s, r: any) => s + (r.total_claims || 0), 0);

    // Jackpot pool grows from REAL activity
    const jackpotPool = 5000 + totalClaimsWeek * 8 + weeklyParticipants * 25 + questEngaged * 50;

    // Leaderboard top 10 by streak this week
    const { data: leaderboard } = await admin
      .from("daily_streaks")
      .select("visitor_id, current_streak, total_claims, streak_coins")
      .gte("updated_at", weekStartIso)
      .order("current_streak", { ascending: false })
      .limit(10);

    return Response.json({
      weekStart: weekStartIso,
      weeklyParticipants,
      totalRegistered,
      questEngaged,
      totalClaimsWeek,
      jackpotPool,
      leaderboard: leaderboard ?? [],
    }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
