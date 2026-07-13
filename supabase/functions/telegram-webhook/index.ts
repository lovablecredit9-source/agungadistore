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

const CANCEL_KB = { inline_keyboard: [[{ text: "❌ Batal", callback_data: "batal" }]] };

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

// ===== helpers =====
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normPhone(p: string): string | null {
  const d = String(p || "").replace(/\D/g, "");
  if (!d) return null;
  const n = d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("62") ? d : d.startsWith("8") ? "62" + d : d;
  if (n.length < 9 || n.length > 16) return null;
  return n;
}

function maskPhone(p: string): string {
  if (!p) return "****";
  const local = p.startsWith("62") ? "0" + p.slice(2) : p;
  if (local.length < 6) return local;
  return local.slice(0, 4) + "****" + local.slice(-4);
}

function randomLoginCode(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function uniqueLoginCode(admin: any): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = randomLoginCode();
    const { data } = await admin.from("user_balances").select("id").eq("login_code", code).maybeSingle();
    if (!data) return code;
  }
  return randomLoginCode(9);
}

function fmtRp(n: number): string {
  return "Rp " + (Number(n) || 0).toLocaleString("id-ID");
}

function sectionText(key: string): string {
  switch (key) {
    case "game":
      return `🎮 <b>Game</b>\n\nMainkan puluhan game seru, kumpulkan poin, level up, quest harian/mingguan/bulanan, dan menangkan hadiah.\n\nBuka: ${WEB_URL}/game`;
    case "akun":
      return `👤 <b>Akun</b>\n\nKelola profil, foto profil, status akun, PIN, 2FA, dan keamanan akun kamu.\n\nBuka: ${WEB_URL}/ruang-ku`;
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

async function getChatRow(admin: any, chatId: string) {
  const { data } = await admin
    .from("telegram_chats")
    .select("tg_state, tg_data, tg_visitor_id, unread_count")
    .eq("chat_id", chatId)
    .maybeSingle();
  return data || { tg_state: "", tg_data: {}, tg_visitor_id: null, unread_count: 0 };
}

async function setState(admin: any, chatId: string, state: string, data: Record<string, unknown> = {}) {
  await admin.from("telegram_chats").update({ tg_state: state, tg_data: data }).eq("chat_id", chatId);
}

async function clearState(admin: any, chatId: string) {
  await admin.from("telegram_chats").update({ tg_state: "", tg_data: {} }).eq("chat_id", chatId);
}

// ===== flow starters =====
async function startLogin(admin: any, token: string, chatId: string) {
  await setState(admin, chatId, "login_code", {});
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: `🔑 <b>Login Akun Saldo</b>\n\nMasukkan <b>Kode Login</b> akun kamu (8 karakter).\n\n📍 Cara dapat kode: buka website → halaman <b>Saldo</b> → kartu "Login Cepat Perangkat Lain" → salin kodenya.\n\nKetik kodenya sekarang 👇`,
    parse_mode: "HTML",
    reply_markup: CANCEL_KB,
  });
}

async function startDaftar(admin: any, token: string, chatId: string) {
  await setState(admin, chatId, "reg_username", {});
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: `📝 <b>Daftar Akun Saldo Baru</b>\n\nLangkah 1/4 — Ketik <b>username</b> kamu (min. 3 karakter):`,
    parse_mode: "HTML",
    reply_markup: CANCEL_KB,
  });
}

async function startConfess(admin: any, token: string, chatId: string) {
  await setState(admin, chatId, "confess_msg", {});
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: `💬 <b>Kirim Confess Anonim</b>\n\nTulis isi confess kamu (maks. 800 karakter). Confess akan tampil di <b>Confess Wall</b> secara anonim.\n\nKetik pesannya sekarang 👇`,
    parse_mode: "HTML",
    reply_markup: CANCEL_KB,
  });
}

