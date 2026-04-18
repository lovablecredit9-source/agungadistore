import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId } = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Top 10 longest streaks (currently active)
    const { data: top } = await admin
      .from("daily_streaks")
      .select("visitor_id, current_streak, longest_streak, total_claims, streak_coins")
      .order("current_streak", { ascending: false })
      .limit(10);

    const visitorIds = (top || []).map(t => t.visitor_id);

    // Get profile names
    const { data: streakProfiles } = await admin
      .from("streak_profiles")
      .select("visitor_id, username, avatar_url")
      .in("visitor_id", visitorIds);
    const { data: gameProfiles } = await admin
      .from("game_profiles")
      .select("visitor_id, display_name, avatar_url")
      .in("visitor_id", visitorIds);
    const { data: balProfiles } = await admin
      .from("user_balances")
      .select("visitor_id, username")
      .in("visitor_id", visitorIds);

    const nameMap = new Map<string, { name: string; avatar: string | null }>();
    streakProfiles?.forEach((p: any) => nameMap.set(p.visitor_id, { name: p.username, avatar: p.avatar_url }));
    gameProfiles?.forEach((p: any) => {
      if (!nameMap.has(p.visitor_id)) nameMap.set(p.visitor_id, { name: p.display_name, avatar: p.avatar_url });
    });
    balProfiles?.forEach((p: any) => {
      if (!nameMap.has(p.visitor_id)) nameMap.set(p.visitor_id, { name: p.username, avatar: null });
    });

    const ranked = (top || []).map((t: any, i: number) => {
      const meta = nameMap.get(t.visitor_id);
      return {
        rank: i + 1,
        visitor_id: t.visitor_id,
        name: meta?.name || `Pemain ${t.visitor_id.slice(0, 6)}`,
        avatar_url: meta?.avatar || null,
        current_streak: t.current_streak,
        longest_streak: t.longest_streak,
        total_claims: t.total_claims,
        streak_coins: t.streak_coins,
        is_me: t.visitor_id === visitorId,
      };
    });

    // Find user's own rank if not in top 10
    let myRank = ranked.find(r => r.is_me);
    if (!myRank && visitorId) {
      const { data: me } = await admin
        .from("daily_streaks")
        .select("current_streak, longest_streak, total_claims, streak_coins")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (me) {
        const { count } = await admin
          .from("daily_streaks")
          .select("*", { count: "exact", head: true })
          .gt("current_streak", me.current_streak);
        myRank = {
          rank: (count || 0) + 1,
          visitor_id: visitorId,
          name: "Saya",
          avatar_url: null,
          current_streak: me.current_streak,
          longest_streak: me.longest_streak,
          total_claims: me.total_claims,
          streak_coins: me.streak_coins,
          is_me: true,
        };
      }
    }

    return Response.json({ leaderboard: ranked, myRank }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
