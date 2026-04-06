import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { visitor_id, tier_name, price } = await request.json();

    if (!visitor_id || !tier_name || !price || typeof price !== "number" || price <= 0) {
      return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
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
    const { data: pinRow } = await admin
      .from("user_pins")
      .select("pin_hash")
      .eq("visitor_id", visitor_id)
      .maybeSingle();

    // PIN not required for this — storage upgrade doesn't need PIN

    // Get balance
    const { data: balanceRow, error: balanceError } = await admin
      .from("user_balances")
      .select("id, balance")
      .eq("visitor_id", visitor_id)
      .maybeSingle();

    if (balanceError || !balanceRow) {
      return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }

    if (balanceRow.balance < price) {
      return Response.json(
        { error: `Saldo tidak cukup. Butuh Rp${price.toLocaleString("id-ID")}, saldo Rp${balanceRow.balance.toLocaleString("id-ID")}` },
        { status: 400, headers: corsHeaders }
      );
    }

    const newBalance = balanceRow.balance - price;

    // Deduct balance
    const { error: updateError } = await admin
      .from("user_balances")
      .update({ balance: newBalance })
      .eq("id", balanceRow.id);

    if (updateError) {
      return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }

    // Record transaction
    const { error: txError } = await admin.from("balance_transactions").insert({
      visitor_id,
      type: "purchase",
      amount: price,
      description: `Upgrade penyimpanan musik ke ${tier_name}`,
    });

    if (txError) {
      // Rollback
      await admin.from("user_balances").update({ balance: balanceRow.balance }).eq("id", balanceRow.id);
      return Response.json({ error: "Gagal mencatat transaksi" }, { status: 500, headers: corsHeaders });
    }

    return Response.json(
      { success: true, balance_remaining: newBalance, tier_name },
      { headers: corsHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
