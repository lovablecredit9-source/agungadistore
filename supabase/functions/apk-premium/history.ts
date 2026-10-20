// Per-wallet YouTube history for APK PREMIUM. Rows are reached only through this edge function
// after resolveWalletIdentity; the table has no browser grants.
// deno-lint-ignore-file no-explicit-any
export const HISTORY_MAX = 300;
const TYPES = ["search", "select", "mp3", "mp4", "play"];

const ytUrl = (u: unknown) => {
  if (typeof u !== "string" || u.length > 2048) return null;
  try {
    const x = new URL(u);
    if (x.protocol !== "https:" || !/(^|\.)(youtube\.com|youtu\.be)$/i.test(x.hostname)) return null;
    for (const k of [...x.searchParams.keys()]) if (/key|token|auth|sig/i.test(k)) x.searchParams.delete(k);
    return x.toString();
  } catch { return null; }
};
/** Media/thumbnail links: https only, no data: URLs, credential params rejected (never stored). */
const httpsUrl = (u: unknown) => {
  if (typeof u !== "string" || u.length > 2048) return null;
  try {
    const x = new URL(u);
    if (x.protocol !== "https:") return null;
    if ([...x.searchParams.keys()].some((k) => /api_?key|apikey|token|secret/i.test(k))) return null;
    return x.toString();
  } catch { return null; }
};
const str = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

export function sanitizeEntry(r: any) {
  if (!r || typeof r !== "object" || !TYPES.includes(r.type)) return null;
  const title = str(r.title, 200);
  if (!title) return null;
  const at = r.at ? new Date(Number(r.at) || r.at) : new Date();
  const url = ytUrl(r.url);
  const quality = str(r.quality, 16);
  const media_url = r.status === "ok" ? httpsUrl(r.media_url) : null;
  const type = r.type as string;
  const dedupe_key = `${type}|${type === "search" ? title.toLowerCase() : url ?? title.toLowerCase()}|${quality ?? ""}`.slice(0, 600);
  return {
    type, title, url, quality, dedupe_key, media_url,
    thumbnail: httpsUrl(r.thumbnail),
    media_kind: media_url ? (r.media_kind === "video" ? "video" : r.media_kind === "audio" ? "audio" : type === "mp4" ? "video" : "audio") : null,
    duration: str(r.duration, 16),
    status: ["ok", "fail", "pending"].includes(r.status) ? r.status : null,
    error: str(r.error, 200),
    at: isNaN(at.getTime()) || at.getTime() > Date.now() + 60_000 ? new Date().toISOString() : at.toISOString(),
  };
}

const COLS = "id, type, title, url, thumbnail, media_url, media_kind, quality, duration, status, error, at";

export async function historyAction(c: any, walletId: string, action: string, body: any) {
  if (action === "yt_history_list") {
    const { data, error } = await c.from("apk_youtube_history").select(COLS).eq("wallet_id", walletId).order("at", { ascending: false }).limit(HISTORY_MAX);
    if (error) throw error;
    return { items: data ?? [] };
  }
  if (action === "yt_history_add" || action === "yt_history_import") {
    const raw = action === "yt_history_add" ? [body.entry] : Array.isArray(body.entries) ? body.entries.slice(0, 100) : [];
    const rows = raw.map(sanitizeEntry).filter(Boolean).map((e: any) => ({ ...e, wallet_id: walletId }));
    if (!rows.length) return { error: "Data riwayat tidak valid", status: 400 };
    // One row per dedupe key; on re-import keep whichever is newer.
    const uniq = new Map<string, any>();
    for (const r of rows) if (!uniq.has(r.dedupe_key) || uniq.get(r.dedupe_key).at < r.at) uniq.set(r.dedupe_key, r);
    let list = [...uniq.values()];
    if (action === "yt_history_import") {
      const { data: have } = await c.from("apk_youtube_history").select("dedupe_key, at").eq("wallet_id", walletId).in("dedupe_key", list.map((r) => r.dedupe_key));
      const newer = new Map((have ?? []).map((h: any) => [h.dedupe_key, h.at]));
      list = list.filter((r) => !newer.has(r.dedupe_key) || String(newer.get(r.dedupe_key)) < r.at);
    }
    if (list.length) {
      const { error } = await c.from("apk_youtube_history").upsert(list, { onConflict: "wallet_id,dedupe_key" });
      if (error) throw error;
    }
    // Cap per wallet: drop the oldest beyond HISTORY_MAX.
    const { data: old } = await c.from("apk_youtube_history").select("id").eq("wallet_id", walletId).order("at", { ascending: false }).range(HISTORY_MAX, HISTORY_MAX + 500);
    if (old?.length) await c.from("apk_youtube_history").delete().eq("wallet_id", walletId).in("id", old.map((o: any) => o.id));
    return historyAction(c, walletId, "yt_history_list", {});
  }
  if (action === "yt_history_delete") {
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "ID tidak valid", status: 400 };
    const { error } = await c.from("apk_youtube_history").delete().eq("wallet_id", walletId).eq("id", id);
    if (error) throw error;
    return { ok: true };
  }
  if (action === "yt_history_clear") {
    const { error } = await c.from("apk_youtube_history").delete().eq("wallet_id", walletId);
    if (error) throw error;
    return { ok: true };
  }
  return { error: "Aksi tidak dikenal", status: 400 };
}
