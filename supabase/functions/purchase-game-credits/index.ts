import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREDIT_PACKAGES = [
  { id: "10", credits: 10, price: 5000, label: "10 Kredit" },
  { id: "30", credits: 30, price: 10000, label: "30 Kredit" },
  { id: "60", credits: 60, price: 15000, label: "60 Kredit" },
  { id: "100", credits: 100, price: 20000, label: "100 Kredit" },
  { id: "200", credits: 200, price: 50000, label: "200 Kredit" },
  { id: "500", credits: 500, price: 30000, label: "500 Kredit" },
  { id: "1000", credits: 1000, price: 50000, label: "1000 Kredit" },
  { id: "unlimited", credits: -1, price: 100000, label: "Unlimited 1 Bulan" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, visitorId, packageId, pin } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "get_packages") {
      return Response.json({ packages: CREDIT_PACKAGES }, { headers: corsHeaders });
    }

    if (action === "get_credits") {
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      const { data } = await admin.from("user_game_credits").select("*").eq("visitor_id", visitorId).maybeSingle();
      const credits = data?.credits || 0;
      const unlimitedUntil = data?.unlimited_until || null;
      const isUnlimited = unlimitedUntil && new Date(unlimitedUntil) > new Date();
      return Response.json({ credits, unlimited_until: unlimitedUntil, is_unlimited: !!isUnlimited }, { headers: corsHeaders });
    }

    if (action === "use_credit") {
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      const { data } = await admin.from("user_game_credits").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!data) return Response.json({ error: "Kamu belum punya kredit jawaban" }, { status: 400, headers: corsHeaders });
      
      const isUnlimited = data.unlimited_until && new Date(data.unlimited_until) > new Date();
      if (isUnlimited) {
        return Response.json({ success: true, credits: data.credits, is_unlimited: true }, { headers: corsHeaders });
      }
      if (data.credits <= 0) {
        return Response.json({ error: "Kredit jawaban habis" }, { status: 400, headers: corsHeaders });
      }
      await admin.from("user_game_credits").update({ credits: data.credits - 1, updated_at: new Date().toISOString() }).eq("id", data.id);
      return Response.json({ success: true, credits: data.credits - 1, is_unlimited: false }, { headers: corsHeaders });
    }

    if (action === "purchase") {
      if (!visitorId || !packageId) return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });

      const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
      if (!pkg) return Response.json({ error: "Paket tidak ditemukan" }, { status: 400, headers: corsHeaders });

      // Verify PIN
      const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
      if (pinRow) {
        if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 403, headers: corsHeaders });
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pin));
        const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
        if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah" }, { status: 403, headers: corsHeaders });
      }

      // Check balance
      const { data: balance } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
      if (!balance) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
      if (balance.balance < pkg.price) return Response.json({ error: "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });

      // Deduct balance
      await admin.from("user_balances").update({ balance: balance.balance - pkg.price }).eq("id", balance.id);

      // Record transaction
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        type: "purchase",
        amount: pkg.price,
        description: `Beli ${pkg.label} (Kredit Jawaban Game)`,
      });

      // Upsert credits
      const { data: existing } = await admin.from("user_game_credits").select("*").eq("visitor_id", visitorId).maybeSingle();
      
      if (pkg.id === "unlimited") {
        const unlimitilDate = new Date();
        unlimitilDate.setDate(unlimitilDate.getDate() + 30);
        if (existing) {
          await admin.from("user_game_credits").update({
            unlimited_until: unlimitilDate.toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await admin.from("user_game_credits").insert({
            visitor_id: visitorId,
            credits: 0,
            unlimited_until: unlimitilDate.toISOString(),
          });
        }
      } else {
        if (existing) {
          await admin.from("user_game_credits").update({
            credits: existing.credits + pkg.credits,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await admin.from("user_game_credits").insert({
            visitor_id: visitorId,
            credits: pkg.credits,
          });
        }
      }

      const finalCredits = existing ? (pkg.id === "unlimited" ? existing.credits : existing.credits + pkg.credits) : (pkg.id === "unlimited" ? 0 : pkg.credits);
      
      return Response.json({
        success: true,
        package: pkg,
        credits: finalCredits,
        balance_remaining: balance.balance - pkg.price,
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
