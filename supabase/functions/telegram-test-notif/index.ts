// Kirim notifikasi TEST ke Telegram user. Limit: 2x per jam per visitor.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type NotifType = "deposit" | "purchase" | "login" | "admin_message" | "balance_change";
const NOTIF_FIELD: Record<NotifType, string> = {
  deposit: "notif_deposit",
  purchase: "notif_purchase",
  login: "notif_login",
  admin_message: "notif_admin_message",
  balance_change: "notif_balance_change",
};

const SAMPLE: Record<NotifType, string> = {
  deposit: "🧪 <b>TEST — Deposit Masuk</b>\n\n💰 Jumlah: <b>Rp 50.000</b>\n📌 Metode: QRIS\n🆔 TX: #TEST123\n\n<i>Ini hanya simulasi. Saldo tidak berubah.</i>",
  purchase: "🧪 <b>TEST — Pembelian Berhasil</b>\n\n📦 Produk: <b>Contoh Produk</b>\n💵 Total: <b>Rp 10.000</b>\n🆔 Order: #TEST456\n\n<i>Ini hanya simulasi. Tidak ada order yang dibuat.</i>",
  login: "🧪 <b>TEST — Login Perangkat Baru</b>\n\n📱 Device: Chrome / Android\n🌍 Lokasi: Indonesia\n🕒 Waktu: sekarang\n\n<i>Ini hanya simulasi keamanan.</i>",
  admin_message: "🧪 <b>TEST — Pesan Admin</b>\n\n💬 Halo! Ini contoh pesan dari admin Agung Adi Store.\n\n<i>Ini hanya simulasi.</i>",
  balance_change: "🧪 <b>TEST — Perubahan Saldo</b>\n\n💵 Saldo IN: +Rp 5.000\n🪙 Koin: +100\n💎 Gem: +5\n\n<i>Ini hanya simulasi.</i>",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const body = await req.json().catch(() => ({} as any));
    const visitor_id = String(body.visitor_id || "").trim();
    const type = String(body.type || "").trim() as NotifType;
    if (!visitor_id || !type || !NOTIF_FIELD[type]) return json({ error: "invalid params" }, 400);

    // Rate limit: 2x per type + 10x total per jam
    const PER_TYPE = 2;
    const TOTAL = 10;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("telegram_test_log")
      .select("type, created_at")
      .eq("visitor_id", visitor_id)
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: true });
    const rows = recent ?? [];
    const totalUsed = rows.length;
    const typeRows = rows.filter((r: any) => r.type === type);
    const typeUsed = typeRows.length;

    if (typeUsed >= PER_TYPE) {
      const first = new Date((typeRows[0] as any).created_at).getTime();
      const waitMin = Math.max(1, Math.ceil((first + 3600_000 - Date.now()) / 60000));
      return json({ error: `Limit tombol ini tercapai (${PER_TYPE}×/jam). Coba lagi ~${waitMin} menit.`, rate_limited: true, wait_minutes: waitMin }, 429);
    }
    if (totalUsed >= TOTAL) {
      const first = new Date((rows[0] as any).created_at).getTime();
      const waitMin = Math.max(1, Math.ceil((first + 3600_000 - Date.now()) / 60000));
      return json({ error: `Limit total test tercapai (${TOTAL}×/jam). Coba lagi ~${waitMin} menit.`, rate_limited: true, wait_minutes: waitMin }, 429);
    }

    // Ambil link + cek preferensi & enabled
    const { data: link } = await admin
      .from("telegram_user_links")
      .select(`telegram_chat_id, enabled, ${NOTIF_FIELD[type]}`)
      .eq("visitor_id", visitor_id)
      .maybeSingle();
    if (!link) return json({ error: "Belum terhubung ke Telegram." }, 400);
    if (!link.enabled) return json({ error: "Notifikasi Telegram sedang OFF. Aktifkan dulu." }, 400);
    if (!(link as any)[NOTIF_FIELD[type]]) return json({ error: "Preferensi notif ini sedang dimatikan." }, 400);

    const { data: cfg } = await admin.from("telegram_bot_config").select("bot_token, enabled").limit(1).maybeSingle();
    if (!cfg?.bot_token || !cfg.enabled) return json({ error: "Bot Telegram sedang offline." }, 400);

    const resp = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: (link as any).telegram_chat_id,
        text: SAMPLE[type],
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const rj = await resp.json();
    if (!rj.ok) {
      console.error("tg send fail", rj);
      return json({ error: rj.description || "Gagal kirim." }, 400);
    }

    // Log sukses
    await admin.from("telegram_test_log").insert({ visitor_id, type });
    return json({
      ok: true,
      per_type_used: typeUsed + 1,
      per_type_remaining: Math.max(0, PER_TYPE - (typeUsed + 1)),
      total_used: totalUsed + 1,
      total_remaining: Math.max(0, TOTAL - (totalUsed + 1)),
    });
  } catch (e) {
    console.error("telegram-test-notif error:", e);
    return json({ error: e instanceof Error ? e.message : "internal" }, 500);
  }
});
