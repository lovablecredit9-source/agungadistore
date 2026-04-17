// Manages up to 5 saved balance accounts on this device for fast switching.
// Stores ONLY non-sensitive identifiers (no passwords). Switching uses the
// stored visitor_id to re-fetch the profile from user_balances_public.

const STORAGE_KEY = "saved_balance_accounts_v1";
export const MAX_SAVED_ACCOUNTS = 5;

export interface SavedAccount {
  visitor_id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  last_used_at: number;
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
  const filtered = list.filter((a) => a.visitor_id !== account.visitor_id);
  const next: SavedAccount = { ...account, last_used_at: Date.now() };
  const updated = [next, ...filtered].slice(0, MAX_SAVED_ACCOUNTS);
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
