// Pembelian Music Storage. Harga/kapasitas/diskon dihitung server-side dari storage_packages
// lewat RPC atomik purchase_music_storage (potong saldo + transaksi + storage + voucher dalam 1 transaksi DB).
// Notifikasi Telegram dikirim SETELAH transaksi sukses via telegram-notify; kegagalannya tidak membatalkan pembelian.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyAccountPin } from "../_shared/pin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const rp = (n: number) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const size = (mb: number) => (mb >= 1024 ? `${+(mb / 1024).toFixed(mb % 1024 ? 1 : 0)} GB` : `${mb} MB`);
const esc = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

async function notifyTelegram(url: string, key: string, visitorId: string, r: any) {
  try {
    const exp = new Date(r.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
    const text = [
      "🎵 <b>PEMBELIAN MUSIC STORAGE BERHASIL</b>",
      "",
      `🧾 ID: ${esc(r.trx_id)}`,
      `📦 Paket: ${esc(r.tier_name)}`,
      `💰 Harga: ${rp(r.final_price)}${r.discount > 0 ? ` (normal ${rp(r.price)}, diskon ${rp(r.discount)})` : ""}`,
      `💳 Pembayaran: ${esc(r.source_label)}`,
      `💾 Storage: +${size(r.storage_mb)}`,
      `⏳ Durasi: 30 hari (sampai ${exp})`,
      "",
      "✅ Pembelian berhasil diproses.",
    ].join("\n");
    const res = await fetch(`${url}/functions/v1/telegram-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify({ visitor_id: visitorId, type: "purchase", text }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.ok === false) console.error("upgrade-storage telegram notify failed:", res.status, j?.reason || j?.error);
    return j?.ok ? (j.skipped ? `skipped:${j.reason}` : "sent") : `failed:${j?.reason || res.status}`;
  } catch (e) {
    console.error("upgrade-storage telegram notify error:", e);
    return "failed:network";
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action === "quote" ? "quote" : "purchase";
    const visitorId = String(body.visitorId || body.visitor_id || "").trim();
    const packageId = String(body.packageId || body.package_id || "").trim();
    const voucherCode = String(body.voucherCode || body.voucher_code || "").trim();
    const paymentSource = ["auto", "game", "main"].includes(body.paymentSource) ? body.paymentSource : "auto";
    const requestId = String(body.requestId || body.request_id || "").trim().slice(0, 80) || crypto.randomUUID();

    // Harga dari browser (price/tier_name/storage_mb) diabaikan — paket wajib dipilih lewat ID.
    if (!packageId) return reply({ error: "Pilih paket storage terlebih dahulu" }, 400);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !key) return reply({ error: "Konfigurasi backend belum lengkap" }, 500);
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    if (action === "quote") {
      const { data, error } = await admin.rpc("music_storage_quote", { p_package_id: packageId, p_voucher: voucherCode || null });
      if (error) return reply({ error: "Gagal menghitung harga" }, 500);
      if ((data as any)?.error) return reply(data, 404);
      return reply(data);
    }

    if (!visitorId) return reply({ error: "Visitor ID diperlukan" }, 400);
    if (!body.pin) return reply({ error: "PIN diperlukan", needPin: true }, 403);
    const pinErr = await verifyAccountPin(admin, visitorId, body.pin);
    if (pinErr) return reply({ error: pinErr, needPin: true }, 403);

    const { data, error } = await admin.rpc("purchase_music_storage", {
      p_visitor_id: visitorId, p_package_id: packageId, p_voucher: voucherCode || null, p_source: paymentSource, p_ref: requestId,
    });
    if (error) {
      console.error("purchase_music_storage error:", error);
      return reply({ error: "Pembelian gagal diproses. Saldo tidak terpotong." }, 500);
    }
    const r = data as any;
    if (r?.error) return reply({ error: r.error }, 400);

    // Ulangan request yang sama (double click / refresh) → tidak potong & tidak kirim notif lagi
    if (r.duplicate) return reply({ ...r, telegram: "skipped:duplicate" });

    const telegram = await notifyTelegram(url, key, visitorId, r);
    return reply({ ...r, telegram });
  } catch (error) {
    console.error("upgrade-storage error:", error);
    return reply({ error: error instanceof Error ? error.message : "Terjadi kesalahan" }, 500);
  }
});
