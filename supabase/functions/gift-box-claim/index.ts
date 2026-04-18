import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWIBDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

function getWeekStartWIB(): string {
  const wib = getWIBDate();
  const day = wib.getUTCDay(); // 0 Sun..6 Sat
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  const monday = new Date(wib);
  monday.setUTCDate(wib.getUTCDate() + diff);
  return monday.toISOString().split("T")[0];
}

function getCurrentDayNumber(): number {
  const wib = getWIBDate();
  const day = wib.getUTCDay();
  return day === 0 ? 7 : day; // Mon=1..Sun=7
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "status";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "status") {
      const visitorId = url.searchParams.get("visitorId");
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

      const weekStart = getWeekStartWIB();
      const today = getCurrentDayNumber();

      const [{ data: rewards }, { data: claims }, { data: pass }] = await Promise.all([
        admin.from("daily_gift_box_rewards").select("*").order("day_number", { ascending: true }),
        admin.from("daily_gift_box_claims").select("*").eq("visitor_id", visitorId).eq("week_start", weekStart),
        admin.from("streak_pass_progress").select("is_premium").eq("visitor_id", visitorId).maybeSingle(),
      ]);

      return Response.json({
        weekStart,
        today,
        isPremium: pass?.is_premium ?? false,
        rewards: rewards ?? [],
        claims: claims ?? [],
      }, { headers: corsHeaders });
    }

    if (action === "claim") {
      const { visitorId } = await req.json();
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

      const weekStart = getWeekStartWIB();
      const today = getCurrentDayNumber();

      // Already claimed today this week?
      const { data: existing } = await admin
        .from("daily_gift_box_claims")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("week_start", weekStart)
        .eq("day_number", today)
        .maybeSingle();
      if (existing) {
        return Response.json({ error: "Sudah diklaim hari ini" }, { status: 400, headers: corsHeaders });
      }

      // Premium?
      const { data: pass } = await admin.from("streak_pass_progress").select("is_premium").eq("visitor_id", visitorId).maybeSingle();
      const isPremium = pass?.is_premium ?? false;

      const { data: reward } = await admin
        .from("daily_gift_box_rewards")
        .select("*")
        .eq("day_number", today)
        .eq("is_premium", isPremium)
        .maybeSingle();

      // Fallback to free if premium row missing
      const finalReward = reward ?? (await admin
        .from("daily_gift_box_rewards")
        .select("*")
        .eq("day_number", today)
        .eq("is_premium", false)
        .maybeSingle()).data;

      if (!finalReward) {
        return Response.json({ error: "Reward tidak tersedia" }, { status: 404, headers: corsHeaders });
      }

      // Apply reward
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (streak) {
        const updates: Record<string, unknown> = {};
        if (finalReward.reward_type === "streak_coins") {
          updates.streak_coins = (streak.streak_coins || 0) + finalReward.reward_value;
        } else if (finalReward.reward_type === "bonus_points") {
          updates.total_bonus_points = (streak.total_bonus_points || 0) + finalReward.reward_value;
        } else if (finalReward.reward_type === "freeze_token") {
          updates.freeze_count = (streak.freeze_count || 0) + finalReward.reward_value;
        }
        if (Object.keys(updates).length > 0) {
          await admin.from("daily_streaks").update(updates).eq("id", streak.id);
        }
      }

      if (finalReward.reward_type === "game_credit") {
        const { data: gc } = await admin.from("user_game_credits").select("id, credits").eq("visitor_id", visitorId).maybeSingle();
        if (gc) {
          await admin.from("user_game_credits").update({ credits: (gc.credits || 0) + finalReward.reward_value }).eq("id", gc.id);
        } else {
          await admin.from("user_game_credits").insert({ visitor_id: visitorId, credits: finalReward.reward_value });
        }
        await admin.from("balance_transactions").insert({
          visitor_id: visitorId, amount: 0, type: "game_credit_reward",
          description: `Daily Gift Box Hari ${today}: ${finalReward.reward_label}`,
        });
      }

      // Log claim
      await admin.from("daily_gift_box_claims").insert({
        visitor_id: visitorId,
        week_start: weekStart,
        day_number: today,
        reward_type: finalReward.reward_type,
        reward_value: finalReward.reward_value,
        reward_label: finalReward.reward_label,
      });

      // Award XP to Streak Pass
      const { data: season } = await admin.from("streak_pass_seasons").select("id").eq("is_active", true).order("starts_at", { ascending: false }).limit(1).maybeSingle();
      if (season) {
        const { data: prog } = await admin.from("streak_pass_progress").select("*").eq("visitor_id", visitorId).eq("season_id", season.id).maybeSingle();
        const xpGain = isPremium ? 50 : 30;
        if (prog) {
          await admin.from("streak_pass_progress").update({ total_xp: (prog.total_xp || 0) + xpGain }).eq("id", prog.id);
        } else {
          await admin.from("streak_pass_progress").insert({ visitor_id: visitorId, season_id: season.id, total_xp: xpGain });
        }
      }

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🎁 Daily Gift Box Hari ${today}`,
        message: `Kamu mendapat ${finalReward.reward_label}`,
        type: "gift_box",
      });

      return Response.json({ success: true, reward: finalReward, isPremium }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
