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
    const { visitorId, packageId, quantity: qRaw, pin } = await req.json();
    if (!visitorId || !packageId) {
      return Response.json({ error: "visitorId & packageId wajib" }, { status: 400, headers: corsHeaders });
    }
    const quantity = Math.max(1, Math.min(99, Number(qRaw) || 1));

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: pkg } = await admin.from("gem_packages").select("*").eq("id", packageId).eq("is_active", true).maybeSingle();
    if (!pkg) return Response.json({ error: "Paket tidak ditemukan" }, { status: 404, headers: corsHeaders });

    // First-purchase-only packages: limit to 1 per account, qty must be 1
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

    // Find user_balance via visitor_id
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

    // PIN verification (jika user sudah set PIN)
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

    const { data: bal } = await admin.from("user_balances").select("balance").eq("id", balLogin.user_balance_id).maybeSingle();
    if (!bal || bal.balance < totalPrice) {
      return Response.json({ error: `Saldo kurang. Butuh Rp${totalPrice.toLocaleString("id-ID")}` }, { status: 400, headers: corsHeaders });
    }

    // Deduct balance
    await admin.from("user_balances").update({ balance: bal.balance - totalPrice }).eq("id", balLogin.user_balance_id);

    // Add gems via account-aware RPC (puts gems on the active account's primary profile)
    if (totalGems > 0) {
      await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: totalGems });
    }

    // Add Streak Coins to daily_streaks (combo bundles)
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

    const qtyLabel = quantity > 1 ? ` x${quantity}` : "";
    const comboTxt = totalStreakCoins > 0 ? ` + ${totalStreakCoins.toLocaleString("id-ID")} 🪙` : "";
    await admin.from("gem_transactions").insert({
      visitor_id: visitorId,
      amount: totalGems,
      type: "purchase",
      description: `Beli ${pkg.name}${qtyLabel}: +${totalGems} 💎${comboTxt} (Rp${totalPrice.toLocaleString("id-ID")})`,
      reference_id: pkg.id,
    });
    await admin.from("balance_transactions").insert({
      visitor_id: visitorId,
      amount: -totalPrice,
      type: "gem_purchase",
      description: `Beli ${pkg.name}${qtyLabel}: ${totalGems} 💎${comboTxt}`,
    });
    await admin.from("notifications").insert({
      visitor_id: visitorId,
      title: totalStreakCoins > 0 ? "🎁 Combo Diterima!" : "💎 Gem Bertambah!",
      message: `Kamu mendapat ${totalGems} 💎${comboTxt} dari ${pkg.name}${qtyLabel}`,
      type: "gem",
    });

    return Response.json({ success: true, gems_added: totalGems, streak_coins_added: totalStreakCoins, quantity, new_balance: bal.balance - totalPrice }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
