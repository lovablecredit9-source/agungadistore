// Owner-verified Telegram link management (the browser has no direct table access).
// Body: { visitor_id, action: "status" | "link" | "set_pref" | "unlink", input?, field?, value? }
// Linking only succeeds when Telegram Bot API really accepts the verification message.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveWalletIdentity } from "../_shared/wallet-identity.ts";
import { TG_FIELD, tgErrorMessage, tgSend } from "../_shared/telegram.ts";

const PREF_FIELDS = new Set(["enabled", ...Object.values(TG_FIELD)]);
const PUBLIC_COLS = "id, telegram_chat_id, telegram_username, telegram_first_name, enabled, connected_at, " +
  "notif_deposit, notif_purchase, notif_order, notif_login, notif_admin_message, notif_balance_change, notif_streak, notif_quest, " +
  "notif_reward, notif_ticket, notif_membership, notif_flash_sale, notif_announcement, last_success_at, last_error, last_error_at, last_test_at, last_test_ok";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    // deno-lint-ignore no-explicit-any
    const body = await req.json().catch(() => ({} as any));
    const id = await resolveWalletIdentity(req, admin, body.visitor_id);
    if (!id.ok) return json({ error: id.error }, id.status);
    const visitor_id = id.visitorId;
    const action = String(body.action || (body.input ? "link" : "status"));
    const getLink = async () => (await admin.from("telegram_user_links").select(PUBLIC_COLS).eq("visitor_id", visitor_id).maybeSingle()).data;
    const { data: cfg } = await admin.from("telegram_bot_config").select("bot_token, enabled, bot_username").limit(1).maybeSingle();

    if (action === "status") {
      return json({ link: await getLink(), bot_username: cfg?.bot_username || "", bot_enabled: !!cfg?.enabled && !!cfg?.bot_token });
    }

    if (action === "set_pref") {
      const field = String(body.field || "");
      if (!PREF_FIELDS.has(field) || typeof body.value !== "boolean") return json({ error: "Preferensi tidak valid" }, 400);
      const { data, error } = await admin.from("telegram_user_links").update({ [field]: body.value }).eq("visitor_id", visitor_id).select(PUBLIC_COLS).maybeSingle();
      if (error || !data) return json({ error: "Belum terhubung ke Telegram." }, 400);
      return json({ ok: true, link: data });
    }

    if (action === "unlink") {
      await admin.from("telegram_user_links").delete().eq("visitor_id", visitor_id);
      return json({ ok: true });
    }

    if (action !== "link") return json({ error: "Aksi tidak dikenal" }, 400);
    let input = String(body.input || "").trim();
    if (!input) return json({ error: "Masukkan ID atau username Telegram." }, 400);
    if (!cfg?.bot_token) return json({ error: "Bot Telegram belum dikonfigurasi admin" }, 400);
    if (!cfg.enabled) return json({ error: "Bot Telegram sedang nonaktif" }, 400);

    input = input.replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "").trim();
    const isNumeric = /^-?\d{5,}$/.test(input);
    if (!isNumeric && !/^[A-Za-z0-9_]{4,32}$/.test(input)) return json({ error: "Format username/ID Telegram tidak valid." }, 400);
    const r = await tgSend(cfg.bot_token, {
      chat_id: isNumeric ? input : `@${input}`,
      text: "✅ <b>Akun Telegram berhasil terhubung ke Agung Adi Store!</b>\n\nMulai sekarang kamu akan menerima notifikasi sesuai preferensi yang kamu aktifkan di website.",
      parse_mode: "HTML",
    });
    console.log(JSON.stringify({ tg: "link_verify", account: visitor_id.slice(0, 6) + "…", ok: r.ok, message_id: r.message_id, error_code: r.error_code, at: new Date().toISOString() }));
    if (!r.ok) {
      // Telegram never lets a bot message @username users it has no chat with: chat ID is the reliable path.
      const hint = !isNumeric && /chat not found/i.test(r.description || "") ? " Tips: pakai Chat ID angka (ketik /start di bot untuk melihatnya)." : "";
      return json({ error: tgErrorMessage(r) + hint, needStart: /chat not found|initiate|blocked/i.test(r.description || ""), error_code: r.error_code }, 400);
    }
    const chat = r.chat || {};
    const telegram_chat_id = String(chat.id);
    // One Telegram chat belongs to one account: never silently steal another wallet's link.
    const { data: other } = await admin.from("telegram_user_links").select("visitor_id").eq("telegram_chat_id", telegram_chat_id).neq("visitor_id", visitor_id).maybeSingle();
    if (other) return json({ error: "Akun Telegram ini sudah terhubung ke akun Agung Adi Store lain. Hapus koneksi di akun itu dulu." }, 409);

    const now = new Date().toISOString();
    const fields = { telegram_chat_id, telegram_username: chat.username || "", telegram_first_name: chat.first_name || chat.title || "Telegram User", enabled: true, last_success_at: now, last_error: null };
    const existing = await getLink();
    if (existing) await admin.from("telegram_user_links").update(fields).eq("visitor_id", visitor_id);
    else await admin.from("telegram_user_links").insert({ visitor_id, ...fields });
    return json({ ok: true, verification_message_id: r.message_id, link: await getLink() });
  } catch (e) {
    console.error("telegram-link-direct error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Kesalahan server." }, 500);
  }
});
