import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWIBDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

function getMonthStartWIB(): string {
  const wib = getWIBDate();
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") ?? "status";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
      if (body?.action) action = body.action;
    }

    if (action === "status") {
      const visitorId = url.searchParams.get("visitorId") || body?.visitorId;
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      const monthStart = getMonthStartWIB();
      const [{ data: quests }, { data: progress }] = await Promise.all([
        admin.from("monthly_quests").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
        admin.from("monthly_quest_progress").select("*").eq("visitor_id", visitorId).eq("month_start", monthStart),
      ]);
      return Response.json({ monthStart, quests: quests ?? [], progress: progress ?? [] }, { headers: corsHeaders });
    }

    if (action === "track") {
      const { visitorId, eventType, increment = 1 } = body;
      if (!visitorId || !eventType) return Response.json({ error: "visitorId & eventType required" }, { status: 400, headers: corsHeaders });
      const monthStart = getMonthStartWIB();

      const { data: quests } = await admin
        .from("monthly_quests")
        .select("*")
        .eq("is_active", true)
        .eq("quest_type", eventType);

      if (!quests || quests.length === 0) return Response.json({ updated: 0 }, { headers: corsHeaders });

      let updated = 0;
      for (const q of quests) {
        const { data: existing } = await admin
          .from("monthly_quest_progress")
          .select("*")
          .eq("visitor_id", visitorId)
          .eq("quest_id", q.id)
          .eq("month_start", monthStart)
          .maybeSingle();

        if (existing?.is_completed) continue;

        const newValue = (existing?.current_value ?? 0) + increment;
        const isCompleted = newValue >= q.target_value;

        if (existing) {
          await admin.from("monthly_quest_progress").update({
            current_value: newValue,
            is_completed: isCompleted,
          }).eq("id", existing.id);
        } else {
          await admin.from("monthly_quest_progress").insert({
            visitor_id: visitorId,
            quest_id: q.id,
            month_start: monthStart,
            current_value: newValue,
            is_completed: isCompleted,
          });
        }
        updated++;
      }
      return Response.json({ updated }, { headers: corsHeaders });
    }

    if (action === "claim") {
      const { visitorId, questId } = body;
      if (!visitorId || !questId) return Response.json({ error: "visitorId & questId required" }, { status: 400, headers: corsHeaders });
      const monthStart = getMonthStartWIB();

      const { data: quest } = await admin.from("monthly_quests").select("*").eq("id", questId).maybeSingle();
      if (!quest) return Response.json({ error: "Quest tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const { data: prog } = await admin
        .from("monthly_quest_progress")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("quest_id", questId)
        .eq("month_start", monthStart)
        .maybeSingle();

      if (!prog || !prog.is_completed) return Response.json({ error: "Quest belum selesai" }, { status: 400, headers: corsHeaders });
      if (prog.claimed_at) return Response.json({ error: "Sudah diklaim" }, { status: 400, headers: corsHeaders });

      // Reward coins -> streak_coins
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (streak) {
        await admin.from("daily_streaks").update({
          streak_coins: (streak.streak_coins || 0) + quest.reward_coins,
        }).eq("id", streak.id);
      }

      // Reward XP -> Streak Pass
      const { data: season } = await admin.from("streak_pass_seasons").select("id").eq("is_active", true).order("starts_at", { ascending: false }).limit(1).maybeSingle();
      if (season) {
        const { data: passProg } = await admin.from("streak_pass_progress").select("*").eq("visitor_id", visitorId).eq("season_id", season.id).maybeSingle();
        if (passProg) {
          await admin.from("streak_pass_progress").update({ total_xp: (passProg.total_xp || 0) + quest.reward_xp }).eq("id", passProg.id);
        } else {
          await admin.from("streak_pass_progress").insert({ visitor_id: visitorId, season_id: season.id, total_xp: quest.reward_xp });
        }
      }

      // Reward Saldo IN -> game_balance
      const rewardSaldoIn = Number(quest.reward_saldo_in || 0);
      if (rewardSaldoIn > 0) {
        const { data: gameBal } = await admin.from("game_balance").select("amount,total_earned").eq("visitor_id", visitorId).maybeSingle();
        if (gameBal) {
          await admin.from("game_balance").update({
            amount: Number(gameBal.amount || 0) + rewardSaldoIn,
            total_earned: Number(gameBal.total_earned || 0) + rewardSaldoIn,
            updated_at: new Date().toISOString(),
          }).eq("visitor_id", visitorId);
        } else {
          await admin.from("game_balance").insert({ visitor_id: visitorId, amount: rewardSaldoIn, total_earned: rewardSaldoIn });
        }
        await admin.from("game_balance_transactions").insert({
          visitor_id: visitorId,
          type: "monthly_quest_reward",
          amount: rewardSaldoIn,
          description: `Misi Bulanan: ${quest.title}`,
        });
      }

      // Reward Gems
      const rewardGems = Number(quest.reward_gems || 0);
      if (rewardGems > 0) {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: rewardGems });
      }

      await admin.from("monthly_quest_progress").update({ claimed_at: new Date().toISOString() }).eq("id", prog.id);

      const rewardParts = [
        quest.reward_coins > 0 ? `+${quest.reward_coins} Coins` : null,
        rewardSaldoIn > 0 ? `+Saldo IN ${rewardSaldoIn}` : null,
        rewardGems > 0 ? `+${rewardGems} Gem` : null,
        quest.reward_xp > 0 ? `+${quest.reward_xp} XP Pass` : null,
      ].filter(Boolean).join(", ");

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🗓️ Misi Bulanan Selesai: ${quest.title}`,
        message: rewardParts || "Reward diklaim",
        type: "monthly_quest",
      });

      return Response.json({ success: true, coins: quest.reward_coins, xp: quest.reward_xp, saldo_in: rewardSaldoIn, gems: rewardGems }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
