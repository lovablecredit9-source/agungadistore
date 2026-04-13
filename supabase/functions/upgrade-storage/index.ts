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
    const visitorId = body.visitorId || body.visitor_id;
    const packageId = body.packageId || body.package_id;
    const legacyTierName = body.tier_name;
    const legacyPrice = body.price;
    const pin = body.pin;

    if (!visitorId) {
      return Response.json({ error: "Visitor ID diperlukan" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Konfigurasi backend belum lengkap" }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const pinCheck = await verifyPin(admin, visitorId, pin);
    if (!pinCheck.ok) {
      return Response.json({ error: pinCheck.error, needPin: pinCheck.needPin }, { status: 403, headers: corsHeaders });
    }

    let tierName = legacyTierName;
    let price = typeof legacyPrice === "number" ? legacyPrice : null;
    let storageMb = 0;

    if (packageId) {
      const { data: pkg } = await admin
        .from("storage_packages")
        .select("id, name, price, storage_mb")
        .eq("id", packageId)
        .eq("is_active", true)
        .maybeSingle();

      if (!pkg) {
        return Response.json({ error: "Paket storage tidak ditemukan" }, { status: 404, headers: corsHeaders });
      }

      tierName = pkg.name;
      price = pkg.price;
      storageMb = pkg.storage_mb;
    }

    if (!tierName || typeof price !== "number" || price < 0) {
      return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
    }

    const { data: balanceRow, error: balanceError } = await admin
      .from("user_balances")
      .select("id, balance")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (balanceError || !balanceRow) {
      return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }

    if (balanceRow.balance < price) {
      return Response.json(
        { error: `Saldo tidak cukup. Butuh Rp${price.toLocaleString("id-ID")}, saldo Rp${balanceRow.balance.toLocaleString("id-ID")}` },
        { status: 400, headers: corsHeaders },
      );
    }

    const newBalance = balanceRow.balance - price;

    const { error: updateError } = await admin
      .from("user_balances")
      .update({ balance: newBalance })
      .eq("id", balanceRow.id);

    if (updateError) {
      return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }

    const { error: txError } = await admin.from("balance_transactions").insert({
      visitor_id: visitorId,
      type: "purchase",
      amount: price,
      description: `Upgrade penyimpanan musik ke ${tierName}`,
    });

    if (txError) {
      await admin.from("user_balances").update({ balance: balanceRow.balance }).eq("id", balanceRow.id);
      return Response.json({ error: "Gagal mencatat transaksi" }, { status: 500, headers: corsHeaders });
    }

    if (storageMb > 0) {
      await admin.from("user_music_storage").insert({
        visitor_id: visitorId,
        storage_mb: storageMb,
        voucher_code: `STORAGE-${Date.now()}`,
      });
    }

    return Response.json(
      { success: true, balance_remaining: newBalance, tier_name: tierName, storage_mb: storageMb },
      { headers: corsHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
