import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREEZE_PRICE = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { visitorId, pin } = await req.json();

    if (!visitorId) {
      return Response.json({ error: "Visitor ID diperlukan" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get balance account (akun saldo aktif untuk visitor ini)
    const { data: balanceRow } = await admin.from("user_balances").select("id, balance, visitor_id").eq("visitor_id", visitorId).maybeSingle();
    if (!balanceRow) return Response.json({ error: "Akun saldo tidak ditemukan. Login/daftar saldo dulu di tab Plus → Saldo Saya." }, { status: 404, headers: corsHeaders });

    // Verify PIN — cari PIN berdasarkan visitor_id akun saldo (bukan browser visitor)
    // Cek di kedua kemungkinan: visitor request ATAU visitor akun saldo
    const { data: pinRows } = await admin
      .from("user_pins")
      .select("pin_hash, visitor_id")
      .in("visitor_id", [visitorId, balanceRow.visitor_id]);

    const pinRow = pinRows && pinRows.length > 0 ? pinRows[0] : null;
    if (!pinRow) return Response.json({ error: "PIN belum dibuat. Buat PIN di tab Plus → Saldo Saya.", needPin: true }, { status: 403, headers: corsHeaders });
    if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 403, headers: corsHeaders });
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pin));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah" }, { status: 403, headers: corsHeaders });

    if (balanceRow.balance < FREEZE_PRICE) return Response.json({ error: "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });

    // Get current streak record
    const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();

    if (!streak) {
      return Response.json({ error: "Belum ada streak. Klaim dulu hari ini!" }, { status: 400, headers: corsHeaders });
    }

    // Deduct balance
    const { error: balErr } = await admin.from("user_balances").update({ balance: balanceRow.balance - FREEZE_PRICE }).eq("id", balanceRow.id);
    if (balErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });

    // Add freeze
    const { error: updErr } = await admin.from("daily_streaks").update({
      freeze_count: (streak.freeze_count || 0) + 1,
    }).eq("id", streak.id);

    if (updErr) {
      await admin.from("user_balances").update({ balance: balanceRow.balance }).eq("id", balanceRow.id);
      return Response.json({ error: "Gagal menambah pelindung" }, { status: 500, headers: corsHeaders });
    }

    // Record transaction
    await admin.from("balance_transactions").insert({
      visitor_id: visitorId,
      type: "purchase",
      amount: FREEZE_PRICE,
      description: "Beli Streak Freeze (Pelindung Streak)",
    });

    return Response.json({
      success: true,
      freeze_count: (streak.freeze_count || 0) + 1,
      balance_remaining: balanceRow.balance - FREEZE_PRICE,
    }, { headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