async function showSaldo(admin: any, token: string, chatId: string, visitorId: string | null) {
  if (!visitorId) {
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: `🛒 <b>Produk & Saldo</b>\n\nKamu belum login. Login dulu untuk cek saldo langsung di sini.`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "🔑 Login Sekarang", callback_data: "login" }], [{ text: "📝 Daftar Baru", callback_data: "daftar" }]] },
    });
    return;
  }
  const { data: u } = await admin
    .from("user_balances")
    .select("username, balance, bonus_balance, phone")
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (!u) {
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Akun tidak ditemukan. Silakan login ulang.", reply_markup: MENU });
    return;
  }
  const total = (Number(u.balance) || 0) + (Number(u.bonus_balance) || 0);
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: `🛒 <b>Saldo Kamu</b>\n\n👤 User: <b>${u.username}</b>\n📱 HP: ${maskPhone(u.phone || "")}\n💰 Saldo: <b>${fmtRp(u.balance)}</b>\n🎁 Bonus: <b>${fmtRp(u.bonus_balance)}</b>\n💳 Total: <b>${fmtRp(total)}</b>\n\nBelanja & isi saldo di: ${WEB_URL}/saldo`,
    parse_mode: "HTML",
    reply_markup: MENU,
  });
}

async function doLoginByCode(admin: any, token: string, chatId: string, rawInput: string) {
  const code = rawInput.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(code)) {
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Format kode tidak valid. Kode terdiri dari 6-12 huruf/angka. Coba lagi:", reply_markup: CANCEL_KB });
    return;
  }
  const { data: user } = await admin
    .from("user_balances")
    .select("visitor_id, username, balance, bonus_balance, phone, totp_enabled")
    .eq("login_code", code)
    .maybeSingle();
  if (!user) {
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Kode login tidak ditemukan atau sudah diganti. Cek lagi di website, lalu ketik kodenya:", reply_markup: CANCEL_KB });
    return;
  }
  if (user.totp_enabled) {
    await clearState(admin, chatId);
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔒 Akun ini memakai 2FA. Untuk keamanan, login lewat website ya.", reply_markup: MENU });
    return;
  }
  await admin.from("telegram_chats").update({ tg_visitor_id: user.visitor_id, tg_state: "", tg_data: {} }).eq("chat_id", chatId);
  const total = (Number(user.balance) || 0) + (Number(user.bonus_balance) || 0);
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: `✅ <b>Login berhasil!</b>\n\nHalo <b>${user.username}</b> 👋\n💳 Total saldo: <b>${fmtRp(total)}</b>\n\nKetik /saldo untuk cek saldo kapan saja.`,
    parse_mode: "HTML",
    reply_markup: MENU,
  });
}

