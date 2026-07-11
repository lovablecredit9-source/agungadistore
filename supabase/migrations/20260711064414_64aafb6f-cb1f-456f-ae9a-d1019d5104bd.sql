CREATE OR REPLACE FUNCTION public.is_registered_balance_visitor(p_visitor_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p_visitor_id IS NOT NULL
    AND btrim(p_visitor_id) <> ''
    AND EXISTS (
      SELECT 1
      FROM public.user_balances ub
      WHERE ub.visitor_id = p_visitor_id
    );
$function$;

CREATE OR REPLACE FUNCTION public.ensure_music_daily_quests(p_visitor_id text)
RETURNS SETOF public.music_daily_quests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NOT public.is_registered_balance_visitor(p_visitor_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.music_daily_quests(visitor_id, quest_date, quest_type, target_value, reward_coins) VALUES
    (p_visitor_id, v_today, 'listen_seconds', 600, 50),
    (p_visitor_id, v_today, 'like_songs', 3, 30),
    (p_visitor_id, v_today, 'comment_song', 1, 25),
    (p_visitor_id, v_today, 'share_song', 1, 20),
    (p_visitor_id, v_today, 'react_songs', 5, 25),
    (p_visitor_id, v_today, 'unique_artists', 5, 40),
    (p_visitor_id, v_today, 'listen_long', 1800, 80),
    (p_visitor_id, v_today, 'comment_extra', 3, 50),
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

CREATE OR REPLACE FUNCTION public.claim_music_quest(p_visitor_id text, p_quest_id uuid)
RETURNS TABLE(success boolean, message text, coins_added integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quest record;
BEGIN
  IF NOT public.is_registered_balance_visitor(p_visitor_id) THEN
    RETURN QUERY SELECT false, 'Login saldo dulu untuk klaim quest'::text, 0;
    RETURN;
  END IF;

  SELECT * INTO v_quest FROM public.music_daily_quests
  WHERE id = p_quest_id AND visitor_id = p_visitor_id;
  
  IF v_quest IS NULL THEN
    RETURN QUERY SELECT false, 'Quest tidak ditemukan'::text, 0;
    RETURN;
  END IF;
  IF NOT v_quest.is_completed THEN
    RETURN QUERY SELECT false, 'Quest belum selesai'::text, 0;
    RETURN;
  END IF;
  IF v_quest.is_claimed THEN
    RETURN QUERY SELECT false, 'Sudah diklaim'::text, 0;
    RETURN;
  END IF;
  
  UPDATE public.music_daily_quests SET is_claimed = true WHERE id = p_quest_id;
  PERFORM public.add_account_credits(p_visitor_id, v_quest.reward_coins);
  PERFORM public.create_notification(p_visitor_id, '🎵 Music Quest Selesai!', 'Kamu dapat ' || v_quest.reward_coins || ' koin dari quest musik harian.', 'success', NULL);
  
  RETURN QUERY SELECT true, 'Berhasil klaim ' || v_quest.reward_coins || ' koin'::text, v_quest.reward_coins;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bump_music_quest_event(p_visitor_id text, p_quest_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NOT public.is_registered_balance_visitor(p_visitor_id) OR p_quest_type IS NULL THEN RETURN; END IF;
  PERFORM public.ensure_music_daily_quests(p_visitor_id);
  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + 1),
      is_completed = (current_value + 1 >= target_value)
  WHERE visitor_id = p_visitor_id AND quest_date = v_today
    AND quest_type = p_quest_type AND is_completed = false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bump_music_share_quest(p_visitor_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NOT public.is_registered_balance_visitor(p_visitor_id) THEN RETURN; END IF;
  PERFORM public.ensure_music_daily_quests(p_visitor_id);

  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + 1),
      is_completed = (current_value + 1 >= target_value)
  WHERE visitor_id = p_visitor_id
    AND quest_date = v_today
    AND quest_type = 'share_song'
    AND is_completed = false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bump_music_comment_quest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NOT public.is_registered_balance_visitor(NEW.visitor_id) THEN
    RAISE EXCEPTION 'Login saldo dulu untuk komentar lagu';
  END IF;

  PERFORM public.ensure_music_daily_quests(NEW.visitor_id);

  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + 1),
      is_completed = (current_value + 1 >= target_value)
  WHERE visitor_id = NEW.visitor_id
    AND quest_date = v_today
    AND quest_type IN ('comment_song', 'comment_extra')
    AND is_completed = false;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bump_music_like_quest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NOT public.is_registered_balance_visitor(NEW.visitor_id) THEN
    RAISE EXCEPTION 'Login saldo dulu untuk like lagu';
  END IF;

  PERFORM public.ensure_music_daily_quests(NEW.visitor_id);

  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + 1),
      is_completed = (current_value + 1 >= target_value)
  WHERE visitor_id = NEW.visitor_id
    AND quest_date = v_today
    AND quest_type = 'like_songs'
    AND is_completed = false;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bump_music_react_quest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NOT public.is_registered_balance_visitor(NEW.visitor_id) THEN
    RAISE EXCEPTION 'Login saldo dulu untuk reaksi lagu';
  END IF;

  PERFORM public.ensure_music_daily_quests(NEW.visitor_id);

  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + 1),
      is_completed = (current_value + 1 >= target_value)
  WHERE visitor_id = NEW.visitor_id
    AND quest_date = v_today
    AND quest_type = 'react_songs'
    AND is_completed = false;

  RETURN NEW;
