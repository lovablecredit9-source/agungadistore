// Admin-only YouTube playlist importer. Reads METADATA only (YouTube Data API when
// YOUTUBE_API_KEY is set, otherwise the official public playlist feed, max 15 items).
// Never downloads audio. Legal audio is uploaded by the admin and attached via "attach".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { isAdminRequest } from "../_shared/admin.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Item = { position: number; videoId: string; title: string; artist: string; thumbnail: string | null; url: string };

export function parsePlaylistId(input: string): string | null {
  try {
    const u = new URL(input.trim());
    const id = u.searchParams.get("list");
    return id && /^[A-Za-z0-9_-]{10,64}$/.test(id) ? id : null;
  } catch {
    return /^[A-Za-z0-9_-]{10,64}$/.test(input.trim()) ? input.trim() : null;
  }
}

export const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function fetchPlaylist(listId: string): Promise<{ title: string; items: Item[]; source: string; partial: boolean }> {
  const key = Deno.env.get("YOUTUBE_API_KEY");
  if (key) {
    const meta = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${listId}&key=${key}`).then(r => r.json());
    const title = meta?.items?.[0]?.snippet?.title || "Imported YouTube Playlist";
    const items: Item[] = [];
    let page = "";
    do {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${listId}&key=${key}${page ? `&pageToken=${page}` : ""}`).then(r => r.json());
      if (r.error) throw new Error(r.error.message || "YouTube API error");
      for (const it of r.items || []) {
        const sn = it.snippet; const vid = sn?.resourceId?.videoId;
        if (!vid) continue;
        items.push({ position: sn.position ?? items.length, videoId: vid, title: sn.title, artist: sn.videoOwnerChannelTitle || "", thumbnail: sn.thumbnails?.high?.url || sn.thumbnails?.default?.url || null, url: `https://www.youtube.com/watch?v=${vid}` });
      }
      page = r.nextPageToken || "";
    } while (page && items.length < 500);
    return { title, items, source: "youtube_data_api", partial: false };
  }
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${listId}`);
  if (!res.ok) throw new Error(`Playlist tidak dapat diakses (HTTP ${res.status})`);
  const xml = await res.text();
  const title = decode(xml.match(/<title>([^<]*)<\/title>/)?.[1] || "Imported YouTube Playlist");
  const entries = xml.split("<entry>").slice(1);
  const items = entries.map((e, i) => {
    const vid = e.match(/<yt:videoId>([^<]+)</)?.[1] || "";
    return {
      position: i, videoId: vid,
      title: decode(e.match(/<title>([^<]*)<\/title>/)?.[1] || ""),
      artist: decode(e.match(/<author>\s*<name>([^<]*)<\/name>/)?.[1] || ""),
      thumbnail: e.match(/<media:thumbnail url="([^"]+)"/)?.[1] || null,
      url: `https://www.youtube.com/watch?v=${vid}`,
    };
  }).filter(i => i.videoId);
  return { title, items, source: "youtube_public_feed", partial: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    if (!(await isAdminRequest(req, db))) return json({ error: "Forbidden — admin only" }, 403);
    const { data: u } = await db.auth.getUser((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
    const body = await req.json();
    const action = body.action;

    if (action === "analyze" || action === "commit") {
      const listId = parsePlaylistId(String(body.url || ""));
      if (!listId) return json({ error: "URL playlist YouTube tidak valid" }, 400);
      const pl = await fetchPlaylist(listId);
      const vids = pl.items.map(i => i.videoId);
      const [{ data: songs }, { data: tracks }, { data: allSongs }] = await Promise.all([
        db.from("playlist_songs").select("id, source_video_id").in("source_video_id", vids.length ? vids : ["-"]),
        db.from("music_youtube_tracks").select("video_id, song_id").in("video_id", vids.length ? vids : ["-"]),
        db.from("playlist_songs").select("id, title, artist"),
      ]);
      const songByVid = new Map((songs || []).map((s: any) => [s.source_video_id, s.id]));
      const trackVids = new Set((tracks || []).map((t: any) => t.video_id));
      const byTitle = new Map((allSongs || []).map((s: any) => [`${norm(s.title)}|${norm(s.artist)}`, s.id]));
      const rows = pl.items.map(i => {
        const audioSong = songByVid.get(i.videoId) || byTitle.get(`${norm(i.title)}|${norm(i.artist)}`) || null;
        const status = audioSong ? "exists_audio" : trackVids.has(i.videoId) ? "exists_metadata" : (!i.title || /private video|deleted video/i.test(i.title)) ? "unavailable" : "new";
        return { ...i, status, songId: audioSong };
      });
      if (action === "analyze") return json({ playlistId: listId, title: pl.title, source: pl.source, partial: pl.partial, items: rows });

      // commit: metadata only. Never downloads audio.
      const selected = new Set<string>(Array.isArray(body.videoIds) ? body.videoIds : rows.map(r => r.videoId));
      let { data: plRow } = await db.from("playlists").select("id").eq("playlist_type", "admin").eq("name", pl.title).maybeSingle();
      if (!plRow) {
        const ins = await db.from("playlists").insert({ name: pl.title, playlist_type: "admin", cover_url: rows[0]?.thumbnail || null }).select("id").single();
        if (ins.error) return json({ error: ins.error.message }, 500);
        plRow = ins.data;
      }
      let created = 0, existing = 0, skipped = 0, failed = 0, linked = 0;
      for (const r of rows) {
        if (!selected.has(r.videoId) || r.status === "unavailable") { skipped++; continue; }
        if (r.status !== "new") {
          existing++;
          if (r.songId) {
            const { error } = await db.from("playlist_items").upsert({ playlist_id: plRow!.id, song_id: r.songId, item_order: r.position }, { onConflict: "playlist_id,song_id", ignoreDuplicates: true });
            if (!error) linked++;
          }
          continue;
        }
        const { error } = await db.from("music_youtube_tracks").upsert({
          video_id: r.videoId, title: r.title, artist: r.artist || "YouTube", thumbnail_url: r.thumbnail, youtube_url: r.url,
          source_playlist_id: listId, position: r.position, playlist_id: plRow!.id, status: "awaiting_audio",
        }, { onConflict: "video_id", ignoreDuplicates: true });
        if (error) failed++; else created++;
      }
      await db.from("music_import_logs").insert({
        playlist_url: String(body.url), playlist_id: listId, admin_user_id: u?.user?.id || null,
        total_items: rows.length, new_items: created, existing_items: existing, skipped_items: skipped, failed_items: failed, metadata_source: pl.source,
      });
      return json({ ok: true, playlistDbId: plRow!.id, title: pl.title, partial: pl.partial, summary: { total: rows.length, existing, new: created, skipped, failed, linked } });
    }

    if (action === "attach") {
      // Admin uploaded LEGAL audio to music-files; promote metadata track into playlist_songs.
      const { videoId, fileUrl, fileSize, duration, coverUrl } = body;
      if (!videoId || !fileUrl || !(Number(fileSize) > 0)) return json({ error: "Data audio tidak lengkap" }, 400);
      const base = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/music-files/`;
      if (!String(fileUrl).startsWith(base)) return json({ error: "File harus dari penyimpanan musik" }, 400);
      const { data: t } = await db.from("music_youtube_tracks").select("*").eq("video_id", videoId).maybeSingle();
      if (!t) return json({ error: "Track tidak ditemukan" }, 404);
      if (t.song_id) return json({ error: "Track sudah punya audio", songId: t.song_id }, 409);
      const ins = await db.from("playlist_songs").insert({
        title: t.title, artist: t.artist, file_url: fileUrl, file_size: Number(fileSize), duration: Math.round(Number(duration) || 0) || null,
        cover_url: coverUrl || null, source_type: "youtube_licensed", source_url: t.youtube_url, source_video_id: t.video_id, source_playlist_id: t.source_playlist_id,
      }).select("id").single();
      if (ins.error) return json({ error: ins.error.code === "23505" ? "Lagu ini sudah ada" : ins.error.message }, 409);
      if (t.playlist_id) await db.from("playlist_items").upsert({ playlist_id: t.playlist_id, song_id: ins.data.id, item_order: t.position }, { onConflict: "playlist_id,song_id", ignoreDuplicates: true });
      await db.from("music_youtube_tracks").update({ song_id: ins.data.id, status: "audio_ready" }).eq("id", t.id);
      return json({ ok: true, songId: ins.data.id });
    }
    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Gagal" }, 500);
  }
});
