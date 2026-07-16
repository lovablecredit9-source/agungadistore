import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function randomCode(): string {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "PQ-" + Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = body.action;

    if (action === "redeem") {
      const { code, visitorId } = body;
      if (!code || !visitorId) return Response.json({ error: "code & visitorId wajib" }, { status: 400, headers: corsHeaders });

      const { data: v } = await admin.from("premium_quest_vouchers").select("*").eq("code", code.trim().toUpperCase()).maybeSingle();
      if (!v) return Response.json({ error: "Kode voucher tidak ditemukan" }, { status: 404, headers: corsHeaders });
      if (!v.is_active) return Response.json({ error: "Voucher tidak aktif" }, { status: 400, headers: corsHeaders });
      if (v.expires_at && new Date(v.expires_at) < new Date()) return Response.json({ error: "Voucher sudah kadaluarsa" }, { status: 400, headers: corsHeaders });
      if (v.used_count >= v.max_uses) return Response.json({ error: "Kuota voucher habis" }, { status: 400, headers: corsHeaders });

      // Ambil user_balance_id
      const { data: blh } = await admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
      const ub_id = blh?.user_balance_id ?? null;

      // Cek batas per akun
      let ownedFilter = admin.from("premium_quest_voucher_redemptions").select("id", { count: "exact", head: true }).eq("voucher_id", v.id);
      if (ub_id) ownedFilter = ownedFilter.or(`visitor_id.eq.${visitorId},user_balance_id.eq.${ub_id}`);
      else ownedFilter = ownedFilter.eq("visitor_id", visitorId);
      const { count } = await ownedFilter;
      if ((count ?? 0) >= v.max_per_account) return Response.json({ error: `Kamu sudah pakai voucher ini ${count}× (batas ${v.max_per_account})` }, { status: 400, headers: corsHeaders });

      // Aktifkan premium quest
      const expiresAt = new Date(Date.now() + v.duration_days * 86400000).toISOString();
      await admin.from("premium_quest_subscriptions").insert({
        visitor_id: visitorId,
        user_balance_id: ub_id,
        plan_name: `Voucher ${v.duration_days} Hari`,
        plan_code: "VOUCHER_REDEEM",
        expires_at: expiresAt,
        is_active: true,
        is_permanent: false,
        purchase_source: "voucher",
      });

      await admin.from("premium_quest_voucher_redemptions").insert({
        voucher_id: v.id,
        visitor_id: visitorId,
        user_balance_id: ub_id,
        duration_days: v.duration_days,
      });
      await admin.from("premium_quest_vouchers").update({ used_count: v.used_count + 1 }).eq("id", v.id);

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: "🎟️ Penukaran Voucher Berhasil",
        message: `Kode ${code} berhasil ditukar. Premium Quest aktif ${v.duration_days} hari.`,
        type: "success",
      });

      return Response.json({ success: true, duration_days: v.duration_days, expires_at: expiresAt }, { headers: corsHeaders });
    }

    if (action === "admin_create") {
      const { code, duration_days, max_uses, max_per_account, expires_at, note } = body;
      const finalCode = (code && code.trim()) ? code.trim().toUpperCase() : randomCode();
      const { data, error } = await admin.from("premium_quest_vouchers").insert({
        code: finalCode,
        duration_days: duration_days || 1,
        max_uses: max_uses || 1,
        max_per_account: max_per_account || 1,
        expires_at: expires_at || null,
        note: note || null,
      }).select().single();
      if (error) return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
      return Response.json({ success: true, voucher: data }, { headers: corsHeaders });
    }

    if (action === "admin_list") {
      const { data } = await admin.from("premium_quest_vouchers").select("*").order("created_at", { ascending: false });
      return Response.json({ vouchers: data ?? [] }, { headers: corsHeaders });
    }

    if (action === "admin_toggle") {
      const { id, is_active } = body;
      await admin.from("premium_quest_vouchers").update({ is_active }).eq("id", id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "admin_delete") {
      await admin.from("premium_quest_vouchers").delete().eq("id", body.id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
