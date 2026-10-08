import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyAccountPin } from "../_shared/pin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function loadSettings(admin: any) {
  const { data } = await admin.from("admin_settings").select("setting_key, setting_value")
    .in("setting_key", ["confess_price_1","confess_price_2","confess_price_3","confess_admin_wa","confess_notify_purchase"]);
  const map = new Map<string, string>((data || []).map((r: any) => [r.setting_key, r.setting_value]));
  return {
    price1: parseInt(map.get("confess_price_1") || "2000", 10) || 2000,
    price2: parseInt(map.get("confess_price_2") || "4000", 10) || 4000,
    price3: parseInt(map.get("confess_price_3") || "5000", 10) || 5000,
    adminWa: (map.get("confess_admin_wa") || "").replace(/\D/g, ""),
    notifyPurchase: (map.get("confess_notify_purchase") || "on") === "on",
  };
}
function priceForN(n: number, s: { price1: number; price2: number; price3: number }) {
  // Tier per jumlah nomor: 1=2k, 2=4k, 3=5k, 5=6k, 10=7k, 15=8k.
  // Jumlah di antara tier dibulatkan ke tier berikutnya.
  if (n <= 0) return 0;
  if (n === 1) return s.price1;
  if (n === 2) return s.price2;
  if (n === 3) return s.price3;
  if (n <= 5) return 6000;
  if (n <= 10) return 7000;
  if (n <= 15) return 8000;
  return 0;
}
async function notifyAdminWa(admin: any, adminWa: string, text: string) {
  if (!adminWa || adminWa.length < 9) return;
  const visitorKey = "system_admin_notif";
  let threadId: string | null = null;
  const { data: existing } = await admin.from("confess_threads")
    .select("id").eq("visitor_id", visitorKey).eq("target_phone", adminWa).maybeSingle();
  if (existing?.id) threadId = existing.id;
  else {
    const { data: ins } = await admin.from("confess_threads").insert({
      visitor_id: visitorKey, target_phone: adminWa, sender_name: "Sistem Confess",
      last_message_preview: text.slice(0, 80),
    }).select("id").single();
    threadId = ins?.id || null;
  }
  if (!threadId) return;
  await admin.from("confess_thread_messages").insert({
    thread_id: threadId, direction: "out", text, status: "pending", is_free: true,
  });
  await admin.from("confess_threads").update({
    last_message_at: new Date().toISOString(), last_message_preview: text.slice(0, 80),
  }).eq("id", threadId);
}

function normPhone(p: string): string | null {
  const d = String(p || "").replace(/\D/g, "");
  if (!d) return null;
  let n = d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("62") ? d : d.startsWith("8") ? "62" + d : d;
  if (n.length < 9 || n.length > 16) return null;
  return n;
}

