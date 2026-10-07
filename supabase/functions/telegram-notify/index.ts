// Kirim notifikasi Telegram ke user yang sudah link akun saldo ke bot.
// Body: { visitor_id: string, type: NotifType, text: string, parse_mode?: "HTML"|"Markdown" }
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Setiap jenis notifikasi punya saklar ON/OFF di telegram_user_links.
const NOTIF_FIELD: Record<string, string> = {
  deposit: "notif_deposit",
  purchase: "notif_purchase",
  login: "notif_login",
  admin_message: "notif_admin_message",
  balance_change: "notif_balance_change",
  order: "notif_order",
  streak: "notif_streak",
  quest: "notif_quest",
  reward: "notif_reward",
  ticket: "notif_ticket",
  live_cs: "notif_ticket",
  membership: "notif_membership",
  flash_sale: "notif_flash_sale",
  announcement: "notif_announcement",
};

async function sendTg(token: string, payload: unknown) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal,
    });
    return await r.json().catch(() => ({ ok: false }));
  } catch (e) {
    console.error("telegram-notify send failed:", e);
    return { ok: false, description: "timeout_or_network" };
  } finally { clearTimeout(t); }
}

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
    // Hanya backend (service role) yang boleh mengirim notifikasi — cegah spam ke chat user.
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!bearer || bearer !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return json({ error: "forbidden" }, 403);
    const body = await req.json().catch(() => ({} as any));
    const visitor_id = String(body.visitor_id || "").trim();
    const type = String(body.type || "").trim();
    const text = String(body.text || "").trim().slice(0, 3800);
    const parse_mode = body.parse_mode === "Markdown" ? "Markdown" : "HTML";
    const field = NOTIF_FIELD[type];
    if (!visitor_id || !text || !field) return json({ error: "invalid params" }, 400);

    const { data: link } = await admin
      .from("telegram_user_links")
      .select(`telegram_chat_id, enabled, ${field}`)
      .eq("visitor_id", visitor_id)
      .maybeSingle();
    if (!link || !link.enabled || !(link as any)[field]) {
      return json({ ok: true, skipped: true, reason: "disabled_or_not_linked" });
    }

    const { data: cfg } = await admin.from("telegram_bot_config").select("bot_token, enabled").limit(1).maybeSingle();
    if (!cfg?.bot_token || !cfg.enabled) return json({ ok: true, skipped: true, reason: "bot_off" });

    let rj = await sendTg(cfg.bot_token, { chat_id: (link as any).telegram_chat_id, text, parse_mode, disable_web_page_preview: true });
    // Formatting error → kirim ulang sebagai teks biasa
    if (!rj.ok && rj.error_code === 400 && /parse/i.test(rj.description || "")) {
      rj = await sendTg(cfg.bot_token, { chat_id: (link as any).telegram_chat_id, text, disable_web_page_preview: true });
    }
    if (!rj.ok) {
      console.error("telegram-notify telegram error:", rj.error_code, rj.description);
      const reason = rj.error_code === 403 ? "blocked" : rj.error_code === 429 ? "rate_limited" : "telegram_error";
      return json({ ok: false, skipped: true, reason });
    }
    return json({ ok: true });
  } catch (e) {
    console.error("telegram-notify error:", e);
    return json({ error: "internal" }, 500);
  }
});
