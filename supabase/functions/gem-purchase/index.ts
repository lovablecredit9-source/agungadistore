import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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
    const quantity = Math.max(1, Math.min(99, Number(qRaw) || 1));
    const paymentSource: "auto" | "game" | "main" =
      pSrcRaw === "game" || pSrcRaw === "main" ? pSrcRaw : "auto";

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
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
    if (pinRow) {
      if (!pin || !/^\d{4,6}$/.test(String(pin))) {
        return Response.json({ error: "PIN diperlukan" }, { status: 401, headers: corsHeaders });
      }
      const h = await hashPin(String(pin));
      if (h !== pinRow.pin_hash) {
        return Response.json({ error: "PIN salah" }, { status: 401, headers: corsHeaders });
      }
    }

    const totalPrice = pkg.price * quantity;
    const totalGems = (pkg.gems + (pkg.bonus_gems || 0)) * quantity;
    const totalStreakCoins = ((pkg as any).bonus_streak_coins || 0) * quantity;
    const totalGameCredits = ((pkg as any).bonus_game_credits || 0) * quantity;

    // Ambil saldo Game (Saldo IN) & Utama
    const { data: gameBal } = await admin
      .from("game_balance")
      .select("id, amount, total_spent")
      .eq("visitor_id", visitorId)
      .maybeSingle();
    const { data: bal } = await admin
      .from("user_balances")
      .select("id, balance")
      .eq("id", balLogin.user_balance_id)
      .maybeSingle();

    const gameAmount = gameBal?.amount || 0;
    const mainAmount = bal?.balance || 0;

    // Saldo IN (game_balance) hanya untuk produk toko. Pembelian Gem wajib Saldo Utama.
    let payFromGame = 0;
    let payFromMain = 0;
    let sourceLabel = "";
    if (mainAmount < totalPrice) {
      return Response.json({ error: `Saldo Utama kurang. Butuh Rp${totalPrice.toLocaleString("id-ID")}. Saldo IN tidak bisa dipakai untuk Gem.` }, { status: 400, headers: corsHeaders });
    }
    payFromMain = totalPrice;
    sourceLabel = "Saldo Utama";

    // Potong saldo
    if (payFromGame > 0 && gameBal) {
      await admin.from("game_balance").update({
        amount: gameAmount - payFromGame,
        total_spent: (gameBal.total_spent || 0) + payFromGame,
      }).eq("id", gameBal.id);
      await admin.from("game_balance_transactions").insert({
        visitor_id: visitorId,
        type: "spend",
        amount: -payFromGame,
        description: `Beli ${pkg.name} (${totalGems} 💎)`,
      });
    }
    if (payFromMain > 0 && bal) {
      await admin.from("user_balances").update({ balance: mainAmount - payFromMain }).eq("id", bal.id);
    }
    const newBalance = mainAmount - payFromMain;
    const newGameBalance = gameAmount - payFromGame;

    // Tambah gem
    if (totalGems > 0) {
      await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: totalGems });
    }

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

    await admin.from("gem_transactions").insert({
      visitor_id: visitorId,
      amount: totalGems,
      type: "purchase",
      description: `Beli ${pkg.name}${qtyLabel}: +${totalGems} 💎${comboTxt} (Rp${totalPrice.toLocaleString("id-ID")} [${sourceLabel}])`,
      reference_id: pkg.id,
    });
    if (payFromMain > 0) {
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        amount: -payFromMain,
        type: "gem_purchase",
        description: `Beli ${pkg.name}${qtyLabel}: ${totalGems} 💎${comboTxt} [${sourceLabel}]`,
      });
    }
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
