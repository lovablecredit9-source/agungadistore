import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  visitorId: z.string().trim().min(1, "Visitor ID tidak ditemukan"),
  waNumber: z.string().trim().min(9, "Nomor WA tidak valid").max(16, "Nomor WA terlalu panjang"),
  slotIndex: z.number().int().min(3).max(5, "Slot hanya tersedia 3-5"),
  method: z.enum(["balance", "qris"]),
  pin: z.string().optional(),
});

function normPhone(p: string): string | null {
  const d = String(p || "").replace(/\D/g, "");
  if (!d) return null;
  let n = d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("62") ? d : d.startsWith("8") ? "62" + d : d;
  if (n.length < 9 || n.length > 16) return null;
  return n;
}

function generateTrxId() {
  const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `WASLOT-${Date.now()}-${randomPart}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await request.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Data tidak valid" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Konfigurasi backend belum lengkap" }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { visitorId, waNumber: rawWa, slotIndex, method, pin } = parsed.data;
    const waNumber = normPhone(rawWa);
    if (!waNumber) {
      return Response.json({ error: "Nomor WA tidak valid" }, { status: 400, headers: corsHeaders });
    }

    // Check if user already has this number at any slot
    const { data: existingNumber } = await admin
      .from("user_wa_notif_numbers")
      .select("id, slot_index, is_paid, paid_until")
      .eq("visitor_id", visitorId)
      .eq("wa_number", waNumber)
      .maybeSingle();

    if (existingNumber) {
      return Response.json({ error: "Nomor WA sudah terdaftar. Hapus dulu sebelum mendaftarkan ulang." }, { status: 400, headers: corsHeaders });
    }

    // Count existing slots
    const { data: existingSlots } = await admin
      .from("user_wa_notif_numbers")
      .select("slot_index")
      .eq("visitor_id", visitorId)
      .order("slot_index", { ascending: true });

    const usedSlots = new Set((existingSlots || []).map((s) => s.slot_index));
    const maxSlot = usedSlots.size > 0 ? Math.max(...Array.from(usedSlots)) : 0;

    // Slot 1-2 are free; slot 3-5 require payment
    if (slotIndex <= 2) {
      return Response.json({ error: "Slot 1-2 gratis. Silakan tambah nomor dari menu Notifikasi WA tanpa bayar." }, { status: 400, headers: corsHeaders });
    }

    // Must fill slots sequentially (can't skip)
    if (slotIndex > maxSlot + 1) {
      return Response.json({ error: `Isi slot ${maxSlot + 1} dulu sebelum slot ${slotIndex}.` }, { status: 400, headers: corsHeaders });
    }

    // Check if slot already paid/active
    if (usedSlots.has(slotIndex)) {
      return Response.json({ error: `Slot ${slotIndex} sudah digunakan. Hapus dulu.` }, { status: 400, headers: corsHeaders });
    }

    const amount = 5000;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const trxId = generateTrxId();

    if (method === "balance") {
      // Verify PIN
      if (!pin) {
        return Response.json({ error: "PIN diperlukan untuk pembayaran saldo", needPin: true }, { status: 403, headers: corsHeaders });
      }
      const { data: pinRow } = await admin
        .from("user_pins")
        .select("pin_hash")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (!pinRow) {
        return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 200, headers: corsHeaders });
      }
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pin));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
      if (hashHex !== pinRow.pin_hash) {
        return Response.json({ error: "PIN salah", needPin: true }, { status: 403, headers: corsHeaders });
      }

      // Check balances: saldo IN dipakai dulu, kalau kurang baru saldo utama.
      const { data: gameBal } = await admin
        .from("game_balance")
        .select("id, amount, total_spent")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      const { data: balanceRow } = await admin
        .from("user_balances")
        .select("id, balance")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      const gameAmount = gameBal?.amount || 0;
      const mainAmount = balanceRow?.balance || 0;
      const payFromGame = Math.min(gameAmount, amount);
      const payFromMain = amount - payFromGame;

      if (mainAmount < payFromMain) {
        return Response.json({ error: `Saldo tidak cukup. Butuh Rp5.000. Saldo IN Rp${gameAmount.toLocaleString("id-ID")}, saldo utama Rp${mainAmount.toLocaleString("id-ID")}.` }, { status: 400, headers: corsHeaders });
      }

      if (payFromGame > 0 && gameBal) {
        const { error: gameError } = await admin
          .from("game_balance")
          .update({ amount: gameAmount - payFromGame, total_spent: (gameBal.total_spent || 0) + payFromGame })
          .eq("id", gameBal.id);
        if (gameError) {
          return Response.json({ error: "Gagal memotong saldo IN" }, { status: 500, headers: corsHeaders });
        }
        await admin.from("game_balance_transactions").insert({
          visitor_id: visitorId,
          type: "spend",
          amount: -payFromGame,
          description: `Bayar slot WA notifikasi #${slotIndex}`,
        });
      }

      if (payFromMain > 0 && balanceRow) {
        const { error: balanceError } = await admin
          .from("user_balances")
          .update({ balance: mainAmount - payFromMain })
          .eq("id", balanceRow.id);

        if (balanceError) {
          if (payFromGame > 0 && gameBal) await admin.from("game_balance").update({ amount: gameAmount, total_spent: gameBal.total_spent || 0 }).eq("id", gameBal.id);
          return Response.json({ error: "Gagal memotong saldo utama" }, { status: 500, headers: corsHeaders });
        }
      }

      // Record balance transaction
      if (payFromMain > 0) {
        const sourceLabel = payFromGame > 0 ? "Saldo IN + Saldo Utama" : "Saldo Utama";
        await admin.from("balance_transactions").insert({
          visitor_id: visitorId,
          type: "purchase",
          amount: -payFromMain,
          description: `Bayar slot WA notifikasi #${slotIndex} [${sourceLabel}]`,
        });
      }
    }

    // Insert slot payment record
    const { error: paymentError } = await admin.from("wa_slot_payments").insert({
      visitor_id: visitorId,
      wa_number: waNumber,
      slot_index: slotIndex,
      amount,
      paid_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      method,
      trx_id: trxId,
      status: "active",
    });

    if (paymentError) {
      return Response.json({ error: "Gagal mencatat pembayaran slot" }, { status: 500, headers: corsHeaders });
    }

    // Insert the WA number
    const { data: numberRow, error: numberError } = await admin
      .from("user_wa_notif_numbers")
      .insert({
        visitor_id: visitorId,
        wa_number: waNumber,
        label: `Slot ${slotIndex}`,
        is_paid: true,
        paid_until: expiresAt.toISOString(),
        slot_index: slotIndex,
      })
      .select("id, wa_number, slot_index, is_paid, paid_until")
      .single();

    if (numberError || !numberRow) {
      return Response.json({ error: "Gagal menambahkan nomor WA" }, { status: 500, headers: corsHeaders });
    }

    // WA notif
    try {
      const notifPromise = fetch(`${supabaseUrl}/functions/v1/send-wa-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          event_type: "purchase",
          notify_visitor_id: visitorId,
          vars: {
            trx_id: trxId,
            user: visitorId.slice(0, 8),
            produk: `Slot WA Notifikasi #${slotIndex}`,
            qty: 1,
            harga: amount.toLocaleString("id-ID"),
            metode: method.toUpperCase(),
          },
        }),
      }).catch((e) => { console.error("send-wa-notification failed:", e); });
      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(notifPromise);
      } else {
        await notifPromise;
      }
    } catch (e) { console.error("notif dispatch error:", e); }

    return Response.json({
      success: true,
      slot: numberRow,
      expires_at: expiresAt.toISOString(),
      trx_id: trxId,
    }, { headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
