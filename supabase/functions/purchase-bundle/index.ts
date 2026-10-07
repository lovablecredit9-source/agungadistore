import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyAccountPin } from "../_shared/pin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Paket Bundel: pembayaran + kredit + streak + storage diberikan dalam SATU transaksi
 * `purchase_bundle_atomic` (rollback semua bila satu gagal; idempoten lewat purchaseRef).
 * Bundel belum punya sistem voucher, jadi voucher tidak diterima di sini.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, visitorId, packageId, pin } = body;
    const paymentSource = ["auto", "game", "main"].includes(body.paymentSource) ? body.paymentSource : "auto";
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "get_packages") {
      const { data } = await admin.from("bundle_packages").select("*").eq("is_active", true).order("sort_order");
      return reply({ packages: data || [] });
    }

    if (!visitorId || !packageId) return reply({ error: "Data tidak lengkap" }, 400);
    const { data: bundle } = await admin.from("bundle_packages").select("id, is_active").eq("id", packageId).maybeSingle();
    if (!bundle) return reply({ error: "Paket tidak ditemukan" }, 400);
    if (!bundle.is_active) return reply({ error: "Paket sedang tidak aktif" }, 400);

    if (!pin) return reply({ error: "PIN diperlukan", needPin: true });
    const pinErr = await verifyAccountPin(admin, visitorId, pin);
    if (pinErr) return reply({ error: pinErr, needPin: true });

    const ref = "bd:" + String(body.purchaseRef || crypto.randomUUID()).replace(/[^A-Za-z0-9-]/g, "").slice(0, 60);
    const { data, error } = await admin.rpc("purchase_bundle_atomic", {
      p_visitor_id: visitorId, p_package_id: packageId, p_source: paymentSource, p_ref: ref,
    });
    if (error) {
      console.error("purchase_bundle_atomic error:", error.message);
      return reply({ error: "Pembelian gagal diproses. Saldo tidak terpotong." }, 500);
    }
    if ((data as any)?.error) return reply({ error: (data as any).error }, 400);
    return reply(data);
  } catch (error) {
    console.error("purchase-bundle error:", error);
    return reply({ error: "Terjadi kesalahan. Saldo tidak terpotong." }, 500);
  }
});
