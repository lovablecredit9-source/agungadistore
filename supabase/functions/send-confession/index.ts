import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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


    if (!visitorId) return Response.json({ error: "Visitor tidak dikenal" }, { status: 400, headers: corsHeaders });
    if (message.length < 3) return Response.json({ error: "Pesan terlalu pendek" }, { status: 400, headers: corsHeaders });
    if (phones.length < 1 || phones.length > 15) return Response.json({ error: "Pilih 1-15 nomor tujuan" }, { status: 400, headers: corsHeaders });

    const normalized: string[] = [];
    for (const p of phones) {
      const n = normPhone(p);
      if (!n) return Response.json({ error: `Nomor tidak valid: ${p}` }, { status: 400, headers: corsHeaders });
      if (!normalized.includes(n)) normalized.push(n);
    }
    if (scheduledAt) {
      const diffMin = (scheduledAt.getTime() - Date.now()) / 60000;
      if (diffMin < 5) return Response.json({ error: "Jadwal minimal 5 menit dari sekarang" }, { status: 400, headers: corsHeaders });
      if (diffMin > 30 * 24 * 60) return Response.json({ error: "Jadwal maksimal 30 hari ke depan" }, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
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
        const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
        if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 403, headers: corsHeaders });
        if ((await sha256(pin)) !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 403, headers: corsHeaders });
      }

      if (sPrice > 0) await admin.from("user_balances").update({ balance: bal.balance - sPrice }).eq("id", bal.id);

      const trxId = `CFS-SCH-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
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
      }).select("id").single();
      if (schErr) {
        await admin.from("user_balances").update({ balance: bal.balance }).eq("id", bal.id);
        return Response.json({ error: "Gagal menjadwalkan: " + schErr.message }, { status: 500, headers: corsHeaders });
      }
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId, type: "purchase", amount: sPrice,
        description: `Confess terjadwal ${scheduledAt.toLocaleString("id-ID")}`, trx_id: trxId,
      });
      if (voucher) {
        await admin.from("confess_vouchers").update({ used_count: (voucher.used_count || 0) + 1 }).eq("id", voucher.id);
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
        balance_remaining: bal.balance - sPrice, charged: sPrice,
        voucher_discount: voucher ? (baseS - sPrice) : 0,
      }, { headers: corsHeaders });

    }

    // === Cek thread mana yang masih FREE (tidak perlu bayar) ===
    const now = new Date();
    const { data: existingThreads } = await admin
      .from("confess_threads")
      .select("id, target_phone, free_until")
      .eq("user_balance_id", ubId)
      .in("target_phone", normalized);

    const freeMap = new Map<string, { id: string; free_until: string }>();
    (existingThreads || []).forEach((t: any) => {
      if (new Date(t.free_until) > now) freeMap.set(t.target_phone, t);
    });

    const paidPhones = normalized.filter((p) => !freeMap.has(p));
    const freePhones = normalized.filter((p) => freeMap.has(p));
    let chargePrice = paidPhones.length > 0 ? priceForN(paidPhones.length, settings) : 0;
    let trialDiscount = 0;
    let trialGranted = false;

    if (chargePrice > 0) {
      const { data: usedByAccount } = await admin
        .from("confess_free_trial").select("id").eq("user_balance_id", ubId).maybeSingle();

      if (!usedByAccount) {
        const orFilters: string[] = [`visitor_id.eq.${visitorId}`];
        if (deviceFingerprint) orFilters.push(`device_fingerprint.eq.${deviceFingerprint}`);
        if (ipAddress) orFilters.push(`ip_address.eq.${ipAddress}`);

        const { data: abuse } = await admin
          .from("confess_free_trial").select("id, user_balance_id").or(orFilters.join(",")).limit(1).maybeSingle();

        if (abuse) {
          return Response.json({
            error: "⚠️ Anda melakukan kecurangan! Perangkat/IP ini sudah pernah klaim percobaan gratis Confess. Ganti akun tidak akan mengulang gratisan — silakan lanjut dengan saldo.",
            cheatDetected: true,
          }, { status: 403, headers: corsHeaders });
        }

        trialDiscount = Math.min(chargePrice, 2000);
        chargePrice = chargePrice - trialDiscount;
        trialGranted = true;
      }
    }

    // Apply voucher discount on top of trial
    const priceBeforeVoucher = chargePrice;
    let voucherDiscount = 0;
    if (voucher && chargePrice > 0) {
      voucherDiscount = Math.floor((chargePrice * voucherPct) / 100);
      chargePrice = Math.max(0, chargePrice - voucherDiscount);
    }

    if (bal.balance < chargePrice) {
      return Response.json({
        error: `Saldo kurang. Butuh Rp${chargePrice.toLocaleString("id-ID")} (${paidPhones.length} nomor baru, ${freePhones.length} gratis${trialDiscount > 0 ? ", diskon percobaan Rp" + trialDiscount.toLocaleString("id-ID") : ""}${voucherDiscount > 0 ? ", voucher -Rp" + voucherDiscount.toLocaleString("id-ID") : ""})`,
      }, { status: 400, headers: corsHeaders });
    }


    if (chargePrice > 0) {
      if (!/^\d{6}$/.test(pin)) return Response.json({ error: "PIN harus 6 digit", needPin: true }, { status: 400, headers: corsHeaders });
      const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
      if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 403, headers: corsHeaders });
      if ((await sha256(pin)) !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 403, headers: corsHeaders });
    }

    if (chargePrice > 0) {
      const { error: updErr } = await admin.from("user_balances").update({ balance: bal.balance - chargePrice }).eq("id", bal.id);
      if (updErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }

    if (trialGranted) {
      await admin.from("confess_free_trial").insert({
        visitor_id: visitorId, user_balance_id: ubId,
        ip_address: ipAddress, device_fingerprint: deviceFingerprint,
      });
    }

    const trxId = `CFS-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
    const { data: conf, error: cErr } = await admin
      .from("confessions").insert({
        trx_id: trxId, sender_visitor_id: visitorId,
        sender_name: senderName || null, message,
        num_targets: normalized.length, total_price: chargePrice, status: "pending",
      }).select("id").single();
    if (cErr || !conf) {
      if (chargePrice > 0) await admin.from("user_balances").update({ balance: bal.balance }).eq("id", bal.id);
      return Response.json({ error: "Gagal menyimpan confess" }, { status: 500, headers: corsHeaders });
    }

    const { data: targets, error: targetErr } = await admin
      .from("confession_targets")
      .insert(normalized.map((p) => ({ confession_id: conf.id, phone: p })))
      .select("id, phone");
    if (targetErr || !targets) {
      if (chargePrice > 0) await admin.from("user_balances").update({ balance: bal.balance }).eq("id", bal.id);
      return Response.json({ error: "Gagal menyimpan nomor tujuan" }, { status: 500, headers: corsHeaders });
    }
    const targetIdByPhone = new Map<string, string>((targets as any[]).map((t) => [t.phone, t.id]));

    if (chargePrice > 0) {
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId, type: "purchase", amount: chargePrice,
        description: `Confess ke ${paidPhones.length} nomor`, trx_id: trxId,
      });
    }

    // Voucher redemption log + increment
    if (voucher) {
      await admin.from("confess_vouchers").update({ used_count: (voucher.used_count || 0) + 1 }).eq("id", voucher.id);
      await admin.from("confess_voucher_redemptions").insert({
        voucher_id: voucher.id, voucher_code: voucher.code, visitor_id: visitorId, user_balance_id: ubId,
        discount_percent: voucherPct, original_price: priceBeforeVoucher, final_price: chargePrice,
      });
    }



    const preview = (moodTag ? `[${moodTag}] ` : "") + message.slice(0, 80);
    const newFreeUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    for (const phone of normalized) {
      const isFree = freeMap.has(phone);
      const updatePayload: any = {
        last_message_at: now.toISOString(),
        last_message_preview: preview,
        sender_name: senderName || null,
        user_balance_id: ubId,
      };
      if (!isFree) {
        updatePayload.last_paid_at = now.toISOString();
        updatePayload.free_until = newFreeUntil;
      }

      const { data: existing } = await admin
        .from("confess_threads").select("id")
        .eq("user_balance_id", ubId).eq("target_phone", phone).maybeSingle();

      let threadId: string;
      if (existing) {
        await admin.from("confess_threads").update(updatePayload).eq("id", existing.id);
        threadId = existing.id;
      } else {
        const { data: ins } = await admin
          .from("confess_threads").insert({
            visitor_id: visitorId, user_balance_id: ubId,
            target_phone: phone, sender_name: senderName || null,
            last_paid_at: now.toISOString(), free_until: newFreeUntil,
            last_message_at: now.toISOString(), last_message_preview: preview,
          }).select("id").single();
        threadId = ins!.id;
      }

      await admin.from("confess_thread_messages").insert({
        thread_id: threadId, direction: "out", text: message, status: "pending",
        trx_id: trxId, is_free: isFree, target_id: targetIdByPhone.get(phone) || null,
        mood_tag: moodTag, is_voice: isVoice,
      });
    }

    // Publish to Wall (anonymous)
    if (shareToWall) {
      const maskedPhones = normalized.map(maskPhone).join(", ");
      await admin.from("confess_public_wall").insert({
        confession_id: conf.id,
        visitor_id: visitorId,
        sender_name: senderName || null,
        masked_phone: maskedPhones,
        message,
        mood_tag: moodTag,
      });
    }

    if (settings.notifyPurchase) {
      await notifyAdminWa(admin, settings.adminWa,
        `🆕 *Pembelian Confess*\nTRX: ${trxId}\nDari: ${senderName || "Anonim"} (${visitorId.slice(0,8)})\nKe: ${normalized.length} nomor (${paidPhones.length} bayar, ${freePhones.length} gratis)\nHarga: Rp${chargePrice.toLocaleString("id-ID")}${trialDiscount ? ` (diskon trial Rp${trialDiscount.toLocaleString("id-ID")})` : ""}${shareToWall ? "\n📢 Dibagikan ke Wall Publik" : ""}${moodTag ? `\nMood: ${moodTag}` : ""}`);
    }


    return Response.json({
      success: true, trx_id: trxId,
      balance_remaining: bal.balance - chargePrice, charged: chargePrice,
      free_count: freePhones.length, paid_count: paidPhones.length,
      trial_discount: trialDiscount, trial_granted: trialGranted,
      voucher_discount: voucherDiscount,
      voucher_code: voucher?.code || null,
      shared_to_wall: shareToWall,
    }, { headers: corsHeaders });

  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
