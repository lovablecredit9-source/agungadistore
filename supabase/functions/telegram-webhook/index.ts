import { createClient } from "npm:@supabase/supabase-js@2";

const WEB_URL = "https://agungadistore.lovable.app";

function tgApi(token: string, method: string, payload: unknown) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const MENU = {
  inline_keyboard: [
    [{ text: "🛒 Produk & Saldo", callback_data: "saldo" }, { text: "🎮 Game", callback_data: "game" }],
    [{ text: "💬 Confess", callback_data: "confess" }, { text: "👤 Akun", callback_data: "akun" }],
    [{ text: "🔑 Login", callback_data: "login" }, { text: "📝 Daftar", callback_data: "daftar" }],
    [{ text: "🎧 Live CS (Chat Admin)", callback_data: "cs" }],
    [{ text: "🌐 Buka Website", url: WEB_URL }],
  ],
};

function wibNow() {
  const now = new Date();
  const hari = now.toLocaleDateString("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" });
  const tanggal = now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });
  return { hari, tanggal, jam, full: `${hari}, ${tanggal} • ${jam} WIB` };
}

function uptimeText(activatedAt: string | null): string {
  if (!activatedAt) return "baru saja";
  const ms = Date.now() - new Date(activatedAt).getTime();
  if (ms < 0) return "baru saja";
  const totalMin = Math.floor(ms / 60000);
  const hari = Math.floor(totalMin / 1440);
  const jam = Math.floor((totalMin % 1440) / 60);
  const menit = totalMin % 60;
  const parts: string[] = [];
  if (hari > 0) parts.push(`${hari} hari`);
  if (jam > 0) parts.push(`${jam} jam`);
  parts.push(`${menit} menit`);
  return parts.join(" ");
}

function sectionText(key: string): string {
  switch (key) {
    case "saldo":
      return `🛒 <b>Produk & Saldo</b>\n\nBeli produk digital murah & terpercaya, isi saldo (deposit QRIS/e-wallet), dan bayar pakai saldo dengan PIN 6 digit.\n\nBuka: ${WEB_URL}/saldo`;
    case "game":
      return `🎮 <b>Game</b>\n\nMainkan puluhan game seru, kumpulkan poin, level up, quest harian/mingguan/bulanan, dan menangkan hadiah.\n\nBuka: ${WEB_URL}/game`;
    case "confess":
      return `💬 <b>Confess</b>\n\nKirim confess anonim, Confess Wall, Roulette, dan Confess berhadiah.\n\nBuka: ${WEB_URL}/confess`;
    case "akun":
      return `👤 <b>Akun</b>\n\nKelola profil, foto profil, status akun, PIN, 2FA, dan keamanan akun kamu.\n\nBuka: ${WEB_URL}/ruang-ku`;
    case "login":
      return `🔑 <b>Login</b>\n\nMasuk ke akun saldo kamu untuk belanja, klaim voucher, tiket, dan lainnya.\n\nBuka: ${WEB_URL}/saldo`;
    case "daftar":
      return `📝 <b>Daftar</b>\n\nBuat akun saldo baru gratis untuk mulai belanja & menikmati semua fitur.\n\nBuka: ${WEB_URL}/saldo`;
    case "cs":
      return `🎧 <b>Live CS</b>\n\nKetik langsung pesan kamu di sini. Pesan akan diteruskan ke admin dan dibalas secepatnya. 💌`;
    default:
      return "";
  }
}

