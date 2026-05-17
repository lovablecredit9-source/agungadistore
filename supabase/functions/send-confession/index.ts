import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function priceFor(n: number): number {
  if (n <= 1) return 2000;
  if (n === 2) return 4000;
  if (n === 3) return 5000;
  return 0;
}

function normPhone(p: string): string | null {
  const d = String(p || "").replace(/\D/g, "");
  if (!d) return null;
  let n = d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("62") ? d : d.startsWith("8") ? "62" + d : d;
  if (n.length < 9 || n.length > 16) return null;
  return n;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

    if (!visitorId) return Response.json({ error: "Visitor tidak dikenal" }, { status: 400, headers: corsHeaders });
    if (message.length < 3) return Response.json({ error: "Pesan terlalu pendek" }, { status: 400, headers: corsHeaders });
    if (phones.length < 1 || phones.length > 3) return Response.json({ error: "Pilih 1-3 nomor tujuan" }, { status: 400, headers: corsHeaders });
    if (!/^\d{6}$/.test(pin)) return Response.json({ error: "PIN harus 6 digit", needPin: true }, { status: 400, headers: corsHeaders });

    const normalized: string[] = [];
    for (const p of phones) {
      const n = normPhone(p);
      if (!n) return Response.json({ error: `Nomor tidak valid: ${p}` }, { status: 400, headers: corsHeaders });
      if (!normalized.includes(n)) normalized.push(n);
    }
    const price = priceFor(normalized.length);
    if (!price) return Response.json({ error: "Jumlah nomor tidak didukung" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // PIN
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
    if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 403, headers: corsHeaders });
    if ((await sha256(pin)) !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 403, headers: corsHeaders });

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

    // === Cek thread mana yang masih FREE (tidak perlu bayar) ===
    const now = new Date();
    const { data: existingThreads } = await admin
      .from("confess_threads")
      .select("id, target_phone, free_until")
      .eq("visitor_id", visitorId)
      .in("target_phone", normalized);

    const freeMap = new Map<string, { id: string; free_until: string }>();
    (existingThreads || []).forEach((t: any) => {
      if (new Date(t.free_until) > now) freeMap.set(t.target_phone, t);
    });

    const paidPhones = normalized.filter((p) => !freeMap.has(p));
    const freePhones = normalized.filter((p) => freeMap.has(p));
    const chargePrice = paidPhones.length > 0 ? priceFor(paidPhones.length) : 0;

    if (bal.balance < chargePrice) {
      return Response.json({
        error: `Saldo kurang. Butuh Rp${chargePrice.toLocaleString("id-ID")} (${paidPhones.length} nomor baru, ${freePhones.length} gratis)`,
      }, { status: 400, headers: corsHeaders });
    }

    if (chargePrice > 0) {
      const { error: updErr } = await admin.from("user_balances").update({ balance: bal.balance - chargePrice }).eq("id", bal.id);
      if (updErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }

    const trxId = `CFS-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
    const { data: conf, error: cErr } = await admin
      .from("confessions")
      .insert({
        trx_id: trxId,
        sender_visitor_id: visitorId,
        sender_name: senderName || null,
        message,
        num_targets: normalized.length,
        total_price: chargePrice,
        status: "pending",
      })
      .select("id")
      .single();
    if (cErr || !conf) {
      if (chargePrice > 0) await admin.from("user_balances").update({ balance: bal.balance }).eq("id", bal.id);
      return Response.json({ error: "Gagal menyimpan confess" }, { status: 500, headers: corsHeaders });
    }

    await admin.from("confession_targets").insert(normalized.map((p) => ({ confession_id: conf.id, phone: p })));

    if (chargePrice > 0) {
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        type: "purchase",
        amount: chargePrice,
        description: `Confess ke ${paidPhones.length} nomor`,
        trx_id: trxId,
      });
    }

    // === Upsert threads + insert outbound message per nomor ===
    const preview = message.slice(0, 80);
    const newFreeUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    for (const phone of normalized) {
      const isFree = freeMap.has(phone);
      // Untuk nomor yang TIDAK gratis (dibayar) → set last_paid_at & extend free_until.
      // Untuk nomor gratis → biarkan free_until existing.
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
        .from("confess_threads")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("target_phone", phone)
        .maybeSingle();

      let threadId: string;
      if (existing) {
        await admin.from("confess_threads").update(updatePayload).eq("id", existing.id);
        threadId = existing.id;
      } else {
        const { data: ins } = await admin
          .from("confess_threads")
          .insert({
            visitor_id: visitorId,
            user_balance_id: ubId,
            target_phone: phone,
            sender_name: senderName || null,
            last_paid_at: now.toISOString(),
            free_until: newFreeUntil,
            last_message_at: now.toISOString(),
            last_message_preview: preview,
          })
          .select("id")
          .single();
        threadId = ins!.id;
      }

      await admin.from("confess_thread_messages").insert({
        thread_id: threadId,
        direction: "out",
        text: message,
        status: "pending",
        trx_id: trxId,
        is_free: isFree,
      });
    }

    return Response.json({
      success: true,
      trx_id: trxId,
      balance_remaining: bal.balance - chargePrice,
      charged: chargePrice,
      free_count: freePhones.length,
      paid_count: paidPhones.length,
    }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
