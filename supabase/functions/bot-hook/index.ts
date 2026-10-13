// Telegram webhook runtime for rented bots. Telegram -> bot-hook?b=<botId> -> active version's
// adistore-bot.json spec (data only, interpreted here) -> sendMessage with the bot's own token.
// Also: ?flush=1 (internal) sends queued owner expiry messages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { decryptToken, hookSecret, safeEqual, redact } from "../_shared/bot-crypto.ts";
import { replyFor, type BotSpec } from "../_shared/bot-spec.ts";

const ok = () => new Response("ok");
const EXPIRED_MSG = "⛔ Masa sewa bot telah berakhir. Silakan perpanjang masa sewa untuk menggunakan bot kembali.";

function left(exp: string) {
  let s = Math.max(0, Math.floor((new Date(exp).getTime() - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60);
  return d ? `${d} hari ${h} jam` : h ? `${h} jam ${m} menit` : `${m} menit`;
}
const wib = (d: string) => new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB";

async function send(token: string, chatId: number | string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text }) });
  const j = await r.json().catch(() => ({}));
  return { ok: !!j.ok, message_id: j.result?.message_id as number | undefined, error: j.description as string | undefined };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const url = new URL(req.url);
  const log = (botId: string, message: string, level = "info") => db.from("bot_runtime_logs").insert({ bot_id: botId, level, message: redact(message).slice(0, 500) });

  // ---- internal flush of owner expiry messages ----
  if (url.searchParams.get("flush")) {
    const { data: sec } = await db.from("telegram_internal_secret").select("token").limit(1).maybeSingle();
    if (!sec?.token || !safeEqual(req.headers.get("x-tg-internal"), sec.token)) return new Response("Unauthorized", { status: 401 });
    const { data: q } = await db.from("bot_notifications").select("id, bot_id, rental_id").eq("channel", "owner_telegram").eq("status", "queued").limit(50);
    for (const n of q ?? []) {
      const { data: b } = await db.from("bot_instances").select("id, bot_token, owner_telegram_id").eq("id", n.bot_id).maybeSingle();
      const { data: r } = await db.from("bot_rentals").select("last_transaction_id").eq("id", n.rental_id).maybeSingle();
      const tok = await decryptToken(b?.bot_token ?? null).catch(() => null);
      if (!tok || !b?.owner_telegram_id) { await db.from("bot_notifications").update({ status: "failed", detail: "token/owner kosong" }).eq("id", n.id); continue; }
      const res = await send(tok, b.owner_telegram_id, `⚠️ Masa sewa bot Anda telah berakhir.\n\nBot sementara dibekukan.\n\nSilakan perpanjang masa sewa di AGUNG ADI STORE untuk mengaktifkan bot kembali.\n\nID Transaksi: ${r?.last_transaction_id ?? "-"}\n\nStatus: EXPIRED`);
      await db.from("bot_notifications").update({ status: res.ok ? "sent" : "failed", detail: res.ok ? `message_id ${res.message_id}` : redact(res.error ?? "error").slice(0, 200) }).eq("id", n.id);
      await log(b.id, res.ok ? `Pesan expired terkirim ke owner (message_id ${res.message_id})` : `Pesan expired ke owner gagal: ${res.error}`, res.ok ? "info" : "warn");
    }
    return ok();
  }

  // ---- Telegram update ----
  const botId = url.searchParams.get("b") || "";
  if (!/^[0-9a-f-]{36}$/.test(botId)) return new Response("Not found", { status: 404 });
  if (!safeEqual(req.headers.get("X-Telegram-Bot-Api-Secret-Token"), await hookSecret(botId))) return new Response("Unauthorized", { status: 401 });

  try {
    const update = await req.json();
    const msg = update.message ?? update.edited_message;
    if (typeof update.update_id !== "number" || !msg?.chat?.id) return ok();
    const { data: bot } = await db.from("bot_instances").select("id, name, status, bot_token, current_version, rental_id, deleted_at, webhook_set").eq("id", botId).maybeSingle();
    if (!bot || bot.deleted_at || !bot.webhook_set) return ok(); // stopped: no logic runs
    const { data: rental } = await db.from("bot_rentals").select("status, expires_at, last_transaction_id").eq("id", bot.rental_id).maybeSingle();
    const token = await decryptToken(bot.bot_token);
    if (!token) return ok();

    const text: string = typeof msg.text === "string" ? msg.text : "";
    const isCommand = text.trim().startsWith("/");
    const fresh = await db.rpc("bot_record_update", { p_bot: bot.id, p_update: update.update_id, p_user: msg.from?.id ?? null, p_is_command: isCommand });
    if (fresh.data === false) return ok(); // Telegram retry, already handled

    const expired = !rental || rental.status !== "ACTIVE" || new Date(rental.expires_at) <= new Date();
    if (expired) {
      const r = await send(token, msg.chat.id, `${EXPIRED_MSG}\n\nID Transaksi: ${rental?.last_transaction_id ?? "-"}`);
      await log(bot.id, `Update ${update.update_id} saat sewa habis → pesan perpanjang ${r.ok ? `terkirim (message_id ${r.message_id})` : `gagal: ${r.error}`}`, "warn");
      return ok();
    }
    if (bot.status !== "ACTIVE") return ok();

    const { data: ver } = await db.from("bot_versions").select("version, config, compatible").eq("bot_id", bot.id).eq("version", bot.current_version).is("deleted_at", null).maybeSingle();
    if (!ver?.compatible || !ver.config) { await log(bot.id, `Update ${update.update_id}: versi aktif tidak kompatibel, tidak dibalas`, "warn"); return ok(); }
    const spec = ver.config as BotSpec;
    const { reply } = replyFor(spec, text, {
      first_name: msg.from?.first_name ?? "", username: msg.from?.username ?? "", chat_id: String(msg.chat.id), user_id: String(msg.from?.id ?? ""),
      text, bot_name: bot.name, version: `v${ver.version}`, status: "AKTIF", expires_at: wib(rental!.expires_at), time_left: left(rental!.expires_at),
      transaction_id: rental!.last_transaction_id ?? "-",
    });
    if (!reply) { await log(bot.id, `Update ${update.update_id} diterima (v${ver.version}), tidak ada balasan`); return ok(); }
    const r = await send(token, msg.chat.id, reply);
    await log(bot.id, `${isCommand ? "Command " + text.split(/\s+/)[0].slice(0, 32) : "Pesan"} dari ${msg.from?.id ?? "?"} → v${ver.version} ${r.ok ? `dibalas (message_id ${r.message_id})` : `gagal kirim: ${r.error}`}`, r.ok ? "info" : "error");
    if (!r.ok) await db.from("bot_instances").update({ last_error: redact(r.error ?? "sendMessage gagal").slice(0, 300) }).eq("id", bot.id);
    return ok();
  } catch (e) {
    await log(botId, `Error runtime: ${e instanceof Error ? e.message : "unknown"}`, "error");
    return ok(); // never make Telegram retry-loop
  }
});
