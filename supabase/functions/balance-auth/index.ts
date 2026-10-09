import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { isAdminRequest } from "../_shared/admin.ts";
import { resolveWalletIdentity } from "../_shared/wallet-identity.ts";
import { buildDeviceFields, normalizeHistoryQuery, serverIpFromHeaders } from "../_shared/login-device.ts";

// Satu tempat pencatatan riwayat login: IP dari header server, detail perangkat terstruktur.
// deno-lint-ignore no-explicit-any
async function insertLoginHistory(admin: any, request: Request, payload: any, userBalanceId: string, accountVisitorId: string, method: string, fallbackDevice: string | null = null) {
  const di = payload?.deviceInfo || {};
  const fields = buildDeviceFields(di.details, request.headers.get("user-agent"));
  const ip = serverIpFromHeaders(request.headers);
  const deviceVisitor = typeof payload?.visitorId === "string" ? payload.visitorId.trim().slice(0, 80) : null;
  const { error } = await admin.from("balance_login_history").insert({
    user_balance_id: userBalanceId,
    visitor_id: accountVisitorId,
    device_info: di.device || fallbackDevice,
    browser: di.browser || null,
    ip_address: ip,
    ip_source: ip ? "server" : null,
    device_visitor_id: deviceVisitor || null,
    login_method: method,
    ...fields,
  });
  if (error) console.error("[login_history insert]", error.message);
}

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
    .select("id, visitor_id, username, phone, email, balance, auth_user_id")
    .eq("email", lowered)
    .eq("password_hash", passwordHash)
    .maybeSingle();

  if (byEmail) return byEmail;

  const { data: byUsername } = await admin
    .from("user_balances")
    .select("id, visitor_id, username, phone, email, balance, auth_user_id")
    .ilike("username", trimmed)
    .eq("password_hash", passwordHash)
    .maybeSingle();

  if (byUsername) return byUsername;

  const phoneVariants = normalizedPhoneVariants(trimmed);
  if (phoneVariants.length > 0) {
    const { data: phoneUsers } = await admin
      .from("user_balances")
      .select("id, visitor_id, username, phone, email, balance, auth_user_id")
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

// ===== TOTP (Google Authenticator) helpers =====
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function generateTotpSecret(len = 20): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/g, "").toUpperCase().replace(/\s/g, "");
  let bits = "";
  for (const c of clean) {
    const idx = B32_ALPHABET.indexOf(c);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}
async function totpCodeAt(secret: string, counter: number): Promise<string> {
  const keyData = base32Decode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const offset = sig[sig.length - 1] & 0x0f;
  const bin = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3];
  return String(bin % 1000000).padStart(6, "0");
}
async function verifyTotp(secret: string, token: string): Promise<boolean> {
  if (!secret || !/^\d{6}$/.test(token || "")) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  // ±2 langkah (~±60-90 detik) untuk mentoleransi jam perangkat yang sedikit meleset
  for (let w = -2; w <= 2; w++) {
    if (await totpCodeAt(secret, step + w) === token) return true;
  }
  return false;
}
function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    codes.push(String(n).padStart(6, "0"));
  }
  return codes;
}

// ===== Proteksi brute-force login (sederhana untuk user, ketat untuk penyerang) =====
const LOGIN_MAX_FAIL = 5;          // 5 kali salah
const LOGIN_WINDOW_MIN = 15;       // dalam 15 menit
const LOGIN_ATTEMPT_ACTION = "balance_login";

async function loginKey(identifier: string): Promise<string> {
  const enc = new TextEncoder().encode(`login:${identifier.trim().toLowerCase()}`);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return "lg_" + Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

async function checkLoginLock(admin: ReturnType<typeof createClient>, identifier: string) {
  try {
    const key = await loginKey(identifier);
    const since = new Date(Date.now() - LOGIN_WINDOW_MIN * 60000).toISOString();
    const { count } = await admin
      .from("pin_attempts")
      .select("id", { count: "exact", head: true })
      .eq("visitor_id", key)
      .eq("action", LOGIN_ATTEMPT_ACTION)
      .eq("succeeded", false)
      .gte("attempted_at", since);
    const fails = count ?? 0;
    return { locked: fails >= LOGIN_MAX_FAIL, remaining: Math.max(0, LOGIN_MAX_FAIL - fails) };
  } catch {
    return { locked: false, remaining: LOGIN_MAX_FAIL };
  }
}

async function logLoginAttempt(
  admin: ReturnType<typeof createClient>,
  identifier: string,
  succeeded: boolean,
  ip: string | null,
) {
  try {
    const key = await loginKey(identifier);
    if (succeeded) {
      // Login berhasil → bersihkan catatan gagal supaya user tidak terkunci
      await admin.from("pin_attempts").delete().eq("visitor_id", key).eq("action", LOGIN_ATTEMPT_ACTION);
      return;
    }
    await admin.from("pin_attempts").insert({
      visitor_id: key,
      action: LOGIN_ATTEMPT_ACTION,
      succeeded: false,
      ip_address: ip,
    });
  } catch { /* best-effort */ }
}

// Selesaikan login: catat riwayat perangkat + notif WA + kembalikan user
async function finishLogin(admin: ReturnType<typeof createClient>, user: any, payload: any, identifier: string, request: Request, method = "password") {
  // Deteksi perangkat baru (belum pernah login di akun ini)
  let isNewDevice = false;
  const deviceName = payload.deviceInfo?.device || payload.deviceInfo?.browser || "Perangkat tidak dikenal";
  try {
    const { data: known } = await admin
      .from("balance_login_history")
      .select("id, device_info, browser")
      .eq("user_balance_id", user.id)
      .limit(50);
    if (Array.isArray(known) && known.length > 0) {
      isNewDevice = !known.some(
        (h: any) =>
          (h.device_info && h.device_info === payload.deviceInfo?.device) ||
          (h.browser && h.browser === payload.deviceInfo?.browser),
      );
    }
  } catch { /* abaikan */ }

  if (payload.deviceInfo) {
    await insertLoginHistory(admin, request, payload, user.id, user.visitor_id, method);
  }

  if (isNewDevice) {
    try {
      await admin.rpc("create_notification", {
        p_visitor_id: user.visitor_id,
        p_title: "🔐 Login dari perangkat baru",
        p_message: `Akun Anda baru saja login dari ${deviceName}. Jika ini bukan Anda, segera ganti sandi & aktifkan 2FA.`,
        p_type: "security",
        p_related_id: null,
      });
    } catch { /* abaikan */ }
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
  const { totp_secret, totp_backup_codes, ...safeUser } = user;
  return Response.json({ success: true, user: safeUser, action: "logged_in", newDevice: isNewDevice }, { headers: corsHeaders });
}
function randomLoginCode(len = 8): string {
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

// ===== Origin allow-list: barcode/kode hanya sah dari website resmi =====
const ALLOWED_ORIGIN_HOSTS = [
  "agungadistore.lovable.app",
  "id-preview--9938d2f7-32f1-4a21-8024-63ca072797fe.lovable.app",
  "9938d2f7-32f1-4a21-8024-63ca072797fe.lovableproject.com",
];
function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin") || request.headers.get("referer") || "";
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    if (ALLOWED_ORIGIN_HOSTS.includes(host)) return true;
    if (host.endsWith(".lovable.app")) return true; // preview & published lovable
    if (host.endsWith(".lovableproject.com")) return true; // editor preview resmi Lovable
    if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return true;
    return false;
  } catch {
    return false;
  }
}

// HMAC signature so a barcode image dibuat di luar website resmi tidak cocok
async function signLoginCode(code: string): Promise<string> {
  const secret = Deno.env.get("LOGIN_CODE_SIGN_SECRET") ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(code));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 20);
}

