import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PlaybackState } from "@/components/PlaylistTab";

/**
 * Hook untuk track listening time pengguna.
 * - Menghitung durasi dengar dari PROGRES `currentTime` audio yang sebenarnya,
 *   bukan wall-clock. Jadi buffering, pause, seek maju/mundur tidak menambah
 *   detik palsu → level listener & durasi akurat.
 * - Flush via RPC `log_song_listen` saat akumulasi cukup / lagu berubah / unmount.
 */
export function useMusicListenTracker(playbackState: PlaybackState | undefined, visitorId: string | undefined) {
  const accumulatedRef = useRef(0);
  const lastSongIdRef = useRef<string | null>(null);
  const lastCurrentTimeRef = useRef<number | null>(null);
  const lastSongInfoRef = useRef<{ id: string; title: string; artist: string; type: string } | null>(null);
  const flushingRef = useRef(false);

  // Flush helper
  const flush = async (force = false) => {
    if (flushingRef.current) return;
    const acc = Math.floor(accumulatedRef.current);
    const info = lastSongInfoRef.current;
    if (!info || !visitorId) { if (force) accumulatedRef.current = 0; return; }
    if (acc < (force ? 3 : 15)) return;
    flushingRef.current = true;
    accumulatedRef.current = Math.max(0, accumulatedRef.current - acc);
    try {
      await supabase.rpc("ensure_music_daily_quests", { p_visitor_id: visitorId });
      await supabase.rpc("log_song_listen", {
        p_visitor_id: visitorId,
        p_song_id: info.id,
        p_song_type: info.type,
        p_song_title: info.title,
        p_song_artist: info.artist,
        p_seconds: Math.round(acc),
      });
      window.dispatchEvent(new CustomEvent("music-listen-logged", {
        detail: { visitorId, songId: info.id, songType: info.type, seconds: acc },
      }));
    } catch {
      accumulatedRef.current += acc;
    } finally {
      flushingRef.current = false;
    }
  };

  useEffect(() => {
    if (!playbackState || !visitorId) return;
    const song = playbackState.song;
    const isPlaying = playbackState.isPlaying;
    const currentTime = Number(playbackState.currentTime) || 0;

    // Detect song change → flush previous, reset progress anchor
    if (song?.id !== lastSongIdRef.current) {
      flush(true);
      lastSongIdRef.current = song?.id ?? null;
      lastCurrentTimeRef.current = null;
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
      return;
    }

    if (!song || !isPlaying) {
      // Saat pause/stop, jangan hitung; reset anchor supaya resume tidak lompat.
      lastCurrentTimeRef.current = null;
      return;
    }

    // Hitung selisih progres audio yang sebenarnya diputar.
    const prev = lastCurrentTimeRef.current;
    lastCurrentTimeRef.current = currentTime;
    if (prev != null) {
      const delta = currentTime - prev;
      // delta valid hanya untuk pemutaran normal (bukan seek/loop). Batasi < 45s.
      if (delta > 0 && delta < 45) {
        accumulatedRef.current += delta;
        if (accumulatedRef.current >= 15) flush(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackState?.song?.id, playbackState?.isPlaying, playbackState?.currentTime, visitorId]);

  // Flush on unmount
  useEffect(() => {
    return () => { flush(true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
