CREATE OR REPLACE FUNCTION public.log_song_listen(
  p_visitor_id text,
  p_song_id uuid,
  p_song_type text,
  p_song_title text,
  p_song_artist text,
  p_seconds integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_level text;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_seconds integer := GREATEST(0, COALESCE(p_seconds, 0));
BEGIN
  IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' OR p_song_id IS NULL OR v_seconds < 3 THEN
    RETURN;
  END IF;

  -- Ensure today's quests exist before progress is applied.
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
    WHEN COALESCE(v_total, 0) >= 360000 THEN 'Diamond'
    WHEN COALESCE(v_total, 0) >= 144000 THEN 'Platinum'
    WHEN COALESCE(v_total, 0) >= 36000 THEN 'Gold'
    WHEN COALESCE(v_total, 0) >= 7200 THEN 'Silver'
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
$$;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.music_listener_xp;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.music_daily_quests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.song_listening_log;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;