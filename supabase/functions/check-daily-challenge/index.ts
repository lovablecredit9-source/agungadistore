import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWibDate(): string {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  return wib.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, eventType, increment = 1, claimChallengeId } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = getWibDate();

    // Claim reward
    if (claimChallengeId) {
      const { data: progress } = await admin
        .from("daily_challenge_progress")
        .select("*, daily_challenges(*)")
        .eq("challenge_id", claimChallengeId)
        .eq("visitor_id", visitorId)
        .eq("challenge_date", today)
        .maybeSingle();

      if (!progress) return Response.json({ error: "Belum ada progres" }, { status: 400, headers: corsHeaders });
      if (progress.claimed_at) return Response.json({ error: "Reward sudah diklaim" }, { status: 400, headers: corsHeaders });
      const ch = (progress as any).daily_challenges;
      if (!ch || progress.current_value < ch.target_value) {
        return Response.json({ error: "Misi belum selesai" }, { status: 400, headers: corsHeaders });
      }

      const rewardCoins = Number(ch.reward_coins || 0);
      const rewardSaldoIn = Number(ch.reward_saldo_in || 0);
      const rewardGems = Number(ch.reward_gems || 0);

      if (rewardCoins > 0) {
        const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
        if (streak) {
          await admin.from("daily_streaks").update({
            streak_coins: (streak.streak_coins || 0) + rewardCoins,
          }).eq("id", streak.id);
        } else {
          await admin.from("daily_streaks").insert({
            visitor_id: visitorId,
            streak_coins: rewardCoins,
            last_claim_date: today,
          });
        }
      }
      if (rewardSaldoIn > 0) {
        const { data: gameBal } = await admin.from("game_balance").select("amount,total_earned").eq("visitor_id", visitorId).maybeSingle();
        if (gameBal) {
          await admin.from("game_balance").update({
            amount: Number(gameBal.amount || 0) + rewardSaldoIn,
            total_earned: Number(gameBal.total_earned || 0) + rewardSaldoIn,
            updated_at: new Date().toISOString(),
          }).eq("visitor_id", visitorId);
        } else {
          await admin.from("game_balance").insert({
            visitor_id: visitorId,
            amount: rewardSaldoIn,
            total_earned: rewardSaldoIn,
          });
        }
        await admin.from("game_balance_transactions").insert({
          visitor_id: visitorId,
          type: "quest_reward",
          amount: rewardSaldoIn,
          description: `Quest Mission: ${ch.title}`,
        });
      }
      if (rewardGems > 0) {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: rewardGems });
      }
      await admin.from("daily_challenge_progress").update({
        claimed_at: new Date().toISOString(),
      }).eq("id", progress.id);

      const rewardParts = [
        rewardCoins > 0 ? `${rewardCoins} Streak Coins` : null,
        rewardSaldoIn > 0 ? `Saldo IN ${rewardSaldoIn}` : null,
        rewardGems > 0 ? `${rewardGems} Gem` : null,
      ].filter(Boolean).join(", ");

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎯 Misi Harian Selesai!`,
        message: `Kamu dapat ${rewardParts || "reward"} dari "${ch.title}"`,
        type: "daily_challenge",
      });

      return Response.json({ success: true, reward_coins: rewardCoins, reward_saldo_in: rewardSaldoIn, reward_gems: rewardGems }, { headers: corsHeaders });
    }

    // Update progress
    if (!eventType) return Response.json({ updated: 0 }, { headers: corsHeaders });

    const { data: challenges } = await admin
      .from("daily_challenges")
      .select("*")
      .eq("is_active", true)
      .eq("challenge_type", eventType);

    if (!challenges || challenges.length === 0) return Response.json({ updated: 0 }, { headers: corsHeaders });

    let updated = 0;
    for (const ch of challenges) {
      const { data: existing } = await admin
        .from("daily_challenge_progress")
        .select("*")
        .eq("challenge_id", ch.id)
        .eq("visitor_id", visitorId)
        .eq("challenge_date", today)
        .maybeSingle();

      if (existing) {
        if (existing.is_completed) continue;
        const newVal = existing.current_value + increment;
        await admin.from("daily_challenge_progress").update({
          current_value: newVal,
          is_completed: newVal >= ch.target_value,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await admin.from("daily_challenge_progress").insert({
          challenge_id: ch.id,
          visitor_id: visitorId,
          challenge_date: today,
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
