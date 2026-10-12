// Shared Telegram delivery: one path for every notification (preference check,
// idempotency via telegram_delivery_log, real Bot API result). Never logs the bot token.

export const TG_CATEGORIES = [
  "deposit", "purchase", "order", "login", "admin_message", "balance_change", "streak",
  "quest", "reward", "ticket", "membership", "flash_sale", "announcement",
] as const;
export type TgCategory = typeof TG_CATEGORIES[number];

export const TG_FIELD: Record<string, string> = {
  deposit: "notif_deposit", purchase: "notif_purchase", order: "notif_order", login: "notif_login",
  admin_message: "notif_admin_message", balance_change: "notif_balance_change", streak: "notif_streak",
  quest: "notif_quest", reward: "notif_reward", ticket: "notif_ticket", live_cs: "notif_ticket",
  membership: "notif_membership", flash_sale: "notif_flash_sale", announcement: "notif_announcement",
};

export const escHtml = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type TgApiResult = { ok: boolean; message_id?: number; error_code?: number; description?: string; chat?: any };

export async function tgSend(token: string, payload: Record<string, unknown>): Promise<TgApiResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal,
    });
    const j = await r.json().catch(() => ({ ok: false, error_code: r.status, description: "invalid_response" }));
    if (j.ok) return { ok: true, message_id: j.result?.message_id, chat: j.result?.chat };
    return { ok: false, error_code: j.error_code ?? r.status, description: String(j.description || "telegram_error") };
  } catch (_e) {
    return { ok: false, error_code: 0, description: "network_timeout" };
  } finally { clearTimeout(t); }
}

/** Human Indonesian explanation of a Telegram Bot API error. */
export function tgErrorMessage(r: TgApiResult): string {
  const d = (r.description || "").toLowerCase();
  if (d.includes("chat not found")) return "Telegram: chat tidak ditemukan. Buka bot lalu ketik /start, kemudian coba lagi.";
  if (d.includes("bot can't initiate") || d.includes("can't initiate")) return "Telegram: bot belum boleh memulai chat. Ketik /start di bot dulu.";
  if (d.includes("blocked")) return "Telegram: kamu memblokir bot. Buka bot, unblock, lalu ketik /start.";
  if (d.includes("deactivated")) return "Telegram: akun Telegram ini sudah nonaktif.";
  if (r.error_code === 401 || d.includes("unauthorized")) return "Telegram: token bot tidak valid (hubungi admin).";
  if (r.error_code === 429) return "Telegram: terlalu banyak pesan, coba lagi sebentar.";
  if (d === "network_timeout") return "Telegram tidak merespons (timeout jaringan). Coba lagi.";
  return `Telegram menolak pesan: ${r.description || "error"} (kode ${r.error_code ?? "?"}).`;
}

export type DeliverResult =
  | { status: "sent"; message_id?: number }
  | { status: "skipped"; reason: string }
  | { status: "duplicate" }
  | { status: "failed"; reason: string; error_code?: number; message: string };

// deno-lint-ignore no-explicit-any
export async function deliverTelegram(admin: any, opts: {
  visitorId: string; category: string; text: string; eventKey: string; source?: string; ignorePreference?: boolean;
}): Promise<DeliverResult> {
  const field = TG_FIELD[opts.category];
  if (!field) return { status: "skipped", reason: "unknown_category" };
  const log = (status: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ tg: "deliver", event_key: opts.eventKey, source: opts.source, category: opts.category,
      account: opts.visitorId.slice(0, 6) + "…", status, at: new Date().toISOString(), ...extra }));

  // Idempotency claim: the first caller for an event_key wins.
  const { error: claimErr } = await admin.from("telegram_delivery_log").insert({
    event_key: opts.eventKey, visitor_id: opts.visitorId, category: opts.category, source: opts.source ?? null,
  });
  if (claimErr) {
    if (String(claimErr.code) === "23505") { log("duplicate"); return { status: "duplicate" }; }
    log("failed", { reason: "log_insert_failed" });
    return { status: "failed", reason: "log_insert_failed", message: "Gagal mencatat pengiriman." };
  }
  const finish = async (status: string, extra: Record<string, unknown>) => {
    await admin.from("telegram_delivery_log").update({ status, finished_at: new Date().toISOString(), ...extra }).eq("event_key", opts.eventKey);
  };

  const { data: link } = await admin.from("telegram_user_links")
    .select(`id, telegram_chat_id, enabled, ${field}`).eq("visitor_id", opts.visitorId).maybeSingle();
  if (!link) { await finish("skipped", { reason: "not_linked" }); log("skipped", { reason: "not_linked" }); return { status: "skipped", reason: "not_linked" }; }
  if (!link.enabled) { await finish("skipped", { reason: "master_off" }); log("skipped", { reason: "master_off" }); return { status: "skipped", reason: "master_off" }; }
  if (!opts.ignorePreference && !link[field]) { await finish("skipped", { reason: "preference_off" }); log("skipped", { reason: "preference_off" }); return { status: "skipped", reason: "preference_off" }; }

  const { data: cfg } = await admin.from("telegram_bot_config").select("bot_token, enabled").limit(1).maybeSingle();
  if (!cfg?.bot_token || !cfg.enabled) { await finish("skipped", { reason: "bot_off" }); log("skipped", { reason: "bot_off" }); return { status: "skipped", reason: "bot_off" }; }

  let r = await tgSend(cfg.bot_token, { chat_id: link.telegram_chat_id, text: opts.text, parse_mode: "HTML", disable_web_page_preview: true });
  if (!r.ok && r.error_code === 400 && /parse|entit/i.test(r.description || "")) {
    r = await tgSend(cfg.bot_token, { chat_id: link.telegram_chat_id, text: opts.text.replace(/<[^>]+>/g, ""), disable_web_page_preview: true });
  }
  const now = new Date().toISOString();
  if (r.ok) {
    await finish("sent", { message_id: r.message_id ?? null });
    await admin.from("telegram_user_links").update({ last_success_at: now }).eq("id", link.id);
    log("sent", { message_id: r.message_id });
    return { status: "sent", message_id: r.message_id };
  }
  const message = tgErrorMessage(r);
  await finish("failed", { reason: (r.description || "").slice(0, 200), error_code: r.error_code ?? null });
  await admin.from("telegram_user_links").update({ last_error: message.slice(0, 300), last_error_at: now }).eq("id", link.id);
  log("failed", { error_code: r.error_code, reason: r.description });
  return { status: "failed", reason: r.description || "telegram_error", error_code: r.error_code, message };
}