async function ensureChat(admin: any, chat: any) {
  const chatId = String(chat.id);
  const first = chat.first_name || chat.title || "Pengguna";
  const uname = chat.username || "";
  await admin.from("telegram_chats").upsert(
    { chat_id: chatId, first_name: first, username: uname },
    { onConflict: "chat_id" },
  );
  return chatId;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: cfg } = await admin.from("telegram_bot_config").select("*").limit(1).maybeSingle();
  if (!cfg || !cfg.bot_token) return new Response(JSON.stringify({ ok: true }));

  // Validate webhook secret
  const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (cfg.webhook_secret && secret !== cfg.webhook_secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = cfg.bot_token as string;
  const update = await req.json().catch(() => ({}));

  try {
    // Callback button press
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = await ensureChat(admin, cq.message.chat);
      const key = String(cq.data || "");
      await tgApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
      if (!cfg.enabled) {
        await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔴 Bot sedang tidak aktif. Coba lagi nanti." });
        return new Response(JSON.stringify({ ok: true }));
      }
      const txt = sectionText(key);
      if (txt) {
        await tgApi(token, "sendMessage", { chat_id: chatId, text: txt, parse_mode: "HTML", reply_markup: MENU });
      }
      return new Response(JSON.stringify({ ok: true }));
    }

    const message = update.message ?? update.edited_message;
    if (!message?.chat?.id) return new Response(JSON.stringify({ ok: true }));

    const chatId = await ensureChat(admin, message.chat);
    const text: string = message.text || "";

    if (!cfg.enabled) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔴 Bot sedang tidak aktif. Coba lagi nanti." });
      return new Response(JSON.stringify({ ok: true }));
    }

    const cmd = text.trim().toLowerCase().split(/[\s@]/)[0];

    if (cmd === "/start" || cmd === "/menu") {
      const now = wibNow();
      const uptime = uptimeText((cfg as any).activated_at ?? null);
      const base = (cfg.welcome_message && cfg.welcome_message.trim())
        ? cfg.welcome_message
        : "👋 <b>Selamat datang di Agung Adi Store!</b>\n\nMurah & Terpercaya. Pilih menu di bawah atau ketik pesan untuk chat admin (Live CS).";
      const welcome = `${base}\n\n🟢 Bot aktif selama: <b>${uptime}</b>\n🕒 <b>${now.hari}</b>, ${now.tanggal}\n⏰ ${now.jam} WIB`;
      await tgApi(token, "sendMessage", { chat_id: chatId, text: welcome, parse_mode: "HTML", reply_markup: MENU });
      return new Response(JSON.stringify({ ok: true }));
    }

    if (cmd === "/info" || cmd === "/status") {
      const now = wibNow();
      const uname = cfg.bot_username ? `@${cfg.bot_username}` : "Bot Telegram";
      const uptime = uptimeText((cfg as any).activated_at ?? null);
      await tgApi(token, "sendMessage", {
        chat_id: chatId,
        text: `🤖 <b>Info Bot</b>\n\nStatus: 🟢 <b>AKTIF</b>\nNama: ${uname}\nToko: <b>Agung Adi Store</b>\n⏱️ Aktif selama: <b>${uptime}</b>\n\n📅 Hari: <b>${now.hari}</b>\n🗓️ Tanggal: ${now.tanggal}\n⏰ Jam: <b>${now.jam} WIB</b>\n\nKetik /start untuk membuka menu.`,
        parse_mode: "HTML",
      });
      return new Response(JSON.stringify({ ok: true }));
    }

    if (cmd === "/help" || cmd === "/bantuan") {
      await tgApi(token, "sendMessage", {
        chat_id: chatId,
        text: "ℹ️ Perintah:\n/start - Menu utama\n/info - Status bot & waktu\n/saldo /game /confess /akun /login /daftar\n/cs - Live chat admin\n\nAtau ketik pesan langsung untuk chat admin.",
      });
      return new Response(JSON.stringify({ ok: true }));
    }

    const sectionKeys = ["saldo", "game", "confess", "akun", "login", "daftar", "cs"];
    if (cmd.startsWith("/") && sectionKeys.includes(cmd.slice(1))) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: sectionText(cmd.slice(1)), parse_mode: "HTML", reply_markup: MENU });
      return new Response(JSON.stringify({ ok: true }));
    }

    // Free text => Live CS: store + notify owner
    await admin.from("telegram_messages").insert({
      chat_id: chatId,
      direction: "in",
      text,
      telegram_message_id: message.message_id,
    });
    await admin.from("telegram_chats").update({
      last_message: text.slice(0, 200),
      last_message_at: new Date().toISOString(),
      status: "open",
    }).eq("chat_id", chatId);
    // increment unread
    const { data: c } = await admin.from("telegram_chats").select("unread_count").eq("chat_id", chatId).maybeSingle();
    await admin.from("telegram_chats").update({ unread_count: ((c?.unread_count as number) || 0) + 1 }).eq("chat_id", chatId);

    // notify owner
    if (cfg.owner_id) {
      const uname = message.chat.username ? `@${message.chat.username}` : (message.chat.first_name || "User");
      await tgApi(token, "sendMessage", {
        chat_id: cfg.owner_id,
        text: `📩 <b>Pesan Live CS baru</b>\nDari: ${uname} (${chatId})\n\n${text}`,
        parse_mode: "HTML",
      });
    }

    // acknowledge to user
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: "✅ Pesan kamu sudah diterima admin. Mohon tunggu balasan ya. 🙏",
    });

    return new Response(JSON.stringify({ ok: true }));
  } catch (e) {
    console.error("telegram-webhook error:", e);
    return new Response(JSON.stringify({ ok: true }));
  }
});
