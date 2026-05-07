import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, planId, pin } = await req.json();
    if (!visitorId || !planId) {
      return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: plan } = await admin.from("store_premium_plans").select("*").eq("id", planId).eq("is_active", true).maybeSingle();
    if (!plan) return Response.json({ error: "Paket tidak ditemukan" }, { status: 400, headers: corsHeaders });

    // Verify PIN
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
    if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 200, headers: corsHeaders });
    if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 200, headers: corsHeaders });
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 200, headers: corsHeaders });

    // Cek saldo
    const { data: balRow } = await admin.from("user_balances").select("id, balance, bonus_balance").eq("visitor_id", visitorId).maybeSingle();
    if (!balRow) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    if (balRow.balance < plan.price) return Response.json({ error: "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });

    // Get user_balance_id
    const { data: blh } = await admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
    const ubId = blh?.user_balance_id ?? null;

    // Cek subscription aktif (perpanjang dari expiry terjauh)
    const { data: existing } = await admin.from("store_premium_subscriptions")
      .select("expires_at")
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .or(`visitor_id.eq.${visitorId}${ubId ? `,user_balance_id.eq.${ubId}` : ""}`)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startsAt = existing ? new Date(existing.expires_at) : new Date();
    const expiresAt = new Date(startsAt.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

    // Potong saldo
    const newBal = balRow.balance - plan.price;
    const { error: balErr } = await admin.from("user_balances").update({ balance: newBal }).eq("id", balRow.id);
    if (balErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });

    // Insert subscription
    await admin.from("store_premium_subscriptions").insert({
      visitor_id: visitorId,
      user_balance_id: ubId,
      plan_id: plan.id,
      plan_name: plan.name,
      duration_days: plan.duration_days,
      price_paid: plan.price,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });

    // Catat transaksi
    await admin.from("balance_transactions").insert({
      visitor_id: visitorId,
      type: "purchase",
      amount: plan.price,
      description: `Membership Premium Toko: ${plan.name}`,
    });

    // Notifikasi
    await admin.rpc("create_notification", {
      p_visitor_id: visitorId,
      p_title: "👑 Premium Toko Aktif!",
      p_message: `Selamat! ${plan.name} aktif sampai ${expiresAt.toLocaleDateString("id-ID")}. Klaim voucher Rp 2.000 setiap hari di tab Premium!`,
      p_type: "success",
      p_related_id: null,
    });

    return Response.json({
      success: true,
      plan_name: plan.name,
      expires_at: expiresAt.toISOString(),
      balance_remaining: newBal,
    }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 500, headers: corsHeaders });
  }
});
