import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  visitorId: z.string().trim().min(1),
  action: z.enum(["list", "purchase"]).default("list"),
  planId: z.string().uuid().optional(),
  paymentMethod: z.enum(["coins", "balance"]).optional(),
  paymentSource: z.enum(["auto", "game", "main"]).default("auto"),
  pin: z.string().trim().min(1).optional(),
});

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Permintaan tidak valid" }, { status: 400, headers: corsHeaders });
    }

    const { visitorId, action, planId, paymentMethod, paymentSource, pin } = parsed.data;
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---------- LIST ----------
    if (action === "list") {
      const { data: plans } = await admin
        .from("streak_membership_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      const { data: streak } = await admin
        .from("daily_streaks")
        .select("streak_coins")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      const { data: activeMemberships } = await admin
        .from("streak_user_memberships")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false });

      const { data: gameBal } = await admin.from("game_balance").select("amount").eq("visitor_id", visitorId).maybeSingle();
      const { data: balanceRow } = await admin.from("user_balances").select("balance").eq("visitor_id", visitorId).maybeSingle();

      return Response.json({
        plans: plans || [],
        active_memberships: activeMemberships || [],
        user_coins: streak?.streak_coins || 0,
        game_balance: gameBal?.amount || 0,
        main_balance: balanceRow?.balance || 0,
      }, { headers: corsHeaders });
    }

    // ---------- PURCHASE ----------
    if (!planId || !paymentMethod) {
      return Response.json({ error: "Paket atau metode pembayaran tidak dipilih" }, { status: 400, headers: corsHeaders });
    }

    const { data: plan } = await admin
      .from("streak_membership_plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .maybeSingle();
    if (!plan) return Response.json({ error: "Paket tidak ditemukan" }, { status: 404, headers: corsHeaders });

    // Verify PIN if paying with balance
    if (paymentMethod === "balance") {
      const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
      if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 403, headers: corsHeaders });
      if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 403, headers: corsHeaders });
      const hashHex = await sha256Hex(pin);
      if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 403, headers: corsHeaders });
    }

    let amountPaid = 0;
    let methodLabel = "";

    if (paymentMethod === "coins") {
      const price = plan.price_coins || 0;
      if (price <= 0) return Response.json({ error: "Paket ini tidak menerima pembayaran koin" }, { status: 400, headers: corsHeaders });
      const { data: streak } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
      const userCoins = streak?.streak_coins || 0;
      if (userCoins < price) return Response.json({ error: `Streak Coins tidak cukup (butuh ${price.toLocaleString("id-ID")})` }, { status: 400, headers: corsHeaders });
      if (!streak) return Response.json({ error: "Data streak tidak ditemukan" }, { status: 404, headers: corsHeaders });
      const { error: updErr } = await admin.from("daily_streaks").update({ streak_coins: userCoins - price }).eq("id", streak.id);
      if (updErr) return Response.json({ error: "Gagal memotong koin" }, { status: 500, headers: corsHeaders });
      amountPaid = price;
      methodLabel = "Streak Coins";
    } else {
      const price = plan.price_idr || 0;
      if (price <= 0) return Response.json({ error: "Paket ini tidak menerima pembayaran saldo" }, { status: 400, headers: corsHeaders });

      const { data: gameBal } = await admin.from("game_balance").select("id, amount, total_spent").eq("visitor_id", visitorId).maybeSingle();
      const { data: balanceRow } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
      if (!balanceRow && !gameBal) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
      const gameAmount = gameBal?.amount || 0;
      const mainAmount = balanceRow?.balance || 0;

      let payFromGame = 0, payFromMain = 0;
      if (paymentSource === "main") {
        if (mainAmount < price) return Response.json({ error: "Saldo Utama tidak cukup" }, { status: 400, headers: corsHeaders });
        payFromMain = price;
        methodLabel = "Saldo Utama";
      } else if (paymentSource === "game") {
        if (gameAmount < price) return Response.json({ error: "Saldo IN tidak cukup" }, { status: 400, headers: corsHeaders });
        payFromGame = price;
        methodLabel = "Saldo IN";
      } else {
        if (gameAmount + mainAmount < price) return Response.json({ error: "Saldo gabungan tidak cukup" }, { status: 400, headers: corsHeaders });
        payFromGame = Math.min(gameAmount, price);
        payFromMain = price - payFromGame;
        methodLabel = payFromGame > 0 && payFromMain > 0 ? "Saldo IN + Utama" : payFromGame > 0 ? "Saldo IN" : "Saldo Utama";
      }

      if (payFromGame > 0 && gameBal) {
        await admin.from("game_balance").update({ amount: gameAmount - payFromGame, total_spent: (gameBal.total_spent || 0) + payFromGame }).eq("id", gameBal.id);
        await admin.from("game_balance_transactions").insert({ visitor_id: visitorId, type: "spend", amount: -payFromGame, description: `Beli Membership ${plan.name}` });
      }
      if (payFromMain > 0 && balanceRow) {
        const { error: balErr } = await admin.from("user_balances").update({ balance: mainAmount - payFromMain }).eq("id", balanceRow.id);
        if (balErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
        await admin.from("balance_transactions").insert({ visitor_id: visitorId, type: "purchase", amount: payFromMain, description: `Beli Membership ${plan.name} [${methodLabel}]` });
      }
      amountPaid = price;
    }

    // Stack expiry: jika masih ada membership aktif, perpanjang dari expires_at terjauh
    const { data: existingActive } = await admin
      .from("streak_user_memberships")
      .select("expires_at")
      .eq("visitor_id", visitorId)
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1);

    const startsAt = existingActive && existingActive.length > 0 ? new Date(existingActive[0].expires_at) : new Date();
    const expiresAt = new Date(startsAt.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

    const { error: insErr } = await admin.from("streak_user_memberships").insert({
      visitor_id: visitorId,
      plan_id: plan.id,
      plan_name: plan.name,
      duration_days: plan.duration_days,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      payment_method: methodLabel,
      amount_paid: amountPaid,
      bonus_multiplier: plan.bonus_multiplier,
      is_active: true,
    });
    if (insErr) return Response.json({ error: "Gagal menyimpan membership: " + insErr.message }, { status: 500, headers: corsHeaders });

    // Beri bonus instant: streak coins, gems, freeze
    if (plan.bonus_streak_coins > 0) {
      const { data: s } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
      if (s) {
        await admin.from("daily_streaks").update({ streak_coins: (s.streak_coins || 0) + plan.bonus_streak_coins }).eq("id", s.id);
      } else {
        const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
        await admin.from("daily_streaks").insert({ visitor_id: visitorId, last_claim_date: today, current_streak: 0, longest_streak: 0, total_claims: 0, streak_coins: plan.bonus_streak_coins });
      }
    }
    if (plan.bonus_gems > 0) {
      try { await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: plan.bonus_gems }); } catch (_) { /* ignore */ }
    }
    if (plan.bonus_freeze_count > 0) {
      const { data: fr } = await admin.from("streak_freezes").select("id, freeze_count").eq("visitor_id", visitorId).maybeSingle();
      if (fr) {
        await admin.from("streak_freezes").update({ freeze_count: (fr.freeze_count || 0) + plan.bonus_freeze_count }).eq("id", fr.id);
      } else {
        await admin.from("streak_freezes").insert({ visitor_id: visitorId, freeze_count: plan.bonus_freeze_count });
      }
    }

    return Response.json({
      success: true,
      plan_name: plan.name,
      expires_at: expiresAt.toISOString(),
      method: methodLabel,
      bonus: {
        streak_coins: plan.bonus_streak_coins,
        gems: plan.bonus_gems,
        freeze: plan.bonus_freeze_count,
        multiplier: plan.bonus_multiplier,
      },
    }, { headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
