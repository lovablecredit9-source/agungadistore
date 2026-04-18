import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "get";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "get") {
      const visitorId = url.searchParams.get("visitorId");
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

      const { data } = await admin.from("streak_reminders").select("*").eq("visitor_id", visitorId).maybeSingle();

      // Smart suggestion: hitung jam rata-rata klaim user dari streak_rewards_log (7 hari terakhir)
      let suggestedHour = 19;
      const { data: logs } = await admin
        .from("streak_rewards_log")
        .select("created_at")
        .eq("visitor_id", visitorId)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
        .limit(20);

      if (logs && logs.length >= 3) {
        const hours = logs.map(l => {
          const wib = new Date(new Date(l.created_at).getTime() + 7 * 60 * 60 * 1000);
          return wib.getUTCHours();
        });
        const avg = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
        suggestedHour = avg;
      }

      return Response.json({ reminder: data, suggestedHour }, { headers: corsHeaders });
    }

    if (action === "save") {
      const body = await req.json();
      const { visitorId, isEnabled, preferredHour, preferredMinute, smartMode, notifyBrowser } = body;
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

      const { data: existing } = await admin.from("streak_reminders").select("id").eq("visitor_id", visitorId).maybeSingle();

      const payload = {
        visitor_id: visitorId,
        is_enabled: isEnabled ?? false,
        preferred_hour: typeof preferredHour === "number" ? Math.max(0, Math.min(23, preferredHour)) : 19,
        preferred_minute: typeof preferredMinute === "number" ? Math.max(0, Math.min(59, preferredMinute)) : 0,
        smart_mode: smartMode ?? true,
        notify_browser: notifyBrowser ?? true,
      };

      if (existing) {
        await admin.from("streak_reminders").update(payload).eq("id", existing.id);
      } else {
        await admin.from("streak_reminders").insert(payload);
      }

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
