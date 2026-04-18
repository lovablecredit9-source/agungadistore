import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOOSTERS = [
  { id: "double_coins", name: "2x Streak Coins", desc: "Klaim harian dapat 2x koin selama 24 jam", cost: 100, durationHours: 24 },
  { id: "auto_claim_7d", name: "Auto-Claim 7 Hari", desc: "Otomatis claim streak setiap hari (7 hari)", cost: 350, durationHours: 168 },
  { id: "lucky_day", name: "Lucky Day", desc: "Reward Mystery Box 3x lipat hari ini", cost: 200, durationHours: 24 },
  { id: "double_streak", name: "Double Streak Day", desc: "Hari ini dihitung sebagai 2 hari streak", cost: 500, durationHours: 24 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, boosterId, action } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "list") {
      const { data: active } = await admin
        .from("streak_active_boosters")
        .select("*")
        .eq("visitor_id", visitorId)
        .gt("expires_at", new Date().toISOString());
      return Response.json({ boosters: BOOSTERS, active: active || [] }, { headers: corsHeaders });
    }

    const booster = BOOSTERS.find(b => b.id === boosterId);
    if (!booster) return Response.json({ error: "Booster tidak ditemukan" }, { status: 404, headers: corsHeaders });

    const { data: streak } = await admin
      .from("daily_streaks")
      .select("id, streak_coins")
      .eq("visitor_id", visitorId)
      .maybeSingle();
    if (!streak) return Response.json({ error: "Mulai streak dulu!" }, { status: 400, headers: corsHeaders });
    if ((streak.streak_coins || 0) < booster.cost) {
      return Response.json({ error: `Butuh ${booster.cost} koin (kamu punya ${streak.streak_coins || 0})` }, { status: 400, headers: corsHeaders });
    }

    // Check existing
    const { data: existingActive } = await admin
      .from("streak_active_boosters")
      .select("id")
      .eq("visitor_id", visitorId)
      .eq("booster_type", boosterId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (existingActive) return Response.json({ error: "Booster ini sudah aktif" }, { status: 400, headers: corsHeaders });

    const expiresAt = new Date(Date.now() + booster.durationHours * 3600 * 1000).toISOString();

    await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) - booster.cost }).eq("id", streak.id);

    await admin.from("streak_active_boosters").insert({
      visitor_id: visitorId,
      booster_type: boosterId,
      expires_at: expiresAt,
      metadata: { name: booster.name, cost: booster.cost },
    });

    await admin.from("notifications").insert({
      visitor_id: visitorId,
      title: `⚡ Booster Aktif: ${booster.name}`,
      message: `Berlaku ${booster.durationHours} jam.`,
      type: "booster",
    });

    return Response.json({ success: true, booster, expiresAt }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
