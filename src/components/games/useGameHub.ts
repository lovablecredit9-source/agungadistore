import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GameHubSummary {
  favorite_games: string[];
  last_played_game: string | null;
  last_played_at: string | null;
  play_counts: Record<string, number>;
  stats: { game_type: string; wins: number; losses: number; points: number; updated_at: string }[];
  totalPoints: number;
  rank: number | null;
  memberships: { plan_name: string; expires_at: string; bonus_multiplier: number }[];
  achievements: { achievement_key: string; unlocked_at: string }[];
}

const EMPTY: GameHubSummary = { favorite_games: [], last_played_game: null, last_played_at: null, play_counts: {}, stats: [], totalPoints: 0, rank: null, memberships: [], achievements: [] };

/** Favorites / last played / per-game stats from the existing `game-profile` function. */
export function useGameHub(gameVisitorId: string | null | undefined) {
  const [hub, setHub] = useState<GameHubSummary>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!gameVisitorId) { setLoading(false); return; }
    const { data } = await supabase.functions.invoke("game-profile", { body: { action: "hub_summary", visitorId: gameVisitorId } });
    if (data && !data.error) setHub({ ...EMPTY, ...data });
    setLoading(false);
  }, [gameVisitorId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleFavorite = useCallback(async (gameType: string): Promise<boolean | null> => {
    if (!gameVisitorId) return null;
    // optimistic
    setHub((h) => ({ ...h, favorite_games: h.favorite_games.includes(gameType) ? h.favorite_games.filter((g) => g !== gameType) : [gameType, ...h.favorite_games] }));
    const { data } = await supabase.functions.invoke("game-profile", { body: { action: "toggle_favorite_game", visitorId: gameVisitorId, gameType } });
    if (data?.favorite_games) { setHub((h) => ({ ...h, favorite_games: data.favorite_games })); return !!data.favorite; }
    refresh();
    return null;
  }, [gameVisitorId, refresh]);

  const touchPlayed = useCallback((gameType: string) => {
    if (!gameVisitorId) return;
    setHub((h) => ({ ...h, last_played_game: gameType, last_played_at: new Date().toISOString(), play_counts: { ...h.play_counts, [gameType]: (h.play_counts[gameType] || 0) + 1 } }));
    supabase.functions.invoke("game-profile", { body: { action: "touch_played", visitorId: gameVisitorId, gameType } }).catch(() => {});
  }, [gameVisitorId]);

  return { hub, loading, refresh, toggleFavorite, touchPlayed };
}

export function relativeTime(iso?: string | null) {
  if (!iso) return "Belum pernah";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}
