import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REWARD = 2000; // Rp per pihak
const VOUCHER_DAYS = 30;

async function resolveBalance(sb: any, visitorId: string) {
  const { data: hist } = await sb
    .from("balance_login_history")
    .select("user_balance_id")
    .eq("visitor_id", visitorId)
    .order("logged_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let ubId = hist?.user_balance_id || null;
  if (!ubId) {
    const { data: ub } = await sb.from("user_balances").select("id").eq("visitor_id", visitorId).maybeSingle();
    ubId = ub?.id || null;
  }
  return ubId;
}

function genCode() {
  return "REF-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function makeVoucher(sb: any, visitorId: string, ubId: string, note: string) {
  // Hadiah referral langsung masuk sebagai SALDO (bukan voucher diskon biasa).
  const { data: ub } = await sb.from("user_balances").select("balance").eq("id", ubId).maybeSingle();
  const current = Number(ub?.balance || 0);
  await sb.from("user_balances").update({ balance: current + REWARD }).eq("id", ubId);

  const trxId = "REF" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
  await sb.from("balance_transactions").insert({
    visitor_id: visitorId,
    type: "topup",
    amount: REWARD,
    description: `Bonus referral (saldo) - ${note}`,
    trx_id: trxId,
  });

  try {
    await sb.rpc("create_notification", {
      p_visitor_id: visitorId,
      p_title: "💰 Bonus Saldo Referral Rp 2.000",
      p_message: `${note} Saldo Rp ${REWARD.toLocaleString("id-ID")} sudah masuk ke akunmu.`,
      p_type: "success",
      p_related_id: trxId,
    });
  } catch (_) { /* ignore */ }
  return { code: trxId, expires: null };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "get");
    const visitorId = String(body.visitorId || "").trim();
    if (!visitorId) return Response.json({ error: "visitorId wajib" }, { status: 400, headers: corsHeaders });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const ubId = await resolveBalance(sb, visitorId);
    if (!ubId) return Response.json({ error: "Login akun saldo dulu untuk pakai referral." }, { status: 200, headers: corsHeaders });

    // === GET: ambil/buat kode + statistik ===
    if (action === "get") {
      let { data: rec } = await sb.from("store_referral_codes").select("*").eq("user_balance_id", ubId).maybeSingle();
      if (!rec) {
        let code = "";
        for (let i = 0; i < 6; i++) {
          code = genCode();
          const { data: exist } = await sb.from("store_referral_codes").select("id").eq("code", code).maybeSingle();
          if (!exist) break;
        }
        const { data: ins } = await sb.from("store_referral_codes")
          .insert({ user_balance_id: ubId, visitor_id: visitorId, code })
          .select("*").single();
        rec = ins;
      }
      // Apakah akun ini sudah pernah memakai kode orang lain?
      const { data: usedByMe } = await sb.from("store_referral_uses").select("code").eq("referred_balance_id", ubId).maybeSingle();
      return Response.json({
        code: rec.code,
        uses_count: rec.uses_count,
        total_reward: rec.total_reward,
        already_redeemed: !!usedByMe,
        reward: REWARD,
      }, { headers: corsHeaders });
    }

    // === REDEEM: pakai kode teman ===
    if (action === "redeem") {
      const inputCode = String(body.code || "").trim().toUpperCase();
      if (!inputCode) return Response.json({ error: "Masukkan kode referral." }, { status: 200, headers: corsHeaders });

      const { data: ref } = await sb.from("store_referral_codes").select("*").eq("code", inputCode).maybeSingle();
      if (!ref) return Response.json({ error: "Kode referral tidak ditemukan." }, { status: 200, headers: corsHeaders });
      if (ref.user_balance_id === ubId) return Response.json({ error: "Tidak bisa memakai kode sendiri." }, { status: 200, headers: corsHeaders });

      const { data: already } = await sb.from("store_referral_uses").select("id").eq("referred_balance_id", ubId).maybeSingle();
      if (already) return Response.json({ error: "Kamu sudah pernah memakai kode referral." }, { status: 200, headers: corsHeaders });

      // Catat pemakaian (unique referred_balance_id mencegah double)
      const { error: useErr } = await sb.from("store_referral_uses").insert({
        code: inputCode,
        referrer_balance_id: ref.user_balance_id,
        referred_balance_id: ubId,
        referred_visitor_id: visitorId,
        reward_amount: REWARD,
      });
      if (useErr) return Response.json({ error: "Kamu sudah pernah memakai kode referral." }, { status: 200, headers: corsHeaders });

      // Voucher untuk yang memakai (referred)
      const mine = await makeVoucher(sb, visitorId, ubId, "Berhasil pakai kode referral teman!");
      // Voucher untuk pengajak (referrer)
      await makeVoucher(sb, ref.visitor_id, ref.user_balance_id, "Temanmu memakai kode referralmu!");

      // Update statistik pengajak
      await sb.from("store_referral_codes")
        .update({ uses_count: (ref.uses_count || 0) + 1, total_reward: (ref.total_reward || 0) + REWARD })
        .eq("id", ref.id);

      return Response.json({ success: true, voucher: mine.code, reward: REWARD }, { headers: corsHeaders });
    }

    return Response.json({ error: "Aksi tidak dikenal" }, { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return Response.json({ error: e?.message || "internal" }, { status: 500, headers: corsHeaders });
  }
});
