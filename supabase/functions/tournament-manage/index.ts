import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, visitorId, points = 0, won = false } = await req.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get active tournament
    const { data: tournament } = await admin
      .from("tournaments")
      .select("*")
      .eq("is_active", true)
      .eq("is_settled", false)
      .lte("starts_at", new Date().toISOString())
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (action === "get") {
      if (!tournament) return Response.json({ tournament: null, leaderboard: [] }, { headers: corsHeaders });
      const { data: entries } = await admin
        .from("tournament_entries")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("total_points", { ascending: false })
        .limit(20);

      const vids = (entries || []).map((e: any) => e.visitor_id);
      const { data: profiles } = await admin.from("game_profiles").select("visitor_id, display_name, avatar_url").in("visitor_id", vids.length ? vids : ["__none__"]);
      const profMap = Object.fromEntries((profiles || []).map((p: any) => [p.visitor_id, p]));

      const leaderboard = (entries || []).map((e: any) => ({
        ...e,
        display_name: profMap[e.visitor_id]?.display_name || "Pemain",
        avatar_url: profMap[e.visitor_id]?.avatar_url || null,
      }));

      let myEntry = null;
      if (visitorId) {
        myEntry = (entries || []).find((e: any) => e.visitor_id === visitorId) || null;
      }

      return Response.json({ tournament, leaderboard, myEntry }, { headers: corsHeaders });
    }

    if (action === "submit_score") {
      if (!tournament || !visitorId) return Response.json({ skipped: true }, { headers: corsHeaders });
      const { data: existing } = await admin
        .from("tournament_entries")
        .select("*")
        .eq("tournament_id", tournament.id)
        .eq("visitor_id", visitorId)
        .maybeSingle();

      if (existing) {
        await admin.from("tournament_entries").update({
          total_points: existing.total_points + points,
          total_wins: existing.total_wins + (won ? 1 : 0),
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await admin.from("tournament_entries").insert({
          tournament_id: tournament.id,
          visitor_id: visitorId,
          total_points: points,
          total_wins: won ? 1 : 0,
        });
      }
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "settle") {
      // Settle ended tournaments — distribute prizes
      const { data: ended } = await admin
        .from("tournaments")
        .select("*")
        .eq("is_active", true)
        .eq("is_settled", false)
        .lt("ends_at", new Date().toISOString());

      let settled = 0;
      for (const t of (ended || [])) {
        const { data: top } = await admin
          .from("tournament_entries")
          .select("*")
          .eq("tournament_id", t.id)
          .order("total_points", { ascending: false })
          .limit(3);

        const prizes = [t.prize_first, t.prize_second, t.prize_third];
        for (let i = 0; i < (top || []).length; i++) {
          const entry: any = top![i];
          const prize = prizes[i];
          if (!entry || !prize) continue;
          // Add prize as game_credit_reward log + notification
          await admin.from("balance_transactions").insert({
            visitor_id: entry.visitor_id,
            amount: 0,
            type: "tournament_prize",
            description: `🏆 Tournament "${t.name}" Rank #${i + 1}: +${prize} Game Credit`,
          });
          await admin.from("notifications").insert({
            visitor_id: entry.visitor_id,
            title: `🏆 Juara #${i + 1} Tournament!`,
            message: `Kamu dapat ${prize} Game Credit dari "${t.name}"`,
            type: "tournament",
          });
        }
        await admin.from("tournaments").update({ is_settled: true, is_active: false }).eq("id", t.id);
        settled++;
      }
      return Response.json({ settled }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
