import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash function using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await request.json();
    const { action } = payload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Konfigurasi backend belum lengkap" }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // === REGISTER ===
    if (action === "register") {
      const { username, phone, email, password } = payload;

      if (!username || username.trim().length < 3) {
        return Response.json({ error: "Username minimal 3 karakter" }, { status: 400, headers: corsHeaders });
      }
      if (!phone || phone.trim().length < 7) {
        return Response.json({ error: "Nomor HP tidak valid" }, { status: 400, headers: corsHeaders });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return Response.json({ error: "Format email tidak valid" }, { status: 400, headers: corsHeaders });
      }
      if (!password || password.length < 6) {
        return Response.json({ error: "Sandi minimal 6 karakter" }, { status: 400, headers: corsHeaders });
      }

      // Check if email already exists
      const { data: existing } = await admin
        .from("user_balances")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .neq("email", "")
        .maybeSingle();

      if (existing) {
        return Response.json({ error: "Email sudah terdaftar. Silakan login." }, { status: 400, headers: corsHeaders });
      }

      const passwordHash = await hashPassword(password);
      const visitorId = payload.visitorId || crypto.randomUUID();

      const { data: newUser, error: insertError } = await admin
        .from("user_balances")
        .insert({
          visitor_id: visitorId,
          username: username.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password_hash: passwordHash,
        })
        .select("id, visitor_id, username, phone, email, balance")
        .single();

      if (insertError) {
        return Response.json({ error: "Gagal mendaftar: " + insertError.message }, { status: 500, headers: corsHeaders });
      }

      // Record login history
      if (payload.deviceInfo) {
        await admin.from("balance_login_history").insert({
          user_balance_id: newUser.id,
          visitor_id: visitorId,
          device_info: payload.deviceInfo?.device || null,
          browser: payload.deviceInfo?.browser || null,
          ip_address: payload.deviceInfo?.ip || null,
        });
      }

      return Response.json({ success: true, user: newUser, action: "registered" }, { headers: corsHeaders });
    }

    // === LOGIN ===
    if (action === "login") {
      const { email, password } = payload;

      if (!email || !password) {
        return Response.json({ error: "Email dan sandi wajib diisi" }, { status: 400, headers: corsHeaders });
      }

      const passwordHash = await hashPassword(password);

      const { data: user, error: findError } = await admin
        .from("user_balances")
        .select("id, visitor_id, username, phone, email, balance")
        .eq("email", email.trim().toLowerCase())
        .eq("password_hash", passwordHash)
        .maybeSingle();

      if (findError || !user) {
        return Response.json({ error: "Email atau sandi salah" }, { status: 401, headers: corsHeaders });
      }

      // Update visitor_id to current device if provided
      const newVisitorId = payload.visitorId;
      if (newVisitorId && newVisitorId !== user.visitor_id) {
        await admin
          .from("user_balances")
          .update({ visitor_id: newVisitorId })
          .eq("id", user.id);
        user.visitor_id = newVisitorId;
      }

      // Record login history
      if (payload.deviceInfo) {
        await admin.from("balance_login_history").insert({
          user_balance_id: user.id,
          visitor_id: newVisitorId || user.visitor_id,
          device_info: payload.deviceInfo?.device || null,
          browser: payload.deviceInfo?.browser || null,
          ip_address: payload.deviceInfo?.ip || null,
        });
      }

      return Response.json({ success: true, user, action: "logged_in" }, { headers: corsHeaders });
    }

    // === LOGIN HISTORY ===
    if (action === "login_history") {
      const { userBalanceId } = payload;
      if (!userBalanceId) {
        return Response.json({ error: "ID akun tidak ditemukan" }, { status: 400, headers: corsHeaders });
      }

      const { data: history } = await admin
        .from("balance_login_history")
        .select("*")
        .eq("user_balance_id", userBalanceId)
        .order("logged_in_at", { ascending: false })
        .limit(20);

      return Response.json({ success: true, history: history || [] }, { headers: corsHeaders });
    }

    return Response.json({ error: "Action tidak valid" }, { status: 400, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
