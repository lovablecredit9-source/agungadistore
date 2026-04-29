-- Extend ensure_music_daily_quests with 6 more quest types
CREATE OR REPLACE FUNCTION public.ensure_music_daily_quests(p_visitor_id text)
 RETURNS SETOF music_daily_quests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  INSERT INTO public.music_daily_quests(visitor_id, quest_date, quest_type, target_value, reward_coins) VALUES
    (p_visitor_id, v_today, 'listen_seconds', 600, 50),
    (p_visitor_id, v_today, 'like_songs', 3, 30),
    (p_visitor_id, v_today, 'comment_song', 1, 25),
    (p_visitor_id, v_today, 'share_song', 1, 20),
    (p_visitor_id, v_today, 'react_songs', 5, 25),
    (p_visitor_id, v_today, 'unique_artists', 5, 40),
    (p_visitor_id, v_today, 'listen_long', 1800, 80),
    (p_visitor_id, v_today, 'comment_extra', 3, 50),
    -- BARU
    (p_visitor_id, v_today, 'unique_songs', 5, 30),
    (p_visitor_id, v_today, 'finish_songs', 3, 35),
    (p_visitor_id, v_today, 'replay_liked', 1, 20),
    (p_visitor_id, v_today, 'open_artist_tab', 1, 15),
    (p_visitor_id, v_today, 'play_playlist', 1, 25),
    (p_visitor_id, v_today, 'listen_marathon', 3600, 150)
  ON CONFLICT (visitor_id, quest_date, quest_type) DO NOTHING;

  RETURN QUERY SELECT * FROM public.music_daily_quests
  WHERE visitor_id = p_visitor_id AND quest_date = v_today
  ORDER BY quest_type;
END;
$function$;

