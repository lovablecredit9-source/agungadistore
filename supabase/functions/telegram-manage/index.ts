import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PROJECT_REF = "qhkcohwrforhqjylaapo";
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/telegram-webhook`;
const FRIENDLY_TG_ERROR = "⚠️ Telegram sedang mengalami gangguan. Silakan coba lagi.";

const COMMANDS = [
  { command: "start", description: "Menu utama & dashboard" },
  { command: "menu", description: "Tampilkan menu" },
  { command: "produk", description: "Lihat & beli produk" },
  { command: "keranjang", description: "Keranjang belanja" },
  { command: "saldo", description: "Saldo & deposit" },
  { command: "streak", description: "Streak harian" },
  { command: "quest", description: "Quest & hadiah" },
  { command: "game", description: "Game" },
  { command: "confess", description: "Confess" },
  { command: "akun", description: "Akun" },
  { command: "login", description: "Login" },
  { command: "daftar", description: "Daftar akun baru" },
  { command: "cs", description: "Live chat admin" },
  { command: "owner", description: "Panel Owner (khusus owner)" },
  { command: "info", description: "Status bot & waktu" },
  { command: "help", description: "Bantuan" },
];

const BROADCAST_MAX = 3000;          // max recipients per broadcast
const BROADCAST_BATCH = 25;          // Telegram ~30 msg/s global limit
const BROADCAST_COOLDOWN_MS = 5 * 60 * 1000;

async function tgApi(token: string, method: string, payload: unknown, timeoutMs = 10000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    return await r.json().catch(() => ({ ok: false, description: "invalid_response" }));
  } catch (e) {
    console.error(`tgApi ${method} failed:`, e);
    return { ok: false, description: "timeout_or_network" };
  } finally {
    clearTimeout(t);
  }
}

function maskToken(tok: string | null | undefined): string {
  if (!tok) return "";
  const [id] = tok.split(":");
  return `${id}:••••••••${tok.slice(-4)}`;
}

function publicConfig(cfg: any) {
  if (!cfg) return null;
  const { bot_token, webhook_secret, ...rest } = cfg;
  return { ...rest, has_token: !!bot_token, token_masked: maskToken(bot_token) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

    // Require an authenticated ADMIN (role checked server-side, not just signed-in)
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(jwt);
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: isAdmin } = await userClient.rpc("is_admin_user");
    if (!isAdmin) return json({ error: "Khusus admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const { data: existing } = await admin.from("telegram_bot_config").select("*").limit(1).maybeSingle();

    if (action === "get") {
      return json({ config: publicConfig(existing) });
    }

    if (action === "status") {
      const since = new Date(Date.now() - 86400000).toISOString();
      const [users, linked, chatsOpen, unread, depPending, orders, tickets, streaks, products] = await Promise.all([
        admin.from("telegram_chats").select("id", { count: "exact", head: true }),
        admin.from("telegram_user_links").select("id", { count: "exact", head: true }).eq("enabled", true),
        admin.from("telegram_chats").select("id", { count: "exact", head: true }).eq("status", "open"),
        admin.from("telegram_chats").select("id", { count: "exact", head: true }).gt("unread_count", 0),
        admin.from("deposits").select("id", { count: "exact", head: true }).eq("status", "pending"),
        admin.from("seller_orders").select("id", { count: "exact", head: true }).gte("created_at", since),
        admin.from("tickets").select("id", { count: "exact", head: true }).neq("status", "closed"),
        admin.from("daily_streaks").select("id", { count: "exact", head: true }).gt("current_streak", 0),
        admin.from("products").select("id", { count: "exact", head: true }),
      ]);
      let webhook: any = null; let bot: any = null;
      if (existing?.bot_token) {
        const [wh, me] = await Promise.all([tgApi(existing.bot_token, "getWebhookInfo", {}), tgApi(existing.bot_token, "getMe", {})]);
        if (wh.ok) {
          webhook = {
            ok: wh.result.url === WEBHOOK_URL,
            url_set: !!wh.result.url,
            pending: wh.result.pending_update_count || 0,
            last_error: wh.result.last_error_message || null,
            last_error_at: wh.result.last_error_date ? new Date(wh.result.last_error_date * 1000).toISOString() : null,
          };
        } else webhook = { ok: false, error: FRIENDLY_TG_ERROR };
        if (me.ok) bot = { username: me.result.username, name: me.result.first_name };
      }
      const { data: lastBroadcasts } = await admin.from("telegram_broadcast_log").select("target, total, sent, failed, blocked, created_at").order("created_at", { ascending: false }).limit(5);
      return json({
        config: publicConfig(existing),
        webhook, bot,
        stats: {
          users: users.count || 0, linked: linked.count || 0, chats_open: chatsOpen.count || 0, unread: unread.count || 0,
          deposit_pending: depPending.count || 0, orders_24h: orders.count || 0, tickets_open: tickets.count || 0,
          active_streaks: streaks.count || 0, products: products.count || 0,
        },
        broadcasts: lastBroadcasts || [],
      });
    }

    if (action === "save") {
      const bot_token = String(body.bot_token || existing?.bot_token || "").trim();
      const owner_id = String(body.owner_id ?? existing?.owner_id ?? "").trim();
      const enabled = body.enabled !== undefined ? !!body.enabled : (existing?.enabled ?? true);
      const welcome_message = String(body.welcome_message ?? existing?.welcome_message ?? "");
      const qris_image_url = String(body.qris_image_url ?? existing?.qris_image_url ?? "").trim();
      const qris_caption = String(body.qris_caption ?? existing?.qris_caption ?? "");
      const maintenance_mode = body.maintenance_mode !== undefined ? !!body.maintenance_mode : (existing?.maintenance_mode ?? false);
      const maintenance_message = String(body.maintenance_message ?? existing?.maintenance_message ?? "").slice(0, 500);
      if (!bot_token) return json({ error: "Token bot wajib diisi" }, 400);

      const me = await tgApi(bot_token, "getMe", {});
      if (!me.ok) return json({ error: me.description === "timeout_or_network" ? FRIENDLY_TG_ERROR : "Token bot tidak valid. Cek kembali di @BotFather." }, 400);
      const bot_username = me.result?.username || "";

      const webhook_secret = existing?.webhook_secret && existing.webhook_secret.length > 10
        ? existing.webhook_secret
        : crypto.randomUUID().replace(/-/g, "");

      const wh = await tgApi(bot_token, "setWebhook", {
        url: WEBHOOK_URL,
        secret_token: webhook_secret,
        allowed_updates: ["message", "edited_message", "callback_query"],
        drop_pending_updates: true,
      });
      if (!wh.ok) return json({ error: "Gagal daftar webhook. " + FRIENDLY_TG_ERROR }, 400);

      await tgApi(bot_token, "setMyCommands", { commands: COMMANDS });

      const activated_at = enabled
        ? (existing?.enabled && existing?.activated_at ? existing.activated_at : new Date().toISOString())
        : null;
      const payload = { bot_token, owner_id, enabled, welcome_message, webhook_secret, bot_username, activated_at, qris_image_url, qris_caption, maintenance_mode, maintenance_message };
      if (existing?.id) await admin.from("telegram_bot_config").update(payload).eq("id", existing.id);
      else await admin.from("telegram_bot_config").insert(payload);
      return json({ success: true, bot_username });
    }

    if (action === "set_maintenance") {
      if (!existing?.id) return json({ error: "Bot belum dikonfigurasi" }, 400);
      await admin.from("telegram_bot_config").update({
        maintenance_mode: !!body.maintenance_mode,
        maintenance_message: String(body.maintenance_message ?? existing.maintenance_message ?? "").slice(0, 500),
      }).eq("id", existing.id);
      return json({ success: true });
    }

    if (action === "reset_webhook") {
      if (!existing?.bot_token) return json({ error: "Bot belum dikonfigurasi" }, 400);
      const wh = await tgApi(existing.bot_token, "setWebhook", {
        url: WEBHOOK_URL, secret_token: existing.webhook_secret,
        allowed_updates: ["message", "edited_message", "callback_query"],
      });
      if (!wh.ok) return json({ error: FRIENDLY_TG_ERROR }, 400);
      await tgApi(existing.bot_token, "setMyCommands", { commands: COMMANDS });
      return json({ success: true });
    }

    if (action === "test_owner") {
      if (!existing?.bot_token || !existing.owner_id) return json({ error: "Isi token & ID owner dulu" }, 400);
      const r = await tgApi(existing.bot_token, "sendMessage", {
        chat_id: existing.owner_id,
        text: `✅ <b>Tes Notifikasi Admin</b>\n\nBot @${existing.bot_username || "-"} terhubung dan bisa mengirim pesan.\n🕒 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
        parse_mode: "HTML",
      });
      if (!r.ok) {
        const blocked = r.error_code === 403;
        return json({ error: blocked ? "Owner belum /start bot atau memblokir bot." : FRIENDLY_TG_ERROR }, 400);
      }
      return json({ success: true });
    }

    if (action === "clear") {
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
      const text = String(body.text || "").trim().slice(0, 4000);
      if (!existing?.bot_token) return json({ error: "Bot belum dikonfigurasi" }, 400);
      if (!chatId || !text) return json({ error: "chat_id & text wajib" }, 400);
      const rj = await tgApi(existing.bot_token, "sendMessage", { chat_id: chatId, text });
      if (!rj.ok) {
        return json({ error: rj.error_code === 403 ? "Pengguna memblokir bot." : rj.error_code === 400 ? "Chat tidak valid." : FRIENDLY_TG_ERROR }, 400);
      }
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

    // ===== Broadcast: preview (count) / send (batched, rate-limited) =====
    if (action === "broadcast_preview" || action === "broadcast_send") {
      if (!existing?.bot_token) return json({ error: "Bot belum dikonfigurasi" }, 400);
      const target = ["all", "linked", "announce"].includes(body.target) ? body.target : "all";
      const text = String(body.text || "").trim();
      const buttonText = String(body.button_text || "").trim().slice(0, 40);
      const buttonUrl = String(body.button_url || "").trim();
      if (!text) return json({ error: "Pesan wajib diisi" }, 400);
      if (text.length > 3500) return json({ error: "Pesan terlalu panjang (maks 3500 karakter)" }, 400);
      if (buttonUrl && !/^https:\/\//i.test(buttonUrl)) return json({ error: "Link tombol harus diawali https://" }, 400);

      let ids: string[] = [];
      if (target === "all") {
        const { data } = await admin.from("telegram_chats").select("chat_id").limit(BROADCAST_MAX);
        ids = (data || []).map((r: any) => String(r.chat_id));
      } else {
        let q = admin.from("telegram_user_links").select("telegram_chat_id").eq("enabled", true).limit(BROADCAST_MAX);
        if (target === "announce") q = q.eq("notif_announcement", true);
        const { data } = await q;
        ids = (data || []).map((r: any) => String(r.telegram_chat_id));
      }
      ids = [...new Set(ids.filter(Boolean))];

      if (action === "broadcast_preview") return json({ total: ids.length, max: BROADCAST_MAX });

      if (!body.confirm) return json({ error: "Konfirmasi diperlukan" }, 400);
      const last = existing.last_broadcast_at ? new Date(existing.last_broadcast_at).getTime() : 0;
      const wait = last + BROADCAST_COOLDOWN_MS - Date.now();
      if (wait > 0) return json({ error: `Tunggu ${Math.ceil(wait / 60000)} menit sebelum broadcast berikutnya.` }, 429);
      await admin.from("telegram_bot_config").update({ last_broadcast_at: new Date().toISOString() }).eq("id", existing.id);

      const reply_markup = buttonText && buttonUrl ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] } : undefined;
      let sent = 0, failed = 0, blocked = 0;
      for (let i = 0; i < ids.length; i += BROADCAST_BATCH) {
        const batch = ids.slice(i, i + BROADCAST_BATCH);
        const results = await Promise.all(batch.map(async (cid) => {
          let r = await tgApi(existing.bot_token, "sendMessage", { chat_id: cid, text, parse_mode: "HTML", disable_web_page_preview: false, reply_markup }, 8000);
          if (!r.ok && r.error_code === 429) {
            await sleep(((r.parameters?.retry_after as number) || 2) * 1000);
            r = await tgApi(existing.bot_token, "sendMessage", { chat_id: cid, text, parse_mode: "HTML", reply_markup }, 8000);
          }
          if (!r.ok && r.error_code === 400 && /parse/i.test(r.description || "")) {
            r = await tgApi(existing.bot_token, "sendMessage", { chat_id: cid, text, reply_markup }, 8000);
          }
          return r;
        }));
        for (const r of results) {
          if (r.ok) sent++;
          else if (r.error_code === 403) blocked++;
          else failed++;
        }
        if (i + BROADCAST_BATCH < ids.length) await sleep(1100);
      }
      await admin.from("telegram_broadcast_log").insert({
        created_by: userData.user.id, target, message: text.slice(0, 3500),
        button_text: buttonText || null, button_url: buttonUrl || null,
        total: ids.length, sent, failed, blocked,
      });
      return json({ success: true, total: ids.length, sent, failed, blocked });
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    console.error("telegram-manage error:", e);
    return json({ error: "Terjadi kesalahan server. Silakan coba lagi." }, 500);
  }
});
