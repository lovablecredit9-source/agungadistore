// TEST notifications per category. Owner-verified, really calls Telegram Bot API,
// returns PASS (message_id) / SKIPPED / FAIL. Never changes balances or orders.
// Limit: 2x per category + 15x total per hour (only real sends count).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveWalletIdentity } from "../_shared/wallet-identity.ts";
import { TG_CATEGORIES, TG_FIELD, tgErrorMessage, tgSend } from "../_shared/telegram.ts";

const LABEL: Record<string, string> = {
  deposit: "Deposit", purchase: "Pembelian", order: "Status Pesanan", login: "Login Perangkat",
  admin_message: "Pesan Admin", balance_change: "Perubahan Saldo", streak: "Streak", quest: "Quest",
  reward: "Hadiah", ticket: "Tiket & Live CS", membership: "Membership", flash_sale: "Flash Sale", announcement: "Pengumuman",
};
const BODY: Record<string, string> = {
  deposit: "💰 Contoh: deposit Rp 50.000 via QRIS disetujui.",
  purchase: "🛒 Contoh: pembelian produk Rp 10.000 berhasil.",
  order: "📦 Contoh: pesanan sedang dikirim penjual.",
  login: "🔐 Contoh: login dari perangkat baru (Chrome / Android).",
  admin_message: "💬 Contoh pesan dari admin Agung Adi Store.",
  balance_change: "💵 Contoh: saldo bertambah Rp 5.000.",
  streak: "🔥 Contoh: streak harian berhasil diklaim.",
  quest: "🎯 Contoh: quest selesai, hadiah siap diklaim.",
  reward: "🎁 Contoh: kamu mendapat +50 Gem.",
  ticket: "🎫 Contoh: admin membalas tiket kamu.",
  membership: "👑 Contoh: membership aktif.",
  flash_sale: "⚡ Contoh: flash sale dimulai.",
  announcement: "📢 Contoh: pengumuman baru dari toko.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    // deno-lint-ignore no-explicit-any
    const body = await req.json().catch(() => ({} as any));
    const id = await resolveWalletIdentity(req, admin, body.visitor_id);
    if (!id.ok) return json({ status: "fail", error: id.error }, id.status);
    const visitor_id = id.visitorId;

    const PER_TYPE = 2, TOTAL = 15;
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { data: recent } = await admin.from("telegram_test_log").select("type, created_at")
      .eq("visitor_id", visitor_id).gte("created_at", oneHourAgo).eq("ok", true).order("created_at", { ascending: true });
    const rows = recent ?? [];
    const usage: Record<string, number> = {};
    rows.forEach((r: { type: string }) => { usage[r.type] = (usage[r.type] ?? 0) + 1; });

    if (body.action === "usage") return json({ usage, total_used: rows.length, per_type: PER_TYPE, total: TOTAL, categories: TG_CATEGORIES });

    const type = String(body.type || "");
    if (!TG_FIELD[type] || type === "live_cs") return json({ status: "fail", error: "Kategori tidak dikenal." }, 400);
    if ((usage[type] ?? 0) >= PER_TYPE) return json({ status: "skipped", reason: "rate_limited", error: `Limit test ${LABEL[type]} tercapai (${PER_TYPE}×/jam).` }, 429);
    if (rows.length >= TOTAL) return json({ status: "skipped", reason: "rate_limited", error: `Limit total test tercapai (${TOTAL}×/jam).` }, 429);

    const field = TG_FIELD[type];
    const { data: link } = await admin.from("telegram_user_links").select(`id, telegram_chat_id, enabled, ${field}`).eq("visitor_id", visitor_id).maybeSingle();
    if (!link) return json({ status: "skipped", reason: "not_linked", error: "Belum terhubung ke Telegram." });
    if (!link.enabled) return json({ status: "skipped", reason: "master_off", error: "Telegram sedang OFF." });
    if (!link[field]) return json({ status: "skipped", reason: "preference_off", error: `Preferensi ${LABEL[type]} sedang OFF.` });
    const { data: cfg } = await admin.from("telegram_bot_config").select("bot_token, enabled").limit(1).maybeSingle();
    if (!cfg?.bot_token || !cfg.enabled) return json({ status: "skipped", reason: "bot_off", error: "Bot Telegram sedang nonaktif." });

    const text = `🧪 <b>TEST — ${LABEL[type]}</b>\n\n${BODY[type]}\n\n<i>Ini pesan TEST. Saldo, pesanan, dan data tidak berubah.</i>`;
    const r = await tgSend(cfg.bot_token, { chat_id: link.telegram_chat_id, text, parse_mode: "HTML", disable_web_page_preview: true });
    const now = new Date().toISOString();
    await admin.from("telegram_test_log").insert({ visitor_id, type, ok: r.ok, message_id: r.message_id ?? null, error: r.ok ? null : (r.description || "").slice(0, 200) });
    console.log(JSON.stringify({ tg: "test", category: type, account: visitor_id.slice(0, 6) + "…", ok: r.ok, message_id: r.message_id, error_code: r.error_code, at: now }));
    if (r.ok) {
      await admin.from("telegram_user_links").update({ last_test_at: now, last_test_ok: true, last_success_at: now }).eq("id", link.id);
      return json({ status: "pass", message_id: r.message_id, per_type_remaining: Math.max(0, PER_TYPE - (usage[type] ?? 0) - 1), total_remaining: Math.max(0, TOTAL - rows.length - 1) });
    }
    const message = tgErrorMessage(r);
    await admin.from("telegram_user_links").update({ last_test_at: now, last_test_ok: false, last_error: message, last_error_at: now }).eq("id", link.id);
    return json({ status: "fail", error: message, error_code: r.error_code });
  } catch (e) {
    console.error("telegram-test-notif error:", e instanceof Error ? e.message : "unknown");
    return json({ status: "fail", error: "Kesalahan server." }, 500);
  }
});
