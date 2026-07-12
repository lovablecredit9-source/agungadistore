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

function getTodayWIB() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split("T")[0];
}

function getYesterdayWIB() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  wib.setDate(wib.getDate() - 1);
  return wib.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, visitorId, packageId, planDays, pin, voucherCode, paymentSource = "auto" } = await req.json();

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
    if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 200, headers: corsHeaders });
    if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 200, headers: corsHeaders });
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pin));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 403, headers: corsHeaders });

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

    // Check balances - split between Saldo IN (game_balance) and Saldo Utama (user_balances)
    const { data: gameBal } = await admin.from("game_balance").select("id, amount, total_spent").eq("visitor_id", visitorId).maybeSingle();
    const { data: balanceRow } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
    if (!balanceRow && !gameBal) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    const gameAmount = gameBal?.amount || 0;
    const mainAmount = balanceRow?.balance || 0;

    let payFromGame = 0;
    let payFromMain = 0;
    let sourceLabel = "Gratis";
    if (finalPrice > 0) {
      if (paymentSource === "game") {
        if (gameAmount < finalPrice) {
          return Response.json({ error: `Saldo IN tidak cukup. Butuh Rp${finalPrice.toLocaleString("id-ID")}, saldo IN Rp${gameAmount.toLocaleString("id-ID")}.` }, { status: 400, headers: corsHeaders });
        }
        payFromGame = finalPrice;
        sourceLabel = "Saldo IN";
      } else if (paymentSource === "main") {
        if (mainAmount < finalPrice) {
          return Response.json({ error: `Saldo Utama tidak cukup. Butuh Rp${finalPrice.toLocaleString("id-ID")}, saldo Rp${mainAmount.toLocaleString("id-ID")}.` }, { status: 400, headers: corsHeaders });
        }
        payFromMain = finalPrice;
        sourceLabel = "Saldo Utama";
      } else {
        payFromGame = Math.min(gameAmount, finalPrice);
        payFromMain = finalPrice - payFromGame;
        if (mainAmount < payFromMain) {
          return Response.json({ error: `Saldo tidak cukup. Butuh Rp${finalPrice.toLocaleString("id-ID")}. Saldo IN Rp${gameAmount.toLocaleString("id-ID")}, saldo utama Rp${mainAmount.toLocaleString("id-ID")}.` }, { status: 400, headers: corsHeaders });
        }
        sourceLabel = payFromGame > 0 && payFromMain > 0 ? "Saldo IN + Saldo Utama" : payFromGame > 0 ? "Saldo IN" : "Saldo Utama";
      }
    }

    // Check existing subscription - accumulate
    const { data: existingSubs } = await admin.from("streak_subscriptions").select("id, expires_at").eq("visitor_id", visitorId).eq("is_active", true).gte("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }).limit(1);
    const existingSub = existingSubs && existingSubs.length > 0 ? existingSubs[0] : null;
    const startsAt = existingSub ? new Date(existingSub.expires_at) : new Date();
    const expiresAt = new Date(startsAt.getTime() + plan.days * 24 * 60 * 60 * 1000);

    // Deduct
    if (payFromGame > 0 && gameBal) {
      await admin.from("game_balance").update({ amount: gameAmount - payFromGame, total_spent: (gameBal.total_spent || 0) + payFromGame }).eq("id", gameBal.id);
      await admin.from("game_balance_transactions").insert({ visitor_id: visitorId, type: "spend", amount: -payFromGame, description: `Beli Auto-Klaim Streak ${plan.name}` });
    }
    if (payFromMain > 0 && balanceRow) {
      const { error: balErr } = await admin.from("user_balances").update({ balance: mainAmount - payFromMain }).eq("id", balanceRow.id);
      if (balErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }
    const newBalance = mainAmount - payFromMain;

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
      if (payFromMain > 0 && balanceRow) await admin.from("user_balances").update({ balance: mainAmount }).eq("id", balanceRow.id);
      if (payFromGame > 0 && gameBal) await admin.from("game_balance").update({ amount: gameAmount }).eq("id", gameBal.id);
      return Response.json({ error: "Gagal membuat langganan" }, { status: 500, headers: corsHeaders });
    }

    // Auto-claim today's streak immediately after successful purchase
    const today = getTodayWIB();
    const yesterday = getYesterdayWIB();
    let autoClaimed = false;

    const { data: streak } = await admin
      .from("daily_streaks")
      .select("id, last_claim_date, current_streak, longest_streak, total_claims")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (!streak) {
      const { error: streakInsertErr } = await admin.from("daily_streaks").insert({
        visitor_id: visitorId,
        last_claim_date: today,
        current_streak: 1,
        longest_streak: 1,
        total_claims: 1,
      });
      autoClaimed = !streakInsertErr;
    } else if (streak.last_claim_date !== today) {
      const isContinuous = streak.last_claim_date === yesterday;
      const newStreak = isContinuous ? streak.current_streak + 1 : 1;
      const newLongest = Math.max(streak.longest_streak, newStreak);

      const { error: streakUpdateErr } = await admin.from("daily_streaks").update({
        last_claim_date: today,
        current_streak: newStreak,
        longest_streak: newLongest,
        total_claims: streak.total_claims + 1,
      }).eq("id", streak.id);

      autoClaimed = !streakUpdateErr;
    }

    // Record transaction
    const discountParts = [
      flashDiscountAmount > 0 ? `Flash Sale ${flashDiscountPercent}%` : null,
      voucherDiscountAmount > 0 ? `Voucher Rp${voucherDiscountAmount.toLocaleString("id-ID")}` : null,
    ].filter(Boolean);
    const desc = totalDiscountAmount > 0
      ? `Beli paket Auto-Klaim Streak ${plan.name} [${sourceLabel}] - ${discountParts.join(" + ")}`
      : `Beli paket Auto-Klaim Streak ${plan.name} [${sourceLabel}]`;
    if (payFromMain > 0) {
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        type: "purchase",
        amount: payFromMain,
        description: desc,
      });
    }

    return Response.json({
      success: true,
      plan: plan.name,
      expires_at: expiresAt.toISOString(),
      balance_remaining: newBalance,
      game_balance_remaining: gameAmount - payFromGame,
      paid_from_game: payFromGame,
      paid_from_main: payFromMain,
      source_label: sourceLabel,
      discount_amount: totalDiscountAmount,
      flash_discount_amount: flashDiscountAmount,
      voucher_discount_amount: voucherDiscountAmount,
      auto_claimed: autoClaimed,
    }, { headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
