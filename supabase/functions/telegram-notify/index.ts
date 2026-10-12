// Central Telegram notification gateway (trusted callers only).
// Body: { visitor_id, type, text? | (title, message), event_key?, source? }
// Callers: service-role edge functions, or the notifications trigger (x-tg-internal token).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { deliverTelegram, escHtml, TG_FIELD } from "../_shared/telegram.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    let trusted = !!bearer && bearer === serviceKey;
    if (!trusted) {
      const internal = req.headers.get("x-tg-internal") || "";
      if (internal.length >= 32) {
        const { data } = await admin.from("telegram_internal_secret").select("token").limit(1).maybeSingle();
        trusted = !!data?.token && data.token === internal;
      }
    }
    if (!trusted) return json({ error: "forbidden" }, 403);

    // deno-lint-ignore no-explicit-any
    const body = await req.json().catch(() => ({} as any));
    const visitor_id = String(body.visitor_id || "").trim();
    const type = String(body.type || "").trim();
    let text = String(body.text || "").trim();
    if (!text && (body.title || body.message)) {
      text = `🔔 <b>${escHtml(String(body.title || "Notifikasi"))}</b>\n\n${escHtml(String(body.message || ""))}\n\n<i>Agung Adi Store</i>`;
    }
    text = text.slice(0, 3800);
    if (!visitor_id || !text || !TG_FIELD[type]) return json({ error: "invalid params" }, 400);
    const event_key = String(body.event_key || "").trim().slice(0, 200) || `adhoc:${type}:${visitor_id}:${crypto.randomUUID()}`;

    const r = await deliverTelegram(admin, { visitorId: visitor_id, category: type, text, eventKey: event_key, source: String(body.source || "edge").slice(0, 80) });
    if (r.status === "sent") return json({ ok: true, status: "sent", message_id: r.message_id });
    if (r.status === "failed") return json({ ok: false, status: "failed", reason: r.reason, error_code: r.error_code });
    return json({ ok: true, status: r.status, reason: (r as { reason?: string }).reason });
  } catch (e) {
    console.error("telegram-notify error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "internal" }, 500);
  }
});