function gen6DigitCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
}

function maskPhone(phone: string): string {
  const p = String(phone || "");
  return p.length > 6 ? p.slice(0, 4) + "****" + p.slice(-3) : p;
}

// Kirim teks langsung ke nomor WA terdaftar via bot
async function sendWaText(waNumber: string, text: string) {
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    await fetch(`${url}/functions/v1/send-wa-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ text, wa_number: waNumber, event_type: "reset" }),
    });
  } catch (e) {
    console.error("sendWaText failed:", e);
  }
}

// Cek kepercayaan perangkat: perangkat utama (pembuat akun) atau sudah nempel >= 30 hari
async function deviceTrust(
  admin: ReturnType<typeof createClient>,
  user: { id: string; visitor_id: string; device_bound_at?: string | null },
  visitorId: string,
): Promise<{ trusted: boolean; ageDays: number; known: boolean; isPrimary: boolean }> {
  if (user.visitor_id === visitorId) {
    const boundAt = user.device_bound_at ? new Date(user.device_bound_at).getTime() : Date.now();
    return { trusted: true, ageDays: (Date.now() - boundAt) / 86400000, known: true, isPrimary: true };
  }
  const { data } = await admin
    .from("balance_login_history")
    .select("logged_in_at")
    .eq("user_balance_id", user.id)
    .eq("visitor_id", visitorId)
    .order("logged_in_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return { trusted: false, ageDays: 0, known: false, isPrimary: false };
  const ageDays = (Date.now() - new Date(data.logged_in_at).getTime()) / 86400000;
  return { trusted: ageDays >= 30, ageDays, known: true, isPrimary: false };
}

// Catat pelanggaran/percobaan; 10x dalam 60 menit -> blokir sementara 3 hari
async function registerAbuse(
  admin: ReturnType<typeof createClient>,
  user: { id: string; visitor_id: string } | null,
  visitorId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await admin.from("balance_wa_reset_codes").insert({
    user_balance_id: user?.id ?? null,
    visitor_id: visitorId,
    purpose: "abuse",
    code: "-",
    expires_at: new Date().toISOString(),
    is_used: true,
  });
  const { count } = await admin
    .from("balance_wa_reset_codes")
    .select("id", { count: "exact", head: true })
    .eq("visitor_id", visitorId)
    .eq("purpose", "abuse")
    .gte("created_at", since);
  if ((count ?? 0) >= 10) {
    const { data: existingBan } = await admin
      .from("account_bans")
      .select("id")
      .eq("visitor_id", visitorId)
      .eq("is_active", true)
      .maybeSingle();
    if (!existingBan) {
      await admin.from("account_bans").insert({
        visitor_id: visitorId,
        user_balance_id: user?.id ?? null,
        reason: "Terlalu banyak percobaan reset/aktivitas mencurigakan pada perangkat tidak dikenal.",
        is_permanent: false,
        banned_until: new Date(Date.now() + 3 * 86400000).toISOString(),
        banned_by: "system",
        is_active: true,
      });
    }
    return true;
  }
  return false;
}

// Cari akun tanpa sandi (untuk reset via WA) berdasarkan email/username/no HP
async function findAccountByIdentifier(admin: ReturnType<typeof createClient>, identifier: string) {
  const trimmed = identifier.trim();
  const lowered = trimmed.toLowerCase();
  const cols = "id, visitor_id, username, phone, email, balance, device_bound_at";
  const { data: byEmail } = await admin.from("user_balances").select(cols).eq("email", lowered).maybeSingle();
  if (byEmail) return byEmail;
  const { data: byUsername } = await admin.from("user_balances").select(cols).ilike("username", trimmed).maybeSingle();
  if (byUsername) return byUsername;
  const variants = normalizedPhoneVariants(trimmed);
  if (variants.length > 0) {
    const { data: byPhone } = await admin.from("user_balances").select(cols).in("phone", variants).limit(1);
    if (byPhone?.[0]) return byPhone[0];
  }
  return null;
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

    // === AUTH BRIDGE: login account (Supabase Auth) -> existing wallet (user_balances) ===
    // Identity comes ONLY from the verified bearer token; never from the request body.
    if (action === "auth_link") {
      const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: authData, error: authErr } = await admin.auth.getUser(token);
      const authUser = authData?.user;
      if (authErr || !authUser) {
        return Response.json({ error: "Sesi login tidak valid. Silakan login ulang." }, { status: 401, headers: corsHeaders });
      }
      const authEmail = (authUser.email || "").toLowerCase();
      const emailConfirmed = Boolean(authUser.email_confirmed_at);
      if (!emailConfirmed) {
        return Response.json({ error: "Silakan verifikasi email terlebih dahulu.", code: "email_not_confirmed" }, { status: 403, headers: corsHeaders });
      }
      const cols = "id, visitor_id, username, phone, email, balance, totp_secret, totp_enabled, totp_backup_codes, auth_user_id";
      let { data: row } = await admin.from("user_balances").select(cols).eq("auth_user_id", authUser.id).maybeSingle();
      let linked = false;
      if (!row && await isAdminRequest(request, admin)) {
        // Admin login accounts never get or claim a user wallet.
        return Response.json({ error: "Akun admin tidak bisa dipakai sebagai wallet pengguna.", code: "admin_conflict" }, { status: 409, headers: corsHeaders });
      }
      if (!row && authEmail) {
        // Email match alone is NOT proof of wallet ownership: never auto-link, never duplicate.
        const { data: byEmail } = await admin.from("user_balances").select("id, auth_user_id").ilike("email", authEmail.replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle();
        if (byEmail) {
          return Response.json({
            error: byEmail.auth_user_id
              ? "Email ini sudah terhubung ke akun lain. Hubungi admin."
              : "Email ini sudah dipakai wallet lama. Hubungkan dengan memasukkan data login wallet lama.",
            code: byEmail.auth_user_id ? "already_linked" : "link_required",
          }, { status: 409, headers: corsHeaders });
        }
      }
      if (!row) {
        // Brand-new account: create its wallet once.
        const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
        const base = String(meta.username || meta.full_name || meta.name || authEmail.split("@")[0] || "user")
          .replace(/[^A-Za-z0-9_.]/g, "").slice(0, 20) || "user";
        let uname = base.length >= 3 ? base : `${base}user`;
        for (let i = 0; i < 5; i++) {
          const { data: taken } = await admin.from("user_balances").select("id").ilike("username", uname).maybeSingle();
          if (!taken) break;
          uname = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
        }
        const phone = typeof meta.phone === "string" ? normalizePhone(meta.phone) : "";
        const { data: created, error: insErr } = await admin.from("user_balances").insert({
          visitor_id: crypto.randomUUID(), username: uname, phone, email: authEmail, auth_user_id: authUser.id,
        }).select(cols).single();
        if (insErr || !created) {
          console.error("auth_link insert failed", insErr);
          return Response.json({ error: "Gagal membuat akun saldo." }, { status: 500, headers: corsHeaders });
        }
        row = created;
        linked = true;
      }
      // Keep wallet email in sync with the confirmed login email (after email-change confirmation).
      if (authEmail && row.email !== authEmail) {
        const { data: clash } = await admin.from("user_balances").select("id").ilike("email", authEmail.replace(/[\\%_]/g, "\\$&")).neq("id", row.id).limit(1).maybeSingle();
        if (!clash) { await admin.from("user_balances").update({ email: authEmail }).eq("id", row.id); row.email = authEmail; }
      }
      // App-level 2FA stays separate from the login password.
      if (row.totp_enabled) {
        const code = String(payload.totpCode || "").trim();
        if (!code) return Response.json({ success: true, needTotp: true }, { headers: corsHeaders });
        let ok = await verifyTotp(row.totp_secret || "", code);
        if (!ok && /^\d{6}$/.test(code) && Array.isArray(row.totp_backup_codes) && row.totp_backup_codes.includes(code)) {
          await admin.from("user_balances").update({ totp_backup_codes: row.totp_backup_codes.filter((c: string) => c !== code) }).eq("id", row.id);
          ok = true;
        }
        if (!ok) return Response.json({ error: "Kode 2FA / kode cadangan salah." }, { status: 401, headers: corsHeaders });
      }
      const { totp_secret: _s, totp_backup_codes: _b, auth_user_id: _a, ...safe } = row as any;
      const res = await finishLogin(admin, safe, payload, authEmail, request, "auth");
      if (linked) console.log("auth_link linked wallet", row.id);
      return res;
    }

    // === LEGACY MIGRATION: DISABLED ===
    // It created a pre-confirmed login account from the old wallet password alone,
    // without proving the user controls the email. Old wallets keep using the legacy
    // "login" action until they link via "claim_link" (two proofs).
    if (action === "legacy_migrate") {
      return Response.json({ error: "Migrasi otomatis dinonaktifkan. Login seperti biasa.", code: "migration_disabled" }, { status: 410, headers: corsHeaders });
    }

    // === SECURE CLAIM: link an existing wallet to the signed-in login account ===
    // Requires BOTH proofs: (1) a login account whose email is verified by the auth
    // system, and (2) the existing wallet password. Wallet email must equal the
    // verified email. Admin accounts are never linked. Never creates a wallet.
    if (action === "claim_link") {
      const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: authData } = await admin.auth.getUser(token);
      const authUser = authData?.user;
      if (!authUser) return Response.json({ error: "Sesi login tidak valid. Silakan login ulang." }, { status: 401, headers: corsHeaders });
      if (!authUser.email_confirmed_at) return Response.json({ error: "Verifikasi email login terlebih dahulu.", code: "email_not_confirmed" }, { status: 403, headers: corsHeaders });
      if (await isAdminRequest(request, admin)) {
        return Response.json({ error: "Akun admin tidak bisa dihubungkan ke wallet pengguna.", code: "admin_conflict" }, { status: 409, headers: corsHeaders });
      }
      const { loginId, password } = payload;
      if (!loginId || !password) return Response.json({ error: "Isi username/email/no HP dan sandi wallet lama." }, { status: 400, headers: corsHeaders });
      const lock = await checkLoginLock(admin, loginId);
      if (lock.locked) return Response.json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${LOGIN_WINDOW_MIN} menit.` }, { status: 429, headers: corsHeaders });
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
      const wallet = await findUserByLogin(admin, loginId, await hashPassword(password));
      if (!wallet) {
        await logLoginAttempt(admin, loginId, false, clientIp);
        return Response.json({ error: "Data wallet lama salah.", code: "invalid_credentials" }, { status: 401, headers: corsHeaders });
      }
      await logLoginAttempt(admin, loginId, true, clientIp);
      const authEmail = (authUser.email || "").toLowerCase();
      if (!wallet.email || wallet.email.toLowerCase() !== authEmail) {
        return Response.json({ error: "Email wallet berbeda dengan email login. Hubungi admin untuk verifikasi manual.", code: "email_mismatch" }, { status: 409, headers: corsHeaders });
      }
      if (wallet.auth_user_id) {
        return Response.json({ error: wallet.auth_user_id === authUser.id ? "Wallet sudah terhubung." : "Wallet ini sudah terhubung ke akun login lain.", code: "already_linked" }, { status: 409, headers: corsHeaders });
      }
      const { data: other } = await admin.from("user_balances").select("id").eq("auth_user_id", authUser.id).maybeSingle();
      if (other) return Response.json({ error: "Akun login ini sudah punya wallet lain.", code: "auth_has_wallet" }, { status: 409, headers: corsHeaders });
      const { data: upd, error: linkErr } = await admin.from("user_balances").update({ auth_user_id: authUser.id }).eq("id", wallet.id).is("auth_user_id", null).select("id");
      if (linkErr || !upd?.length) return Response.json({ error: "Gagal menghubungkan wallet. Coba lagi." }, { status: 500, headers: corsHeaders });
      console.log("claim_link linked wallet", wallet.id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

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
          await insertLoginHistory(admin, request, payload, upgradedUser.id, visitorId, "register", null);
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
          await insertLoginHistory(admin, request, payload, upgradedGuest.id, visitorId, "register", null);
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
        await insertLoginHistory(admin, request, payload, newUser.id, visitorId, "register", null);
      }

      return Response.json({ success: true, user: newUser, action: "registered" }, { headers: corsHeaders });
    }

    // === LOGIN (supports email, username, or phone) ===
    if (action === "login" || action === "verify_totp" || action === "confirm_totp_setup") {
      const { email, password, loginId } = payload;
      const identifier = loginId || email; // support both old 'email' field and new 'loginId'

      if (!identifier || !password) {
        return Response.json({ error: "Email/Username/No HP dan sandi wajib diisi" }, { status: 400, headers: corsHeaders });
      }

      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        request.headers.get("cf-connecting-ip") ??
        null;

      const lock = await checkLoginLock(admin, identifier);
      if (lock.locked) {
        return Response.json(
          { error: `Terlalu banyak percobaan login gagal. Demi keamanan, coba lagi dalam ${LOGIN_WINDOW_MIN} menit atau reset sandi.`, locked: true },
          { status: 429, headers: { ...corsHeaders, "Retry-After": String(LOGIN_WINDOW_MIN * 60) } },
        );
      }

      const passwordHash = await hashPassword(password);
      const baseUser = await findUserByLogin(admin, identifier, passwordHash);

      if (!baseUser) {
        await logLoginAttempt(admin, identifier, false, clientIp);
        const left = Math.max(0, lock.remaining - 1);
        return Response.json(
          {
            error: left > 0
              ? `Email/Username/No HP atau sandi salah. Sisa ${left} percobaan sebelum akun dikunci sementara.`
              : "Email/Username/No HP atau sandi salah. Akun dikunci sementara demi keamanan.",
            attemptsLeft: left,
          },
          { status: 401, headers: corsHeaders },
        );
      }

      // Wallet sudah pindah ke login baru: sandi lama tidak berlaku lagi di jalur ini.
      if ((baseUser as any).auth_user_id) {
        return Response.json({ error: "Akun ini sudah memakai login baru. Silakan login dengan email & sandi.", code: "use_auth_login" }, { status: 409, headers: corsHeaders });
      }
      await logLoginAttempt(admin, identifier, true, clientIp);
      delete (baseUser as any).auth_user_id;


      // Ambil status 2FA
      const { data: sec } = await admin
        .from("user_balances")
        .select("totp_secret, totp_enabled, totp_backup_codes")
        .eq("id", baseUser.id)
        .maybeSingle();
      const user = { ...baseUser, ...(sec || {}) };

      // ── STEP 1: login (verifikasi sandi) — tentukan langkah 2FA ──
      if (action === "login") {
        if (user.totp_enabled) {
          return Response.json({ success: true, needTotp: true, action: "need_totp" }, { headers: corsHeaders });
        }
        // 2FA sekarang opsional: akun yang belum mengaktifkan 2FA bisa login biasa.
        return await finishLogin(admin, user, payload, identifier, request);
      }

      // ── STEP 2a: konfirmasi setup 2FA (scan lalu masukkan kode) ──
      if (action === "confirm_totp_setup") {
        const code = String(payload.totpCode || "").trim();
        if (!user.totp_secret) return Response.json({ error: "Rahasia 2FA belum dibuat. Ulangi login." }, { status: 400, headers: corsHeaders });
        const ok = await verifyTotp(user.totp_secret, code);
        if (!ok) return Response.json({ error: "Kode 2FA salah. Pastikan waktu perangkat akurat." }, { status: 401, headers: corsHeaders });
        await admin.from("user_balances").update({ totp_enabled: true }).eq("id", user.id);
        return await finishLogin(admin, user, payload, identifier, request);
      }

      // ── STEP 2b: verifikasi 2FA saat login (kode authenticator / kode cadangan) ──
      if (action === "verify_totp") {
        const code = String(payload.totpCode || "").trim();
        let ok = await verifyTotp(user.totp_secret || "", code);
        if (!ok && /^\d{6}$/.test(code) && Array.isArray(user.totp_backup_codes) && user.totp_backup_codes.includes(code)) {
          // Kode cadangan: pakai sekali lalu hapus
          const remaining = user.totp_backup_codes.filter((c: string) => c !== code);
          await admin.from("user_balances").update({ totp_backup_codes: remaining }).eq("id", user.id);
          ok = true;
        }
        if (!ok) return Response.json({ error: "Kode 2FA / kode cadangan salah." }, { status: 401, headers: corsHeaders });
        return await finishLogin(admin, user, payload, identifier, request);
      }
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

    // === 2FA MANAGEMENT (logged-in, keyed by visitorId) ===
    if (action === "get_2fa_status") {
      const { visitorId } = payload;
      if (!visitorId) return Response.json({ error: "ID tidak ditemukan" }, { status: 400, headers: corsHeaders });
      const { data: u } = await admin
        .from("user_balances")
        .select("totp_enabled, totp_backup_codes")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (!u) return Response.json({ error: "Akun tidak ditemukan" }, { status: 404, headers: corsHeaders });
      return Response.json({
        success: true,
        enabled: !!u.totp_enabled,
        backupCount: Array.isArray(u.totp_backup_codes) ? u.totp_backup_codes.length : 0,
      }, { headers: corsHeaders });
    }

    if (action === "start_2fa_setup") {
      const { visitorId } = payload;
      if (!visitorId) return Response.json({ error: "ID tidak ditemukan" }, { status: 400, headers: corsHeaders });
      const { data: u } = await admin
        .from("user_balances")
        .select("id, username, email, totp_enabled")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (!u) return Response.json({ error: "Akun tidak ditemukan" }, { status: 404, headers: corsHeaders });
      if (u.totp_enabled) return Response.json({ error: "2FA sudah aktif" }, { status: 400, headers: corsHeaders });
      const secret = generateTotpSecret();
      await admin.from("user_balances").update({
        totp_secret: secret,
        totp_enabled: false,
        totp_backup_codes: [],
      }).eq("id", u.id);
      const label = encodeURIComponent(`Agung Adi Store:${u.username || u.email || visitorId}`);
      const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=Agung%20Adi%20Store&algorithm=SHA1&digits=6&period=30`;
      return Response.json({ success: true, otpauth, secret }, { headers: corsHeaders });
    }

    if (action === "confirm_2fa_setup") {
      const { visitorId } = payload;
      const code = String(payload.totpCode || "").trim();
      if (!visitorId) return Response.json({ error: "ID tidak ditemukan" }, { status: 400, headers: corsHeaders });
      const { data: u } = await admin
        .from("user_balances")
        .select("id, totp_secret")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (!u || !u.totp_secret) return Response.json({ error: "Rahasia 2FA belum dibuat. Ulangi setup." }, { status: 400, headers: corsHeaders });
      const ok = await verifyTotp(u.totp_secret, code);
      if (!ok) return Response.json({ error: "Kode 2FA salah. Pastikan waktu perangkat akurat." }, { status: 401, headers: corsHeaders });
      const backupCodes = generateBackupCodes(8);
      await admin.from("user_balances").update({ totp_enabled: true, totp_backup_codes: backupCodes }).eq("id", u.id);
      return Response.json({ success: true, backupCodes }, { headers: corsHeaders });
    }

    if (action === "regen_backup_codes") {
      const { visitorId } = payload;
      const code = String(payload.totpCode || "").trim();
      if (!visitorId) return Response.json({ error: "ID tidak ditemukan" }, { status: 400, headers: corsHeaders });
      const { data: u } = await admin
        .from("user_balances")
        .select("id, totp_secret, totp_enabled")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (!u || !u.totp_enabled) return Response.json({ error: "2FA belum aktif" }, { status: 400, headers: corsHeaders });
      const ok = await verifyTotp(u.totp_secret || "", code);
      if (!ok) return Response.json({ error: "Kode 2FA salah. Pastikan waktu perangkat akurat." }, { status: 401, headers: corsHeaders });
      const backupCodes = generateBackupCodes(8);
      await admin.from("user_balances").update({ totp_backup_codes: backupCodes }).eq("id", u.id);
      return Response.json({ success: true, backupCodes }, { headers: corsHeaders });
    }

    if (action === "view_2fa_barcode") {
      const { visitorId } = payload;
      const code = String(payload.totpCode || "").trim();
      if (!visitorId) return Response.json({ error: "ID tidak ditemukan" }, { status: 400, headers: corsHeaders });
      const { data: u } = await admin
        .from("user_balances")
        .select("username, email, totp_secret, totp_enabled")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (!u || !u.totp_enabled || !u.totp_secret) return Response.json({ error: "2FA belum aktif" }, { status: 400, headers: corsHeaders });
      const ok = await verifyTotp(u.totp_secret, code);
      if (!ok) return Response.json({ error: "Kode 2FA salah. Pastikan waktu perangkat akurat." }, { status: 401, headers: corsHeaders });
      const label = encodeURIComponent(`Agung Adi Store:${u.username || u.email || visitorId}`);
      const otpauth = `otpauth://totp/${label}?secret=${u.totp_secret}&issuer=Agung%20Adi%20Store&algorithm=SHA1&digits=6&period=30`;
      return Response.json({ success: true, otpauth, secret: u.totp_secret }, { headers: corsHeaders });
    }

    if (action === "disable_2fa") {
      const { visitorId } = payload;
      const code = String(payload.totpCode || "").trim();
      if (!visitorId) return Response.json({ error: "ID tidak ditemukan" }, { status: 400, headers: corsHeaders });
      const { data: u } = await admin
        .from("user_balances")
        .select("id, totp_secret, totp_enabled, totp_backup_codes")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (!u || !u.totp_enabled) return Response.json({ error: "2FA belum aktif" }, { status: 400, headers: corsHeaders });
      let ok = await verifyTotp(u.totp_secret || "", code);
      if (!ok && /^\d{6}$/.test(code) && Array.isArray(u.totp_backup_codes) && u.totp_backup_codes.includes(code)) {
        ok = true;
      }
      if (!ok) return Response.json({ error: "Kode 2FA / kode cadangan salah." }, { status: 401, headers: corsHeaders });
      await admin.from("user_balances").update({
        totp_enabled: false,
        totp_secret: null,
        totp_backup_codes: [],
      }).eq("id", u.id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

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
      let code = user.login_code;
      if (action === "regenerate_login_code" || !code) {
        code = await generateUniqueLoginCode(admin);
        await admin.from("user_balances").update({ login_code: code }).eq("id", user.id);
      }
      const sig = await signLoginCode(code);
      return Response.json({ success: true, code, sig }, { headers: corsHeaders });

    }

    // === LOGIN WITH CODE (barcode / kode perangkat web) ===
    if (action === "login_with_code") {
      // Kode perangkat hanya bisa dipakai dari website resmi. Barcode memakai tanda tangan tambahan.
      if (!originAllowed(request)) {
        return Response.json({ error: "Kode/barcode hanya bisa dipakai dari website resmi Agung Adi Store." }, { status: 403, headers: corsHeaders });
      }
      const rawCode = String(payload.code || "").trim().toUpperCase();
      const sig = String(payload.sig || "").trim();
      if (!/^[A-Z0-9]{6,12}$/.test(rawCode)) {
        return Response.json({ error: "Kode login tidak valid" }, { status: 400, headers: corsHeaders });
      }
      if (sig) {
        const expectedSig = await signLoginCode(rawCode);
        if (sig !== expectedSig) {
          return Response.json({ error: "Barcode tidak sah / bukan dari website resmi." }, { status: 403, headers: corsHeaders });
        }
      }

      const { data: user } = await admin
        .from("user_balances")
        .select("id, visitor_id, username, phone, email, balance, totp_secret, totp_enabled, totp_backup_codes")
        .eq("login_code", rawCode)
        .maybeSingle();
      if (!user) {
        return Response.json({ error: "Kode login tidak ditemukan atau sudah diganti" }, { status: 401, headers: corsHeaders });
      }

      // 2FA juga berlaku untuk login via kode/barcode
      if (user.totp_enabled) {
        const totpCode = String(payload.totpCode || "").trim();
        if (!totpCode) {
          return Response.json({ success: true, needTotp: true, action: "need_totp" }, { headers: corsHeaders });
        }
        let ok = await verifyTotp(user.totp_secret || "", totpCode);
        if (!ok && /^\d{6}$/.test(totpCode) && Array.isArray(user.totp_backup_codes) && user.totp_backup_codes.includes(totpCode)) {
          const remaining = user.totp_backup_codes.filter((c: string) => c !== totpCode);
          await admin.from("user_balances").update({ totp_backup_codes: remaining }).eq("id", user.id);
          ok = true;
        }
        if (!ok) return Response.json({ error: "Kode 2FA / kode cadangan salah." }, { status: 401, headers: corsHeaders });
      }

      if (payload.deviceInfo) {
        await insertLoginHistory(admin, request, payload, user.id, user.visitor_id, "code", null);
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

      const { totp_secret: _ts, totp_backup_codes: _bc, totp_enabled: _te, ...safeCodeUser } = user as any;
      return Response.json({ success: true, user: safeCodeUser, action: "logged_in" }, { headers: corsHeaders });
    }

    // === LOGIN WITH WHATSAPP TOKEN (.logintoken dari bot WA) ===
    if (action === "verify_wa_login_token") {
      const inputCode = String(payload.code || "").trim().toUpperCase();
      const visitorId = String(payload.visitorId || "").trim();
      if (!/^[A-Z0-9]{6,32}$/.test(inputCode)) {
        return Response.json({ error: "Token login WA tidak valid" }, { status: 400, headers: corsHeaders });
      }

      const { data: row } = await admin
        .from("balance_wa_reset_codes")
        .select("*, user_balances:user_balance_id(id, visitor_id, username, phone, email, balance, totp_secret, totp_enabled, totp_backup_codes)")
        .eq("purpose", "wa_login")
        .eq("code", inputCode)
        .eq("is_used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) return Response.json({ error: "Token tidak ditemukan / sudah dipakai" }, { status: 404, headers: corsHeaders });
      if (new Date(row.expires_at) < new Date()) {
        await admin.from("balance_wa_reset_codes").update({ is_used: true }).eq("id", row.id);
        return Response.json({ error: "Token sudah kedaluwarsa. Minta .logintoken lagi di WA." }, { status: 400, headers: corsHeaders });
      }
      if ((row.attempts || 0) >= (row.max_attempts || 3)) {
        await admin.from("balance_wa_reset_codes").update({ is_used: true }).eq("id", row.id);
        return Response.json({ error: "Percobaan token habis. Minta token baru." }, { status: 429, headers: corsHeaders });
      }

      // Token .logintoken TIDAK mengikuti nomor WA / akun WA lama.
      // Akun yang dipakai selalu akun saldo yang sedang login di web saat menekan "Ya".
      const accountVisitorId = String(payload.accountVisitorId || payload.account_visitor_id || "").trim();
      if (!accountVisitorId) {
        return Response.json({ error: "Token WA harus dikonfirmasi dari akun saldo yang sudah login di web." }, { status: 400, headers: corsHeaders });
      }
      const { data: approvingUser } = await admin
        .from("user_balances")
        .select("id, visitor_id, username, phone, email, balance, totp_secret, totp_enabled, totp_backup_codes")
        .eq("visitor_id", accountVisitorId)
        .maybeSingle();
      if (!approvingUser?.id) return Response.json({ error: "Akun saldo web tidak ditemukan." }, { status: 404, headers: corsHeaders });
      const user = approvingUser;

      if (user.totp_enabled) {
        const totpCode = String(payload.totpCode || "").trim();
        if (!totpCode) return Response.json({ success: true, needTotp: true, action: "need_totp" }, { headers: corsHeaders });
        let ok = await verifyTotp(user.totp_secret || "", totpCode);
        if (!ok && /^\d{6}$/.test(totpCode) && Array.isArray(user.totp_backup_codes) && user.totp_backup_codes.includes(totpCode)) {
          const remaining = user.totp_backup_codes.filter((c: string) => c !== totpCode);
          await admin.from("user_balances").update({ totp_backup_codes: remaining }).eq("id", user.id);
          ok = true;
        }
        if (!ok) return Response.json({ error: "Kode 2FA / kode cadangan salah." }, { status: 401, headers: corsHeaders });
      }

      if (visitorId) {
        await insertLoginHistory(admin, request, payload, user.id, user.visitor_id, "wa_token", "Login Token WhatsApp");
      }
      await admin.from("balance_wa_reset_codes").update({ user_balance_id: user.id, visitor_id: user.visitor_id, is_used: true }).eq("id", row.id);

      // Notifikasi sukses dikirim oleh bot ke chat WA peminta token lewat polling status.
      // Jangan kirim ke nomor profil akun, karena nomor WA peminta token boleh berbeda.

      const { totp_secret: _ts, totp_backup_codes: _bc, totp_enabled: _te, ...safeUser } = user as any;
      return Response.json({ success: true, user: safeUser, action: "logged_in" }, { headers: corsHeaders });
    }


    // === LOGIN HISTORY (owner-only) ===
    // Pemilik dibuktikan server-side lewat resolveWalletIdentity (sesi login -> wallet; visitor_id hanya
    // untuk wallet lama yang belum ditautkan). userBalanceId dari browser TIDAK dipakai sebagai otoritas.
    if (action === "login_history" || action === "security_summary") {
      const who = await resolveWalletIdentity(request, admin, payload.visitorId);
      if (!who.ok) return Response.json({ error: who.error, code: who.code }, { status: who.status, headers: corsHeaders });
      const claimed = typeof payload.visitorId === "string" ? payload.visitorId.trim() : "";
      if (claimed && claimed !== who.visitorId) {
        // Sesi login milik akun lain (mis. baru ganti akun): jangan tampilkan data akun lain.
        return Response.json({ error: "Sesi login milik akun lain. Silakan login ulang akun ini.", code: "account_mismatch" }, { status: 409, headers: corsHeaders });
      }
      const deviceVisitor = typeof payload.deviceVisitorId === "string" ? payload.deviceVisitorId.trim() : "";
      const cols = "id, logged_in_at, device_info, browser, ip_address, ip_source, device_visitor_id, device_brand, device_model, os_name, os_version, browser_name, browser_version, network_type, login_method";

      if (action === "security_summary") {
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        const [{ data: recent }, { data: acct }] = await Promise.all([
          admin.from("balance_login_history").select("logged_in_at, device_visitor_id, device_info, browser").eq("user_balance_id", who.walletId).gte("logged_in_at", since).order("logged_in_at", { ascending: false }).limit(200),
          admin.from("user_balances").select("totp_enabled, auth_user_id").eq("id", who.walletId).maybeSingle(),
        ]);
        const { data: pinRow } = await admin.from("user_pins").select("id").eq("visitor_id", who.visitorId).maybeSingle();
        let emailVerified: boolean | null = null;
        if (acct?.auth_user_id) {
          const { data: au } = await admin.auth.admin.getUserById(acct.auth_user_id).catch(() => ({ data: null }));
          emailVerified = au?.user ? !!au.user.email_confirmed_at : null;
        }
        const keys = new Set((recent || []).map((r: any) => r.device_visitor_id || `${r.device_info || ""}|${r.browser || ""}`));
        return Response.json({
          success: true,
          pinActive: !!pinRow,
          twoFaEnabled: !!acct?.totp_enabled,
          emailVerified, // null = tidak ada akun login email yang tertaut (status tidak diketahui)
          linkedLogin: !!acct?.auth_user_id,
          devices30d: keys.size,
          lastLoginAt: recent?.[0]?.logged_in_at ?? null,
          globalSignOutSupported: !!acct?.auth_user_id,
        }, { headers: corsHeaders });
      }

      const q = normalizeHistoryQuery(payload);
      const since = new Date(Date.now() - q.days * 86400000).toISOString();
      let query = admin.from("balance_login_history").select(cols).eq("user_balance_id", who.walletId).gte("logged_in_at", since);
      if (q.before) query = query.lt("logged_in_at", q.before);
      if (q.scope === "this") query = deviceVisitor ? query.eq("device_visitor_id", deviceVisitor) : query.eq("id", "00000000-0000-0000-0000-000000000000");
      if (q.scope === "other" && deviceVisitor) query = query.or(`device_visitor_id.is.null,device_visitor_id.neq.${deviceVisitor.replace(/[^A-Za-z0-9_-]/g, "")}`);
      const { data: rows, error: hErr } = await query.order("logged_in_at", { ascending: false }).limit(q.limit + 1);
      if (hErr) {
        console.error("[login_history]", hErr.message);
        return Response.json({ error: "Riwayat login gagal dimuat dari server. Coba lagi." }, { status: 500, headers: corsHeaders });
      }
      const list = rows || [];
      const hasMore = list.length > q.limit;
      const history = list.slice(0, q.limit).map((r: any) => ({ ...r, is_this_device: !!deviceVisitor && r.device_visitor_id === deviceVisitor }));
      return Response.json({ success: true, history, hasMore, nextBefore: hasMore ? history[history.length - 1].logged_in_at : null }, { headers: corsHeaders });
    }

    // === REQUEST WA RESET CODE (password / pin / email) ===
    if (action === "request_reset_code") {
      const purpose = String(payload.purpose || "").trim(); // password | pin | email
      if (!["password", "pin", "email"].includes(purpose)) {
        return Response.json({ error: "Jenis reset tidak valid" }, { status: 400, headers: corsHeaders });
      }
      const requesterVisitor = String(payload.visitorId || "").trim();
      if (!requesterVisitor) {
        return Response.json({ error: "Perangkat tidak dikenal" }, { status: 400, headers: corsHeaders });
      }

      // Cari akun: password -> boleh via identifier (lupa sandi); pin/email -> via visitorId (login)
      let user: any = null;
      if (payload.loginId) {
        user = await findAccountByIdentifier(admin, String(payload.loginId));
      } else {
        const { data } = await admin
          .from("user_balances")
          .select("id, visitor_id, username, phone, email, balance, device_bound_at")
          .eq("visitor_id", requesterVisitor)
          .maybeSingle();
        user = data;
      }

      // Cek ban aktif
      const { data: activeBan } = await admin
        .from("account_bans")
        .select("id, banned_until")
        .eq("visitor_id", requesterVisitor)
        .eq("is_active", true)
        .maybeSingle();
      if (activeBan) {
        return Response.json({ error: "Perangkat diblokir sementara. Hubungi admin untuk membuka blokir." }, { status: 403, headers: corsHeaders });
      }

      if (!user || !user.phone) {
        // tetap catat sebagai percobaan agar spam tetap kena limit
        await registerAbuse(admin, null, requesterVisitor);
        return Response.json({ error: "Akun / nomor WA terdaftar tidak ditemukan." }, { status: 404, headers: corsHeaders });
      }

      // Batas permintaan (spam) -> ban 3 hari
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: reqCount } = await admin
        .from("balance_wa_reset_codes")
        .select("id", { count: "exact", head: true })
        .eq("visitor_id", requesterVisitor)
        .neq("purpose", "abuse")
        .gte("created_at", since);
      if ((reqCount ?? 0) >= 10) {
        await registerAbuse(admin, user, requesterVisitor);
        return Response.json({ error: "Terlalu banyak permintaan. Perangkat diblokir 3 hari. Hubungi admin." }, { status: 429, headers: corsHeaders });
      }

      // Untuk pin & email wajib perangkat terpercaya (utama / >= 30 hari)
      if (purpose === "pin" || purpose === "email") {
        const trust = await deviceTrust(admin, user, requesterVisitor);
        if (!trust.trusted) {
          const banned = await registerAbuse(admin, user, requesterVisitor);
          const sisa = trust.known ? Math.ceil(30 - trust.ageDays) : 30;
          return Response.json({
            error: banned
              ? "Perangkat diblokir sementara 3 hari karena aktivitas mencurigakan. Hubungi admin."
              : `Ubah ${purpose === "pin" ? "PIN" : "email"} hanya bisa dari perangkat utama atau perangkat yang sudah terhubung 30 hari. Lakukan dari perangkat sebelumnya (perlu ~${sisa} hari lagi).`,
          }, { status: 403, headers: corsHeaders });
        }
      }

      // Nonaktifkan kode lama utk purpose ini, buat kode baru 5 menit
      await admin.from("balance_wa_reset_codes").update({ is_used: true }).eq("user_balance_id", user.id).eq("purpose", purpose).eq("is_used", false);
      const code = gen6DigitCode();
      await admin.from("balance_wa_reset_codes").insert({
        user_balance_id: user.id,
        visitor_id: requesterVisitor,
        purpose,
        code,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        max_attempts: 3,
      });

      const label = purpose === "password" ? "reset sandi" : purpose === "pin" ? "reset PIN" : "ganti email";
      await sendWaText(String(user.phone), `🔐 Kode ${label} Agung Adi Store: ${code}\nBerlaku 5 menit, maksimal 3x percobaan. Jangan berikan kode ini ke siapa pun.`);

      return Response.json({ success: true, message: "Kode dikirim ke WhatsApp terdaftar", phoneMasked: maskPhone(String(user.phone)) }, { headers: corsHeaders });
    }

    // === APPLY WA RESET (verifikasi kode + terapkan perubahan) ===
    if (action === "apply_reset_code") {
      const purpose = String(payload.purpose || "").trim();
      if (!["password", "pin", "email"].includes(purpose)) {
        return Response.json({ error: "Jenis reset tidak valid" }, { status: 400, headers: corsHeaders });
      }
      const requesterVisitor = String(payload.visitorId || "").trim();
      const inputCode = String(payload.code || "").trim();
      const newValue = String(payload.newValue || "").trim();
      if (!requesterVisitor || !inputCode || !newValue) {
        return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
      }

      let user: any = null;
      if (payload.loginId) {
        user = await findAccountByIdentifier(admin, String(payload.loginId));
      } else {
        const { data } = await admin
          .from("user_balances")
          .select("id, visitor_id, username, phone, email, balance, device_bound_at")
          .eq("visitor_id", requesterVisitor)
          .maybeSingle();
        user = data;
      }
      if (!user) {
        return Response.json({ error: "Akun tidak ditemukan" }, { status: 404, headers: corsHeaders });
      }

      const { data: codeRow } = await admin
        .from("balance_wa_reset_codes")
        .select("*")
        .eq("user_balance_id", user.id)
        .eq("purpose", purpose)
        .eq("is_used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!codeRow) {
        return Response.json({ error: "Kode tidak ditemukan. Minta kode baru." }, { status: 400, headers: corsHeaders });
      }
      if (new Date(codeRow.expires_at) < new Date()) {
        await admin.from("balance_wa_reset_codes").update({ is_used: true }).eq("id", codeRow.id);
        return Response.json({ error: "Kode sudah kedaluwarsa (5 menit). Minta kode baru." }, { status: 400, headers: corsHeaders });
      }
      if (codeRow.attempts >= codeRow.max_attempts) {
        await admin.from("balance_wa_reset_codes").update({ is_used: true }).eq("id", codeRow.id);
        await registerAbuse(admin, user, requesterVisitor);
        return Response.json({ error: "Percobaan habis (3x). Minta kode baru." }, { status: 429, headers: corsHeaders });
      }
      if (inputCode !== codeRow.code) {
        const attempts = (codeRow.attempts || 0) + 1;
        await admin.from("balance_wa_reset_codes").update({ attempts }).eq("id", codeRow.id);
        const left = Math.max(0, codeRow.max_attempts - attempts);
        return Response.json({ error: `Kode salah. Sisa percobaan: ${left}.` }, { status: 400, headers: corsHeaders });
      }

      // Kode benar -> terapkan
      if (purpose === "password") {
        if (newValue.length < 6) return Response.json({ error: "Sandi baru minimal 6 karakter" }, { status: 400, headers: corsHeaders });
        await admin.from("user_balances").update({ password_hash: await hashPassword(newValue) }).eq("id", user.id);
      } else if (purpose === "pin") {
        if (!/^\d{6}$/.test(newValue)) return Response.json({ error: "PIN harus 6 digit angka" }, { status: 400, headers: corsHeaders });
        const pinHash = await hashPassword(newValue);
        const { data: existingPin } = await admin.from("user_pins").select("id").eq("visitor_id", user.visitor_id).maybeSingle();
        if (existingPin) {
          await admin.from("user_pins").update({ pin_hash: pinHash, updated_at: new Date().toISOString() }).eq("visitor_id", user.visitor_id);
        } else {
          await admin.from("user_pins").insert({ visitor_id: user.visitor_id, pin_hash: pinHash });
        }
      } else if (purpose === "email") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newValue)) return Response.json({ error: "Format email tidak valid" }, { status: 400, headers: corsHeaders });
        const { data: existing } = await admin.from("user_balances").select("id").eq("email", newValue.toLowerCase()).neq("id", user.id).maybeSingle();
        if (existing) return Response.json({ error: "Email sudah dipakai akun lain" }, { status: 400, headers: corsHeaders });
        await admin.from("user_balances").update({ email: newValue.toLowerCase() }).eq("id", user.id);
      }

      await admin.from("balance_wa_reset_codes").update({ is_used: true }).eq("id", codeRow.id);
      return Response.json({ success: true, message: "Berhasil diperbarui" }, { headers: corsHeaders });
    }

    // === CHANGE PHONE (tanpa sandi, hanya perangkat terpercaya) ===
    if (action === "change_phone") {
      const requesterVisitor = String(payload.visitorId || "").trim();
      const newPhone = normalizePhone(String(payload.newPhone || ""));
      if (!requesterVisitor || newPhone.length < 7) {
        return Response.json({ error: "Nomor baru tidak valid" }, { status: 400, headers: corsHeaders });
      }

      const { data: activeBan } = await admin
        .from("account_bans")
        .select("id")
        .eq("visitor_id", requesterVisitor)
        .eq("is_active", true)
        .maybeSingle();
      if (activeBan) {
        return Response.json({ error: "Perangkat diblokir sementara. Hubungi admin." }, { status: 403, headers: corsHeaders });
      }

      const { data: user } = await admin
        .from("user_balances")
        .select("id, visitor_id, username, phone, email, balance, device_bound_at")
        .eq("visitor_id", requesterVisitor)
        .maybeSingle();
      if (!user) {
        return Response.json({ error: "Akun tidak ditemukan" }, { status: 404, headers: corsHeaders });
      }

      const trust = await deviceTrust(admin, user, requesterVisitor);
      if (!trust.trusted) {
        const banned = await registerAbuse(admin, user, requesterVisitor);
        const sisa = trust.known ? Math.ceil(30 - trust.ageDays) : 30;
        return Response.json({
          error: banned
            ? "Perangkat diblokir sementara 3 hari. Hubungi admin untuk buka blokir."
            : `Anda tidak bisa melakukan aktivitas ini dari perangkat ini. Ganti nomor hanya bisa dari perangkat utama atau perangkat yang sudah terhubung 30 hari (perlu ~${sisa} hari lagi). Lakukan dari perangkat sebelumnya.`,
        }, { status: 403, headers: corsHeaders });
      }

      const variants = normalizedPhoneVariants(newPhone);
      const { data: existingPhone } = await admin.from("user_balances").select("id").in("phone", variants.length ? variants : [newPhone]).neq("id", user.id).limit(1);
      if (existingPhone?.[0]) {
        return Response.json({ error: "Nomor sudah dipakai akun lain" }, { status: 400, headers: corsHeaders });
      }

      await admin.from("user_balances").update({ phone: newPhone }).eq("id", user.id);
      return Response.json({ success: true, message: "Nomor WhatsApp berhasil diganti" }, { headers: corsHeaders });
    }

    return Response.json({ error: "Action tidak valid" }, { status: 400, headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
