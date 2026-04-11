import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PLANS = [
  { name: "10 Hari", days: 10, price: 5000 },
  { name: "20 Hari", days: 20, price: 10000 },
  { name: "30 Hari", days: 30, price: 15000 },
  { name: "2 Bulan", days: 60, price: 20000 },
  { name: "3 Bulan", days: 90, price: 30000 },
  { name: "6 Bulan", days: 180, price: 50000 },
  { name: "1 Tahun", days: 365, price: 80000 },
];

const STREAK_SETTING_MAP: Record<number, string> = {
  10: "streak_price_10",
  20: "streak_price_20",
  30: "streak_price_30",
  60: "streak_price_60",
  90: "streak_price_90",
  180: "streak_price_180",
  365: "streak_price_365",
};

async function getPlansWithDynamicPrices(admin: any) {
  const { data: settings } = await admin.from("admin_settings").select("setting_key, setting_value")
    .in("setting_key", Object.values(STREAK_SETTING_MAP));

  const priceMap: Record<string, number> = {};
  if (settings) {
    for (const s of settings) {
      const val = parseInt(s.setting_value);
      if (!isNaN(val) && val > 0) priceMap[s.setting_key] = val;
    }
  }

  return DEFAULT_PLANS.map(plan => {
    const settingKey = STREAK_SETTING_MAP[plan.days];
    const dynamicPrice = settingKey ? priceMap[settingKey] : undefined;
    return { ...plan, price: dynamicPrice ?? plan.price };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { visitorId, planDays, pin, voucherCode } = await req.json();

    if (!visitorId || !planDays) {
      return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const PLANS = await getPlansWithDynamicPrices(admin);

    const plan = PLANS.find(p => p.days === planDays);
    if (!plan) {
      return Response.json({ error: "Paket tidak valid" }, { status: 400, headers: corsHeaders });
    }

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

    // Calculate price with voucher
    let finalPrice = plan.price;
    let discountAmount = 0;
    let voucherId: string | null = null;

    if (voucherCode) {
      const { data: voucher } = await admin
        .from("streak_discount_vouchers").select("*")
        .eq("code", voucherCode.trim().toUpperCase()).eq("is_active", true).maybeSingle();
      if (voucher && voucher.used_count < voucher.max_uses && (!voucher.expires_at || new Date(voucher.expires_at) > new Date())) {
        discountAmount = Math.min(voucher.discount_amount, plan.price);
        finalPrice = Math.max(0, plan.price - discountAmount);
        voucherId = voucher.id;
      }
    }

    // Check balance
    const { data: balanceRow } = await admin
      .from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();

    if (!balanceRow) {
      return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }

    if (balanceRow.balance < finalPrice) {
      return Response.json({ error: "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });
    }

    // Check if already has active subscription - get the LATEST one
    const { data: existingSubs } = await admin
      .from("streak_subscriptions")
      .select("id, expires_at")
      .eq("visitor_id", visitorId)
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1);

    const existingSub = existingSubs && existingSubs.length > 0 ? existingSubs[0] : null;

    // Calculate start from existing expiry or now - ACCUMULATE
    const startsAt = existingSub ? new Date(existingSub.expires_at) : new Date();
    const expiresAt = new Date(startsAt.getTime() + plan.days * 24 * 60 * 60 * 1000);

    // Deduct balance
    const newBalance = balanceRow.balance - finalPrice;
    const { error: balErr } = await admin
      .from("user_balances").update({ balance: newBalance }).eq("id", balanceRow.id);

    if (balErr) {
      return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }

    // Update voucher used count
    if (voucherId) {
      const { data: vRow } = await admin.from("streak_discount_vouchers").select("used_count").eq("id", voucherId).maybeSingle();
      if (vRow) {
        await admin.from("streak_discount_vouchers").update({ used_count: vRow.used_count + 1 }).eq("id", voucherId);
      }
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
      // Rollback balance
      await admin.from("user_balances").update({ balance: balanceRow.balance }).eq("id", balanceRow.id);
      return Response.json({ error: "Gagal membuat langganan" }, { status: 500, headers: corsHeaders });
    }

    // Record transaction
    const desc = discountAmount > 0
      ? `Beli paket Auto-Klaim Streak ${plan.name} - Diskon Rp${discountAmount.toLocaleString("id-ID")}`
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
      discount_amount: discountAmount,
    }, { headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
