import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, planId, pin, voucherCode } = await req.json();
    if (!visitorId || !planId) {
      return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: plan } = await admin.from("store_premium_plans").select("*").eq("id", planId).eq("is_active", true).maybeSingle();
    if (!plan) return Response.json({ error: "Paket tidak ditemukan" }, { status: 400, headers: corsHeaders });

    // Verify PIN
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
    if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 200, headers: corsHeaders });
    if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 200, headers: corsHeaders });
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 200, headers: corsHeaders });

    // Cek saldo
    const { data: balRow } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
    if (!balRow) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });

    // Get user_balance_id
    const { data: blh } = await admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
    const ubId = blh?.user_balance_id ?? null;

    // Validasi & terapkan voucher membership (potongan Rupiah) bila ada
    let discount = 0;
    let usedVoucher: { id: string; code: string } | null = null;
    if (voucherCode && typeof voucherCode === "string" && voucherCode.trim()) {
      const code = voucherCode.trim().toUpperCase();
      const { data: v } = await admin.from("discount_vouchers")
        .select("id, code, discount_amount, max_uses, used_count, is_active, expires_at, source, visitor_id, user_balance_id")
        .eq("code", code)
        .eq("source", "membership_discount")
        .maybeSingle();
      if (!v) return Response.json({ error: "Kode voucher membership tidak ditemukan" }, { status: 400, headers: corsHeaders });
      if (!v.is_active) return Response.json({ error: "Voucher sudah tidak aktif" }, { status: 400, headers: corsHeaders });
      if ((v.used_count ?? 0) >= (v.max_uses ?? 1)) return Response.json({ error: "Voucher sudah pernah dipakai" }, { status: 400, headers: corsHeaders });
      if (v.expires_at && new Date(v.expires_at) < new Date()) return Response.json({ error: "Voucher sudah hangus" }, { status: 400, headers: corsHeaders });
      const ownsByVisitor = v.visitor_id === visitorId;
      const ownsByBalance = ubId && v.user_balance_id === ubId;
      if (!ownsByVisitor && !ownsByBalance) return Response.json({ error: "Voucher ini bukan milik akun kamu" }, { status: 400, headers: corsHeaders });
      discount = Math.min(plan.price, v.discount_amount ?? 0);
      usedVoucher = { id: v.id, code: v.code };
    }

    const finalPrice = Math.max(0, plan.price - discount);
    if (balRow.balance < finalPrice) return Response.json({ error: "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });

    // Cek subscription aktif (perpanjang dari expiry terjauh)
    const { data: existing } = await admin.from("store_premium_subscriptions")
      .select("expires_at")
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .or(`visitor_id.eq.${visitorId}${ubId ? `,user_balance_id.eq.${ubId}` : ""}`)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startsAt = existing ? new Date(existing.expires_at) : new Date();
    const expiresAt = new Date(startsAt.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

    // Potong saldo
    const newBal = balRow.balance - finalPrice;
    const { error: balErr } = await admin.from("user_balances").update({ balance: newBal }).eq("id", balRow.id);
    if (balErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });

    // Tandai voucher terpakai
    if (usedVoucher) {
      await admin.from("discount_vouchers").update({ used_count: 1, is_active: false }).eq("id", usedVoucher.id);
    }

    // Insert subscription
    await admin.from("store_premium_subscriptions").insert({
      visitor_id: visitorId,
      user_balance_id: ubId,
      plan_id: plan.id,
      plan_name: plan.name,
      duration_days: plan.duration_days,
      price_paid: finalPrice,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });

    // Catat transaksi
    await admin.from("balance_transactions").insert({
      visitor_id: visitorId,
      type: "purchase",
      amount: finalPrice,
      description: `Membership Premium Toko: ${plan.name}${usedVoucher ? ` (voucher ${usedVoucher.code} -${discount})` : ""}`,
    });

    // Notifikasi
    await admin.rpc("create_notification", {
      p_visitor_id: visitorId,
      p_title: "👑 Premium Toko Aktif!",
      p_message: `Selamat! ${plan.name} aktif sampai ${expiresAt.toLocaleDateString("id-ID")}. Klaim voucher Rp 2.000 setiap hari di tab Premium!`,
      p_type: "success",
      p_related_id: null,
    });

    return Response.json({
      success: true,
      plan_name: plan.name,
      expires_at: expiresAt.toISOString(),
      balance_remaining: newBal,
      discount_applied: discount,
      voucher_used: usedVoucher?.code ?? null,
    }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 500, headers: corsHeaders });
  }
});