END;
$function$;

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

  SELECT COUNT(DISTINCT song_id)::int INTO v_unique_songs
  FROM public.song_listening_log
  WHERE visitor_id = p_visitor_id
    AND listened_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta');
  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, COALESCE(v_unique_songs, 0)),
      is_completed = (COALESCE(v_unique_songs, 0) >= target_value)
  WHERE visitor_id = p_visitor_id AND quest_date = v_today
    AND quest_type = 'unique_songs' AND is_completed = false;

  IF v_seconds >= 60 THEN
    UPDATE public.music_daily_quests
    SET current_value = LEAST(target_value, current_value + 1),
        is_completed = (current_value + 1 >= target_value)
    WHERE visitor_id = p_visitor_id AND quest_date = v_today
      AND quest_type = 'finish_songs' AND is_completed = false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.liked_songs WHERE visitor_id = p_visitor_id AND song_id = p_song_id
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

DROP POLICY IF EXISTS "Anyone can insert comments" ON public.song_comments;
DROP POLICY IF EXISTS "Owner or admin can update" ON public.song_comments;
DROP POLICY IF EXISTS "Owner or admin can delete" ON public.song_comments;
CREATE POLICY "Registered balance users can insert comments" ON public.song_comments FOR INSERT WITH CHECK (public.is_registered_balance_visitor(visitor_id));
CREATE POLICY "Registered comment owner can update" ON public.song_comments FOR UPDATE USING (public.is_registered_balance_visitor(visitor_id)) WITH CHECK (public.is_registered_balance_visitor(visitor_id));
CREATE POLICY "Registered comment owner can delete" ON public.song_comments FOR DELETE USING (public.is_registered_balance_visitor(visitor_id));

DROP POLICY IF EXISTS "Anyone can insert reactions" ON public.song_reactions;
DROP POLICY IF EXISTS "Anyone can delete own reactions" ON public.song_reactions;
CREATE POLICY "Registered balance users can insert song reactions" ON public.song_reactions FOR INSERT WITH CHECK (public.is_registered_balance_visitor(visitor_id));
CREATE POLICY "Registered balance users can delete song reactions" ON public.song_reactions FOR DELETE USING (public.is_registered_balance_visitor(visitor_id));

DROP POLICY IF EXISTS "reactions_insert" ON public.song_comment_reactions;
DROP POLICY IF EXISTS "reactions_delete" ON public.song_comment_reactions;
CREATE POLICY "Registered balance users can insert comment reactions" ON public.song_comment_reactions FOR INSERT WITH CHECK (public.is_registered_balance_visitor(visitor_id));
CREATE POLICY "Registered balance users can delete comment reactions" ON public.song_comment_reactions FOR DELETE USING (public.is_registered_balance_visitor(visitor_id));

DROP POLICY IF EXISTS "Anyone can insert quests" ON public.music_daily_quests;
DROP POLICY IF EXISTS "Anyone can update quests" ON public.music_daily_quests;
CREATE POLICY "Registered balance users can insert music quests" ON public.music_daily_quests FOR INSERT WITH CHECK (public.is_registered_balance_visitor(visitor_id));
CREATE POLICY "Registered balance users can update music quests" ON public.music_daily_quests FOR UPDATE USING (public.is_registered_balance_visitor(visitor_id)) WITH CHECK (public.is_registered_balance_visitor(visitor_id));

DROP POLICY IF EXISTS "Anyone can upsert xp" ON public.music_listener_xp;
DROP POLICY IF EXISTS "Anyone can update xp" ON public.music_listener_xp;
CREATE POLICY "Registered balance users can insert music xp" ON public.music_listener_xp FOR INSERT WITH CHECK (public.is_registered_balance_visitor(visitor_id));
CREATE POLICY "Registered balance users can update music xp" ON public.music_listener_xp FOR UPDATE USING (public.is_registered_balance_visitor(visitor_id)) WITH CHECK (public.is_registered_balance_visitor(visitor_id));

DROP POLICY IF EXISTS "Anyone can insert listen log" ON public.song_listening_log;
CREATE POLICY "Registered balance users can insert listen log" ON public.song_listening_log FOR INSERT WITH CHECK (public.is_registered_balance_visitor(visitor_id));