async function handleRegisterStep(admin: any, token: string, chatId: string, state: string, data: any, text: string) {
  const val = text.trim();
  if (state === "reg_username") {
    if (val.length < 3) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Username minimal 3 karakter. Coba lagi:", reply_markup: CANCEL_KB });
      return;
    }
    const { data: exists } = await admin.from("user_balances").select("id").eq("username", val).maybeSingle();
    if (exists) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Username sudah dipakai. Pilih username lain:", reply_markup: CANCEL_KB });
      return;
    }
    await setState(admin, chatId, "reg_phone", { username: val });
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "Langkah 2/4 — Ketik <b>nomor HP</b> (contoh: 0812xxxx):", parse_mode: "HTML", reply_markup: CANCEL_KB });
    return;
  }
  if (state === "reg_phone") {
    const phone = normPhone(val);
    if (!phone) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Nomor HP tidak valid. Ketik ulang (contoh: 0812xxxx):", reply_markup: CANCEL_KB });
      return;
    }
    const { data: exists } = await admin.from("user_balances").select("id").neq("phone", "").eq("phone", phone).maybeSingle();
    if (exists) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Nomor HP sudah terdaftar. Silakan login. Ketik nomor lain atau tekan Batal:", reply_markup: CANCEL_KB });
      return;
    }
    await setState(admin, chatId, "reg_email", { ...data, phone });
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "Langkah 3/4 — Ketik <b>email</b> kamu:", parse_mode: "HTML", reply_markup: CANCEL_KB });
    return;
  }
  if (state === "reg_email") {
    const email = val.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Format email tidak valid. Ketik ulang:", reply_markup: CANCEL_KB });
      return;
    }
    const { data: exists } = await admin.from("user_balances").select("id").neq("email", "").eq("email", email).maybeSingle();
    if (exists) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Email sudah terdaftar. Silakan login. Ketik email lain atau tekan Batal:", reply_markup: CANCEL_KB });
      return;
    }
    await setState(admin, chatId, "reg_password", { ...data, email });
    await tgApi(token, "sendMessage", { chat_id: chatId, text: "Langkah 4/4 — Ketik <b>sandi</b> (min. 6 karakter):", parse_mode: "HTML", reply_markup: CANCEL_KB });
    return;
  }
  if (state === "reg_password") {
    if (val.length < 6) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Sandi minimal 6 karakter. Ketik ulang:", reply_markup: CANCEL_KB });
      return;
    }
    const passwordHash = await sha256Hex(val);
    const visitorId = crypto.randomUUID();
    const loginCode = await uniqueLoginCode(admin);
    const { data: created, error } = await admin
      .from("user_balances")
      .insert({
        visitor_id: visitorId,
        username: data.username,
        phone: data.phone,
        email: data.email,
        password_hash: passwordHash,
        login_code: loginCode,
      })
      .select("visitor_id, username")
      .single();
    if (error || !created) {
      await clearState(admin, chatId);
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Gagal membuat akun: " + (error?.message || "coba lagi"), reply_markup: MENU });
      return;
    }
    await admin.from("telegram_chats").update({ tg_visitor_id: visitorId, tg_state: "", tg_data: {} }).eq("chat_id", chatId);
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: `🎉 <b>Akun berhasil dibuat!</b>\n\n👤 Username: <b>${created.username}</b>\n🔑 Kode Login: <code>${loginCode}</code>\n\nSimpan kode login ini untuk masuk di perangkat lain. Kamu sudah otomatis login di bot ini. Ketik /saldo untuk cek saldo.`,
      parse_mode: "HTML",
      reply_markup: MENU,
    });
    return;
  }
}

