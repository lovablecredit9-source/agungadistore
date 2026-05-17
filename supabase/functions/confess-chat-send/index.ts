// Confess Chat Send - kirim pesan lanjutan GRATIS dalam window 24 jam
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const visitorId = String(body.visitorId || "").trim();
    const threadId = String(body.threadId || "").trim();
    const text = String(body.text || "").trim().slice(0, 800);

    if (!visitorId || !threadId) return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
    if (text.length < 1) return Response.json({ error: "Pesan kosong" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: thread } = await admin
      .from("confess_threads")
      .select("id, visitor_id, target_phone, free_until, sender_name")
      .eq("id", threadId)
      .maybeSingle();

    if (!thread) return Response.json({ error: "Thread tidak ditemukan" }, { status: 404, headers: corsHeaders });
    if (thread.visitor_id !== visitorId) return Response.json({ error: "Akses ditolak" }, { status: 403, headers: corsHeaders });

    const now = new Date();
    if (new Date(thread.free_until) <= now) {
      return Response.json({ error: "Window gratis 24 jam habis. Kirim ulang lewat form berbayar.", expired: true }, { status: 402, headers: corsHeaders });
    }

    // Anti-spam: max 30 pesan/hari/thread
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("confess_thread_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId)
      .eq("direction", "out")
      .gte("created_at", dayAgo);
    if ((count || 0) >= 30) {
      return Response.json({ error: "Batas 30 pesan/hari tercapai" }, { status: 429, headers: corsHeaders });
    }

    const { data: msg, error: msgErr } = await admin
      .from("confess_thread_messages")
      .insert({
        thread_id: threadId,
        direction: "out",
        text,
        status: "pending",
        is_free: true,
      })
      .select("id, created_at")
      .single();
    if (msgErr || !msg) return Response.json({ error: "Gagal menyimpan pesan" }, { status: 500, headers: corsHeaders });

    await admin
      .from("confess_threads")
      .update({
        last_message_at: now.toISOString(),
        last_message_preview: text.slice(0, 80),
      })
      .eq("id", threadId);

    return Response.json({ success: true, message_id: msg.id, created_at: msg.created_at }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
