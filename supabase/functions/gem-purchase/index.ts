import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyAccountPin, accountHasPin } from "../_shared/pin.ts";
import { normalizePaymentSource, clampGemQuantity, computeGemOrder } from "../_shared/gem-order.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, packageId, quantity: qRaw, pin, paymentSource: pSrcRaw } = await req.json();
    if (!visitorId || !packageId) {
      return Response.json({ error: "visitorId & packageId wajib" }, { status: 400, headers: corsHeaders });
    }
    const quantity = clampGemQuantity(qRaw);
    const paymentSource = normalizePaymentSource(pSrcRaw);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: pkg } = await admin.from("gem_packages").select("*").eq("id", packageId).eq("is_active", true).maybeSingle();
    if (!pkg) return Response.json({ error: "Paket tidak ditemukan" }, { status: 404, headers: corsHeaders });

    if ((pkg as any).is_first_purchase_only) {
      if (quantity !== 1) {
        return Response.json({ error: "Paket promo pertama hanya bisa dibeli 1x" }, { status: 400, headers: corsHeaders });
      }
      const { data: prev } = await admin
        .from("gem_transactions")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("reference_id", pkg.id)
        .limit(1)
        .maybeSingle();
      if (prev) {
        return Response.json({ error: "Paket promo pertama sudah pernah dibeli" }, { status: 400, headers: corsHeaders });
      }
    }

    const { data: balLogin } = await admin
      .from("balance_login_history")
      .select("user_balance_id")
      .eq("visitor_id", visitorId)
      .order("logged_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!balLogin?.user_balance_id) {
      return Response.json({ error: "Login akun saldo dulu untuk beli Gem" }, { status: 400, headers: corsHeaders });
    }

    // PIN verification
    if (!pin) {
      const has = await accountHasPin(admin, visitorId);
      return Response.json({ error: has ? "PIN diperlukan" : "PIN belum dibuat. Buat PIN dulu di menu Saldo.", needPin: true }, { status: 401, headers: corsHeaders });
    }
    const pinErr = await verifyAccountPin(admin, visitorId, pin);
    if (pinErr) return Response.json({ error: pinErr }, { status: 401, headers: corsHeaders });

    const order = computeGemOrder(pkg as any, quantity);
    if (!order.ok) {
      return Response.json({ error: order.error }, { status: 400, headers: corsHeaders });
    }
    const { totalPrice, totalGems, totalStreakCoins, totalGameCredits } = order;
    const qtyLabelPay = quantity > 1 ? ` x${quantity}` : "";

    // Pembayaran + Gem atomik di database (Auto = Saldo IN dulu, sisanya Saldo Utama)
    const { data: pay, error: payErr } = await admin.rpc("gem_purchase_pay", {
      p_visitor_id: visitorId,
      p_account_id: balLogin.user_balance_id,
      p_source: paymentSource,
      p_total: totalPrice,
      p_gems: totalGems,
      p_package_id: pkg.id,
      p_description: `Beli ${pkg.name}${qtyLabelPay}: +${totalGems} 💎 (Rp${totalPrice.toLocaleString("id-ID")})`,
    });
    if (payErr) {
      console.error("gem_purchase_pay", payErr);
      return Response.json({ error: payErr.message || "Pembayaran gagal, saldo tidak dipotong" }, { status: 500, headers: corsHeaders });
    }
    const p = pay as any;
    if (!p?.ok) return Response.json({ error: p?.error || "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });
    const payFromGame = Number(p.paid_from_game) || 0;
    const payFromMain = Number(p.paid_from_main) || 0;
    const sourceLabel = String(p.source_label);
    const newBalance = Number(p.new_balance);
    const newGameBalance = Number(p.game_balance_remaining);

    // Bonus Streak Coins
    if (totalStreakCoins > 0) {
      const { data: streak } = await admin
        .from("daily_streaks")
        .select("id, streak_coins")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (streak) {
        await admin.from("daily_streaks")
          .update({ streak_coins: (streak.streak_coins || 0) + totalStreakCoins })
          .eq("id", streak.id);
      } else {
        const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
        await admin.from("daily_streaks").insert({
          visitor_id: visitorId,
          last_claim_date: today,
          current_streak: 0,
          longest_streak: 0,
          total_claims: 0,
          streak_coins: totalStreakCoins,
        });
      }
    }

    // Bonus Game Credits
    if (totalGameCredits > 0) {
      const { data: ugc } = await admin.from("user_game_credits").select("credits").eq("visitor_id", visitorId).maybeSingle();
      if (ugc) {
        await admin.from("user_game_credits")
          .update({ credits: (ugc.credits || 0) + totalGameCredits, updated_at: new Date().toISOString() })
          .eq("visitor_id", visitorId);
      } else {
        await admin.from("user_game_credits").insert({ visitor_id: visitorId, credits: totalGameCredits });
      }
    }

    const qtyLabel = quantity > 1 ? ` x${quantity}` : "";
    const parts: string[] = [];
    if (totalStreakCoins > 0) parts.push(`${totalStreakCoins.toLocaleString("id-ID")} 🪙`);
    if (totalGameCredits > 0) parts.push(`${totalGameCredits.toLocaleString("id-ID")} 🔑`);
    const comboTxt = parts.length ? ` + ${parts.join(" + ")}` : "";

    await admin.from("notifications").insert({
      visitor_id: visitorId,
      title: parts.length ? "🎁 Combo Diterima!" : "💎 Gem Bertambah!",
      message: `Kamu mendapat ${totalGems} 💎${comboTxt} dari ${pkg.name}${qtyLabel} (${sourceLabel})`,
      type: "gem",
    });

    return Response.json({
      success: true,
      gems_added: totalGems,
      streak_coins_added: totalStreakCoins,
      game_credits_added: totalGameCredits,
      quantity,
      new_balance: newBalance,
      game_balance_remaining: newGameBalance,
      paid_from_game: payFromGame,
      paid_from_main: payFromMain,
      source_label: sourceLabel,
    }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
