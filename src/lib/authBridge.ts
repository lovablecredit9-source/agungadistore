import { supabase } from "@/integrations/supabase/client";
import { getDeviceSummary } from "@/lib/device-info";
import { loginDeviceDetails } from "@/lib/login-device-client";
import { getVisitorId } from "@/lib/visitor-id";

/** Marks that this browser's login session belongs to the wallet login (not the admin panel). */
export const WALLET_AUTH_FLAG = "aas_wallet_auth_uid";
/** Set before a redirect (Google / email link) so the wallet links on return. Value = start time (ms). */
export const WALLET_AUTH_PENDING = "aas_wallet_auth_pending";

/** Remember when a wallet login (Google / email link) started. */
export function markWalletAuthPending() {
  sessionStorage.setItem(WALLET_AUTH_PENDING, String(Date.now()));
}

/** Error the sign-in broker put in the return URL (e.g. ?error=...&error_description=...). */
export function readOAuthReturnError(loc: { search: string; hash: string } = window.location): string | null {
  for (const raw of [loc.search, loc.hash.replace(/^#/, "?")]) {
    const p = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
    const err = p.get("error_description") || p.get("error");
    if (err) return err.replace(/\+/g, " ");
  }
  return null;
}

/** User-facing message for an error returned by the Google sign-in round-trip (raw error is logged by callers). */
export function friendlyOAuthReturnError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("sign up") || m.includes("signup")) return "Akun Google ini belum bisa didaftarkan saat ini. Silakan coba lagi nanti atau hubungi admin.";
  if (m.includes("access_denied") || m.includes("denied") || m.includes("cancel")) return "Login Google dibatalkan.";
  return "Session Google gagal dibuat. Silakan coba login kembali.";
}

const CLOCK_SLACK_MS = 2 * 60 * 1000;
/**
 * True only when the session was created by THIS login attempt.
 * A session that already existed in the browser (e.g. the admin panel login) must never be
 * used to open a wallet just because a Google login was started.
 */
export function isSessionFromThisLogin(lastSignInAt: string | null | undefined, pendingValue: string | null, now = Date.now()): boolean {
  const signedIn = lastSignInAt ? Date.parse(lastSignInAt) : NaN;
  if (!Number.isFinite(signedIn)) return false;
  const started = Number(pendingValue);
  const threshold = Number.isFinite(started) && started > 1e12 ? started - CLOCK_SLACK_MS : now - 10 * 60 * 1000;
  return signedIn >= threshold;
}

// eslint-free shape of the wallet row returned by balance-auth.
export type UserBalanceLike = { id: string; visitor_id: string; username: string; phone: string; email: string | null; balance: number };
export type LinkResult = { ok: boolean; user?: UserBalanceLike; needTotp?: boolean; message?: string; code?: string };

async function readFnError(error: unknown, data: { error?: string; code?: string } | null | undefined): Promise<{ message: string | null; code?: string }> {
  if (data?.error) return { message: String(data.error), code: data.code };
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try { const j = await ctx.json(); if (j?.error) return { message: String(j.error), code: j.code }; } catch { /* ignore */ }
  }
  return { message: null };
}

function deviceInfo() {
  return { device: getDeviceSummary(navigator.userAgent), browser: navigator.userAgent.substring(0, 100), details: loginDeviceDetails() };
}

/** Resolve the signed-in login account to its wallet (links or creates exactly one). */
export async function linkWallet(totpCode?: string): Promise<LinkResult> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return { ok: false, message: "Sesi login tidak ditemukan. Silakan login ulang." };
  const { data, error } = await supabase.functions.invoke("balance-auth", {
    body: { action: "auth_link", totpCode, deviceVisitorId: getVisitorId(), deviceInfo: deviceInfo() },
  });
  if (error || data?.error) {
    if (error) console.error("[auth_link]", error);
    const e = await readFnError(error, data);
    return { ok: false, message: e.message || "Data akun belum berhasil dimuat. Coba lagi.", code: e.code };
  }
  if (data?.needTotp) return { ok: false, needTotp: true };
  localStorage.setItem(WALLET_AUTH_FLAG, s.session.user.id);
  sessionStorage.removeItem(WALLET_AUTH_PENDING);
  return { ok: true, user: data.user };
}

/**
 * Secure claim: links an existing wallet to the signed-in login account.
 * Server requires a verified login email AND the old wallet password, and the emails must match.
 */
export async function claimLink(loginId: string, password: string): Promise<{ ok: boolean; message?: string; code?: string }> {
  const { data, error } = await supabase.functions.invoke("balance-auth", {
    body: { action: "claim_link", loginId, password },
  });
  if (error || data?.error) {
    if (error) console.error("[claim_link]", error);
    const e = await readFnError(error, data);
    return { ok: false, message: e.message || "Gagal menghubungkan wallet.", code: e.code };
  }
  return { ok: true };
}

/** Sign out the wallet login session only if it is the one this wallet created. */
export async function signOutWalletAuth() {
  const flagged = localStorage.getItem(WALLET_AUTH_FLAG);
  localStorage.removeItem(WALLET_AUTH_FLAG);
  if (!flagged) return;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id === flagged) await supabase.auth.signOut({ scope: "local" });
}

/**
 * Logout semua perangkat: revoke SEMUA sesi login akun ini di server (scope global).
 * Hanya mungkin bila wallet memakai akun login (email/Google). Wallet lama tanpa akun login
 * tidak punya sesi server yang bisa dicabut, jadi hasilnya revoked=false (jangan diklaim).
 */
export async function signOutWalletAuthEverywhere(): Promise<{ revoked: boolean; error?: string }> {
  const flagged = localStorage.getItem(WALLET_AUTH_FLAG);
  const { data } = await supabase.auth.getSession();
  if (!flagged || data.session?.user.id !== flagged) return { revoked: false };
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) { console.error("[signOut global]", error); return { revoked: false, error: friendlyAuthError(error) }; }
  localStorage.removeItem(WALLET_AUTH_FLAG);
  return { revoked: true };
}

/** Friendly Indonesian messages; the raw error is still logged by callers. */
export function friendlyAuthError(err: { message?: string; code?: string; status?: number } | null | undefined): string {
  const code = (err?.code || "").toLowerCase();
  const msg = (err?.message || "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login")) return "Email atau sandi salah.";
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return "Silakan verifikasi email terlebih dahulu.";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) return "Email ini sudah terdaftar.";
  if (code === "weak_password" || msg.includes("weak") || msg.includes("pwned")) return "Sandi terlalu lemah atau pernah bocor. Gunakan sandi lain.";
  if (code.includes("rate_limit") || err?.status === 429) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (code === "otp_expired" || msg.includes("expired")) return "Link sudah kedaluwarsa. Minta link baru.";
  if (code === "same_password") return "Sandi baru harus berbeda dari sandi lama.";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "Koneksi bermasalah. Periksa internet lalu coba lagi.";
  return err?.message || "Terjadi kesalahan. Coba lagi.";
}
