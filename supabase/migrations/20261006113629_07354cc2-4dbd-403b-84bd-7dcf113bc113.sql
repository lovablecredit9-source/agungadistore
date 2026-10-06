
REVOKE EXECUTE ON FUNCTION public.ticket_after_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ticket_after_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_heartbeat() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ticket_support_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_support_stats() TO authenticated;

-- Perbaikan sumber data leaderboard (pakai gabungan riwayat spin)
CREATE OR REPLACE FUNCTION public.royale_leaderboard(p_metric text DEFAULT 'points', p_limit integer DEFAULT 20, p_visitor_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  WITH s AS (
    SELECT visitor_id,
      count(*) AS total_spin,
      count(*) FILTER (WHERE reward_value > 0) AS total_win,
      count(*) FILTER (WHERE is_jackpot OR rarity IN ('jackpot','mythic')) AS jackpot,
      count(*) FILTER (WHERE rarity IN ('legendary','mythic','jackpot')) AS legendary
    FROM public.royale_all_spins GROUP BY visitor_id
  ), scored AS (
    SELECT s.*, (total_spin + total_win + legendary * 10 + jackpot * 25) AS points,
      COALESCE((SELECT current_streak FROM daily_streaks d WHERE d.visitor_id = s.visitor_id LIMIT 1), 0) AS streak
    FROM s
  ), ranked AS (
    SELECT sc.*, row_number() OVER (ORDER BY CASE p_metric
        WHEN 'spin' THEN total_spin WHEN 'win' THEN total_win WHEN 'jackpot' THEN jackpot
        WHEN 'legendary' THEN legendary WHEN 'streak' THEN streak ELSE points END DESC, total_spin DESC) AS rank,
      COALESCE((SELECT g.display_name FROM game_profiles g WHERE g.visitor_id = sc.visitor_id AND g.display_name IS NOT NULL LIMIT 1),
               (SELECT u.username FROM user_balances u WHERE u.visitor_id = sc.visitor_id LIMIT 1)) AS raw_name,
      (SELECT g.avatar_url FROM game_profiles g WHERE g.visitor_id = sc.visitor_id LIMIT 1) AS avatar_url
    FROM scored sc
  )
  SELECT jsonb_build_object(
    'top', COALESCE((SELECT jsonb_agg(jsonb_build_object('rank', rank, 'name', royale_mask_name(raw_name), 'avatar_url', avatar_url,
        'total_spin', total_spin, 'total_win', total_win, 'jackpot', jackpot, 'legendary', legendary, 'points', points, 'streak', streak,
        'is_me', visitor_id = p_visitor_id) ORDER BY rank) FROM ranked WHERE rank <= GREATEST(1, LEAST(p_limit, 100))), '[]'::jsonb),
    'me', (SELECT jsonb_build_object('rank', rank, 'total_spin', total_spin, 'total_win', total_win, 'jackpot', jackpot,
        'legendary', legendary, 'points', points, 'streak', streak) FROM ranked WHERE visitor_id = p_visitor_id)
  ) INTO r;
  RETURN r;
END $$;

-- Riwayat + statistik pribadi Royale (untuk tab History & kartu My Royale)
CREATE OR REPLACE FUNCTION public.royale_my_summary(p_visitor_id text, p_limit integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF p_visitor_id IS NULL OR length(p_visitor_id) < 8 THEN RETURN jsonb_build_object('error','visitor tidak valid'); END IF;
  SELECT jsonb_build_object(
    'stats', (SELECT jsonb_build_object(
        'total_spin', count(*),
        'total_win', count(*) FILTER (WHERE reward_value > 0),
        'jackpot', count(*) FILTER (WHERE is_jackpot OR rarity IN ('jackpot','mythic')),
        'legendary', count(*) FILTER (WHERE rarity IN ('legendary','mythic','jackpot')),
        'epic', count(*) FILTER (WHERE rarity = 'epic'),
        'points', count(*) + count(*) FILTER (WHERE reward_value > 0) + 10 * count(*) FILTER (WHERE rarity IN ('legendary','mythic','jackpot')) + 25 * count(*) FILTER (WHERE is_jackpot OR rarity IN ('jackpot','mythic')))
      FROM royale_all_spins WHERE visitor_id = p_visitor_id),
    'favorite', (SELECT reward_label FROM royale_all_spins WHERE visitor_id = p_visitor_id AND reward_label IS NOT NULL GROUP BY reward_label ORDER BY count(*) DESC LIMIT 1),
    'streak', COALESCE((SELECT current_streak FROM daily_streaks WHERE visitor_id = p_visitor_id LIMIT 1), 0),
    'history', COALESCE((SELECT jsonb_agg(h ORDER BY (h->>'created_at') DESC) FROM (
        SELECT jsonb_build_object('source', source, 'label', reward_label, 'value', reward_value, 'rarity', rarity, 'jackpot', is_jackpot, 'created_at', created_at) h
        FROM royale_all_spins WHERE visitor_id = p_visitor_id ORDER BY created_at DESC LIMIT GREATEST(1, LEAST(p_limit, 100))) x), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

-- ===== MUSIC =====
ALTER TABLE public.playlist_songs
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trending boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.music_home_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'plays_week', COALESCE((SELECT jsonb_object_agg(song_id::text, c) FROM (
        SELECT song_id, count(*) c FROM song_listening_log WHERE listened_at > now() - interval '7 days' AND song_id IS NOT NULL GROUP BY song_id ORDER BY c DESC LIMIT 50) a), '{}'::jsonb),
    'plays_all', COALESCE((SELECT jsonb_object_agg(song_id::text, c) FROM (
        SELECT song_id, count(*) c FROM song_listening_log WHERE song_id IS NOT NULL GROUP BY song_id ORDER BY c DESC LIMIT 100) b), '{}'::jsonb),
    'likes', COALESCE((SELECT jsonb_object_agg(song_id::text, c) FROM (
        SELECT song_id, count(*) c FROM liked_songs GROUP BY song_id ORDER BY c DESC LIMIT 100) l), '{}'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.music_feed(p_limit integer DEFAULT 30)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(f ORDER BY (f->>'at') DESC), '[]'::jsonb) FROM (
    SELECT * FROM (
      SELECT jsonb_build_object('kind','release','who', COALESCE(s.artist,'Admin'), 'title', s.title, 'song_id', s.id, 'cover_url', s.cover_url, 'at', s.created_at) f
        FROM playlist_songs s ORDER BY s.created_at DESC LIMIT 15
    ) a
    UNION ALL SELECT * FROM (
      SELECT jsonb_build_object('kind','upload','who', royale_mask_name(COALESCE((SELECT u.username FROM user_balances u WHERE u.visitor_id = p.visitor_id LIMIT 1), p.artist)), 'title', p.title, 'song_id', p.id, 'cover_url', p.cover_url, 'at', p.created_at)
        FROM public_songs p WHERE p.status = 'approved' AND COALESCE(p.visibility,'public') = 'public' ORDER BY p.created_at DESC LIMIT 15
    ) b
    UNION ALL SELECT * FROM (
      SELECT jsonb_build_object('kind','like','who', royale_mask_name((SELECT u.username FROM user_balances u WHERE u.visitor_id = l.visitor_id LIMIT 1)), 'title', s.title, 'song_id', s.id, 'cover_url', s.cover_url, 'at', l.created_at)
        FROM liked_songs l JOIN playlist_songs s ON s.id = l.song_id ORDER BY l.created_at DESC LIMIT 15
    ) c
    UNION ALL SELECT * FROM (
      SELECT jsonb_build_object('kind','comment','who', royale_mask_name(c.display_name), 'title', left(c.message, 80), 'song_id', c.song_id, 'cover_url', NULL, 'at', c.created_at)
        FROM song_comments c ORDER BY c.created_at DESC LIMIT 10
    ) d
  ) x LIMIT GREATEST(1, LEAST(p_limit, 60));
$$;
