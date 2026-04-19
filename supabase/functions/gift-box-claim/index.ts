import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_DAY = 30; // 30 hari (1 bulan), reset bila skip 1 hari

function getWIBDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

function getTodayWIB(): string {
  return getWIBDate().toISOString().split("T")[0];
}

function daysDiff(a: string, b: string): number {
  // a, b in YYYY-MM-DD; returns b - a in days
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

/**
 * Hitung streak_day untuk klaim hari ini berdasarkan klaim terakhir.
 * - Belum pernah claim → day 1
 * - Klaim terakhir = kemarin → day = last + 1 (cap MAX_DAY, lalu loop ke 1)
 * - Klaim terakhir > kemarin (skip ≥1 hari) → reset ke day 1
 * - Klaim terakhir = hari ini → null (sudah diklaim)
 */
function nextStreakDay(lastDate: string | null, lastDay: number | null, today: string): number | null {
  if (!lastDate) return 1;
  const diff = daysDiff(lastDate, today);
  if (diff === 0) return null; // sudah klaim hari ini
  if (diff === 1) {
    const next = (lastDay ?? 0) + 1;
    return next > MAX_DAY ? 1 : next; // loop balik setelah hari ke-5
  }
  // diff >= 2 → ada hari yang dilewatkan, reset ke awal
  return 1;
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

      const today = getTodayWIB();

      const [{ data: rewards }, { data: lastClaim }, { data: pass }] = await Promise.all([
        admin.from("daily_gift_box_rewards").select("*").order("day_number", { ascending: true }),
        admin
          .from("daily_gift_box_claims")
          .select("week_start, streak_day, day_number")
          .eq("visitor_id", visitorId)
          .order("week_start", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin.from("streak_pass_progress").select("is_premium").eq("visitor_id", visitorId).maybeSingle(),
      ]);

      const lastDate = lastClaim?.week_start ?? null;
      const lastDay = lastClaim?.streak_day ?? lastClaim?.day_number ?? null;
      const next = nextStreakDay(lastDate, lastDay, today);
      const todayClaimed = next === null;
      const currentDay = todayClaimed ? (lastDay ?? 1) : next!;

      return Response.json({
        today: currentDay,
        todayClaimed,
        lastClaimDate: lastDate,
        weekStart: today, // back-compat (UI uses this only for keying)
        isPremium: pass?.is_premium ?? false,
        rewards: rewards ?? [],
        // Untuk UI: tandai hari mana saja yang sudah dilewati di siklus aktif
        claims: todayClaimed ? [{ day_number: currentDay, streak_day: currentDay }] : [],
        maxDay: MAX_DAY,
      }, { headers: corsHeaders });
    }

    if (action === "claim") {
      const { visitorId } = await req.json();
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

      const today = getTodayWIB();

      const { data: lastClaim } = await admin
        .from("daily_gift_box_claims")
        .select("week_start, streak_day, day_number")
        .eq("visitor_id", visitorId)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastDate = lastClaim?.week_start ?? null;
      const lastDay = lastClaim?.streak_day ?? lastClaim?.day_number ?? null;
      const streakDay = nextStreakDay(lastDate, lastDay, today);
      if (streakDay === null) {
        return Response.json({ error: "Sudah diklaim hari ini" }, { status: 400, headers: corsHeaders });
      }

      // Premium?
      const { data: pass } = await admin.from("streak_pass_progress").select("is_premium").eq("visitor_id", visitorId).maybeSingle();
      const isPremium = pass?.is_premium ?? false;

      // Ambil reward sesuai streakDay
      const { data: reward } = await admin
        .from("daily_gift_box_rewards")
        .select("*")
        .eq("day_number", streakDay)
        .eq("is_premium", isPremium)
        .maybeSingle();

      const finalReward = reward ?? (await admin
        .from("daily_gift_box_rewards")
        .select("*")
        .eq("day_number", streakDay)
        .eq("is_premium", false)
        .maybeSingle()).data;

      if (!finalReward) {
        return Response.json({ error: "Reward tidak tersedia" }, { status: 404, headers: corsHeaders });
      }

      // Apply reward — sekarang semua reward berbasis gem
      if (finalReward.reward_type === "gems") {
        await admin.rpc("add_account_gems", {
          p_visitor_id: visitorId,
          p_amount: finalReward.reward_value,
        });
        await admin.from("gem_transactions").insert({
          visitor_id: visitorId,
          amount: finalReward.reward_value,
          type: "earned",
          description: `Daily Gift Box Hari ${streakDay}: ${finalReward.reward_label}`,
        });
      } else {
        // Back-compat untuk reward lama (tidak seharusnya muncul setelah migrasi)
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
      }

      // Log klaim — gunakan tanggal hari ini sebagai week_start agar unik per hari
      await admin.from("daily_gift_box_claims").insert({
        visitor_id: visitorId,
        week_start: today,
        day_number: streakDay,
        streak_day: streakDay,
        reward_type: finalReward.reward_type,
        reward_value: finalReward.reward_value,
        reward_label: finalReward.reward_label,
      });

      // Award XP ke Streak Pass
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
        title: `🎁 Daily Gift Box Hari ${streakDay}`,
        message: `Kamu mendapat ${finalReward.reward_label}`,
        type: "gift_box",
      });

      return Response.json({
        success: true,
        reward: { ...finalReward, day_number: streakDay },
        streakDay,
        isPremium,
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
