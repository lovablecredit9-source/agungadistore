import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { action, visitorId, pin, newPin, resetToken } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "check") {
      // Check if user has a PIN
      const { data } = await admin.from("user_pins").select("id").eq("visitor_id", visitorId).maybeSingle();
      return Response.json({ hasPin: !!data }, { headers: corsHeaders });
    }

    if (action === "create") {
      if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        return Response.json({ error: "PIN harus 4-6 digit angka" }, { status: 400, headers: corsHeaders });
      }
      const hash = await hashPin(pin);
      const { data: existing } = await admin.from("user_pins").select("id").eq("visitor_id", visitorId).maybeSingle();
      if (existing) {
        return Response.json({ error: "PIN sudah ada. Gunakan reset jika lupa." }, { status: 400, headers: corsHeaders });
      }
      await admin.from("user_pins").insert({ visitor_id: visitorId, pin_hash: hash });
      return Response.json({ success: true, message: "PIN berhasil dibuat" }, { headers: corsHeaders });
    }

    if (action === "verify") {
      if (!pin) {
        return Response.json({ error: "PIN diperlukan" }, { status: 400, headers: corsHeaders });
      }
      const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
      if (!pinRow) {
        return Response.json({ error: "PIN belum dibuat" }, { status: 404, headers: corsHeaders });
      }
      const hash = await hashPin(pin);
      return Response.json({ valid: hash === pinRow.pin_hash }, { headers: corsHeaders });
    }

    if (action === "invalidate_tokens") {
      // Admin invalidates all existing tokens for a user before creating a new one
      if (!visitorId) {
        return Response.json({ error: "Visitor ID diperlukan" }, { status: 400, headers: corsHeaders });
      }
      await admin.from("pin_reset_tokens").update({ is_used: true }).eq("visitor_id", visitorId).eq("is_used", false);
      return Response.json({ success: true, message: "Token lama dinonaktifkan" }, { headers: corsHeaders });
    }

    if (action === "reset") {
      // Reset PIN using token
      if (!resetToken || !newPin) {
        return Response.json({ error: "Token dan PIN baru diperlukan" }, { status: 400, headers: corsHeaders });
      }
      if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
        return Response.json({ error: "PIN baru harus 4-6 digit angka" }, { status: 400, headers: corsHeaders });
      }

      const { data: tokenRow } = await admin.from("pin_reset_tokens")
        .select("*")
        .eq("token", resetToken.toUpperCase())
        .eq("visitor_id", visitorId)
        .eq("is_used", false)
        .maybeSingle();

      if (!tokenRow) {
        return Response.json({ error: "Token reset tidak valid" }, { status: 400, headers: corsHeaders });
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        return Response.json({ error: "Token reset sudah expired" }, { status: 400, headers: corsHeaders });
      }

      const hash = await hashPin(newPin);
      await admin.from("user_pins").update({ pin_hash: hash, updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
      await admin.from("pin_reset_tokens").update({ is_used: true }).eq("id", tokenRow.id);

      return Response.json({ success: true, message: "PIN berhasil direset" }, { headers: corsHeaders });
    }

    return Response.json({ error: "Action tidak valid" }, { status: 400, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
