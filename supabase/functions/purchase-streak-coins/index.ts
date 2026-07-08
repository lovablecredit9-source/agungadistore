import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  visitorId: z.string().trim().min(1),
  packageId: z.string().uuid().optional(),
  pin: z.string().trim().min(1).optional(),
  action: z.enum(["get_packages", "purchase"]).default("purchase"),
  paymentSource: z.enum(["auto", "game", "main"]).default("auto"),
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { visitorId, packageId, pin, action, paymentSource } = parsed.data;

    if (action === "get_packages") {
      const { data } = await admin
        .from("streak_coin_packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return Response.json({ packages: data || [] }, { headers: corsHeaders });
    }

    if (!packageId) {
      return Response.json({ error: "Paket tidak dipilih" }, { status: 400, headers: corsHeaders });
    }

    const { data: pkg } = await admin
      .from("streak_coin_packages")
      .select("*")
      .eq("id", packageId)
      .eq("is_active", true)
      .maybeSingle();

    if (!pkg) {
      return Response.json({ error: "Paket koin tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }

    // Verify PIN
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
    if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 403, headers: corsHeaders });
    if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 403, headers: corsHeaders });
    const hashHex = await sha256Hex(pin);
    if (hashHex !== pinRow.pin_hash) {
      return Response.json({ error: "PIN salah", needPin: true }, { status: 403, headers: corsHeaders });
    }

    // Check balances - split between Saldo IN (game_balance) and Saldo Utama (user_balances)
    const { data: gameBal } = await admin.from("game_balance").select("id, amount, total_spent").eq("visitor_id", visitorId).maybeSingle();
    const { data: balanceRow } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
    if (!balanceRow && !gameBal) {
      return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }
    const gameAmount = gameBal?.amount || 0;
    const mainAmount = balanceRow?.balance || 0;

    let payFromGame = 0;
    let payFromMain = 0;
    let sourceLabel = "";
    // Saldo IN (game_balance) hanya untuk produk toko. Koin Streak wajib Saldo Utama.
    if (mainAmount < pkg.price) {
      return Response.json({ error: "Saldo Utama tidak cukup. Saldo IN tidak bisa dipakai untuk Koin Streak." }, { status: 400, headers: corsHeaders });
    }
    payFromMain = pkg.price;
    sourceLabel = "Saldo Utama";

    // Deduct
    if (payFromGame > 0 && gameBal) {
      await admin.from("game_balance").update({ amount: gameAmount - payFromGame, total_spent: (gameBal.total_spent || 0) + payFromGame }).eq("id", gameBal.id);
      await admin.from("game_balance_transactions").insert({ visitor_id: visitorId, type: "spend", amount: -payFromGame, description: `Beli ${pkg.coins} Koin Streak` });
    }
    if (payFromMain > 0 && balanceRow) {
      const { error: balErr } = await admin.from("user_balances").update({ balance: mainAmount - payFromMain }).eq("id", balanceRow.id);
      if (balErr) {
        return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
      }
    }
    const newBalance = mainAmount - payFromMain;

    // Add coins to daily_streaks
    const { data: streak } = await admin
      .from("daily_streaks")
      .select("id, streak_coins")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (streak) {
      const newCoins = (streak.streak_coins || 0) + pkg.coins;
      const { error: updErr } = await admin
        .from("daily_streaks")
        .update({ streak_coins: newCoins })
        .eq("id", streak.id);
      if (updErr) {
        // Rollback
        if (payFromMain > 0 && balanceRow) await admin.from("user_balances").update({ balance: mainAmount }).eq("id", balanceRow.id);
        if (payFromGame > 0 && gameBal) await admin.from("game_balance").update({ amount: gameAmount }).eq("id", gameBal.id);
        return Response.json({ error: "Gagal menambah koin streak" }, { status: 500, headers: corsHeaders });
      }
    } else {
      const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
      const { error: insErr } = await admin.from("daily_streaks").insert({
        visitor_id: visitorId,
        last_claim_date: today,
        current_streak: 0,
        longest_streak: 0,
        total_claims: 0,
        streak_coins: pkg.coins,
      });
      if (insErr) {
        if (payFromMain > 0 && balanceRow) await admin.from("user_balances").update({ balance: mainAmount }).eq("id", balanceRow.id);
        if (payFromGame > 0 && gameBal) await admin.from("game_balance").update({ amount: gameAmount }).eq("id", gameBal.id);
        return Response.json({ error: "Gagal membuat data streak" }, { status: 500, headers: corsHeaders });
      }
    }

    // Record transaction (main balance only)
    if (payFromMain > 0) {
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        type: "purchase",
        amount: payFromMain,
        description: `Beli ${pkg.coins.toLocaleString("id-ID")} Koin Streak (${pkg.name}) [${sourceLabel}]`,
      });
    }

    return Response.json({
      success: true,
      coins_added: pkg.coins,
      balance_remaining: newBalance,
      game_balance_remaining: gameAmount - payFromGame,
      paid_from_game: payFromGame,
      paid_from_main: payFromMain,
      source_label: sourceLabel,
      package_name: pkg.name,
    }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
