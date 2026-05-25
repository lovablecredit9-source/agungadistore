import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { depositId, visitorId, reason } = await req.json();
    if (!depositId || !visitorId) {
      return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: dep } = await admin
      .from("deposits")
      .select("id, visitor_id, amount, trx_id, status")
      .eq("id", depositId)
      .maybeSingle();

    if (!dep) return Response.json({ error: "Deposit tidak ditemukan" }, { status: 404, headers: corsHeaders });
    if (dep.visitor_id !== visitorId) {
      return Response.json({ error: "Anda tidak berhak membatalkan deposit ini" }, { status: 403, headers: corsHeaders });
    }
    if (dep.status !== "pending") {
      return Response.json({ error: "Deposit sudah diproses, tidak bisa dibatalkan" }, { status: 400, headers: corsHeaders });
    }

    const cancelReason = (reason && String(reason).trim()) || "Dibatalkan oleh pengguna";

    const { error: updErr } = await admin
      .from("deposits")
      .update({ status: "cancelled", cancel_reason: cancelReason, updated_at: new Date().toISOString() })
      .eq("id", depositId)
      .eq("status", "pending");

    if (updErr) return Response.json({ error: "Gagal membatalkan deposit" }, { status: 500, headers: corsHeaders });

    await admin.from("notifications").insert({
      visitor_id: dep.visitor_id,
      title: "Deposit Dibatalkan",
      message: `Deposit Rp ${dep.amount.toLocaleString("id-ID")} (TRX: ${dep.trx_id}) berhasil dibatalkan. Alasan: ${cancelReason}`,
      type: "deposit_cancelled",
      related_id: dep.trx_id,
    });

    // Notif WA admin
    try {
      const url = Deno.env.get("SUPABASE_URL") ?? "";
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      fetch(`${url}/functions/v1/send-wa-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          event_type: "deposit",
          notify_visitor_id: dep.visitor_id,
          vars: {
            action: "DIBATALKAN",
            trx_id: dep.trx_id,
            user: dep.visitor_id.slice(0, 8),
            harga: dep.amount.toLocaleString("id-ID"),
            metode: cancelReason,
          },
        }),
      }).catch(() => {});
    } catch (_) {}

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
