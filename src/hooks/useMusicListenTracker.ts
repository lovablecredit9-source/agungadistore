import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PlaybackState } from "@/components/PlaylistTab";

/**
 * Hook untuk track listening time pengguna.
 * - Setiap 30 detik aktif play, kirim log via RPC `log_song_listen`.
 * - Saat lagu berubah, flush sisa detik.
 * - Auto update XP & quest progress di server.
 */
export function useMusicListenTracker(playbackState: PlaybackState | undefined, visitorId: string | undefined) {
  const accumulatedRef = useRef(0);
  const lastSongIdRef = useRef<string | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const lastSongInfoRef = useRef<{ id: string; title: string; artist: string; type: string } | null>(null);

  // Flush helper
  const flush = async (force = false) => {
    const acc = accumulatedRef.current;
    const info = lastSongInfoRef.current;
    if (!info || !visitorId) { if (force) accumulatedRef.current = 0; return; }
    if (acc < (force ? 3 : 15)) return;
    try {
      await supabase.rpc("log_song_listen", {
        p_visitor_id: visitorId,
        p_song_id: info.id,
        p_song_type: info.type,
        p_song_title: info.title,
        p_song_artist: info.artist,
        p_seconds: Math.round(acc),
      });
    } catch { /* silent */ }
    accumulatedRef.current = 0;
  };

  useEffect(() => {
    if (!playbackState || !visitorId) return;
    const song = playbackState.song;
    const isPlaying = playbackState.isPlaying;

    // Detect song change → flush previous
    if (song?.id !== lastSongIdRef.current) {
      flush(true);
      lastSongIdRef.current = song?.id ?? null;
      if (song) {
        lastSongInfoRef.current = {
          id: song.id,
          title: (song as any).title || "Untitled",
          artist: (song as any).artist || "Unknown",
          type: (song as any).source === "public" ? "public" : "playlist",
        };
      } else {
        lastSongInfoRef.current = null;
      }
      lastTickRef.current = Date.now();
      return;
    }

    if (!isPlaying) { lastTickRef.current = Date.now(); return; }

    // Tick: add elapsed seconds while playing
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (elapsed > 0 && elapsed < 30) accumulatedRef.current += elapsed;
      if (accumulatedRef.current >= 15) flush(false);
    }, 5000);

    return () => {
      clearInterval(interval);
      const now = Date.now();
      const elapsed = (now - lastTickRef.current) / 1000;
      if (elapsed > 0 && elapsed < 30) accumulatedRef.current += elapsed;
      lastTickRef.current = now;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackState?.song?.id, playbackState?.isPlaying, visitorId]);

  // Flush on unmount
  useEffect(() => {
    return () => { flush(true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
