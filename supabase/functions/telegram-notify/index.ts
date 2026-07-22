// Kirim notifikasi Telegram ke user yang sudah link akun saldo ke bot.
// Body: { visitor_id: string, type: "deposit"|"purchase"|"login"|"admin_message"|"balance_change", text: string, parse_mode?: "HTML"|"Markdown" }
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type NotifType = "deposit" | "purchase" | "login" | "admin_message" | "balance_change";
const NOTIF_FIELD: Record<NotifType, string> = {
  deposit: "notif_deposit",
  purchase: "notif_purchase",
  login: "notif_login",
  admin_message: "notif_admin_message",
  balance_change: "notif_balance_change",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const body = await req.json().catch(() => ({} as any));
    const visitor_id = String(body.visitor_id || "").trim();
    const type = String(body.type || "").trim() as NotifType;
    const text = String(body.text || "").trim();
    const parse_mode = body.parse_mode ? String(body.parse_mode) : "HTML";
    if (!visitor_id || !type || !text || !NOTIF_FIELD[type]) return json({ error: "invalid params" }, 400);

    const { data: link } = await admin
      .from("telegram_user_links")
      .select(`telegram_chat_id, enabled, ${NOTIF_FIELD[type]}`)
      .eq("visitor_id", visitor_id)
      .maybeSingle();
    if (!link || !link.enabled || !(link as any)[NOTIF_FIELD[type]]) {
      return json({ ok: true, skipped: true, reason: "disabled_or_not_linked" });
    }

    const { data: cfg } = await admin.from("telegram_bot_config").select("bot_token, enabled").limit(1).maybeSingle();
    if (!cfg?.bot_token || !cfg.enabled) return json({ ok: true, skipped: true, reason: "bot_off" });

    const resp = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: (link as any).telegram_chat_id,
        text,
        parse_mode,
        disable_web_page_preview: true,
      }),
    });
    const rj = await resp.json();
    if (!rj.ok) return json({ ok: false, error: rj.description || "telegram_error" }, 400);
    return json({ ok: true });
  } catch (e) {
    console.error("telegram-notify error:", e);
    return json({ error: e instanceof Error ? e.message : "internal" }, 500);
  }
});
