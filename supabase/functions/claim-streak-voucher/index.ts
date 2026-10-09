import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, code, action } = await req.json();
    if (action === "history") {
      if (!visitorId) return Response.json({ claims: [] }, { headers: corsHeaders });
      const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data } = await db.from("streak_voucher_claims").select("id, voucher_code, reward_type, reward_amount, reward_label, claimed_at, streak_vouchers(name)").eq("visitor_id", visitorId).order("claimed_at", { ascending: false }).limit(50);
      return Response.json({ claims: data ?? [] }, { headers: corsHeaders });
    }
    if (!visitorId || !code) {
      return Response.json({ error: "visitorId & code wajib diisi" }, { status: 200, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const cleanCode = String(code).trim().toUpperCase();

    // Ambil akun saldo aktif (untuk aturan 1 akun = 1 klaim & voucher target)
    const { data: blh } = await admin.from("balance_login_history").select("user_balance_id")
      .eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();

    // Validasi + kuota + hadiah + catatan klaim dalam SATU transaksi database.
    // Jika hadiah gagal, semuanya dibatalkan — tidak ada klaim "sukses" tanpa hadiah.
    const { data: res, error: rpcErr } = await admin.rpc("claim_streak_voucher_atomic", {
      p_visitor_id: visitorId, p_code: cleanCode, p_ub_id: blh?.user_balance_id ?? null,
    });
    if (rpcErr) {
      console.error("claim_streak_voucher_atomic failed", rpcErr.code);
      const dup = rpcErr.code === "23505";
      return Response.json({ error: dup ? "Akun ini sudah pernah klaim voucher tersebut" : "Gagal memberikan hadiah voucher. Tidak ada yang dipotong, coba lagi." }, { status: 200, headers: corsHeaders });
    }
    const r = res as Record<string, unknown>;
    if (!r?.success) return Response.json({ error: String(r?.error || "Gagal klaim voucher") }, { status: 200, headers: corsHeaders });

    const { error: notifErr } = await admin.rpc("create_notification", {
      p_visitor_id: visitorId, p_title: "🎁 Voucher Berhasil Diklaim!",
      p_message: `${r.voucher_name}: ${r.reward_label}`, p_type: "success", p_related_id: String(r.voucher_code),
    });
    if (notifErr) console.error("voucher notification failed", notifErr.code);

    return Response.json(r, { headers: corsHeaders });
  } catch (e) {
    console.error("claim-streak-voucher error", e instanceof Error ? e.message : e);
    return Response.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 200, headers: corsHeaders });
  }
});
