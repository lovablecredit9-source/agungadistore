import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPhone = phone.trim();
      const normalizedUsername = username.trim();
      const passwordHash = await hashPassword(password);
      const visitorId = payload.visitorId || crypto.randomUUID();

      const { data: existingByVisitor } = await admin
        .from("user_balances")
        .select("id, visitor_id, username, phone, email, balance, password_hash")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      const { data: existingByEmail } = await admin
        .from("user_balances")
        .select("id, visitor_id, username, phone, email, balance, password_hash")
        .eq("email", normalizedEmail)
        .neq("email", "")
        .maybeSingle();

      const { data: existingUsername } = await admin
        .from("user_balances")
        .select("id")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (existingUsername && existingUsername.id !== existingByVisitor?.id && existingUsername.id !== existingByEmail?.id) {
        return Response.json({ error: "Username sudah dipakai. Pilih username lain." }, { status: 400, headers: corsHeaders });
      }

      const { data: existingPhone } = await admin
        .from("user_balances")
        .select("id")
        .eq("phone", normalizedPhone)
        .neq("phone", "")
        .maybeSingle();

      if (existingPhone && existingPhone.id !== existingByVisitor?.id && existingPhone.id !== existingByEmail?.id) {
        return Response.json({ error: "Nomor HP sudah terdaftar. Silakan login." }, { status: 400, headers: corsHeaders });
      }

      const upgradeTarget = existingByEmail ?? existingByVisitor;

      if (upgradeTarget) {
        const sameAccount = !existingByEmail || !existingByVisitor || existingByEmail.id === existingByVisitor.id;
        if (!sameAccount) {
          return Response.json({ error: "Perangkat ini sudah terhubung ke akun lain. Silakan login dengan akun yang sudah ada." }, { status: 400, headers: corsHeaders });
        }

        const alreadyRegistered = Boolean(upgradeTarget.email && upgradeTarget.password_hash);
        if (alreadyRegistered) {
          return Response.json({ error: "Email sudah terdaftar. Silakan login." }, { status: 400, headers: corsHeaders });
        }

        const { data: upgradedUser, error: upgradeError } = await admin
          .from("user_balances")
          .update({
            visitor_id: visitorId,
            username: normalizedUsername,
            phone: normalizedPhone,
            email: normalizedEmail,
            password_hash: passwordHash,
          })
          .eq("id", upgradeTarget.id)
          .select("id, visitor_id, username, phone, email, balance")
          .single();

        if (upgradeError || !upgradedUser) {
          return Response.json({ error: "Gagal melengkapi akun: " + (upgradeError?.message || "unknown") }, { status: 500, headers: corsHeaders });
        }

        if (payload.deviceInfo) {
          await admin.from("balance_login_history").insert({
            user_balance_id: upgradedUser.id,
            visitor_id: visitorId,
            device_info: payload.deviceInfo?.device || null,
            browser: payload.deviceInfo?.browser || null,
            ip_address: payload.deviceInfo?.ip || null,
          });
        }

        return Response.json({ success: true, user: upgradedUser, action: "registered" }, { headers: corsHeaders });
      }

      const { data: newUser, error: insertError } = await admin
        .from("user_balances")
        .insert({
          visitor_id: visitorId,
          username: normalizedUsername,
          phone: normalizedPhone,
          email: normalizedEmail,
          password_hash: passwordHash,
        })
        .select("id, visitor_id, username, phone, email, balance")
        .single();

      if (insertError) {
        return Response.json({ error: "Gagal mendaftar: " + insertError.message }, { status: 500, headers: corsHeaders });
      }

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

    // === LOGIN (supports email, username, or phone) ===
    if (action === "login") {
      const { email, password, loginId } = payload;
      const identifier = loginId || email; // support both old 'email' field and new 'loginId'

      if (!identifier || !password) {
        return Response.json({ error: "Email/Username/No HP dan sandi wajib diisi" }, { status: 400, headers: corsHeaders });
      }

      const passwordHash = await hashPassword(password);
      const trimmed = identifier.trim().toLowerCase();

      // Try to find user by email, username, or phone
      let user = null;

      // Try email
      const { data: byEmail } = await admin
        .from("user_balances")
        .select("id, visitor_id, username, phone, email, balance")
        .eq("email", trimmed)
        .eq("password_hash", passwordHash)
        .maybeSingle();
      
      if (byEmail) {
        user = byEmail;
      } else {
        // Try username (case insensitive)
        const { data: allUsers } = await admin
          .from("user_balances")
          .select("id, visitor_id, username, phone, email, balance, password_hash")
          .eq("password_hash", passwordHash);
        
        if (allUsers) {
          user = allUsers.find(u => 
            u.username.toLowerCase() === trimmed || 
            u.phone.replace(/[\s\-+]/g, "").endsWith(trimmed.replace(/[\s\-+]/g, ""))
          );
          if (user) {
            // Remove password_hash from response
            const { password_hash, ...safeUser } = user;
            user = safeUser;
          }
        }
      }

      if (!user) {
        return Response.json({ error: "Email/Username/No HP atau sandi salah" }, { status: 401, headers: corsHeaders });
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

    // === CHANGE PASSWORD (using old password) ===
    if (action === "change_password") {
      const { visitorId, oldPassword, newPassword } = payload;
      if (!visitorId || !oldPassword || !newPassword) {
        return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
      }
      if (newPassword.length < 6) {
        return Response.json({ error: "Sandi baru minimal 6 karakter" }, { status: 400, headers: corsHeaders });
      }

      const oldHash = await hashPassword(oldPassword);
      const { data: user } = await admin
        .from("user_balances")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("password_hash", oldHash)
        .maybeSingle();

      if (!user) {
        return Response.json({ error: "Sandi lama salah" }, { status: 401, headers: corsHeaders });
      }

      const newHash = await hashPassword(newPassword);
      await admin.from("user_balances").update({ password_hash: newHash }).eq("id", user.id);

      return Response.json({ success: true, message: "Sandi berhasil diubah" }, { headers: corsHeaders });
    }

    // === RESET PASSWORD (using admin token) ===
    if (action === "reset_password") {
      const { visitorId, resetToken, newPassword } = payload;
      if (!visitorId || !resetToken || !newPassword) {
        return Response.json({ error: "Token dan sandi baru diperlukan" }, { status: 400, headers: corsHeaders });
      }
      if (newPassword.length < 6) {
        return Response.json({ error: "Sandi baru minimal 6 karakter" }, { status: 400, headers: corsHeaders });
      }

      const { data: tokenRow } = await admin.from("password_reset_tokens")
        .select("*")
        .eq("token", resetToken.toUpperCase())
        .eq("visitor_id", visitorId)
        .eq("is_used", false)
        .maybeSingle();

      if (!tokenRow) {
        return Response.json({ error: "Token reset tidak valid atau sudah dipakai" }, { status: 400, headers: corsHeaders });
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        return Response.json({ error: "Token reset sudah expired" }, { status: 400, headers: corsHeaders });
      }

      const newHash = await hashPassword(newPassword);
      await admin.from("user_balances").update({ password_hash: newHash }).eq("visitor_id", visitorId);
      await admin.from("password_reset_tokens").update({ is_used: true }).eq("id", tokenRow.id);

      return Response.json({ success: true, message: "Sandi berhasil direset" }, { headers: corsHeaders });
    }

    // === CHANGE EMAIL ===
    if (action === "change_email") {
      const { visitorId, newEmail, password } = payload;
      if (!visitorId || !newEmail || !password) {
        return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
        return Response.json({ error: "Format email tidak valid" }, { status: 400, headers: corsHeaders });
      }

      const passwordHash = await hashPassword(password);
      const { data: user } = await admin
        .from("user_balances")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("password_hash", passwordHash)
        .maybeSingle();

      if (!user) {
        return Response.json({ error: "Sandi salah" }, { status: 401, headers: corsHeaders });
      }

      // Check if new email is already used
      const { data: existing } = await admin
        .from("user_balances")
        .select("id")
        .eq("email", newEmail.trim().toLowerCase())
        .neq("id", user.id)
        .maybeSingle();

      if (existing) {
        return Response.json({ error: "Email sudah digunakan akun lain" }, { status: 400, headers: corsHeaders });
      }

      await admin.from("user_balances").update({ email: newEmail.trim().toLowerCase() }).eq("id", user.id);

      return Response.json({ success: true, message: "Email berhasil diubah" }, { headers: corsHeaders });
    }

    // === UPDATE PROFILE (username, phone) ===
    if (action === "update_profile") {
      const { visitorId, username, phone } = payload;
      if (!visitorId) {
        return Response.json({ error: "ID tidak ditemukan" }, { status: 400, headers: corsHeaders });
      }

      const updates: Record<string, string> = {};
      if (username && username.trim().length >= 3) {
        // Check unique username
        const { data: existingUsername } = await admin
          .from("user_balances")
          .select("id")
          .eq("username", username.trim())
          .neq("visitor_id", visitorId)
          .maybeSingle();
        if (existingUsername) {
          return Response.json({ error: "Username sudah dipakai" }, { status: 400, headers: corsHeaders });
        }
        updates.username = username.trim();
      }
      if (phone && phone.trim().length >= 7) {
        updates.phone = phone.trim();
      }

      if (Object.keys(updates).length === 0) {
        return Response.json({ error: "Tidak ada perubahan" }, { status: 400, headers: corsHeaders });
      }

      const { data: updated, error: updateErr } = await admin
        .from("user_balances")
        .update(updates)
        .eq("visitor_id", visitorId)
        .select("id, visitor_id, username, phone, email, balance")
        .single();

      if (updateErr || !updated) {
        return Response.json({ error: "Gagal memperbarui profil" }, { status: 500, headers: corsHeaders });
      }

      return Response.json({ success: true, user: updated, message: "Profil berhasil diperbarui" }, { headers: corsHeaders });
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
