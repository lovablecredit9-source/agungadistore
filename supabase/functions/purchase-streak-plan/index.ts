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

    // Dukung packageId (baru) dan planDays (lama)
    let packageId: string | null = body.packageId || null;
    if (!packageId && body.planDays) {
      const { data } = await admin.from("streak_packages").select("id").eq("days", body.planDays).eq("is_active", true).maybeSingle();
      packageId = data?.id ?? null;
    }
    if (!packageId) return reply({ error: "Paket tidak valid" }, 400);

    if (action === "quote_all") {
      const { data: pkgs } = await admin.from("streak_packages").select("id").eq("is_active", true).order("sort_order");
      const quotes = [];
      for (const p of pkgs || []) {
        const { data } = await admin.rpc("streak_plan_quote", { p_package_id: p.id, p_voucher: null });
        if (data && !(data as any).error) quotes.push(data);
      }
      return reply({ quotes });
    }

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
    return reply(data);
  } catch (error) {
    console.error("purchase-streak-plan error:", error);
    return reply({ error: "Terjadi kesalahan. Saldo tidak terpotong." }, 500);
  }
});