async function handleConfessStep(admin: any, token: string, chatId: string, state: string, data: any, text: string, chat: any) {
  const val = text.trim();
  if (state === "confess_msg") {
    if (val.length < 3) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "⚠️ Confess terlalu pendek. Tulis lagi:", reply_markup: CANCEL_KB });
      return;
    }
    await setState(admin, chatId, "confess_name", { message: val.slice(0, 800) });
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: "Mau pakai nama samaran? Ketik namanya, atau ketik <b>-</b> untuk anonim penuh:",
      parse_mode: "HTML",
      reply_markup: CANCEL_KB,
    });
    return;
  }
  if (state === "confess_name") {
    const senderName = val === "-" ? "Anonim" : val.slice(0, 40);
    const visitorKey = `telegram_${chatId}`;
    const { error } = await admin.from("confess_public_wall").insert({
      visitor_id: visitorKey,
      sender_name: senderName,
      masked_phone: "Telegram",
      message: data.message,
    });
    await clearState(admin, chatId);
    if (error) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Gagal mengirim confess. Coba lagi nanti.", reply_markup: MENU });
      return;
    }
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: `✅ <b>Confess terkirim!</b>\n\nConfess kamu sudah tampil di Confess Wall secara anonim. Lihat di: ${WEB_URL}/confess`,
      parse_mode: "HTML",
      reply_markup: MENU,
    });
    return;
  }
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

  const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (cfg.webhook_secret && secret !== cfg.webhook_secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = cfg.bot_token as string;
  const update = await req.json().catch(() => ({}));

  try {
    // ===== Callback button press =====
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = await ensureChat(admin, cq.message.chat);
      const key = String(cq.data || "");
      await tgApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
      if (!cfg.enabled) {
        await tgApi(token, "sendMessage", { chat_id: chatId, text: "🔴 Bot sedang tidak aktif. Coba lagi nanti." });
        return new Response(JSON.stringify({ ok: true }));
      }
      const row = await getChatRow(admin, chatId);

      if (key === "batal") {
        await clearState(admin, chatId);
        await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Dibatalkan. Pilih menu di bawah.", reply_markup: MENU });
        return new Response(JSON.stringify({ ok: true }));
      }
      if (key === "login") { await startLogin(admin, token, chatId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "daftar") { await startDaftar(admin, token, chatId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "confess") { await startConfess(admin, token, chatId); return new Response(JSON.stringify({ ok: true })); }
      if (key === "saldo") { await showSaldo(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }

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
    const row = await getChatRow(admin, chatId);

    // ===== global cancel =====
    if (cmd === "/batal" || cmd === "/cancel") {
      await clearState(admin, chatId);
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "❌ Dibatalkan. Ketik /start untuk membuka menu.", reply_markup: MENU });
      return new Response(JSON.stringify({ ok: true }));
    }

    // ===== active multi-step flows (only if not a command) =====
    if (row.tg_state && !cmd.startsWith("/")) {
      const st = row.tg_state as string;
      const data = (row.tg_data as any) || {};
      if (st === "login_code") { await doLoginByCode(admin, token, chatId, text); return new Response(JSON.stringify({ ok: true })); }
      if (st.startsWith("reg_")) { await handleRegisterStep(admin, token, chatId, st, data, text); return new Response(JSON.stringify({ ok: true })); }
      if (st.startsWith("confess_")) { await handleConfessStep(admin, token, chatId, st, data, text, message.chat); return new Response(JSON.stringify({ ok: true })); }
    }

    if (cmd === "/start" || cmd === "/menu") {
      await clearState(admin, chatId);
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
        text: "ℹ️ Perintah:\n/start - Menu utama\n/info - Status bot & waktu\n/login - Login akun saldo (pakai kode website)\n/daftar - Buat akun saldo baru\n/saldo - Cek saldo (harus login)\n/confess - Kirim confess anonim\n/logout - Keluar akun\n/batal - Batalkan proses\n\nAtau ketik pesan langsung untuk chat admin (Live CS).",
      });
      return new Response(JSON.stringify({ ok: true }));
    }

    if (cmd === "/logout") {
      await admin.from("telegram_chats").update({ tg_visitor_id: null, tg_state: "", tg_data: {} }).eq("chat_id", chatId);
      await tgApi(token, "sendMessage", { chat_id: chatId, text: "👋 Kamu sudah logout dari bot. Ketik /login untuk masuk lagi.", reply_markup: MENU });
      return new Response(JSON.stringify({ ok: true }));
    }

    // ===== interactive command shortcuts =====
    if (cmd === "/login") { await startLogin(admin, token, chatId); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/daftar") { await startDaftar(admin, token, chatId); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/confess") { await startConfess(admin, token, chatId); return new Response(JSON.stringify({ ok: true })); }
    if (cmd === "/saldo") { await showSaldo(admin, token, chatId, row.tg_visitor_id); return new Response(JSON.stringify({ ok: true })); }

    const sectionKeys = ["game", "akun", "cs"];
    if (cmd.startsWith("/") && sectionKeys.includes(cmd.slice(1))) {
      await tgApi(token, "sendMessage", { chat_id: chatId, text: sectionText(cmd.slice(1)), parse_mode: "HTML", reply_markup: MENU });
      return new Response(JSON.stringify({ ok: true }));
    }

    // ===== Free text => Live CS: store + notify owner =====
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
    const { data: c } = await admin.from("telegram_chats").select("unread_count").eq("chat_id", chatId).maybeSingle();
    await admin.from("telegram_chats").update({ unread_count: ((c?.unread_count as number) || 0) + 1 }).eq("chat_id", chatId);

    if (cfg.owner_id) {
      const uname = message.chat.username ? `@${message.chat.username}` : (message.chat.first_name || "User");
      await tgApi(token, "sendMessage", {
        chat_id: cfg.owner_id,
        text: `📩 <b>Pesan Live CS baru</b>\nDari: ${uname} (${chatId})\n\n${text}`,
        parse_mode: "HTML",
      });
    }

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
