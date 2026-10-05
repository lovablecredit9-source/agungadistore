// Manages saved balance accounts on this device for fast switching.
// Stores ONLY non-sensitive identifiers (no passwords). Switching uses the
// stored visitor_id to re-fetch the profile from user_balances_public.
// Free: 5 slots. Paid slot upgrade (verified by backend): 10 slots.

const STORAGE_KEY = "saved_balance_accounts_v1";
const LIMIT_KEY = "saved_accounts_slot_limit_v1";
export const FREE_SAVED_ACCOUNTS = 5;
export const PAID_SAVED_ACCOUNTS = 10;
/** @deprecated use getSlotLimit() */
export const MAX_SAVED_ACCOUNTS = FREE_SAVED_ACCOUNTS;

export interface SavedAccount {
  visitor_id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  last_used_at: number;
}

/** Cached limit (last value confirmed by the backend for this device). */
export function getSlotLimit(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(LIMIT_KEY) || "null");
    if (raw && raw.max === PAID_SAVED_ACCOUNTS && (raw.expires_at === null || new Date(raw.expires_at) > new Date())) {
      return PAID_SAVED_ACCOUNTS;
    }
  } catch { /* ignore */ }
  return FREE_SAVED_ACCOUNTS;
}

export function setSlotLimitCache(max: number, expires_at: string | null) {
  localStorage.setItem(LIMIT_KEY, JSON.stringify({ max, expires_at }));
}

/** Number shown after the slash: paid → 10, free → max(5, current count). */
export function displaySlotCap(count: number, limit = getSlotLimit()): number {
  return limit >= PAID_SAVED_ACCOUNTS ? PAID_SAVED_ACCOUNTS : Math.max(FREE_SAVED_ACCOUNTS, count);
}

export function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedAccount[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((a) => a && typeof a.visitor_id === "string" && typeof a.username === "string")
      .sort((a, b) => (b.last_used_at || 0) - (a.last_used_at || 0));
  } catch {
    return [];
  }
}

export function saveAccount(account: Omit<SavedAccount, "last_used_at">) {
  const list = getSavedAccounts();
  const exists = list.some((a) => a.visitor_id === account.visitor_id);
  const filtered = list.filter((a) => a.visitor_id !== account.visitor_id);
  const next: SavedAccount = { ...account, last_used_at: Date.now() };
  // Existing accounts are never dropped when the paid period ends; only new ones are blocked.
  const cap = exists ? Math.max(list.length, getSlotLimit()) : getSlotLimit();
  const updated = [next, ...filtered].slice(0, Math.max(cap, 1));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function removeSavedAccount(visitorId: string) {
  const list = getSavedAccounts().filter((a) => a.visitor_id !== visitorId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function touchSavedAccount(visitorId: string) {
  const list = getSavedAccounts();
  const found = list.find((a) => a.visitor_id === visitorId);
  if (!found) return list;
  return saveAccount({
    visitor_id: found.visitor_id,
    username: found.username,
    email: found.email,
    phone: found.phone,
  });
}
