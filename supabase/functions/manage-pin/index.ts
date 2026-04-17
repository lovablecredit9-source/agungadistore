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

// Rate limit configuration (per visitor / per action)
const RATE_LIMITS: Record<string, { max: number; windowMinutes: number }> = {
  verify: { max: 5, windowMinutes: 15 },
  create: { max: 3, windowMinutes: 60 },
  reset: { max: 5, windowMinutes: 60 },
  invalidate_tokens: { max: 5, windowMinutes: 60 },
};

async function checkRateLimit(
  admin: ReturnType<typeof createClient>,
  visitorId: string,
  action: string,
  ip: string | null,
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  const cfg = RATE_LIMITS[action];
  if (!cfg) return { allowed: true };
  const since = new Date(Date.now() - cfg.windowMinutes * 60 * 1000).toISOString();

  // Count failed attempts in window for this visitor
  const { count } = await admin
    .from("pin_attempts")
    .select("id", { count: "exact", head: true })
    .eq("visitor_id", visitorId)
    .eq("action", action)
    .eq("succeeded", false)
    .gte("attempted_at", since);

  if ((count ?? 0) >= cfg.max) {
    return { allowed: false, retryAfterSec: cfg.windowMinutes * 60 };
  }
  return { allowed: true };
}

async function logAttempt(
  admin: ReturnType<typeof createClient>,
  visitorId: string,
  action: string,
  succeeded: boolean,
  ip: string | null,
) {
  try {
    await admin.from("pin_attempts").insert({
      visitor_id: visitorId,
      action,
      succeeded,
      ip_address: ip,
    });
  } catch {
    // best-effort logging only
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("cf-connecting-ip") ??
    null;

  try {
    const body = await request.json();
    const { action, visitorId, pin, newPin, resetToken } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Basic input validation
    if (typeof action !== "string") {
      return Response.json({ error: "Action diperlukan" }, { status: 400, headers: corsHeaders });
    }
    if (visitorId !== undefined && (typeof visitorId !== "string" || visitorId.length < 8 || visitorId.length > 128)) {
      return Response.json({ error: "Visitor ID tidak valid" }, { status: 400, headers: corsHeaders });
    }

    if (action === "check") {
      if (!visitorId) {
        return Response.json({ error: "Visitor ID diperlukan" }, { status: 400, headers: corsHeaders });
      }
      const { data } = await admin.from("user_pins").select("id").eq("visitor_id", visitorId).maybeSingle();
      return Response.json({ hasPin: !!data }, { headers: corsHeaders });
    }

    // Rate-limited actions
    if (["verify", "create", "reset", "invalidate_tokens"].includes(action)) {
      if (!visitorId) {
        return Response.json({ error: "Visitor ID diperlukan" }, { status: 400, headers: corsHeaders });
      }
      const rl = await checkRateLimit(admin, visitorId, action, ip);
      if (!rl.allowed) {
        return Response.json(
          { error: "Terlalu banyak percobaan. Coba lagi nanti." },
          { status: 429, headers: { ...corsHeaders, "Retry-After": String(rl.retryAfterSec ?? 900) } },
        );
      }
    }

    if (action === "create") {
      if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
        await logAttempt(admin, visitorId, "create", false, ip);
        return Response.json({ error: "PIN harus 6 digit angka" }, { status: 400, headers: corsHeaders });
      }
      const hash = await hashPin(pin);
      const { data: existing } = await admin.from("user_pins").select("id").eq("visitor_id", visitorId).maybeSingle();
      if (existing) {
        await logAttempt(admin, visitorId, "create", false, ip);
        return Response.json({ error: "PIN sudah ada. Gunakan reset jika lupa." }, { status: 400, headers: corsHeaders });
      }
      await admin.from("user_pins").insert({ visitor_id: visitorId, pin_hash: hash });
      await logAttempt(admin, visitorId, "create", true, ip);
      return Response.json({ success: true, message: "PIN berhasil dibuat" }, { headers: corsHeaders });
    }

    if (action === "verify") {
      if (!pin) {
        await logAttempt(admin, visitorId, "verify", false, ip);
        return Response.json({ error: "PIN diperlukan" }, { status: 400, headers: corsHeaders });
      }
      const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
      if (!pinRow) {
        await logAttempt(admin, visitorId, "verify", false, ip);
        return Response.json({ error: "PIN belum dibuat" }, { status: 404, headers: corsHeaders });
      }
      const hash = await hashPin(pin);
      const valid = hash === pinRow.pin_hash;
      await logAttempt(admin, visitorId, "verify", valid, ip);
      return Response.json({ valid }, { headers: corsHeaders });
    }

    if (action === "invalidate_tokens") {
      await admin.from("pin_reset_tokens").update({ is_used: true }).eq("visitor_id", visitorId).eq("is_used", false);
      await logAttempt(admin, visitorId, "invalidate_tokens", true, ip);
      return Response.json({ success: true, message: "Token lama dinonaktifkan" }, { headers: corsHeaders });
    }

    if (action === "reset") {
      if (!resetToken || !newPin) {
        await logAttempt(admin, visitorId, "reset", false, ip);
        return Response.json({ error: "Token dan PIN baru diperlukan" }, { status: 400, headers: corsHeaders });
      }
      if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
        await logAttempt(admin, visitorId, "reset", false, ip);
        return Response.json({ error: "PIN baru harus 6 digit angka" }, { status: 400, headers: corsHeaders });
      }

      const { data: tokenRow } = await admin.from("pin_reset_tokens")
        .select("*")
        .eq("token", resetToken.toString().trim())
        .eq("visitor_id", visitorId)
        .eq("is_used", false)
        .maybeSingle();

      if (!tokenRow) {
        await logAttempt(admin, visitorId, "reset", false, ip);
        return Response.json({ error: "Token reset tidak valid" }, { status: 400, headers: corsHeaders });
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        await logAttempt(admin, visitorId, "reset", false, ip);
        return Response.json({ error: "Token reset sudah expired" }, { status: 400, headers: corsHeaders });
      }

      const hash = await hashPin(newPin);
      await admin.from("user_pins").update({ pin_hash: hash, updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
      await admin.from("pin_reset_tokens").update({ is_used: true }).eq("id", tokenRow.id);
      await logAttempt(admin, visitorId, "reset", true, ip);

      return Response.json({ success: true, message: "PIN berhasil direset" }, { headers: corsHeaders });
    }

    return Response.json({ error: "Action tidak valid" }, { status: 400, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
