import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getActiveFlashDiscountPercent(admin: any, discountKey: string): Promise<number> {
  const { data } = await admin
    .from("admin_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["flash_sale_end", discountKey]);

  const settings = Object.fromEntries((data || []).map((row: any) => [row.setting_key, row.setting_value || ""]));
  const flashSaleEnd = settings.flash_sale_end;
  const isFlashActive = !!flashSaleEnd && new Date(flashSaleEnd) > new Date();

  if (!isFlashActive) return 0;

  const rawDiscount = Number.parseInt(settings[discountKey] || "0", 10);
  if (!Number.isFinite(rawDiscount)) return 0;

  return Math.min(100, Math.max(0, rawDiscount));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, visitorId, packageId, planDays, pin, voucherCode } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Return available packages
    if (action === "get_packages") {
      const { data } = await admin.from("streak_packages").select("*").eq("is_active", true).order("sort_order", { ascending: true });
      return Response.json({ packages: data || [] }, { headers: corsHeaders });
    }

    // Purchase flow - support both packageId (new) and planDays (legacy)
    let plan: any = null;
    if (packageId) {
      const { data } = await admin.from("streak_packages").select("*").eq("id", packageId).eq("is_active", true).maybeSingle();
      plan = data;
    } else if (planDays) {
      const { data } = await admin.from("streak_packages").select("*").eq("days", planDays).eq("is_active", true).maybeSingle();
      plan = data;
    }

    if (!visitorId || !plan) {
      return Response.json({ error: "Paket tidak valid" }, { status: 400, headers: corsHeaders });
    }

    // Verify PIN
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
    if (pinRow) {
      if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 403, headers: corsHeaders });
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pin));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah" }, { status: 403, headers: corsHeaders });
    }

    // Calculate price with flash sale + voucher
    const flashDiscountPercent = await getActiveFlashDiscountPercent(admin, "promo_streak_discount");
    const priceAfterFlashSale = flashDiscountPercent > 0
      ? Math.max(0, Math.round(plan.price * (1 - flashDiscountPercent / 100)))
      : plan.price;
    const flashDiscountAmount = Math.max(0, plan.price - priceAfterFlashSale);

    let finalPrice = priceAfterFlashSale;
    let voucherDiscountAmount = 0;
    let voucherId: string | null = null;

    if (voucherCode) {
      const { data: voucher } = await admin.from("streak_discount_vouchers").select("*").eq("code", voucherCode.trim().toUpperCase()).eq("is_active", true).maybeSingle();
      if (voucher && voucher.used_count < voucher.max_uses && (!voucher.expires_at || new Date(voucher.expires_at) > new Date())) {
        voucherDiscountAmount = Math.min(voucher.discount_amount, priceAfterFlashSale);
        finalPrice = Math.max(0, priceAfterFlashSale - voucherDiscountAmount);
        voucherId = voucher.id;
      }
    }

    const totalDiscountAmount = flashDiscountAmount + voucherDiscountAmount;

    // Check balance
    const { data: balanceRow } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
    if (!balanceRow) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    if (balanceRow.balance < finalPrice) return Response.json({ error: "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });

    // Check existing subscription - accumulate
    const { data: existingSubs } = await admin.from("streak_subscriptions").select("id, expires_at").eq("visitor_id", visitorId).eq("is_active", true).gte("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }).limit(1);
    const existingSub = existingSubs && existingSubs.length > 0 ? existingSubs[0] : null;
    const startsAt = existingSub ? new Date(existingSub.expires_at) : new Date();
    const expiresAt = new Date(startsAt.getTime() + plan.days * 24 * 60 * 60 * 1000);

    // Deduct balance
    const newBalance = balanceRow.balance - finalPrice;
    const { error: balErr } = await admin.from("user_balances").update({ balance: newBalance }).eq("id", balanceRow.id);
    if (balErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });

    // Update voucher
    if (voucherId) {
      const { data: vRow } = await admin.from("streak_discount_vouchers").select("used_count").eq("id", voucherId).maybeSingle();
      if (vRow) await admin.from("streak_discount_vouchers").update({ used_count: vRow.used_count + 1 }).eq("id", voucherId);
    }

    // Create subscription
    const { error: subErr } = await admin.from("streak_subscriptions").insert({
      visitor_id: visitorId,
      plan_name: plan.name,
      plan_days: plan.days,
      price_paid: finalPrice,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });

    if (subErr) {
      await admin.from("user_balances").update({ balance: balanceRow.balance }).eq("id", balanceRow.id);
      return Response.json({ error: "Gagal membuat langganan" }, { status: 500, headers: corsHeaders });
    }

    // Record transaction
    const discountParts = [
      flashDiscountAmount > 0 ? `Flash Sale ${flashDiscountPercent}%` : null,
      voucherDiscountAmount > 0 ? `Voucher Rp${voucherDiscountAmount.toLocaleString("id-ID")}` : null,
    ].filter(Boolean);
    const desc = totalDiscountAmount > 0
      ? `Beli paket Auto-Klaim Streak ${plan.name} - ${discountParts.join(" + ")}`
      : `Beli paket Auto-Klaim Streak ${plan.name}`;
    await admin.from("balance_transactions").insert({
      visitor_id: visitorId,
      type: "purchase",
      amount: finalPrice,
      description: desc,
    });

    return Response.json({
      success: true,
      plan: plan.name,
      expires_at: expiresAt.toISOString(),
      balance_remaining: newBalance,
      discount_amount: totalDiscountAmount,
      flash_discount_amount: flashDiscountAmount,
      voucher_discount_amount: voucherDiscountAmount,
    }, { headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
