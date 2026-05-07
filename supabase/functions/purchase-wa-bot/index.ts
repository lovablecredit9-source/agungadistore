import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyPin(admin: any, visitorId: string, pin?: string) {
  const { data: pinRow } = await admin
    .from("user_pins")
    .select("pin_hash")
    .eq("visitor_id", visitorId)
    .maybeSingle();

  if (!pinRow) return { ok: false, error: "PIN belum dibuat", needPin: true };
  if (!pin) return { ok: false, error: "PIN diperlukan", needPin: true };

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pin));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

  if (hashHex !== pinRow.pin_hash) return { ok: false, error: "PIN salah", needPin: true };
  return { ok: true };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const visitorId = body.visitorId;
    const packageId = body.packageId;
    const botName = (body.botName || "My Bot").trim().slice(0, 50);
    const pin = body.pin;

    if (!visitorId || !packageId) {
      return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
    }

    if (!botName || botName.length < 1) {
      return Response.json({ error: "Nama bot wajib diisi" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Konfigurasi backend belum lengkap" }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify PIN
    const pinCheck = await verifyPin(admin, visitorId, pin);
    if (!pinCheck.ok) {
      return Response.json({ error: pinCheck.error, needPin: pinCheck.needPin }, { status: 403, headers: corsHeaders });
    }

    // Get package
    const { data: pkg, error: pkgError } = await admin
      .from("wa_bot_packages")
      .select("id, name, duration_hours, price")
      .eq("id", packageId)
      .eq("is_active", true)
      .maybeSingle();

    if (pkgError || !pkg) {
      return Response.json({ error: "Paket bot tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }

    // Get balance
    const { data: balanceRow, error: balanceError } = await admin
      .from("user_balances")
      .select("id, balance")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (balanceError || !balanceRow) {
      return Response.json({ error: "Akun saldo tidak ditemukan", needLogin: true }, { status: 404, headers: corsHeaders });
    }

    if (balanceRow.balance < pkg.price) {
      return Response.json(
        { error: `Saldo tidak cukup. Butuh Rp${pkg.price.toLocaleString("id-ID")}, saldo Rp${balanceRow.balance.toLocaleString("id-ID")}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Deduct balance
    const newBalance = balanceRow.balance - pkg.price;
    const { error: updateError } = await admin
      .from("user_balances")
      .update({ balance: newBalance })
      .eq("id", balanceRow.id);

    if (updateError) {
      return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }

    // Record transaction
    const trxId = `BOT-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    const { error: txError } = await admin.from("balance_transactions").insert({
      visitor_id: visitorId,
      type: "purchase",
      amount: pkg.price,
      description: `Sewa Bot WA "${botName}" - ${pkg.name}`,
      trx_id: trxId,
    });

    if (txError) {
      // Rollback
      await admin.from("user_balances").update({ balance: balanceRow.balance }).eq("id", balanceRow.id);
      return Response.json({ error: "Gagal mencatat transaksi" }, { status: 500, headers: corsHeaders });
    }

    // Create subscription
    const now = new Date();
    const expiresAt = new Date(now.getTime() + pkg.duration_hours * 60 * 60 * 1000);
    const sessionId = `sess-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

    const { data: subscription, error: subError } = await admin
      .from("wa_bot_subscriptions")
      .insert({
        visitor_id: visitorId,
        package_id: pkg.id,
        bot_name: botName,
        status: "pending",
        price_paid: pkg.price,
        starts_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        session_id: sessionId,
      })
      .select("id, bot_name, status, starts_at, expires_at, session_id")
      .single();

    if (subError || !subscription) {
      return Response.json({ error: "Gagal membuat langganan bot" }, { status: 500, headers: corsHeaders });
    }

    return Response.json(
      {
        success: true,
        subscription,
        trx_id: trxId,
        package_name: pkg.name,
        balance_remaining: newBalance,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
