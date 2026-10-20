/** Local, per-device YouTube activity history for APK PREMIUM (never stores keys/tokens). */
export const YT_HISTORY_KEY = "adi_store_youtube_history_v1";
export const YT_HISTORY_MAX = 100;

export type YtHistoryType = "search" | "select" | "mp3" | "mp4";
export type YtHistoryStatus = "ok" | "fail" | "pending";
export type YtHistoryItem = {
  id: string; type: YtHistoryType; title: string; url?: string; thumbnail?: string;
  quality?: string; status?: YtHistoryStatus; error?: string; at: number;
};

const TYPES: YtHistoryType[] = ["search", "select", "mp3", "mp4"];
const isYtUrl = (u: unknown): u is string => typeof u === "string" && /^https:\/\/([\w-]+\.)?(youtube\.com|youtu\.be)\//i.test(u) && u.length <= 2048;
const safeImg = (u: unknown) => (typeof u === "string" && /^https:\/\//i.test(u) && u.length <= 2048 ? u : undefined);

/** Strips any query param that could carry a credential before storing a URL. */
function cleanUrl(u?: string) {
  if (!isYtUrl(u)) return undefined;
  try {
    const x = new URL(u);
    for (const k of [...x.searchParams.keys()]) if (/key|token|apikey|auth|sig/i.test(k)) x.searchParams.delete(k);
    return x.toString();
  } catch { return undefined; }
}

export function sanitize(raw: unknown): YtHistoryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!TYPES.includes(r.type as YtHistoryType) || typeof r.title !== "string" || !r.title.trim()) return null;
  const at = Number(r.at);
  if (!Number.isFinite(at) || at <= 0) return null;
  return {
    id: typeof r.id === "string" ? r.id.slice(0, 64) : `${at}`,
    type: r.type as YtHistoryType,
    title: r.title.trim().slice(0, 200),
    url: cleanUrl(r.url as string),
    thumbnail: safeImg(r.thumbnail),
    quality: typeof r.quality === "string" ? r.quality.slice(0, 16) : undefined,
    status: ["ok", "fail", "pending"].includes(r.status as string) ? (r.status as YtHistoryStatus) : undefined,
    error: typeof r.error === "string" ? r.error.slice(0, 200) : undefined,
    at,
  };
}

export function loadHistory(storage: Storage = localStorage): YtHistoryItem[] {
  try {
    const arr = JSON.parse(storage.getItem(YT_HISTORY_KEY) || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.map(sanitize).filter((x): x is YtHistoryItem => !!x).sort((a, b) => b.at - a.at).slice(0, YT_HISTORY_MAX);
  } catch { return []; }
}

function persist(list: YtHistoryItem[], storage: Storage) {
  try { storage.setItem(YT_HISTORY_KEY, JSON.stringify(list)); } catch { /* storage full/blocked */ }
}

/** Same activity = same type + same URL (or same query for searches, case-insensitive) + same quality. */
const sameKey = (a: Pick<YtHistoryItem, "type" | "url" | "title" | "quality">) =>
  `${a.type}|${a.type === "search" ? a.title.trim().toLowerCase() : a.url ?? a.title.toLowerCase()}|${a.quality ?? ""}`;

export function addHistory(entry: Omit<YtHistoryItem, "id" | "at"> & { at?: number }, storage: Storage = localStorage): YtHistoryItem[] {
  const at = entry.at ?? Date.now();
  const item = sanitize({ ...entry, at, id: `${at}-${Math.random().toString(36).slice(2, 8)}` });
  const list = loadHistory(storage);
  if (!item) return list;
  const k = sameKey(item);
  const prev = list.find((x) => sameKey(x) === k);
  const merged = { ...item, id: prev?.id ?? item.id, thumbnail: item.thumbnail ?? prev?.thumbnail };
  const next = [merged, ...list.filter((x) => sameKey(x) !== k)].slice(0, YT_HISTORY_MAX);
  persist(next, storage);
  return next;
}

export function removeHistory(id: string, storage: Storage = localStorage) {
  const next = loadHistory(storage).filter((x) => x.id !== id);
  persist(next, storage);
  return next;
}

export function clearHistory(storage: Storage = localStorage) {
  try { storage.removeItem(YT_HISTORY_KEY); } catch { /* ignore */ }
  return [] as YtHistoryItem[];
}
