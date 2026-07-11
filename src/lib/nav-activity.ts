// Pelacak aktivitas navigasi ringan (localStorage) untuk rekomendasi khusus user.
export type NavActivity = Record<string, { count: number; last: number }>;

const KEY = "nav_activity_v1";

export function recordTabVisit(tab: string) {
  try {
    const raw = localStorage.getItem(KEY);
    const data: NavActivity = raw ? JSON.parse(raw) : {};
    const prev = data[tab] || { count: 0, last: 0 };
    data[tab] = { count: prev.count + 1, last: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getNavActivity(): NavActivity {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NavActivity) : {};
  } catch {
    return {};
  }
}
