import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { visitor_id, code } = await request.json();

    if (!visitor_id || !code) {
      return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Konfigurasi backend belum lengkap" }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const normalizedCode = code.trim().toUpperCase();

    // Find voucher
    const { data: voucher, error: vErr } = await admin
      .from("music_storage_vouchers")
      .select("*")
      .eq("code", normalizedCode)
      .eq("is_active", true)
      .maybeSingle();

    if (vErr || !voucher) {
      return Response.json({ error: "Kode voucher tidak ditemukan atau tidak aktif" }, { status: 404, headers: corsHeaders });
    }

    // Check expiry
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      return Response.json({ error: "Voucher sudah expired" }, { status: 400, headers: corsHeaders });
    }

    // Check usage
    if (voucher.used_count >= voucher.max_uses) {
      return Response.json({ error: "Voucher sudah habis dipakai" }, { status: 400, headers: corsHeaders });
    }

    // Check if user already redeemed this code
    const { data: existing } = await admin
      .from("user_music_storage")
      .select("id")
      .eq("visitor_id", visitor_id)
      .eq("voucher_code", normalizedCode)
      .maybeSingle();

    if (existing) {
      return Response.json({ error: "Kamu sudah pernah menggunakan voucher ini" }, { status: 400, headers: corsHeaders });
    }

    // Insert user storage record
    const { error: insertErr } = await admin.from("user_music_storage").insert({
      visitor_id,
      storage_mb: voucher.storage_mb,
      voucher_code: normalizedCode,
      expires_at: voucher.expires_at,
    });

    if (insertErr) {
      return Response.json({ error: "Gagal menyimpan data storage" }, { status: 500, headers: corsHeaders });
    }

    // Increment used_count
    await admin
      .from("music_storage_vouchers")
      .update({ used_count: voucher.used_count + 1 })
      .eq("id", voucher.id);

    return Response.json(
      {
        success: true,
        storage_mb: voucher.storage_mb,
        expires_at: voucher.expires_at,
        message: `Berhasil mendapatkan ${formatStorage(voucher.storage_mb)} penyimpanan!`,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});

function formatStorage(mb: number): string {
  if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(0)}TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)}GB`;
  return `${mb}MB`;
}
