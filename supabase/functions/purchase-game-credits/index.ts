import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyAccountPin } from "../_shared/pin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  label: string;
  is_unlimited: boolean;
  unlimited_days: number;
  is_active: boolean;
  sort_order: number;
}

async function getPackages(admin: any): Promise<CreditPackage[]> {
  const { data } = await admin
    .from("credit_packages")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return data || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, visitorId, packageId, pin, voucherCode, paymentSource = "auto", purchaseRef } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "get_packages") {
      const packages = await getPackages(admin);
      return Response.json({ packages }, { headers: corsHeaders });
    }

    if (action === "get_credits") {
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      // Account-aware: aggregate credits from all visitor IDs linked to the same balance account
      const { data: totalCredits } = await admin.rpc("get_account_credits", { p_visitor_id: visitorId });
      const credits = Number(totalCredits) || 0;
      // Get unlimited status from any row in the account
      const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
      let unlimitedUntil: string | null = null;
      if (ubId) {
        const { data: visitors } = await admin.from("balance_login_history").select("visitor_id").eq("user_balance_id", ubId);
        const vids = Array.from(new Set((visitors || []).map((v: { visitor_id: string }) => v.visitor_id)));
        if (vids.length) {
          const { data: rows } = await admin.from("user_game_credits").select("unlimited_until").in("visitor_id", vids).not("unlimited_until", "is", null);
          const maxTs = (rows || []).map((r: { unlimited_until: string }) => new Date(r.unlimited_until).getTime()).filter((t) => !isNaN(t)).sort((a, b) => b - a)[0];
          if (maxTs) unlimitedUntil = new Date(maxTs).toISOString();
        }
      } else {
        const { data: own } = await admin.from("user_game_credits").select("unlimited_until").eq("visitor_id", visitorId).maybeSingle();
        unlimitedUntil = own?.unlimited_until || null;
      }
      const isUnlimited = unlimitedUntil && new Date(unlimitedUntil) > new Date();
      return Response.json({ credits, unlimited_until: unlimitedUntil, is_unlimited: !!isUnlimited }, { headers: corsHeaders });
    }

    if (action === "use_credit") {
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      // Check unlimited first (account-wide)
      const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
      let unlimitedUntil: string | null = null;
      if (ubId) {
        const { data: visitors } = await admin.from("balance_login_history").select("visitor_id").eq("user_balance_id", ubId);
        const vids = Array.from(new Set((visitors || []).map((v: { visitor_id: string }) => v.visitor_id)));
        if (vids.length) {
          const { data: rows } = await admin.from("user_game_credits").select("unlimited_until").in("visitor_id", vids).not("unlimited_until", "is", null);
          const maxTs = (rows || []).map((r: { unlimited_until: string }) => new Date(r.unlimited_until).getTime()).filter((t) => !isNaN(t)).sort((a, b) => b - a)[0];
          if (maxTs) unlimitedUntil = new Date(maxTs).toISOString();
        }
      } else {
        const { data: own } = await admin.from("user_game_credits").select("unlimited_until").eq("visitor_id", visitorId).maybeSingle();
        unlimitedUntil = own?.unlimited_until || null;
      }
      const isUnlimited = unlimitedUntil && new Date(unlimitedUntil) > new Date();
      if (isUnlimited) {
        const { data: total } = await admin.rpc("get_account_credits", { p_visitor_id: visitorId });
        return Response.json({ success: true, credits: Number(total) || 0, is_unlimited: true }, { headers: corsHeaders });
      }
      // Deduct 1 credit account-wide
      const { data: newTotal, error: deductErr } = await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: -1 });
      if (deductErr) {
        return Response.json({ error: "Kredit jawaban habis" }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ success: true, credits: Number(newTotal) || 0, is_unlimited: false }, { headers: corsHeaders });
    }

    if (action === "check_voucher") {
      if (!voucherCode) return Response.json({ error: "Kode voucher diperlukan" }, { status: 400, headers: corsHeaders });
      const { data: voucher } = await admin.from("game_discount_vouchers").select("*").eq("code", voucherCode.trim().toUpperCase()).eq("is_active", true).maybeSingle();
      if (!voucher) return Response.json({ error: "Voucher tidak ditemukan atau tidak aktif" }, { status: 404, headers: corsHeaders });
      if (voucher.used_count >= voucher.max_uses) return Response.json({ error: "Voucher sudah habis" }, { status: 400, headers: corsHeaders });
      if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) return Response.json({ error: "Voucher sudah kedaluwarsa" }, { status: 400, headers: corsHeaders });
      return Response.json({ valid: true, discount_amount: voucher.discount_amount, voucher_id: voucher.id }, { headers: corsHeaders });
    }

    if (action === "quote_all") {
      // Harga tampil = rumus server yang sama dengan pembelian (flash sale + diskon Premium, tanpa voucher).
      const packages = await getPackages(admin);
      const quotes = await Promise.all(packages.map(async (p) => {
        const { data } = await admin.rpc("game_credit_quote", { p_visitor_id: visitorId || "", p_package_id: p.id, p_voucher: "" });
        return data && !(data as any).error ? data : null;
      }));
      return Response.json({ packages, quotes: quotes.filter(Boolean) }, { headers: corsHeaders });
    }

    if (action === "quote") {
      if (!packageId) return Response.json({ error: "Paket tidak ditemukan" }, { status: 400, headers: corsHeaders });
      const { data: q, error: qErr } = await admin.rpc("game_credit_quote", {
        p_visitor_id: visitorId || "", p_package_id: packageId, p_voucher: voucherCode || "",
      });
      if (qErr) return Response.json({ error: "Gagal menghitung harga. Coba lagi." }, { status: 500, headers: corsHeaders });
      if ((q as any)?.error) return Response.json({ error: (q as any).error }, { status: 400, headers: corsHeaders });
      return Response.json({ quote: q }, { headers: corsHeaders });
    }

    if (action === "purchase") {
      if (!visitorId || !packageId) return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
      if (!["auto", "game", "main"].includes(paymentSource)) {
        return Response.json({ error: "Sumber pembayaran tidak valid" }, { status: 400, headers: corsHeaders });
      }
      if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 200, headers: corsHeaders });
      const pinErr = await verifyAccountPin(admin, visitorId, String(pin));
      if (pinErr) return Response.json({ error: pinErr, needPin: true, pinError: true }, { status: 403, headers: corsHeaders });

      // Seluruh harga, saldo, voucher, kredit & transaksi dihitung dan ditulis atomik di DB (satu transaksi + kunci per akun).
      const rawRef = typeof purchaseRef === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(purchaseRef) ? purchaseRef : crypto.randomUUID();
      const { data: result, error: rpcErr } = await admin.rpc("purchase_game_credits", {
        p_visitor_id: visitorId, p_package_id: packageId, p_voucher: voucherCode || "",
        p_source: paymentSource, p_ref: `gc:${rawRef}`,
      });
      if (rpcErr) {
        console.error("purchase_game_credits rpc", rpcErr.message);
        const msg = /Voucher/.test(rpcErr.message) ? rpcErr.message : "Transaksi gagal diproses. Silakan coba lagi.";
        return Response.json({ error: msg }, { status: 400, headers: corsHeaders });
      }
      if ((result as any)?.error) return Response.json({ error: (result as any).error }, { status: 400, headers: corsHeaders });
      return Response.json(result, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("purchase-game-credits", e);
    return Response.json({ error: "Transaksi gagal diproses. Silakan coba lagi." }, { status: 500, headers: corsHeaders });
  }
});
