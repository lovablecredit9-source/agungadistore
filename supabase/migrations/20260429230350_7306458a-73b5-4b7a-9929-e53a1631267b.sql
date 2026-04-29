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

  SELECT total_seconds INTO v_total
  FROM public.music_listener_xp
  WHERE visitor_id = p_visitor_id;

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

  UPDATE public.music_listener_xp
  SET level = v_level, updated_at = now()
  WHERE visitor_id = p_visitor_id;

  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + v_seconds),
      is_completed = (current_value + v_seconds >= target_value)
  WHERE visitor_id = p_visitor_id
    AND quest_date = v_today
    AND quest_type = 'listen_seconds'
    AND is_completed = false;
END;
$function$;

-- Recalculate existing users' levels based on new thresholds
UPDATE public.music_listener_xp
SET level = CASE
  WHEN total_seconds >= 12960000 THEN 'Legend Pro Immortal'
  WHEN total_seconds >= 5184000  THEN 'Legend Immortal'
  WHEN total_seconds >= 2592000  THEN 'Ninja Master'
  WHEN total_seconds >= 1036800  THEN 'Grand Master'
  WHEN total_seconds >= 432000   THEN 'Warrior'
  WHEN total_seconds >= 172800   THEN 'Legenda Pro'
  WHEN total_seconds >= 86400    THEN 'Legenda'
  WHEN total_seconds >= 43200    THEN 'Master Pro'
  WHEN total_seconds >= 18000    THEN 'Master'
  WHEN total_seconds >= 7200     THEN 'Diamond'
  WHEN total_seconds >= 3600     THEN 'Platinum'
  WHEN total_seconds >= 1800     THEN 'Gold'
  WHEN total_seconds >= 600      THEN 'Silver'
  ELSE 'Bronze'
END,
updated_at = now();