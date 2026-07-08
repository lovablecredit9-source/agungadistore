import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function maskPhone(p: string): string {
  if (!p) return "****";
  const local = p.startsWith("62") ? "0" + p.slice(2) : p;
  if (local.length < 6) return local;
  return local.slice(0, 4) + "****" + local.slice(-4);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const { data: due } = await admin
    .from("confess_scheduled")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .limit(50);

  let processed = 0;
  for (const row of (due || [])) {
    try {
      const trxId = row.trx_id || `CFS-SCHX-${Date.now()}-${row.id.slice(0, 5).toUpperCase()}`;
      const { data: conf, error: cErr } = await admin
        .from("confessions").insert({
          trx_id: trxId, sender_visitor_id: row.visitor_id,
          sender_name: row.sender_name, message: row.message,
          num_targets: row.target_phones.length, total_price: row.price_charged, status: "pending",
          media_url: row.media_url ?? null, media_type: row.media_type ?? null,
          media_name: row.media_name ?? null, media_mime: row.media_mime ?? null, media_size: row.media_size ?? null,
        }).select("id").single();
      if (cErr || !conf) throw new Error(cErr?.message || "Gagal insert confession");

      const { data: targets } = await admin
        .from("confession_targets")
        .insert(row.target_phones.map((p: string) => ({ confession_id: conf.id, phone: p })))
        .select("id, phone");

      const targetIdByPhone = new Map<string, string>((targets || []).map((t: any) => [t.phone, t.id]));
      const preview = (row.mood_tag ? `[${row.mood_tag}] ` : "") + row.message.slice(0, 80);
      const newFreeUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      for (const phone of row.target_phones) {
        const { data: existing } = await admin
          .from("confess_threads").select("id")
          .eq("user_balance_id", row.user_balance_id).eq("target_phone", phone).maybeSingle();

        let threadId: string;
        if (existing) {
          await admin.from("confess_threads").update({
            last_message_at: now.toISOString(), last_message_preview: preview,
            sender_name: row.sender_name, last_paid_at: now.toISOString(), free_until: newFreeUntil,
            chat_stopped: false,
          }).eq("id", existing.id);
          threadId = existing.id;
        } else {
          const { data: ins } = await admin
            .from("confess_threads").insert({
              visitor_id: row.visitor_id, user_balance_id: row.user_balance_id,
              target_phone: phone, sender_name: row.sender_name,
              last_paid_at: now.toISOString(), free_until: newFreeUntil,
              last_message_at: now.toISOString(), last_message_preview: preview,
            }).select("id").single();
          threadId = ins!.id;
        }

        await admin.from("confess_thread_messages").insert({
          thread_id: threadId, direction: "out", text: row.message, status: "pending",
          trx_id: trxId, is_free: false, target_id: targetIdByPhone.get(phone) || null,
          mood_tag: row.mood_tag,
          media_url: row.media_url ?? null, media_type: row.media_type ?? null,
          media_name: row.media_name ?? null, media_mime: row.media_mime ?? null, media_size: row.media_size ?? null,
        });
      }

      if (row.share_to_wall) {
        await admin.from("confess_public_wall").insert({
          confession_id: conf.id, visitor_id: row.visitor_id, sender_name: row.sender_name,
          masked_phone: row.target_phones.map(maskPhone).join(", "),
          message: row.message, mood_tag: row.mood_tag,
        });
      }

      await admin.from("confess_scheduled").update({
        status: "sent", result_confession_id: conf.id, executed_at: now.toISOString(),
      }).eq("id", row.id);

      await admin.from("notifications").insert({
        visitor_id: row.visitor_id,
        title: "⏰ Confess Terjadwal Dikirim",
        message: `Confess terjadwal kamu ke ${row.target_phones.length} nomor sudah dieksekusi.`,
        type: "success", related_id: trxId,
      });
      processed++;
    } catch (e: any) {
      await admin.from("confess_scheduled").update({
        status: "failed", error_message: String(e?.message || e), executed_at: now.toISOString(),
      }).eq("id", row.id);
      // Refund
      const { data: ub } = await admin.from("user_balances").select("balance").eq("id", row.user_balance_id).maybeSingle();
      if (ub) await admin.from("user_balances").update({ balance: (ub.balance || 0) + row.price_charged }).eq("id", row.user_balance_id);
      await admin.from("notifications").insert({
        visitor_id: row.visitor_id,
        title: "❌ Confess Terjadwal Gagal",
        message: `Eksekusi gagal: ${String(e?.message || e).slice(0, 80)}. Saldo Rp${row.price_charged.toLocaleString("id-ID")} dikembalikan.`,
        type: "error", related_id: row.trx_id,
      });
    }
  }

  return Response.json({ ok: true, processed, found: (due || []).length }, { headers: corsHeaders });
});
