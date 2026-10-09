import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyAccountPin } from "../_shared/pin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Paket Streak. Harga/flash sale/voucher dihitung di DB (`streak_plan_quote`),
 * pembayaran + langganan + auto-klaim dalam satu transaksi `purchase_streak_plan_atomic`
 * (idempoten lewat purchaseRef). Harga dari browser diabaikan.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, visitorId, pin, voucherCode } = body;
    const paymentSource = ["auto", "game", "main"].includes(body.paymentSource) ? body.paymentSource : "auto";
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "get_packages") {
      const { data } = await admin.from("streak_packages").select("*").eq("is_active", true).order("sort_order", { ascending: true });
      return reply({ packages: data || [] });
    }

    if (action === "status") {
      if (!visitorId) return reply({ error: "Data tidak lengkap" }, 400);
      const [{ data: st }, { data: subs }, { data: lucky }, { data: ub }, { data: gb }] = await Promise.all([
        admin.rpc("get_streak_autoclaim_status", { p_visitor_id: visitorId }),
        admin.from("streak_subscriptions").select("id, plan_name, plan_days, price_paid, starts_at, expires_at, created_at").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(30),
        admin.from("streak_lucky_bonuses").select("purchase_ref, reward_type, reward_label, created_at").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(30),
        admin.from("user_balances").select("balance").eq("visitor_id", visitorId).maybeSingle(),
        admin.from("game_balance").select("amount").eq("visitor_id", visitorId).maybeSingle(),
      ]);
      // Transaksi pembelian (harga akhir, sumber, diskon) dari balance_transactions server
      const { data: txs } = await admin.from("balance_transactions").select("description, trx_id, purchase_ref, created_at").eq("visitor_id", visitorId).like("purchase_ref", "sp:%").order("created_at", { ascending: false }).limit(30);
      return reply({ status: st, subscriptions: subs || [], lucky: lucky || [], transactions: txs || [], balances: { main: ub ? Number(ub.balance) : null, game: Number(gb?.amount ?? 0) } });
    }

    if (action === "achievement_log") {
      if (!visitorId) return reply({ log: [] });
      const { data } = await admin.from("streak_achievement_log").select("achievement_id, unlocked_at").eq("visitor_id", visitorId).order("unlocked_at", { ascending: false }).limit(50);
      return reply({ log: data ?? [] });
    }

    if (action === "quote_all") {
      const { data: pkgs } = await admin.from("streak_packages").select("id").eq("is_active", true).order("sort_order");
      const quotes = [];
      for (const p of pkgs || []) {
        const { data } = await admin.rpc("streak_plan_quote", { p_package_id: p.id, p_voucher: null });
        if (data && !(data as any).error) quotes.push(data);
      }
      const { data: fs } = await admin.from("admin_settings").select("setting_key, setting_value").in("setting_key", ["flash_sale_end", "flash_sale_label"]);
      const map = Object.fromEntries((fs || []).map((r: any) => [r.setting_key, r.setting_value]));
      const flashOn = quotes.some((q: any) => Number(q.flash_pct) > 0);
      return reply({ quotes, flash_sale_end: flashOn ? map.flash_sale_end : null, flash_sale_label: flashOn ? map.flash_sale_label || null : null, server_now: new Date().toISOString() });
    }

    // Dukung packageId (baru) dan planDays (lama)
    let packageId: string | null = body.packageId || null;
    if (!packageId && body.planDays) {
      const { data } = await admin.from("streak_packages").select("id").eq("days", body.planDays).eq("is_active", true).maybeSingle();
      packageId = data?.id ?? null;
    }
    if (!packageId) return reply({ error: "Paket tidak valid" }, 400);

    if (action === "quote") {
      const { data, error } = await admin.rpc("streak_plan_quote", { p_package_id: packageId, p_voucher: voucherCode || null });
      if (error) return reply({ error: "Gagal menghitung harga" }, 500);
      return reply({ quote: data });
    }

    if (!visitorId) return reply({ error: "Data tidak lengkap" }, 400);
    if (!pin) return reply({ error: "PIN diperlukan", needPin: true });
    const pinErr = await verifyAccountPin(admin, visitorId, pin);
    if (pinErr) return reply({ error: pinErr, needPin: true });

    const ref = "sp:" + String(body.purchaseRef || crypto.randomUUID()).replace(/[^A-Za-z0-9-]/g, "").slice(0, 60);
    const { data, error } = await admin.rpc("purchase_streak_plan_atomic", {
      p_visitor_id: visitorId, p_package_id: packageId, p_voucher: voucherCode || null, p_source: paymentSource, p_ref: ref,
    });
    if (error) {
      console.error("purchase_streak_plan_atomic error:", error.message);
      return reply({ error: /voucher/i.test(error.message) ? error.message : "Pembelian gagal diproses. Saldo tidak terpotong." }, 500);
    }
    if ((data as any)?.error) return reply({ error: (data as any).error }, 400);
    // Lucky Bonus diacak server, maksimal 1x per purchase_ref (retry mengembalikan hasil yang sama)
    const { data: lucky, error: luckyErr } = await admin.rpc("roll_streak_lucky_bonus", { p_visitor_id: visitorId, p_ref: ref });
    if (luckyErr) console.error("roll_streak_lucky_bonus error:", luckyErr.message);
    return reply({ ...(data as Record<string, unknown>), lucky: luckyErr || (lucky as any)?.error ? null : lucky });
  } catch (error) {
    console.error("purchase-streak-plan error:", error);
    return reply({ error: "Terjadi kesalahan. Saldo tidak terpotong." }, 500);
  }
});
