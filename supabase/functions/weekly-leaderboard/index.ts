// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function genVoucher() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 16 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

// Get current week start (Monday in WIB UTC+7)
function getWeekStart(date = new Date()): string {
  // shift to WIB
  const wib = new Date(date.getTime() + 7 * 3600 * 1000);
  const day = wib.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1 - day);
  wib.setUTCDate(wib.getUTCDate() + diff);
  return wib.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, visitorId } = body;
    const thisWeek = getWeekStart();
    const lastWeek = getWeekStart(new Date(Date.now() - 7 * 86400000));

    if (action === "current") {
      // aggregate game_stats points for current week from updated_at>=thisWeek
      const { data: stats } = await supabase
        .from("game_stats")
        .select("visitor_id, points")
        .gte("updated_at", thisWeek);

      const byVisitor = new Map<string, number>();
      (stats || []).forEach((s: any) => {
        byVisitor.set(s.visitor_id, (byVisitor.get(s.visitor_id) || 0) + (s.points || 0));
      });

      const ranked = Array.from(byVisitor.entries())
        .map(([vid, pts]) => ({ visitor_id: vid, points: pts }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 50);

      // Attach display names
      const ids = ranked.map(r => r.visitor_id);
      const { data: profiles } = await supabase.from("game_profiles").select("visitor_id, display_name, avatar_url").in("visitor_id", ids);
      const profMap = new Map((profiles || []).map((p: any) => [p.visitor_id, p]));

      const leaderboard = ranked.map((r, i) => ({
        rank: i + 1,
        visitor_id: r.visitor_id,
        points: r.points,
        display_name: profMap.get(r.visitor_id)?.display_name || "Pemain",
        avatar_url: profMap.get(r.visitor_id)?.avatar_url || null,
      }));

      const { data: rewards } = await supabase.from("weekly_leaderboard_rewards").select("*").eq("is_active", true).order("rank_position");

      return new Response(JSON.stringify({ week_start: thisWeek, leaderboard, rewards }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "claim_last_week") {
      if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 400, headers: corsHeaders });

      // Compute last week ranking
      const { data: stats } = await supabase
        .from("game_stats")
        .select("visitor_id, points")
        .gte("updated_at", lastWeek)
        .lt("updated_at", thisWeek);

      const byVisitor = new Map<string, number>();
      (stats || []).forEach((s: any) => {
        byVisitor.set(s.visitor_id, (byVisitor.get(s.visitor_id) || 0) + (s.points || 0));
      });
      const ranked = Array.from(byVisitor.entries()).sort((a, b) => b[1] - a[1]);
      const myIdx = ranked.findIndex(r => r[0] === visitorId);
      if (myIdx === -1) return new Response(JSON.stringify({ error: "Tidak masuk leaderboard minggu lalu" }), { status: 400, headers: corsHeaders });
      const myRank = myIdx + 1;

      const { data: reward } = await supabase.from("weekly_leaderboard_rewards").select("*").eq("rank_position", myRank).eq("is_active", true).maybeSingle();
      if (!reward) return new Response(JSON.stringify({ error: "Tidak ada hadiah untuk peringkat ini" }), { status: 400, headers: corsHeaders });

      // Already claimed?
      const { data: existing } = await supabase.from("weekly_leaderboard_claims").select("id").eq("visitor_id", visitorId).eq("week_start", lastWeek).maybeSingle();
      if (existing) return new Response(JSON.stringify({ error: "Sudah diklaim" }), { status: 400, headers: corsHeaders });

      let voucherCode: string | null = null;
      if (reward.reward_type === "voucher") {
        voucherCode = genVoucher();
        await supabase.from("game_discount_vouchers").insert({
          code: voucherCode, discount_amount: reward.reward_value, max_uses: 1, is_active: true,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      } else if (reward.reward_type === "balance") {
        await supabase.from("balance_transactions").insert({
          visitor_id: visitorId, amount: reward.reward_value, type: "weekly_leaderboard",
          description: `Hadiah Leaderboard Mingguan #${myRank}`,
        });
      } else if (reward.reward_type === "gems") {
        const { data: p } = await supabase.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
        if (p) await supabase.from("game_profiles").update({ gems: (p.gems || 0) + reward.reward_value }).eq("id", p.id);
      }

      await supabase.from("weekly_leaderboard_claims").insert({
        visitor_id: visitorId, week_start: lastWeek, rank_position: myRank,
        reward_type: reward.reward_type, reward_value: reward.reward_value, reward_label: reward.reward_label,
        voucher_code: voucherCode,
      });

      return new Response(JSON.stringify({ success: true, rank: myRank, reward, voucherCode }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
