import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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

    // current active subscription
    const { data: subs } = await admin
      .from("confess_number_subscriptions")
      .select("*")
      .eq("visitor_id", visitorId)
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
        history: subs || [],
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
    if (bal.balance < SUB_PRICE) return Response.json({ error: `Saldo kurang. Butuh Rp${SUB_PRICE.toLocaleString("id-ID")}` }, { status: 400, headers: corsHeaders });

    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
    if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 403, headers: corsHeaders });
    if ((await sha256(pin)) !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 403, headers: corsHeaders });

    const { error: updErr } = await admin.from("user_balances").update({ balance: bal.balance - SUB_PRICE }).eq("id", bal.id);
    if (updErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });

    // extend from current active expiry if any
    const base = active ? new Date(active.expires_at) : now;
    const expires = new Date(base.getTime() + SUB_DAYS * 24 * 3600 * 1000);
    const trxId = `CNS-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;

    const { error: insErr } = await admin.from("confess_number_subscriptions").insert({
      visitor_id: visitorId, max_numbers: SUB_MAX, price: SUB_PRICE, trx_id: trxId, expires_at: expires.toISOString(),
    });
    if (insErr) {
      await admin.from("user_balances").update({ balance: bal.balance }).eq("id", bal.id);
      return Response.json({ error: "Gagal menyimpan langganan" }, { status: 500, headers: corsHeaders });
    }

    await admin.from("balance_transactions").insert({
      visitor_id: visitorId, type: "purchase", amount: SUB_PRICE,
      description: "Langganan Confess 15 nomor (30 hari)", trx_id: trxId,
    });

    return Response.json({ ok: true, max_numbers: SUB_MAX, expires_at: expires.toISOString(), trx_id: trxId }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String((e as any)?.message || e) }, { status: 500, headers: corsHeaders });
  }
});
