import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, action, kind, durationMs } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "get") {
      const { data } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
      return Response.json({
        extra_life: data?.extra_life || 0,
        auto_hint: data?.auto_hint || 0,
        time_freeze: data?.time_freeze || 0,
        double_xp_until: data?.double_xp_until || null,
      }, { headers: corsHeaders });
    }

    if (action === "activate_double_xp") {
      const duration = Number(durationMs);
      if (!Number.isFinite(duration) || duration <= 0) {
        return Response.json({ error: "durationMs tidak valid" }, { status: 400, headers: corsHeaders });
      }

      const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
      const now = Date.now();
      const currentUntil = pu?.double_xp_until ? new Date(pu.double_xp_until).getTime() : 0;
      const nextUntil = new Date(Math.max(now, currentUntil) + duration).toISOString();

      if (pu) {
        await admin.from("user_power_ups").update({ double_xp_until: nextUntil }).eq("visitor_id", visitorId);
      } else {
        await admin.from("user_power_ups").insert({
          visitor_id: visitorId,
          extra_life: 0,
          auto_hint: 0,
          time_freeze: 0,
          double_xp_until: nextUntil,
        });
      }

      return Response.json({ success: true, double_xp_until: nextUntil }, { headers: corsHeaders });
    }

    if (action === "consume") {
      if (!["extra_life", "auto_hint", "time_freeze"].includes(kind)) {
        return Response.json({ error: "Invalid kind" }, { status: 400, headers: corsHeaders });
      }
      const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
      const cur = (pu?.[kind as keyof typeof pu] as number) || 0;
      if (cur <= 0) return Response.json({ error: "Power-up habis" }, { status: 400, headers: corsHeaders });
      await admin.from("user_power_ups").update({ [kind]: cur - 1 }).eq("visitor_id", visitorId);
      return Response.json({ success: true, remaining: cur - 1 }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
