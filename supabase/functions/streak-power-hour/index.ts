import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWIBDate(): { date: string; hour: number } {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  return { date: wib.toISOString().split("T")[0], hour: wib.getUTCHours() };
}

async function ensureSchedule(admin: ReturnType<typeof createClient>, date: string) {
  const { data: existing } = await admin
    .from("streak_power_hour_schedule")
    .select("*")
    .eq("schedule_date", date)
    .maybeSingle();
  if (existing) return existing;
  // generate jam acak 8-22 (jam aktif)
  const hour = 8 + Math.floor(Math.random() * 15);
  const { data: created } = await admin
    .from("streak_power_hour_schedule")
    .insert({ schedule_date: date, hour_start: hour })
    .select()
    .single();
  return created;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "status";
    const { date, hour } = getWIBDate();

    if (action === "status") {
      const visitorId = url.searchParams.get("visitorId");
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      const schedule = await ensureSchedule(admin, date);
      const { data: claim } = await admin
        .from("streak_power_hour_claims")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("claim_date", date)
        .maybeSingle();
      const isActiveNow = hour === schedule.hour_start;
      const minutesUntil = isActiveNow ? 0 : ((schedule.hour_start - hour + 24) % 24) * 60;
      return Response.json({
        schedule,
        claim,
        currentHour: hour,
        isActiveNow,
        minutesUntil,
      }, { headers: corsHeaders });
    }

    if (action === "claim") {
      const { visitorId } = await req.json();
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      const schedule = await ensureSchedule(admin, date);

      const { data: existing } = await admin
        .from("streak_power_hour_claims")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("claim_date", date)
        .maybeSingle();
      if (existing) return Response.json({ error: "Sudah klaim hari ini", claim: existing }, { status: 400, headers: corsHeaders });

      const success = hour === schedule.hour_start;
      const bonus = success ? 5 : 0;

      const { data: created } = await admin
        .from("streak_power_hour_claims")
        .insert({
          visitor_id: visitorId,
          claim_date: date,
          hour_target: schedule.hour_start,
          hour_claimed: hour,
          success,
          bonus_coins: bonus,
        })
        .select()
        .single();

      if (success && bonus > 0) {
        const { data: streak } = await admin
          .from("daily_streaks")
          .select("id, streak_coins")
          .eq("visitor_id", visitorId)
          .maybeSingle();
        if (streak) {
          await admin
            .from("daily_streaks")
            .update({ streak_coins: (streak.streak_coins || 0) + bonus })
            .eq("id", streak.id);
        }
        await admin.from("notifications").insert({
          visitor_id: visitorId,
          title: "⚡ Power Hour Sukses!",
          message: `Kamu klaim tepat waktu! +${bonus} Streak Coin & badge ⚡`,
          type: "power_hour",
        });
      }

      return Response.json({ success, claim: created, bonus }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
