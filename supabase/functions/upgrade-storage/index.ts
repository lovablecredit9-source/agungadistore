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
    const paymentSource: "auto" | "game" | "main" = body.paymentSource || "auto";

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

    const { data: gameBal } = await admin.from("game_balance").select("id, amount, total_spent").eq("visitor_id", visitorId).maybeSingle();
    const { data: balanceRow } = await admin
      .from("user_balances")
      .select("id, balance")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (!balanceRow && !gameBal) {
      return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }

    const gameAmount = gameBal?.amount || 0;
    const mainAmount = balanceRow?.balance || 0;

    let payFromGame = 0;
    let payFromMain = 0;
    let sourceLabel = "";
    // Saldo IN (game_balance) hanya untuk produk toko. Upgrade storage wajib Saldo Utama.
    if (mainAmount < price) {
      return Response.json({ error: `Saldo Utama tidak cukup. Butuh Rp${price.toLocaleString("id-ID")}, saldo Rp${mainAmount.toLocaleString("id-ID")}. Saldo IN tidak bisa dipakai untuk fitur ini.` }, { status: 400, headers: corsHeaders });
    }
    payFromMain = price;
    sourceLabel = "Saldo Utama";

    if (payFromGame > 0 && gameBal) {
      await admin.from("game_balance").update({ amount: gameAmount - payFromGame, total_spent: (gameBal.total_spent || 0) + payFromGame }).eq("id", gameBal.id);
      await admin.from("game_balance_transactions").insert({ visitor_id: visitorId, type: "spend", amount: -payFromGame, description: `Upgrade storage ${tierName}` });
    }
    if (payFromMain > 0 && balanceRow) {
      const { error: updateError } = await admin
        .from("user_balances")
        .update({ balance: mainAmount - payFromMain })
        .eq("id", balanceRow.id);
      if (updateError) {
        return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
      }
    }
    const newBalance = mainAmount - payFromMain;

    if (payFromMain > 0) {
      const { error: txError } = await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        type: "purchase",
        amount: payFromMain,
        description: `Upgrade penyimpanan musik ke ${tierName} [${sourceLabel}]`,
      });
      if (txError) {
        if (balanceRow) await admin.from("user_balances").update({ balance: mainAmount }).eq("id", balanceRow.id);
        if (payFromGame > 0 && gameBal) await admin.from("game_balance").update({ amount: gameAmount }).eq("id", gameBal.id);
        return Response.json({ error: "Gagal mencatat transaksi" }, { status: 500, headers: corsHeaders });
      }
    }

    if (storageMb > 0) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from("user_music_storage").insert({
        visitor_id: visitorId,
        storage_mb: storageMb,
        voucher_code: `STORAGE-${Date.now()}`,
        expires_at: expiresAt,
      });
    }

    return Response.json(
      { success: true, balance_remaining: newBalance, game_balance_remaining: gameAmount - payFromGame, paid_from_game: payFromGame, paid_from_main: payFromMain, source_label: sourceLabel, tier_name: tierName, storage_mb: storageMb },
      { headers: corsHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
