import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, packageId } = await req.json();
    if (!visitorId || !packageId) {
      return Response.json({ error: "visitorId & packageId wajib" }, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: pkg } = await admin.from("gem_packages").select("*").eq("id", packageId).eq("is_active", true).maybeSingle();
    if (!pkg) return Response.json({ error: "Paket tidak ditemukan" }, { status: 404, headers: corsHeaders });

    // Find user_balance via visitor_id
    const { data: balLogin } = await admin
      .from("balance_login_history")
      .select("user_balance_id")
      .eq("visitor_id", visitorId)
      .order("logged_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!balLogin?.user_balance_id) {
      return Response.json({ error: "Login akun saldo dulu untuk beli Gem" }, { status: 400, headers: corsHeaders });
    }

    const { data: bal } = await admin.from("user_balances").select("balance").eq("id", balLogin.user_balance_id).maybeSingle();
    if (!bal || bal.balance < pkg.price) {
      return Response.json({ error: `Saldo kurang. Butuh Rp${pkg.price.toLocaleString("id-ID")}` }, { status: 400, headers: corsHeaders });
    }

    const totalGems = pkg.gems + (pkg.bonus_gems || 0);

    // Deduct balance
    await admin.from("user_balances").update({ balance: bal.balance - pkg.price }).eq("id", balLogin.user_balance_id);

    // Add gems to game profile
    const { data: prof } = await admin.from("game_profiles").select("gems").eq("visitor_id", visitorId).maybeSingle();
    if (!prof) {
      await admin.from("game_profiles").insert({ visitor_id: visitorId, gems: totalGems });
    } else {
      await admin.from("game_profiles").update({ gems: (prof.gems || 0) + totalGems }).eq("visitor_id", visitorId);
    }

    // Log transactions
    await admin.from("gem_transactions").insert({
      visitor_id: visitorId,
      amount: totalGems,
      type: "purchase",
      description: `Beli ${pkg.name}: +${totalGems} 💎 (Rp${pkg.price.toLocaleString("id-ID")})`,
      reference_id: pkg.id,
    });
    await admin.from("balance_transactions").insert({
      visitor_id: visitorId,
      amount: -pkg.price,
      type: "gem_purchase",
      description: `Beli ${pkg.name}: ${totalGems} 💎`,
    });
    await admin.from("notifications").insert({
      visitor_id: visitorId,
      title: "💎 Gem Bertambah!",
      message: `Kamu mendapat ${totalGems} 💎 dari ${pkg.name}`,
      type: "gem",
    });

    return Response.json({ success: true, gems_added: totalGems, new_balance: bal.balance - pkg.price }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
