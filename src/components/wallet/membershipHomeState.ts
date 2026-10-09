import type { PremiumInfo } from "@/hooks/useStorePremium";

/**
 * Pure display rules for the membership cards on Beranda/Saldo.
 * Premium Toko status always comes from get_store_premium_info → useStorePremium();
 * these helpers only ever *hide* an active state (e.g. expiry passed since the last fetch),
 * they never turn a non-premium backend answer into "AKTIF".
 */
export type StorePremiumHomeState = "active" | "ending" | "locked" | "none";

const DAY = 86_400_000;

export function storePremiumHomeState(
  info: Pick<PremiumInfo, "isPremium" | "isLocked" | "expiresAt">,
  now = Date.now(),
): StorePremiumHomeState {
  const exp = info.expiresAt ? Date.parse(info.expiresAt) : NaN;
  const notExpired = Number.isFinite(exp) && exp > now;
  if (info.isLocked && notExpired) return "locked";
  if (!info.isPremium || !notExpired) return "none";
  return exp - now <= 3 * DAY ? "ending" : "active";
}

export function remainingParts(expiresAt: string | null, now = Date.now()) {
  const exp = expiresAt ? Date.parse(expiresAt) : NaN;
  const ms = Number.isFinite(exp) ? Math.max(0, exp - now) : 0;
  return {
    days: Math.floor(ms / DAY),
    hours: Math.floor((ms % DAY) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
  };
}

/** "07 Nov 2026, 17:04 WIB" — always Asia/Jakarta, regardless of device timezone. */
export function formatWib(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month").replace(".", "")} ${get("year")}, ${get("hour")}:${get("minute")} WIB`;
}

export interface GemSub { plan_name: string | null; expires_at: string | null }

/** Same rule as the existing DailyStreak query (is_active + expires_at in the future). */
export function gemMembershipActive(sub: GemSub | null, now = Date.now()): boolean {
  if (!sub?.expires_at) return false;
  const exp = Date.parse(sub.expires_at);
  return Number.isFinite(exp) && exp > now;
}
