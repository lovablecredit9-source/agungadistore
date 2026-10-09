import { supabase } from "@/integrations/supabase/client";
import { getDeviceSummary } from "@/lib/device-info";

/** Marks that this browser's login session belongs to the wallet login (not the admin panel). */
export const WALLET_AUTH_FLAG = "aas_wallet_auth_uid";
/** Set before a redirect (Google / email link) so the wallet links on return. */
export const WALLET_AUTH_PENDING = "aas_wallet_auth_pending";

export type LinkResult = { ok: boolean; user?: any; needTotp?: boolean; message?: string; code?: string };

async function readFnError(error: unknown, data: any): Promise<{ message: string | null; code?: string }> {
  if (data?.error) return { message: String(data.error), code: data.code };
  const ctx = (error as any)?.context;
  if (ctx && typeof ctx.json === "function") {
    try { const j = await ctx.json(); if (j?.error) return { message: String(j.error), code: j.code }; } catch { /* ignore */ }
  }
  return { message: null };
}

function deviceInfo() {
  return { device: getDeviceSummary(navigator.userAgent), browser: navigator.userAgent.substring(0, 100) };
}

/** Resolve the signed-in login account to its wallet (links or creates exactly one). */
export async function linkWallet(totpCode?: string): Promise<LinkResult> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return { ok: false, message: "Sesi login tidak ditemukan. Silakan login ulang." };
  const { data, error } = await supabase.functions.invoke("balance-auth", {
    body: { action: "auth_link", totpCode, deviceInfo: deviceInfo() },
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

/** One-time move of an old wallet password into the login system. Returns the account email. */
export async function legacyMigrate(loginId: string, password: string): Promise<{ email?: string; message?: string; code?: string }> {
  const { data, error } = await supabase.functions.invoke("balance-auth", {
    body: { action: "legacy_migrate", loginId, password },
  });
  if (error || data?.error) {
    if (error) console.error("[legacy_migrate]", error);
    const e = await readFnError(error, data);
    return { message: e.message || "Login gagal. Coba lagi.", code: e.code };
  }
  return { email: data.email };
}

/** Sign out the wallet login session only if it is the one this wallet created. */
export async function signOutWalletAuth() {
  const flagged = localStorage.getItem(WALLET_AUTH_FLAG);
  localStorage.removeItem(WALLET_AUTH_FLAG);
  if (!flagged) return;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id === flagged) await supabase.auth.signOut({ scope: "local" });
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
