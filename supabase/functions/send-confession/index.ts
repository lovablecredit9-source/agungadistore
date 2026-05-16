import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function priceFor(n: number): number {
  if (n <= 1) return 2000;
  if (n === 2) return 4000;
  if (n === 3) return 5000;
  return 0;
}

function normPhone(p: string): string | null {
  const d = String(p || "").replace(/\D/g, "");
  if (!d) return null;
  let n = d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("62") ? d : d.startsWith("8") ? "62" + d : d;
  if (n.length < 9 || n.length > 16) return null;
  return n;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const visitorId = String(body.visitorId || "").trim();
    const senderName = String(body.senderName || "").trim().slice(0, 40);
    const message = String(body.message || "").trim().slice(0, 800);
    const phones: string[] = Array.isArray(body.phones) ? body.phones : [];
    const pin = String(body.pin || "");

    if (!visitorId) return Response.json({ error: "Visitor tidak dikenal" }, { status: 400, headers: corsHeaders });
    if (message.length < 3) return Response.json({ error: "Pesan terlalu pendek" }, { status: 400, headers: corsHeaders });
    if (phones.length < 1 || phones.length > 3) return Response.json({ error: "Pilih 1-3 nomor tujuan" }, { status: 400, headers: corsHeaders });
    if (!/^\d{6}$/.test(pin)) return Response.json({ error: "PIN harus 6 digit", needPin: true }, { status: 400, headers: corsHeaders });

    const normalized: string[] = [];
    for (const p of phones) {
      const n = normPhone(p);
      if (!n) return Response.json({ error: `Nomor tidak valid: ${p}` }, { status: 400, headers: corsHeaders });
      if (!normalized.includes(n)) normalized.push(n);
    }
    const price = priceFor(normalized.length);
    if (!price) return Response.json({ error: "Jumlah nomor tidak didukung" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // PIN
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
    if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 403, headers: corsHeaders });
    if ((await sha256(pin)) !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 403, headers: corsHeaders });

    // Balance (account-aware via active user_balance)
    const { data: hist } = await admin
      .from("balance_login_history")
      .select("user_balance_id")
      .eq("visitor_id", visitorId)
      .order("logged_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ubId = hist?.user_balance_id;
    if (!ubId) return Response.json({ error: "Akun saldo tidak ditemukan", needLogin: true }, { status: 404, headers: corsHeaders });

    const { data: bal } = await admin.from("user_balances").select("id, balance").eq("id", ubId).maybeSingle();
    if (!bal) return Response.json({ error: "Saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    if (bal.balance < price) return Response.json({ error: `Saldo kurang. Butuh Rp${price.toLocaleString("id-ID")}` }, { status: 400, headers: corsHeaders });

    const { error: updErr } = await admin.from("user_balances").update({ balance: bal.balance - price }).eq("id", bal.id);
    if (updErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });

    const trxId = `CFS-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
    const { data: conf, error: cErr } = await admin
      .from("confessions")
      .insert({
        trx_id: trxId,
        sender_visitor_id: visitorId,
        sender_name: senderName || null,
        message,
        num_targets: normalized.length,
        total_price: price,
        status: "pending",
      })
      .select("id")
      .single();
    if (cErr || !conf) {
      await admin.from("user_balances").update({ balance: bal.balance }).eq("id", bal.id);
      return Response.json({ error: "Gagal menyimpan confess" }, { status: 500, headers: corsHeaders });
    }

    await admin.from("confession_targets").insert(normalized.map((p) => ({ confession_id: conf.id, phone: p })));
    await admin.from("balance_transactions").insert({
      visitor_id: visitorId,
      type: "purchase",
      amount: price,
      description: `Confess ke ${normalized.length} nomor`,
      trx_id: trxId,
    });

    return Response.json({ success: true, trx_id: trxId, balance_remaining: bal.balance - price }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
