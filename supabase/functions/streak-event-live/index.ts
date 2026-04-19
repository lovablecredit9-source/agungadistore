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
  return new Date(monday.getTime() - 7 * 60 * 60 * 1000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const weekStart = getWIBWeekStart();
    const weekStartIso = weekStart.toISOString();

    const [streakRes, claimsRes, questsClaimedRes, allTimeRes] = await Promise.all([
      admin
        .from("daily_streaks")
        .select("visitor_id", { count: "exact", head: true })
        .gte("updated_at", weekStartIso),
      admin
        .from("daily_streaks")
        .select("total_claims")
        .gte("updated_at", weekStartIso),
      admin
        .from("weekly_quest_progress")
        .select("visitor_id", { count: "exact", head: true })
        .eq("week_start", weekStart.toISOString().split("T")[0]),
      admin
        .from("daily_streaks")
        .select("visitor_id", { count: "exact", head: true }),
    ]);

    const weeklyParticipants = streakRes.count ?? 0;
    const totalRegistered = allTimeRes.count ?? 0;
    const questEngaged = questsClaimedRes.count ?? 0;
    const totalClaimsWeek = (claimsRes.data ?? []).reduce((s, r: any) => s + (r.total_claims || 0), 0);

    const jackpotPool = 5000 + totalClaimsWeek * 8 + weeklyParticipants * 25 + questEngaged * 50;

    const { data: leaderboard } = await admin
      .from("daily_streaks")
      .select("visitor_id, current_streak, total_claims, streak_coins")
      .gte("updated_at", weekStartIso)
      .order("current_streak", { ascending: false })
      .limit(10);

    // Resolve display names from multiple profile sources
    const visitorIds = (leaderboard ?? []).map((l: any) => l.visitor_id);
    const nameMap = new Map<string, { name: string; avatar: string | null }>();

    if (visitorIds.length > 0) {
      const [streakProfiles, gameProfiles, balProfiles, musicProfiles] = await Promise.all([
        admin.from("streak_profiles").select("visitor_id, username, avatar_url").in("visitor_id", visitorIds),
        admin.from("game_profiles").select("visitor_id, display_name, avatar_url").in("visitor_id", visitorIds),
        admin.from("user_balances").select("visitor_id, username").in("visitor_id", visitorIds),
        admin.from("music_profiles").select("visitor_id, username, avatar_url").in("visitor_id", visitorIds),
      ]);

      streakProfiles.data?.forEach((p: any) => {
        if (p.username) nameMap.set(p.visitor_id, { name: p.username, avatar: p.avatar_url });
      });
      balProfiles.data?.forEach((p: any) => {
        if (!nameMap.has(p.visitor_id) && p.username) nameMap.set(p.visitor_id, { name: p.username, avatar: null });
      });
      gameProfiles.data?.forEach((p: any) => {
        if (!nameMap.has(p.visitor_id) && p.display_name) nameMap.set(p.visitor_id, { name: p.display_name, avatar: p.avatar_url });
      });
      musicProfiles.data?.forEach((p: any) => {
        if (!nameMap.has(p.visitor_id) && p.username) nameMap.set(p.visitor_id, { name: p.username, avatar: p.avatar_url });
      });
    }

    const enriched = (leaderboard ?? []).map((l: any) => {
      const meta = nameMap.get(l.visitor_id);
      return {
        ...l,
        display_name: meta?.name || `Pemain ${l.visitor_id.slice(0, 4)}`,
        avatar_url: meta?.avatar || null,
      };
    });

    return Response.json({
      weekStart: weekStartIso,
      weeklyParticipants,
      totalRegistered,
      questEngaged,
      totalClaimsWeek,
      jackpotPool,
      leaderboard: enriched,
    }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
