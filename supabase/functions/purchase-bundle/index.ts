import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { action, visitorId, packageId, pin } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "get_packages") {
      const { data } = await admin.from("bundle_packages").select("*").eq("is_active", true).order("sort_order");
      return Response.json({ packages: data || [] }, { headers: corsHeaders });
    }

    if (!visitorId || !packageId) {
      return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
    }

    const { data: bundle } = await admin.from("bundle_packages").select("*").eq("id", packageId).eq("is_active", true).maybeSingle();
    if (!bundle) return Response.json({ error: "Paket tidak ditemukan" }, { status: 400, headers: corsHeaders });

    // Verify PIN — return 200 with needPin flag so the client can prompt without triggering error overlay
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
    if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 200, headers: corsHeaders });
    if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 200, headers: corsHeaders });
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pin));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 200, headers: corsHeaders });

    // Check balances - support Saldo IN (game_balance) + Saldo Utama
    const { data: gameBal } = await admin.from("game_balance").select("id, amount, total_spent").eq("visitor_id", visitorId).maybeSingle();
    const { data: balanceRow } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
    if (!balanceRow && !gameBal) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    const gameAmount = gameBal?.amount || 0;
    const mainAmount = balanceRow?.balance || 0;
    // Saldo IN (game_balance) hanya untuk produk toko. Paket bundel wajib Saldo Utama.
    let payFromGame = 0, payFromMain = 0, sourceLabel = "";
    if (mainAmount >= bundle.price) {
      payFromMain = bundle.price; sourceLabel = "Saldo Utama";
    } else {
      return Response.json({ error: "Saldo Utama tidak cukup. Saldo IN tidak bisa dipakai untuk paket bundel." }, { status: 400, headers: corsHeaders });
    }

    if (payFromGame > 0 && gameBal) {
      await admin.from("game_balance").update({ amount: gameAmount - payFromGame, total_spent: (gameBal.total_spent || 0) + payFromGame }).eq("id", gameBal.id);
      await admin.from("game_balance_transactions").insert({ visitor_id: visitorId, type: "spend", amount: -payFromGame, description: `Beli Paket Bundel: ${bundle.name}` });
    }
    if (payFromMain > 0 && balanceRow) {
      const { error: balErr } = await admin.from("user_balances").update({ balance: mainAmount - payFromMain }).eq("id", balanceRow.id);
      if (balErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }
    const newBalance = mainAmount - payFromMain;

    // Add credits
    if (bundle.credits > 0) {
      const { data: creditRow } = await admin.from("user_game_credits").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (creditRow) {
        await admin.from("user_game_credits").update({ credits: creditRow.credits + bundle.credits }).eq("id", creditRow.id);
      } else {
        await admin.from("user_game_credits").insert({ visitor_id: visitorId, credits: bundle.credits });
      }
    }

    // Add streak subscription
    if (bundle.streak_days > 0) {
      const { data: existingSubs } = await admin.from("streak_subscriptions").select("id, expires_at").eq("visitor_id", visitorId).eq("is_active", true).gte("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }).limit(1);
      const existingSub = existingSubs && existingSubs.length > 0 ? existingSubs[0] : null;
      const startsAt = existingSub ? new Date(existingSub.expires_at) : new Date();
      const expiresAt = new Date(startsAt.getTime() + bundle.streak_days * 24 * 60 * 60 * 1000);

      await admin.from("streak_subscriptions").insert({
        visitor_id: visitorId,
        plan_name: bundle.name,
        plan_days: bundle.streak_days,
        price_paid: 0,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
      });

      // Auto-claim today's streak
      const today = getTodayWIB();
      const yesterday = getYesterdayWIB();
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) {
        await admin.from("daily_streaks").insert({ visitor_id: visitorId, last_claim_date: today, current_streak: 1, longest_streak: 1, total_claims: 1 });
      } else if (streak.last_claim_date !== today) {
        const isContinuous = streak.last_claim_date === yesterday;
        const newStreak = isContinuous ? streak.current_streak + 1 : 1;
        await admin.from("daily_streaks").update({ last_claim_date: today, current_streak: newStreak, longest_streak: Math.max(streak.longest_streak, newStreak), total_claims: streak.total_claims + 1 }).eq("id", streak.id);
      }
    }

    // Add storage (selalu 30 hari, tidak permanen)
    if (bundle.storage_mb > 0) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from("user_music_storage").insert({ visitor_id: visitorId, storage_mb: bundle.storage_mb, voucher_code: `BUNDLE-${Date.now()}`, expires_at: expiresAt });
    }

    // Record transaction (only main portion in balance_transactions)
    if (payFromMain > 0) {
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        type: "purchase",
        amount: payFromMain,
        description: `Beli Paket Bundel: ${bundle.name} [${sourceLabel}]`,
      });
    }

    return Response.json({
      success: true,
      bundle_name: bundle.name,
      balance_remaining: newBalance,
      game_balance_remaining: gameAmount - payFromGame,
      source_label: sourceLabel,
    }, { headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
