import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyAccountPin } from "../_shared/pin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUB_PRICE = 10000; // Rp 10.000 / bulan
const SUB_MAX = 15;
const SUB_DAYS = 30;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "buy");
    const visitorId = String(body.visitorId || body.visitor_id || "").trim();
    if (!visitorId) return Response.json({ error: "Visitor tidak dikenal" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // resolve akun saldo (langganan melekat ke akun, bukan hanya perangkat)
    const { data: histRow } = await admin
      .from("balance_login_history").select("user_balance_id")
      .eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
    const ubId: string | null = histRow?.user_balance_id || null;

    // current active subscription
    const subQuery = admin.from("confess_number_subscriptions").select("*");
    const { data: subs } = await (ubId ? subQuery.or(`visitor_id.eq.${visitorId},user_balance_id.eq.${ubId}`) : subQuery.eq("visitor_id", visitorId))
      .order("expires_at", { ascending: false })
      .limit(10);
    const now = new Date();
    const active = (subs || []).find((s: any) => new Date(s.expires_at) > now) || null;

    if (action === "status") {
      return Response.json({
        active: !!active,
        max_numbers: active ? active.max_numbers : 10,
        expires_at: active?.expires_at || null,
        price: SUB_PRICE,
        days: SUB_DAYS,
        sub_max: SUB_MAX,
        balance: ubId ? Number((await admin.from("user_balances").select("balance").eq("id", ubId).maybeSingle()).data?.balance ?? 0) : null,
        promo: ubId ? (await admin.rpc("confess_promo_status", { p_ub: ubId })).data : null,
        history: (subs || []).map((s: any) => ({ trx_id: s.trx_id, price: s.price, expires_at: s.expires_at, created_at: s.created_at, max_numbers: s.max_numbers })),
      }, { headers: corsHeaders });
    }

    if (action !== "buy") return Response.json({ error: "Aksi tidak dikenal" }, { status: 400, headers: corsHeaders });

    const pin = String(body.pin || "");
    if (!/^\d{6}$/.test(pin)) return Response.json({ error: "PIN harus 6 digit", needPin: true }, { status: 400, headers: corsHeaders });

    // resolve balance
    const { data: hist } = await admin
      .from("balance_login_history")
      .select("user_balance_id")
      .eq("visitor_id", visitorId)
      .order("logged_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const requestRef = String(body.requestRef || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 60);
    let bal: any = null;
    if (hist?.user_balance_id) {
      const { data } = await admin.from("user_balances").select("id, balance").eq("id", hist.user_balance_id).maybeSingle();
      bal = data;
    }
    if (!bal) {
      const { data } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
      bal = data;
    }
    if (!bal) return Response.json({ error: "Saldo tidak ditemukan. Daftar saldo dulu." }, { status: 400, headers: corsHeaders });
    // Idempotent: klik ganda / refresh dengan requestRef yang sama tidak memotong dua kali
    const trxId = requestRef ? `CNS-${requestRef}` : `CNS-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
    if (requestRef) {
      const { data: dupe } = await admin.from("confess_number_subscriptions").select("trx_id, expires_at, max_numbers").eq("trx_id", trxId).maybeSingle();
      if (dupe) return Response.json({ ok: true, duplicate: true, max_numbers: dupe.max_numbers, expires_at: dupe.expires_at, trx_id: dupe.trx_id }, { headers: corsHeaders });
    }
    if (bal.balance < SUB_PRICE) return Response.json({ error: `Saldo kamu Rp${Number(bal.balance).toLocaleString("id-ID")}, sedangkan pembayaran membutuhkan Rp${SUB_PRICE.toLocaleString("id-ID")}.`, code: "insufficient" }, { status: 402, headers: corsHeaders });

    const pinErr = await verifyAccountPin(admin, visitorId, pin);
    if (pinErr) return Response.json({ error: pinErr, needPin: true, code: "pin" }, { status: 403, headers: corsHeaders });

    // Potong saldo atomik (row lock + cek saldo di database)
    const { data: balLeft, error: updErr } = await admin.rpc("consume_main_balance_only", { p_balance_id: bal.id, p_amount: SUB_PRICE });
    if (updErr) {
      const insufficient = /INSUFFICIENT/i.test(updErr.message);
      return Response.json({ error: insufficient ? `Saldo tidak cukup. Pembayaran membutuhkan Rp${SUB_PRICE.toLocaleString("id-ID")}.` : "Gagal memotong saldo", code: insufficient ? "insufficient" : "error" }, { status: insufficient ? 402 : 500, headers: corsHeaders });
    }

    // extend from current active expiry if any
    const base = active ? new Date(active.expires_at) : now;
    const expires = new Date(base.getTime() + SUB_DAYS * 24 * 3600 * 1000);
    const { error: insErr } = await admin.from("confess_number_subscriptions").insert({
      visitor_id: visitorId, user_balance_id: bal.id, max_numbers: SUB_MAX, price: SUB_PRICE, trx_id: trxId, expires_at: expires.toISOString(),
    });
    if (insErr) {
      await admin.rpc("refund_main_balance_only", { p_balance_id: bal.id, p_amount: SUB_PRICE });
      return Response.json({ error: "Gagal menyimpan langganan, saldo dikembalikan" }, { status: 500, headers: corsHeaders });
    }

    await admin.from("balance_transactions").insert({
      visitor_id: visitorId, type: "purchase", amount: SUB_PRICE,
      description: "Langganan Confess 15 nomor (30 hari)", trx_id: trxId,
    });

    return Response.json({ ok: true, max_numbers: SUB_MAX, expires_at: expires.toISOString(), trx_id: trxId, balance_remaining: Number(balLeft) }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String((e as any)?.message || e) }, { status: 500, headers: corsHeaders });
  }
});
