import { useCallback, useEffect, useState } from "react";
import { apkApi } from "./api";
import { loadHistory, YT_HISTORY_KEY } from "./youtubeHistory";

export type YtType = "search" | "select" | "mp3" | "mp4" | "play";
export type YtEntry = {
  id: string; type: YtType; title: string; url: string | null; thumbnail: string | null;
  media_url: string | null; media_kind: "audio" | "video" | null; quality: string | null; duration: string | null;
  status: "ok" | "fail" | "pending" | null; error: string | null; at: string;
};
export type NewEntry = Partial<Omit<YtEntry, "id" | "at">> & { type: YtType; title: string };

/** Server-backed per-account history. Old device-local history is imported once per account (local copy kept). */
export function useYtHistory(visitorId: string) {
  const [items, setItems] = useState<YtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const r = await apkApi<{ items: YtEntry[] }>({ action: "yt_history_list" });
    if (r.error) setError(r.error); else setItems(r.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const flag = `${YT_HISTORY_KEY}_imported_${visitorId}`;
      const local = loadHistory();
      if (local.length && !localStorage.getItem(flag)) {
        const r = await apkApi<{ items: YtEntry[] }>({
          action: "yt_history_import",
          entries: local.map((l) => ({ type: l.type, title: l.title, url: l.url, thumbnail: l.thumbnail, quality: l.quality, status: l.status, error: l.error, at: l.at })),
        });
        if (!r.error) localStorage.setItem(flag, "1");
      }
      if (alive) await load();
    })();
    return () => { alive = false; };
  }, [visitorId, load]);

  const add = useCallback(async (entry: NewEntry) => {
    const r = await apkApi<{ items: YtEntry[] }>({ action: "yt_history_add", entry: { ...entry, at: Date.now() } });
    if (r.error) return r.error;
    setItems(r.items ?? []);
    return null;
  }, []);
  const remove = useCallback(async (id: string) => {
    const prev = items;
    setItems((l) => l.filter((x) => x.id !== id));
    const r = await apkApi({ action: "yt_history_delete", id });
    if (r.error) { setItems(prev); return r.error; }
    return null;
  }, [items]);
  const clear = useCallback(async () => {
    const r = await apkApi({ action: "yt_history_clear" });
    if (r.error) return r.error;
    setItems([]);
    return null;
  }, []);

  return { items, loading, error, reload: load, add, remove, clear };
}
