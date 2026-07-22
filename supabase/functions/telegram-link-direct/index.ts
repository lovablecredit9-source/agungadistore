// Link Telegram directly via chat_id or @username (no /konek code required).
// Body: { visitor_id: string, input: string }
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const body = await req.json().catch(() => ({} as any));
    const visitor_id = String(body.visitor_id || "").trim();
    let input = String(body.input || "").trim();
    if (!visitor_id || !input) return json({ error: "Data tidak lengkap" }, 400);

    const { data: cfg } = await admin.from("telegram_bot_config").select("bot_token, enabled").limit(1).maybeSingle();
    if (!cfg?.bot_token) return json({ error: "Bot Telegram belum dikonfigurasi admin" }, 400);
    if (!cfg.enabled) return json({ error: "Bot Telegram sedang nonaktif" }, 400);

    // Normalisasi input: bisa angka (chat id) atau username (@user / user / t.me/user)
    input = input.replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "").trim();
    const isNumeric = /^-?\d{5,}$/.test(input);
    const chatIdentifier = isNumeric ? input : `@${input}`;

    // Coba kirim pesan verifikasi. Jika user belum pernah /start bot, Telegram akan menolak.
    const sendResp = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatIdentifier,
        text: "✅ <b>Akun Telegram berhasil terhubung ke Agung Adi Store!</b>\n\nMulai sekarang kamu akan menerima notifikasi sesuai preferensi yang kamu aktifkan di website.",
        parse_mode: "HTML",
      }),
    });
    const sendJson = await sendResp.json();
    if (!sendJson.ok) {
      const desc = String(sendJson.description || "");
      if (/chat not found|bot can't initiate|blocked/i.test(desc)) {
        return json({
          error: "Bot belum bisa menghubungi akun ini. Buka bot Telegram lalu ketik /start dulu, baru coba koneksi ulang.",
          needStart: true,
        }, 400);
      }
      return json({ error: `Telegram: ${desc || "gagal verifikasi"}` }, 400);
    }

    const result = sendJson.result;
    const chat = result?.chat || {};
    const telegram_chat_id = String(chat.id);
    const telegram_username = chat.username || "";
    const telegram_first_name = chat.first_name || chat.title || "Telegram User";

    // Upsert link
    const { data: existing } = await admin
      .from("telegram_user_links")
      .select("id")
      .eq("visitor_id", visitor_id)
      .maybeSingle();

    if (existing) {
      await admin.from("telegram_user_links").update({
        telegram_chat_id, telegram_username, telegram_first_name, enabled: true,
      }).eq("id", existing.id);
    } else {
      await admin.from("telegram_user_links").insert({
        visitor_id, telegram_chat_id, telegram_username, telegram_first_name,
        enabled: true,
        notif_deposit: true, notif_purchase: true, notif_login: true,
        notif_admin_message: true, notif_balance_change: true,
      });
    }

    return json({ ok: true, telegram_chat_id, telegram_username, telegram_first_name });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "internal" }, 500);
  }
});
