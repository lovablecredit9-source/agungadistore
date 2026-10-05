import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { accountHasPin, accountPinVisitorId, linkedPinVisitorIds, verifyAccountPin } from "../_shared/pin.ts";

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
      return Response.json({ hasPin: await accountHasPin(admin, visitorId) }, { headers: corsHeaders });
    }

    // Rate-limited actions
    if (["verify", "create", "reset", "invalidate_tokens"].includes(action)) {
      if (!visitorId) {
        return Response.json({ error: "Visitor ID diperlukan" }, { status: 400, headers: corsHeaders });
      }
      const rl = await checkRateLimit(admin, visitorId, action, ip);
      if (!rl.allowed) {
        return Response.json(
          { error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi." },
          { status: 429, headers: { ...corsHeaders, "Retry-After": String(rl.retryAfterSec ?? 900) } },
        );
      }
    }

    // PIN disimpan di akun saldo (bukan perangkat).
    const accountVid = visitorId ? await accountPinVisitorId(admin, visitorId) : "";
    const cleanPin = typeof pin === "string" || typeof pin === "number" ? String(pin).trim() : "";
    const cleanNewPin = typeof newPin === "string" || typeof newPin === "number" ? String(newPin).trim() : "";

    if (action === "create") {
      if (!/^\d{6}$/.test(cleanPin)) {
        await logAttempt(admin, visitorId, "create", false, ip);
        return Response.json({ error: "PIN harus 6 digit angka" }, { status: 400, headers: corsHeaders });
      }
      if (await accountHasPin(admin, visitorId)) {
        await logAttempt(admin, visitorId, "create", false, ip);
        return Response.json({ error: "PIN sudah ada. Gunakan reset jika lupa." }, { status: 400, headers: corsHeaders });
      }
      const hash = await hashPin(cleanPin);
      const { error: insErr } = await admin.from("user_pins").insert({ visitor_id: accountVid, pin_hash: hash });
      if (insErr) return Response.json({ error: "Gagal menyimpan PIN" }, { status: 500, headers: corsHeaders });
      await logAttempt(admin, visitorId, "create", true, ip);
      return Response.json({ success: true, message: "PIN berhasil dibuat" }, { headers: corsHeaders });
    }

    if (action === "verify") {
      if (!cleanPin) {
        return Response.json({ error: "PIN diperlukan" }, { status: 400, headers: corsHeaders });
      }
      const err = await verifyAccountPin(admin, visitorId, cleanPin);
      if (err && err.startsWith("PIN belum")) {
        return Response.json({ error: err, valid: false }, { status: 404, headers: corsHeaders });
      }
      const valid = !err;
      await logAttempt(admin, visitorId, "verify", valid, ip);
      return Response.json({ valid, ...(err && !valid ? { reason: err } : {}) }, { headers: corsHeaders });
    }

    if (action === "invalidate_tokens") {
      const ids = await linkedPinVisitorIds(admin, visitorId);
      await admin.from("pin_reset_tokens").update({ is_used: true }).in("visitor_id", ids).eq("is_used", false);
      await logAttempt(admin, visitorId, "invalidate_tokens", true, ip);
      return Response.json({ success: true, message: "Token lama dinonaktifkan" }, { headers: corsHeaders });
    }

    if (action === "reset") {
      if (!resetToken || !cleanNewPin) {
        await logAttempt(admin, visitorId, "reset", false, ip);
        return Response.json({ error: "Token dan PIN baru diperlukan" }, { status: 400, headers: corsHeaders });
      }
      if (!/^\d{6}$/.test(cleanNewPin)) {
        await logAttempt(admin, visitorId, "reset", false, ip);
        return Response.json({ error: "PIN baru harus 6 digit angka" }, { status: 400, headers: corsHeaders });
      }

      const ids = await linkedPinVisitorIds(admin, visitorId);
      const { data: tokenRow } = await admin.from("pin_reset_tokens")
        .select("*")
        .eq("token", resetToken.toString().trim())
        .in("visitor_id", ids)
        .eq("is_used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenRow) {
        await logAttempt(admin, visitorId, "reset", false, ip);
        return Response.json({ error: "Token reset tidak valid" }, { status: 400, headers: corsHeaders });
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        await logAttempt(admin, visitorId, "reset", false, ip);
        return Response.json({ error: "Token reset sudah expired" }, { status: 400, headers: corsHeaders });
      }

      const hash = await hashPin(cleanNewPin);
      const now = new Date().toISOString();
      // Simpan di akun (PIN akun selalu diutamakan saat verifikasi).
      const { data: own } = await admin.from("user_pins").select("id").eq("visitor_id", accountVid).maybeSingle();
      if (own) await admin.from("user_pins").update({ pin_hash: hash, updated_at: now }).eq("id", own.id);
      else await admin.from("user_pins").insert({ visitor_id: accountVid, pin_hash: hash });
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
