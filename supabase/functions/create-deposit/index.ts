import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  visitorId: z.string().trim().min(1, "Visitor ID tidak ditemukan"),
  amount: z.number().int().positive("Nominal deposit harus lebih dari 0"),
  paymentMethod: z.string().trim().min(1, "Metode pembayaran wajib dipilih").max(40, "Metode pembayaran terlalu panjang"),
});

function generateTrxId() {
  const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `DEP-${Date.now()}-${randomPart}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await request.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Data deposit tidak valid" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Konfigurasi backend belum lengkap" }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { visitorId, amount, paymentMethod } = parsed.data;
    const normalizedMethod = paymentMethod.toUpperCase() === "QRIS" ? "QRIS" : paymentMethod.trim();

    const { data: balanceRow, error: balanceError } = await admin
      .from("user_balances")
      .select("visitor_id, username")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (balanceError || !balanceRow) {
      return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }

    const trxId = generateTrxId();

    const { data: deposit, error: insertError } = await admin
      .from("deposits")
      .insert({
        visitor_id: visitorId,
        username: balanceRow.username,
        amount,
        payment_method: normalizedMethod,
        trx_id: trxId,
      })
      .select("id, visitor_id, username, amount, payment_method, trx_id, status, created_at")
      .single();

    if (insertError || !deposit) {
      return Response.json({ error: "Gagal membuat deposit" }, { status: 500, headers: corsHeaders });
    }

    // Fire-and-forget WA notif ke admin
    try {
      fetch(`${supabaseUrl}/functions/v1/send-wa-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          event_type: "deposit",
          notify_visitor_id: visitorId,
          vars: {
            action: "BARU",
            trx_id: trxId,
            user: balanceRow.username || visitorId.slice(0, 8),
            harga: amount.toLocaleString("id-ID"),
            metode: normalizedMethod,
          },
        }),
      }).catch(() => {});
    } catch (_) {}

    return Response.json({ success: true, deposit }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat membuat deposit";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});