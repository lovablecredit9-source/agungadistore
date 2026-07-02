import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(value: string) {
  return value.trim().replace(/[\s-]/g, "");
}

function normalizedPhoneVariants(value: string) {
  const cleaned = value.replace(/\D/g, "");
  const variants = new Set<string>();

  if (!cleaned) return [];

  variants.add(cleaned);
  variants.add(`+${cleaned}`);

  if (cleaned.startsWith("62")) {
    variants.add(`0${cleaned.slice(2)}`);
  }

  if (cleaned.startsWith("0")) {
    variants.add(`62${cleaned.slice(1)}`);
    variants.add(`+62${cleaned.slice(1)}`);
  }

  return Array.from(variants);
}

async function findUserByLogin(admin: ReturnType<typeof createClient>, identifier: string, passwordHash: string) {
  const trimmed = identifier.trim();
  const lowered = trimmed.toLowerCase();

  const { data: byEmail } = await admin
    .from("user_balances")
    .select("id, visitor_id, username, phone, email, balance")
    .eq("email", lowered)
    .eq("password_hash", passwordHash)
    .maybeSingle();

  if (byEmail) return byEmail;

  const { data: byUsername } = await admin
    .from("user_balances")
    .select("id, visitor_id, username, phone, email, balance")
    .ilike("username", trimmed)
    .eq("password_hash", passwordHash)
    .maybeSingle();

  if (byUsername) return byUsername;

  const phoneVariants = normalizedPhoneVariants(trimmed);
  if (phoneVariants.length > 0) {
    const { data: phoneUsers } = await admin
      .from("user_balances")
      .select("id, visitor_id, username, phone, email, balance")
      .in("phone", phoneVariants)
      .eq("password_hash", passwordHash)
      .limit(1);

    if (phoneUsers?.[0]) return phoneUsers[0];
  }

  return null;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Generate a human-friendly code (no ambiguous chars) like XPJD8HS
function randomLoginCode(len = 7): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function generateUniqueLoginCode(admin: ReturnType<typeof createClient>): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = randomLoginCode();
    const { data } = await admin.from("user_balances").select("id").eq("login_code", code).maybeSingle();
    if (!data) return code;
  }
  return randomLoginCode(9);
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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
      const normalizedPhone = normalizePhone(phone);
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

      const phoneVariants = normalizedPhoneVariants(normalizedPhone);

      const phoneQuery = admin
        .from("user_balances")
        .select("id")
        .neq("phone", "");

      const { data: existingPhone } = await (phoneVariants.length > 0
        ? phoneQuery.in("phone", phoneVariants).limit(1).maybeSingle()
        : phoneQuery.eq("phone", normalizedPhone).maybeSingle());

      if (existingPhone && existingPhone.id !== existingByVisitor?.id && existingPhone.id !== existingByEmail?.id) {
        return Response.json({ error: "Nomor HP sudah terdaftar. Silakan login." }, { status: 400, headers: corsHeaders });
      }

      if (existingByEmail && existingByVisitor && existingByEmail.id !== existingByVisitor.id) {
        const visitorAlreadyRegistered = Boolean(existingByVisitor.email && existingByVisitor.password_hash);
        if (visitorAlreadyRegistered) {
          return Response.json({ error: "Perangkat ini sudah dipakai akun lain. Logout dulu atau login ke akun yang sudah ada." }, { status: 400, headers: corsHeaders });
        }

        const { error: releaseVisitorError } = await admin
          .from("user_balances")
          .update({ visitor_id: crypto.randomUUID() })
          .eq("id", existingByVisitor.id);

        if (releaseVisitorError) {
          return Response.json({ error: "Gagal menyiapkan perangkat untuk akun ini. Coba lagi." }, { status: 500, headers: corsHeaders });
        }
      }

      if (existingByEmail) {
        const alreadyRegistered = Boolean(existingByEmail.email && existingByEmail.password_hash);
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
          .eq("id", existingByEmail.id)
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

      if (existingByVisitor) {
        const alreadyRegistered = Boolean(existingByVisitor.email && existingByVisitor.password_hash);
        if (alreadyRegistered) {
          return Response.json({ error: "Perangkat ini sudah memiliki akun. Silakan login." }, { status: 400, headers: corsHeaders });
        }

        const { data: upgradedGuest, error: upgradeGuestError } = await admin
          .from("user_balances")
          .update({
            username: normalizedUsername,
            phone: normalizedPhone,
            email: normalizedEmail,
            password_hash: passwordHash,
          })
          .eq("id", existingByVisitor.id)
          .select("id, visitor_id, username, phone, email, balance")
          .single();

        if (upgradeGuestError || !upgradedGuest) {
          return Response.json({ error: "Gagal melengkapi akun: " + (upgradeGuestError?.message || "unknown") }, { status: 500, headers: corsHeaders });
        }

        if (payload.deviceInfo) {
          await admin.from("balance_login_history").insert({
            user_balance_id: upgradedGuest.id,
            visitor_id: visitorId,
            device_info: payload.deviceInfo?.device || null,
            browser: payload.deviceInfo?.browser || null,
            ip_address: payload.deviceInfo?.ip || null,
          });
        }

        return Response.json({ success: true, user: upgradedGuest, action: "registered" }, { headers: corsHeaders });
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
      const user = await findUserByLogin(admin, identifier, passwordHash);

      if (!user) {
        return Response.json({ error: "Email/Username/No HP atau sandi salah" }, { status: 401, headers: corsHeaders });
      }

      if (payload.deviceInfo) {
        await admin.from("balance_login_history").insert({
          user_balance_id: user.id,
          visitor_id: user.visitor_id,
          device_info: payload.deviceInfo?.device || null,
          browser: payload.deviceInfo?.browser || null,
          ip_address: payload.deviceInfo?.ip || null,
        });
      }

      // WA notif login ke admin + user (pakai waitUntil agar tidak di-kill)
      try {
        const url = Deno.env.get("SUPABASE_URL") ?? "";
        const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const phone = String(user.phone || "");
        const maskedHp = phone.length > 6 ? phone.slice(0, 4) + "****" + phone.slice(-4) : phone;
        const p = fetch(`${url}/functions/v1/send-wa-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            event_type: "login",
            notify_visitor_id: payload.visitorId || null,
            vars: {
              user: user.username || identifier,
              hp: maskedHp || "-",
              device: payload.deviceInfo?.device || payload.deviceInfo?.browser || "Unknown",
            },
          }),
        }).catch((e) => { console.error("send-wa-notification failed:", e); });
        // @ts-ignore
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) { /* @ts-ignore */ EdgeRuntime.waitUntil(p); } else { await p; }
      } catch (e) { console.error("notif dispatch error:", e); }

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
        .eq("token", resetToken.toString().trim())
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

      // Load current account to check name-change quota
      const { data: current } = await admin
        .from("user_balances")
        .select("id, username, name_change_count, name_change_period")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      const updates: Record<string, string | number> = {};
      const period = currentPeriod();
      let nameChanged = false;

      if (username && username.trim().length >= 3 && current && username.trim() !== current.username) {
        // Enforce max 3 name changes per calendar month
        const usedThisPeriod = (current.name_change_period === period) ? (current.name_change_count || 0) : 0;
        if (usedThisPeriod >= 3) {
          return Response.json({ error: "Batas ganti nama tercapai (maks 3x per bulan). Coba lagi bulan depan." }, { status: 400, headers: corsHeaders });
        }
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
        updates.name_change_count = usedThisPeriod + 1;
        updates.name_change_period = period;
        nameChanged = true;
      }
      if (phone && phone.trim().length >= 7) {
        updates.phone = normalizePhone(phone);
      }

      if (Object.keys(updates).length === 0) {
        return Response.json({ error: "Tidak ada perubahan" }, { status: 400, headers: corsHeaders });
      }

      const { data: updated, error: updateErr } = await admin
        .from("user_balances")
        .update(updates)
        .eq("visitor_id", visitorId)
        .select("id, visitor_id, username, phone, email, balance, name_change_count, name_change_period")
        .single();

      if (updateErr || !updated) {
        return Response.json({ error: "Gagal memperbarui profil" }, { status: 500, headers: corsHeaders });
      }

      const remaining = nameChanged || (updated.name_change_period === period)
        ? Math.max(0, 3 - (updated.name_change_period === period ? (updated.name_change_count || 0) : 0))
        : 3;

      return Response.json({ success: true, user: updated, nameChangesLeft: remaining, message: "Profil berhasil diperbarui" }, { headers: corsHeaders });
    }

    // === LOGIN CODE: get or create for this device's account ===
    if (action === "get_login_code" || action === "regenerate_login_code") {
      const { visitorId } = payload;
      if (!visitorId) {
        return Response.json({ error: "ID tidak ditemukan" }, { status: 400, headers: corsHeaders });
      }
      const { data: user } = await admin
        .from("user_balances")
        .select("id, login_code, email, password_hash")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (!user) {
        return Response.json({ error: "Akun tidak ditemukan" }, { status: 404, headers: corsHeaders });
      }
      if (!user.email || !user.password_hash) {
        return Response.json({ error: "Daftarkan akun (email & sandi) dulu untuk membuat kode login." }, { status: 400, headers: corsHeaders });
      }
      let code = user.login_code;
      if (action === "regenerate_login_code" || !code) {
        code = await generateUniqueLoginCode(admin);
        await admin.from("user_balances").update({ login_code: code }).eq("id", user.id);
      }
      return Response.json({ success: true, code }, { headers: corsHeaders });
    }

    // === LOGIN WITH CODE (barcode / kode) ===
    if (action === "login_with_code") {
      const rawCode = String(payload.code || "").trim().toUpperCase();
      if (!rawCode || rawCode.length < 6) {
        return Response.json({ error: "Kode login tidak valid" }, { status: 400, headers: corsHeaders });
      }
      const { data: user } = await admin
        .from("user_balances")
        .select("id, visitor_id, username, phone, email, balance")
        .eq("login_code", rawCode)
        .maybeSingle();
      if (!user) {
        return Response.json({ error: "Kode login tidak ditemukan atau sudah diganti" }, { status: 401, headers: corsHeaders });
      }

      if (payload.deviceInfo) {
        await admin.from("balance_login_history").insert({
          user_balance_id: user.id,
          visitor_id: user.visitor_id,
          device_info: payload.deviceInfo?.device || null,
          browser: payload.deviceInfo?.browser || null,
          ip_address: payload.deviceInfo?.ip || null,
        });
      }

      try {
        const url = Deno.env.get("SUPABASE_URL") ?? "";
        const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const phone = String(user.phone || "");
        const maskedHp = phone.length > 6 ? phone.slice(0, 4) + "****" + phone.slice(-4) : phone;
        const p = fetch(`${url}/functions/v1/send-wa-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            event_type: "login",
            notify_visitor_id: user.visitor_id,
            vars: { user: user.username || "-", hp: maskedHp || "-", device: (payload.deviceInfo?.device || "Kode/Barcode") + " (kode)" },
          }),
        }).catch(() => {});
        // @ts-ignore
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) { /* @ts-ignore */ EdgeRuntime.waitUntil(p); } else { await p; }
      } catch (_) { /* ignore */ }

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