function maskPhone(p: string): string {
  // 6281234567890 -> 0812****7890
  if (!p) return "****";
  const local = p.startsWith("62") ? "0" + p.slice(2) : p;
  if (local.length < 6) return local;
  return local.slice(0, 4) + "****" + local.slice(-4);
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateVoucher(admin: any, code: string | null) {
  if (!code) return { ok: true, voucher: null as any };
  const { data: v } = await admin.from("confess_vouchers").select("*").eq("code", code).maybeSingle();
  if (!v) return { ok: false, error: "Kode voucher tidak ditemukan" };
  if (!v.is_active) return { ok: false, error: "Voucher tidak aktif" };
  if (v.expires_at && new Date(v.expires_at) <= new Date()) return { ok: false, error: "Voucher kadaluarsa" };
  if (v.used_count >= v.max_uses) return { ok: false, error: "Voucher sudah habis dipakai" };
  return { ok: true, voucher: v };
}

async function findThread(admin: any, visitorId: string, userBalanceId: string, phone: string) {
  const { data } = await admin
    .from("confess_threads")
    .select("id")
    .eq("target_phone", phone)
    .or(`user_balance_id.eq.${userBalanceId},visitor_id.eq.${visitorId}`)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ? data : null;
}

Deno.serve(async (req) => {

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const visitorId = String(body.visitorId || "").trim();
    const senderName = String(body.senderName || "").trim().slice(0, 40);
    const message = String(body.message || "").trim().slice(0, 800);
    const phones: string[] = Array.isArray(body.phones) ? body.phones : [];
    const pin = String(body.pin || "");
    const deviceFingerprint = String(body.deviceFingerprint || "").trim().slice(0, 200) || null;
    const ipAddress = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "").split(",")[0].trim() || null;
    // NEW
    const moodTag = String(body.moodTag || "").trim().slice(0, 20) || null;
    const shareToWall = !!body.shareToWall;
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    const isVoice = !!body.isVoice;
    const voucherCode = String(body.voucherCode || "").trim().toUpperCase().slice(0, 40) || null;
    const mediaUrl = body.mediaUrl ? String(body.mediaUrl).trim().slice(0, 1000) : null;
    const mediaType = body.mediaType ? String(body.mediaType).trim().slice(0, 20) : null;
    const mediaName = body.mediaName ? String(body.mediaName).trim().slice(0, 200) : null;
    const mediaMime = body.mediaMime ? String(body.mediaMime).trim().slice(0, 100) : null;
    const mediaSize = Number(body.mediaSize) || null;
    const requestedTrxId = body.trxId ? String(body.trxId).trim().slice(0, 80) : null;
    const action = String(body.action || "send");
    const useFreeSend = !!body.useFreeSend;
    // Nama penerima per nomor (label dari pengirim; nomor tetap identifier utama)
    const rawNames: Record<string, unknown> = body.names && typeof body.names === "object" ? body.names : {};


    if (!visitorId) return Response.json({ error: "Visitor tidak dikenal" }, { status: 400, headers: corsHeaders });
    if (String(body.message || "").trim().length > 800) return Response.json({ error: "Pesan maksimal 800 karakter" }, { status: 400, headers: corsHeaders });
    if (action !== "quote" && message.length < 3 && !mediaUrl) return Response.json({ error: "Pesan terlalu pendek" }, { status: 400, headers: corsHeaders });
    if (phones.length < 1 || phones.length > 15) return Response.json({ error: "Pilih 1-15 nomor tujuan" }, { status: 400, headers: corsHeaders });

    const normalized: string[] = [];
    const names: Record<string, string> = {};
    for (const p of phones) {
      const n = normPhone(p);
      if (!n) return Response.json({ error: `Nomor WhatsApp tidak valid: ${p}` }, { status: 400, headers: corsHeaders });
      if (!normalized.includes(n)) normalized.push(n);
      const nm = String(rawNames[p] ?? rawNames[n] ?? "").trim().slice(0, 40);
      if (nm && !names[n]) names[n] = nm;
    }
    if (scheduledAt) {
      const diffMin = (scheduledAt.getTime() - Date.now()) / 60000;
      if (diffMin < 5) return Response.json({ error: "Jadwal minimal 5 menit dari sekarang" }, { status: 400, headers: corsHeaders });
      if (diffMin > 30 * 24 * 60) return Response.json({ error: "Jadwal maksimal 30 hari ke depan" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Konfigurasi backend belum lengkap" }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Batas jumlah nomor: default 10, naik ke 15 jika punya langganan aktif
    let maxNumbers = 10;
    {
      const { data: subRow } = await admin
        .from("confess_number_subscriptions")
        .select("max_numbers, expires_at")
        .eq("visitor_id", visitorId)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subRow?.max_numbers) maxNumbers = subRow.max_numbers;
    }
    if (normalized.length > maxNumbers) {
      return Response.json({ error: maxNumbers >= 15 ? "Maksimal 15 nomor." : "Maksimal 10 nomor. Berlangganan Rp10.000/bulan untuk kirim hingga 15 nomor sekaligus.", needSubscription: maxNumbers < 15 }, { status: 400, headers: corsHeaders });
    }

    const settings = await loadSettings(admin);
    const price = priceForN(normalized.length, settings);
    if (!price) return Response.json({ error: "Jumlah nomor tidak didukung" }, { status: 400, headers: corsHeaders });

    // === Validate voucher (if provided) ===
    const voucherRes = await validateVoucher(admin, voucherCode);
    if (!voucherRes.ok) return Response.json({ error: voucherRes.error }, { status: 400, headers: corsHeaders });
    const voucher = voucherRes.voucher;
    const voucherPct = voucher?.discount_percent || 0;




    // Balance
    const { data: hist } = await admin
      .from("balance_login_history")
      .select("user_balance_id")
      .eq("visitor_id", visitorId)
      .order("logged_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ubId = hist?.user_balance_id;
    if (!ubId) return Response.json({ error: "Akun saldo tidak ditemukan", needLogin: true }, { status: 404, headers: corsHeaders });

    const { data: bal } = await admin.from("user_balances").select("id, balance").eq("id", ubId).maybeSingle();
    if (!bal) return Response.json({ error: "Saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });

    // === Scheduling path: charge full price (no free-window discount for scheduled) ===
    if (scheduledAt) {
      const baseS = price;
      const voucherDiscS = voucher ? Math.floor((baseS * voucherPct) / 100) : 0;
      const sPrice = Math.max(0, baseS - voucherDiscS);
      if (bal.balance < sPrice) {
        return Response.json({ error: `Saldo kurang. Butuh Rp${sPrice.toLocaleString("id-ID")} untuk menjadwalkan.` }, { status: 400, headers: corsHeaders });
      }
      if (sPrice > 0) {
        if (!/^\d{6}$/.test(pin)) return Response.json({ error: "PIN harus 6 digit", needPin: true }, { status: 400, headers: corsHeaders });
        const pinErr = await verifyAccountPin(admin, visitorId, pin);
        if (pinErr) return Response.json({ error: pinErr, needPin: true }, { status: 403, headers: corsHeaders });
      }

      // Idempotent: jadwal dengan trx yang sama tidak boleh memotong saldo dua kali
      if (requestedTrxId) {
        const { data: dupe } = await admin.from("confess_scheduled").select("id, trx_id, price_charged").eq("trx_id", requestedTrxId).maybeSingle();
        if (dupe) return Response.json({ success: true, duplicate: true, scheduled: true, scheduled_id: dupe.id, trx_id: dupe.trx_id, charged: dupe.price_charged }, { headers: corsHeaders });
      }
      let balAfter = bal.balance;
      if (sPrice > 0) {
        const { data: left, error: consumeErr } = await admin.rpc("consume_main_balance_only", { p_balance_id: bal.id, p_amount: sPrice });
        if (consumeErr) {
          const insufficient = /INSUFFICIENT/i.test(consumeErr.message);
          return Response.json({ error: insufficient ? `Saldo kamu tidak cukup. Pembayaran membutuhkan Rp${sPrice.toLocaleString("id-ID")}.` : "Gagal memotong saldo" }, { status: insufficient ? 402 : 500, headers: corsHeaders });
        }
        balAfter = Number(left);
      }

      const trxId = requestedTrxId?.startsWith("CFS-") ? requestedTrxId : `CFS-SCH-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
      const { data: sched, error: schErr } = await admin.from("confess_scheduled").insert({
        visitor_id: visitorId,
        user_balance_id: ubId,
        sender_name: senderName || null,
        target_phones: normalized,
        message,
        mood_tag: moodTag,
        share_to_wall: shareToWall,
        scheduled_at: scheduledAt.toISOString(),
        price_charged: sPrice,
        trx_id: trxId,
        media_url: mediaUrl,
        media_type: mediaType,
        media_name: mediaName,
        media_mime: mediaMime,
        media_size: mediaSize,
      }).select("id").single();
      if (schErr || !sched?.id) {
        if (sPrice > 0) await admin.rpc("refund_main_balance_only", { p_balance_id: bal.id, p_amount: sPrice });
        return Response.json({ error: "Gagal menjadwalkan, saldo dikembalikan: " + (schErr?.message || "data jadwal tidak dibuat") }, { status: 500, headers: corsHeaders });
      }
      if (sPrice > 0) await admin.from("balance_transactions").insert({
        visitor_id: visitorId, type: "purchase", amount: sPrice,
        description: `Confess terjadwal ${scheduledAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`, trx_id: trxId,
      });
      if (voucher) {
        await admin.from("confess_vouchers").update({ used_count: (voucher.used_count || 0) + 1 }).eq("id", voucher.id).eq("used_count", voucher.used_count || 0);
        await admin.from("confess_voucher_redemptions").insert({
          voucher_id: voucher.id, voucher_code: voucher.code, visitor_id: visitorId, user_balance_id: ubId,
          discount_percent: voucherPct, original_price: baseS, final_price: sPrice,
        });
      }
      if (settings.notifyPurchase) {
        await notifyAdminWa(admin, settings.adminWa,
          `🆕 *Confess Terjadwal*\nTRX: ${trxId}\nDari: ${senderName || "Anonim"} (${visitorId.slice(0,8)})\nKe: ${normalized.length} nomor\nJadwal: ${scheduledAt.toLocaleString("id-ID")}\nHarga: Rp${sPrice.toLocaleString("id-ID")}${voucher ? ` (voucher ${voucher.code} -${voucherPct}%)` : ""}`);
      }
      return Response.json({
        success: true, scheduled: true, scheduled_id: sched.id, trx_id: trxId,
        balance_remaining: balAfter, charged: sPrice,
        voucher_discount: voucher ? (baseS - sPrice) : 0,
      }, { headers: corsHeaders });

    }

    // === Pembayaran instan: atomic + idempotent di database (confess_checkout) ===
    const rpcPayload: Record<string, unknown> = {
      visitor_id: visitorId, user_balance_id: ubId, trx_id: requestedTrxId,
      phones: normalized, names, sender_name: senderName, message,
      mood_tag: moodTag, is_voice: isVoice, share_to_wall: shareToWall,
      voucher_code: voucherCode, use_free_send: useFreeSend,
      ip_address: ipAddress, device_fingerprint: deviceFingerprint,
      media_url: mediaUrl, media_type: mediaType, media_name: mediaName, media_mime: mediaMime, media_size: mediaSize,
    };
    const { data: quote, error: qErr } = await admin.rpc("confess_checkout", { p: { ...rpcPayload, dry_run: true } });
    if (qErr) return Response.json({ error: "Gagal menghitung harga: " + qErr.message }, { status: 500, headers: corsHeaders });
    if ((quote as any)?.error) return Response.json(quote, { status: 400, headers: corsHeaders });
    if (action === "quote") return Response.json(quote, { headers: corsHeaders });

    // PIN hanya diverifikasi di server, hanya jika memang ada biaya
    let pinVerified = false;
    if (Number((quote as any)?.total || 0) > 0) {
      if (!/^\d{6}$/.test(pin)) return Response.json({ error: "Masukkan PIN 6 digit", needPin: true, code: "need_pin" }, { status: 400, headers: corsHeaders });
      const pinErr = await verifyAccountPin(admin, visitorId, pin);
      if (pinErr) return Response.json({ error: pinErr, needPin: true, code: "pin" }, { status: 403, headers: corsHeaders });
      pinVerified = true;
    }

    const { data: result, error: rpcErr } = await admin.rpc("confess_checkout", { p: { ...rpcPayload, pin_verified: pinVerified } });
    if (rpcErr) return Response.json({ error: "Pembayaran gagal diproses, saldo tidak dipotong. " + rpcErr.message }, { status: 500, headers: corsHeaders });
    const r: any = result || {};
    if (r.error) {
      const status = r.code === "need_pin" ? 400 : r.code === "insufficient" ? 402 : 400;
      return Response.json({ ...r, needPin: r.code === "need_pin" }, { status, headers: corsHeaders });
    }

    if (settings.notifyPurchase && !r.duplicate) {
      try {
        await notifyAdminWa(admin, settings.adminWa,
          `🆕 *Pembelian Confess*\nTRX: ${r.trx_id}\nDari: ${senderName || "Anonim"} (${visitorId.slice(0,8)})\nKe: ${normalized.length} nomor (${r.paid_count} bayar, ${r.free_count} gratis)\nHarga: Rp${Number(r.charged || 0).toLocaleString("id-ID")}${r.trial_discount ? ` (diskon trial Rp${Number(r.trial_discount).toLocaleString("id-ID")})` : ""}${r.voucher_code ? ` (voucher ${r.voucher_code})` : ""}${r.free_send_used ? " (🎁 gratis kirim)" : ""}${shareToWall ? "\n📢 Dibagikan ke Wall Publik" : ""}${moodTag ? `\nMood: ${moodTag}` : ""}`);
      } catch (_) { /* notifikasi admin tidak boleh membatalkan pembelian */ }
    }

    return Response.json({ ...r, shared_to_wall: shareToWall }, { headers: corsHeaders });

  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
