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
  IF NOT public.is_registered_balance_visitor(p_visitor_id) OR p_song_id IS NULL OR v_seconds < 3 THEN
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

  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + v_seconds),
      is_completed = (current_value + v_seconds >= target_value)
  WHERE visitor_id = p_visitor_id AND quest_date = v_today
    AND quest_type IN ('listen_seconds','listen_long','listen_marathon')
    AND is_completed = false;

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

  SELECT COUNT(*)::int INTO v_unique_songs
  FROM (
    SELECT song_id
    FROM public.song_listening_log
    WHERE visitor_id = p_visitor_id
      AND listened_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta')
    GROUP BY song_id
    HAVING SUM(seconds) >= 120
  ) listened_songs;

  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, COALESCE(v_unique_songs, 0)),
      is_completed = (COALESCE(v_unique_songs, 0) >= target_value)
  WHERE visitor_id = p_visitor_id AND quest_date = v_today
    AND quest_type IN ('unique_songs', 'finish_songs') AND is_completed = false;

  SELECT EXISTS(
    SELECT 1 FROM public.liked_songs WHERE visitor_id = p_visitor_id AND song_id = p_song_id
  ) INTO v_is_liked;
  IF v_is_liked AND EXISTS (
    SELECT 1
    FROM public.song_listening_log
    WHERE visitor_id = p_visitor_id
      AND song_id = p_song_id
      AND listened_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta')
    GROUP BY song_id
    HAVING SUM(seconds) >= 120
  ) THEN
    UPDATE public.music_daily_quests
    SET current_value = LEAST(target_value, current_value + 1),
        is_completed = (current_value + 1 >= target_value)
    WHERE visitor_id = p_visitor_id AND quest_date = v_today
      AND quest_type = 'replay_liked' AND is_completed = false;
  END IF;
END;
$function$;