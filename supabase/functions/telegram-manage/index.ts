import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PROJECT_REF = "qhkcohwrforhqjylaapo";
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/telegram-webhook`;

const COMMANDS = [
  { command: "start", description: "Menu utama" },
  { command: "menu", description: "Tampilkan menu" },
  { command: "saldo", description: "Produk & Saldo" },
  { command: "game", description: "Game" },
  { command: "confess", description: "Confess" },
  { command: "akun", description: "Akun" },
  { command: "login", description: "Login" },
  { command: "daftar", description: "Daftar akun baru" },
  { command: "cs", description: "Live chat admin" },
  { command: "info", description: "Status bot & waktu" },
  { command: "help", description: "Bantuan" },
];

function tgApi(token: string, method: string, payload: unknown) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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

    // Require an authenticated user (admin)
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(jwt);
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const { data: existing } = await admin.from("telegram_bot_config").select("*").limit(1).maybeSingle();

    if (action === "get") {
      return json({ config: existing || null });
    }

    if (action === "save") {
      const bot_token = String(body.bot_token ?? existing?.bot_token ?? "").trim();
      const owner_id = String(body.owner_id ?? existing?.owner_id ?? "").trim();
      const enabled = body.enabled !== undefined ? !!body.enabled : (existing?.enabled ?? true);
      const welcome_message = String(body.welcome_message ?? existing?.welcome_message ?? "");
      const qris_image_url = String(body.qris_image_url ?? existing?.qris_image_url ?? "").trim();
      const qris_caption = String(body.qris_caption ?? existing?.qris_caption ?? "");
      if (!bot_token) return json({ error: "Token bot wajib diisi" }, 400);

      // verify token
      const meRes = await tgApi(bot_token, "getMe", {});
      const me = await meRes.json();
      if (!me.ok) return json({ error: "Token bot tidak valid. Cek kembali di @BotFather." }, 400);
      const bot_username = me.result?.username || "";

      const webhook_secret = existing?.webhook_secret && existing.webhook_secret.length > 10
        ? existing.webhook_secret
        : crypto.randomUUID().replace(/-/g, "");

      // register webhook + commands
      const whRes = await tgApi(bot_token, "setWebhook", {
        url: WEBHOOK_URL,
        secret_token: webhook_secret,
        allowed_updates: ["message", "edited_message", "callback_query"],
        drop_pending_updates: true,
      });
      const wh = await whRes.json();
      if (!wh.ok) return json({ error: "Gagal daftar webhook: " + (wh.description || "") }, 400);

      await tgApi(bot_token, "setMyCommands", { commands: COMMANDS });

      // set activated_at when enabling (keep existing time if already active)
      const activated_at = enabled
        ? (existing?.enabled && existing?.activated_at ? existing.activated_at : new Date().toISOString())
        : null;
      const payload = { bot_token, owner_id, enabled, welcome_message, webhook_secret, bot_username, activated_at };
      if (existing?.id) {
        await admin.from("telegram_bot_config").update(payload).eq("id", existing.id);
      } else {
        await admin.from("telegram_bot_config").insert(payload);
      }
      return json({ success: true, bot_username });
    }

    if (action === "clear") {
      // delete commands + webhook, keep token blank
      if (existing?.bot_token) {
        await tgApi(existing.bot_token, "deleteMyCommands", {});
        await tgApi(existing.bot_token, "deleteWebhook", { drop_pending_updates: true });
      }
      if (existing?.id) {
        await admin.from("telegram_bot_config").update({
          bot_token: "", owner_id: "", bot_username: "", webhook_secret: "", enabled: false,
        }).eq("id", existing.id);
      }
      return json({ success: true });
    }

    if (action === "reply") {
      const chatId = String(body.chat_id || "");
      const text = String(body.text || "").trim();
      if (!existing?.bot_token) return json({ error: "Bot belum dikonfigurasi" }, 400);
      if (!chatId || !text) return json({ error: "chat_id & text wajib" }, 400);
      const r = await tgApi(existing.bot_token, "sendMessage", { chat_id: chatId, text });
      const rj = await r.json();
      if (!rj.ok) return json({ error: rj.description || "Gagal kirim" }, 400);
      await admin.from("telegram_messages").insert({ chat_id: chatId, direction: "out", text, telegram_message_id: rj.result?.message_id });
      await admin.from("telegram_chats").update({
        last_message: text.slice(0, 200), last_message_at: new Date().toISOString(), unread_count: 0,
      }).eq("chat_id", chatId);
      return json({ success: true });
    }

    if (action === "mark_read") {
      const chatId = String(body.chat_id || "");
      if (chatId) await admin.from("telegram_chats").update({ unread_count: 0 }).eq("chat_id", chatId);
      return json({ success: true });
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    console.error("telegram-manage error:", e);
    return json({ error: e instanceof Error ? e.message : "internal" }, 500);
  }
});
