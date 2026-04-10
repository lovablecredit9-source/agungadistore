import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLANS = [
  { name: "10 Hari", days: 10, price: 5000 },
  { name: "20 Hari", days: 20, price: 10000 },
  { name: "30 Hari", days: 30, price: 15000 },
  { name: "2 Bulan", days: 60, price: 20000 },
  { name: "3 Bulan", days: 90, price: 30000 },
  { name: "6 Bulan", days: 180, price: 50000 },
  { name: "1 Tahun", days: 365, price: 80000 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { visitorId, planDays, pin } = await req.json();

    if (!visitorId || !planDays) {
      return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
    }

    const plan = PLANS.find(p => p.days === planDays);
    if (!plan) {
      return Response.json({ error: "Paket tidak valid" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify PIN
    const { data: pinRow } = await admin
      .from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();

    if (pinRow) {
      if (!pin) {
        return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 403, headers: corsHeaders });
      }
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pin));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hashHex !== pinRow.pin_hash) {
        return Response.json({ error: "PIN salah" }, { status: 403, headers: corsHeaders });
      }
    }

    // Check balance
    const { data: balanceRow } = await admin
      .from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();

    if (!balanceRow) {
      return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }

    if (balanceRow.balance < plan.price) {
      return Response.json({ error: "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });
    }

    // Check if already has active subscription
    const { data: existingSub } = await admin
      .from("streak_subscriptions")
      .select("id, expires_at")
      .eq("visitor_id", visitorId)
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();

    // Calculate start from existing expiry or now
    const startsAt = existingSub ? new Date(existingSub.expires_at) : new Date();
    const expiresAt = new Date(startsAt.getTime() + plan.days * 24 * 60 * 60 * 1000);

    // Deduct balance
    const newBalance = balanceRow.balance - plan.price;
    const { error: balErr } = await admin
      .from("user_balances").update({ balance: newBalance }).eq("id", balanceRow.id);

    if (balErr) {
      return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }

    // Create subscription
    const { error: subErr } = await admin.from("streak_subscriptions").insert({
      visitor_id: visitorId,
      plan_name: plan.name,
      plan_days: plan.days,
      price_paid: plan.price,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });

    if (subErr) {
      // Rollback balance
      await admin.from("user_balances").update({ balance: balanceRow.balance }).eq("id", balanceRow.id);
      return Response.json({ error: "Gagal membuat langganan" }, { status: 500, headers: corsHeaders });
    }

    // Record transaction
    await admin.from("balance_transactions").insert({
      visitor_id: visitorId,
      type: "purchase",
      amount: plan.price,
      description: `Beli paket Auto-Klaim Streak ${plan.name}`,
    });

    return Response.json({
      success: true,
      plan: plan.name,
      expires_at: expiresAt.toISOString(),
      balance_remaining: newBalance,
    }, { headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
