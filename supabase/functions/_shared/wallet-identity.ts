// Wallet identity for financial actions.
// Signed-in login account (verified bearer token) -> user_balances.auth_user_id -> wallet.
// Browser-supplied visitor_id is only a legacy fallback for wallets NOT yet linked to a
// login account; a linked wallet can never be reached through visitor_id alone.

export type WalletIdentity =
  | { ok: true; via: "auth" | "legacy"; walletId: string; visitorId: string }
  | { ok: false; status: number; error: string; code: string };

// deno-lint-ignore no-explicit-any
export async function resolveWalletIdentity(request: Request, admin: any, claimedVisitorId: unknown): Promise<WalletIdentity> {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  let authUserId: string | null = null;
  if (token) {
    // Anon/publishable keys are not user tokens: getUser fails and we fall through.
    const { data } = await admin.auth.getUser(token).catch(() => ({ data: null }));
    authUserId = data?.user?.id ?? null;
  }

  if (authUserId) {
    const { data: own } = await admin.from("user_balances").select("id, visitor_id").eq("auth_user_id", authUserId).maybeSingle();
    if (own) return { ok: true, via: "auth", walletId: own.id, visitorId: own.visitor_id };
    // Login account without a linked wallet (e.g. admin panel session): legacy rules below.
  }

  const claimed = typeof claimedVisitorId === "string" ? claimedVisitorId.trim() : "";
  if (!claimed) return { ok: false, status: 401, error: "Silakan login ke akun Saldo terlebih dahulu.", code: "not_authenticated" };

  const { data: wallet } = await admin.from("user_balances").select("id, visitor_id, auth_user_id").eq("visitor_id", claimed).maybeSingle();
  if (!wallet) return { ok: false, status: 404, error: "Akun saldo tidak ditemukan. Silakan login ulang di menu Saldo.", code: "wallet_not_found" };
  if (wallet.auth_user_id && wallet.auth_user_id !== authUserId) {
    return { ok: false, status: 401, error: "Sesi login diperlukan untuk wallet ini. Silakan login ulang.", code: "auth_required" };
  }
  return { ok: true, via: "legacy", walletId: wallet.id, visitorId: wallet.visitor_id };
}