-- Update log_song_listen to also bump unique_songs, finish_songs, listen_marathon, replay_liked
CREATE OR REPLACE FUNCTION public.log_song_listen(p_visitor_id text, p_song_id uuid, p_song_type text, p_song_title text, p_song_artist text, p_seconds integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total bigint;
  v_level text;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_seconds integer := GREATEST(0, COALESCE(p_seconds, 0));
  v_unique_artists integer;
  v_unique_songs integer;
  v_is_liked boolean;
BEGIN
  IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' OR p_song_id IS NULL OR v_seconds < 3 THEN
    RETURN;
  END IF;

  PERFORM public.ensure_music_daily_quests(p_visitor_id);

  INSERT INTO public.song_listening_log(visitor_id, song_id, song_type, song_title, song_artist, seconds)
  VALUES (p_visitor_id, p_song_id, COALESCE(NULLIF(p_song_type, ''), 'playlist'), p_song_title, p_song_artist, v_seconds);

  INSERT INTO public.music_listener_xp(visitor_id, total_seconds, level, updated_at)
  VALUES (p_visitor_id, v_seconds, 'Bronze', now())
  ON CONFLICT (visitor_id) DO UPDATE
    SET total_seconds = public.music_listener_xp.total_seconds + EXCLUDED.total_seconds,
        updated_at = now();

  SELECT total_seconds INTO v_total FROM public.music_listener_xp WHERE visitor_id = p_visitor_id;

  v_level := CASE
    WHEN COALESCE(v_total, 0) >= 12960000 THEN 'Legend Pro Immortal'
    WHEN COALESCE(v_total, 0) >= 5184000  THEN 'Legend Immortal'
    WHEN COALESCE(v_total, 0) >= 2592000  THEN 'Ninja Master'
    WHEN COALESCE(v_total, 0) >= 1036800  THEN 'Grand Master'
    WHEN COALESCE(v_total, 0) >= 432000   THEN 'Warrior'
    WHEN COALESCE(v_total, 0) >= 172800   THEN 'Legenda Pro'
    WHEN COALESCE(v_total, 0) >= 86400    THEN 'Legenda'
    WHEN COALESCE(v_total, 0) >= 43200    THEN 'Master Pro'
    WHEN COALESCE(v_total, 0) >= 18000    THEN 'Master'
    WHEN COALESCE(v_total, 0) >= 7200     THEN 'Diamond'
    WHEN COALESCE(v_total, 0) >= 3600     THEN 'Platinum'
    WHEN COALESCE(v_total, 0) >= 1800     THEN 'Gold'
    WHEN COALESCE(v_total, 0) >= 600      THEN 'Silver'
    ELSE 'Bronze'
  END;

  UPDATE public.music_listener_xp SET level = v_level, updated_at = now() WHERE visitor_id = p_visitor_id;

  -- listen_seconds (10 menit)
  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + v_seconds),
      is_completed = (current_value + v_seconds >= target_value)
  WHERE visitor_id = p_visitor_id AND quest_date = v_today
    AND quest_type IN ('listen_seconds','listen_long','listen_marathon')
    AND is_completed = false;

  -- unique_artists
  IF p_song_artist IS NOT NULL AND trim(p_song_artist) <> '' THEN
    SELECT COUNT(DISTINCT lower(trim(song_artist)))::int INTO v_unique_artists
    FROM public.song_listening_log
    WHERE visitor_id = p_visitor_id
      AND listened_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta')
      AND song_artist IS NOT NULL AND trim(song_artist) <> '';
    UPDATE public.music_daily_quests
    SET current_value = LEAST(target_value, COALESCE(v_unique_artists, 0)),
        is_completed = (COALESCE(v_unique_artists, 0) >= target_value)
    WHERE visitor_id = p_visitor_id AND quest_date = v_today
      AND quest_type = 'unique_artists' AND is_completed = false;
  END IF;

  -- unique_songs (BARU): jumlah lagu berbeda yang diputar hari ini
  SELECT COUNT(DISTINCT song_id)::int INTO v_unique_songs
  FROM public.song_listening_log
  WHERE visitor_id = p_visitor_id
    AND listened_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta');
  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, COALESCE(v_unique_songs, 0)),
      is_completed = (COALESCE(v_unique_songs, 0) >= target_value)
  WHERE visitor_id = p_visitor_id AND quest_date = v_today
    AND quest_type = 'unique_songs' AND is_completed = false;

  -- finish_songs (BARU): jika seksi >= 60 detik dianggap "selesai mendengar" 1 lagu
  IF v_seconds >= 60 THEN
    UPDATE public.music_daily_quests
    SET current_value = LEAST(target_value, current_value + 1),
        is_completed = (current_value + 1 >= target_value)
    WHERE visitor_id = p_visitor_id AND quest_date = v_today
      AND quest_type = 'finish_songs' AND is_completed = false;
  END IF;

  -- replay_liked (BARU): jika lagu yang didengar sudah di-like oleh visitor ini
  SELECT EXISTS(
    SELECT 1 FROM public.song_likes WHERE visitor_id = p_visitor_id AND song_id = p_song_id
  ) INTO v_is_liked;
  IF v_is_liked THEN
    UPDATE public.music_daily_quests
    SET current_value = LEAST(target_value, current_value + 1),
        is_completed = (current_value + 1 >= target_value)
    WHERE visitor_id = p_visitor_id AND quest_date = v_today
      AND quest_type = 'replay_liked' AND is_completed = false;
  END IF;
END;
$function$;

-- Helper RPC untuk bump quest manual: open_artist_tab & play_playlist
CREATE OR REPLACE FUNCTION public.bump_music_quest_event(p_visitor_id text, p_quest_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' OR p_quest_type IS NULL THEN RETURN; END IF;
  PERFORM public.ensure_music_daily_quests(p_visitor_id);
  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + 1),
      is_completed = (current_value + 1 >= target_value)
  WHERE visitor_id = p_visitor_id AND quest_date = v_today
    AND quest_type = p_quest_type AND is_completed = false;
END;
$function$;