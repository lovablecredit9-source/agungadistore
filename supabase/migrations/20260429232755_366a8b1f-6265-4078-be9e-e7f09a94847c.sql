-- =========================================================
-- 1) Perbanyak quest harian musik
-- =========================================================
CREATE OR REPLACE FUNCTION public.ensure_music_daily_quests(p_visitor_id text)
RETURNS SETOF public.music_daily_quests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  -- Quest 1: Listen 10 menit (600 detik) → 50 koin
  INSERT INTO public.music_daily_quests(visitor_id, quest_date, quest_type, target_value, reward_coins)
  VALUES (p_visitor_id, v_today, 'listen_seconds', 600, 50)
  ON CONFLICT (visitor_id, quest_date, quest_type) DO NOTHING;

  -- Quest 2: Like 3 lagu → 30 koin
  INSERT INTO public.music_daily_quests(visitor_id, quest_date, quest_type, target_value, reward_coins)
  VALUES (p_visitor_id, v_today, 'like_songs', 3, 30)
  ON CONFLICT (visitor_id, quest_date, quest_type) DO NOTHING;

  -- Quest 3: Komentar 1 lagu → 25 koin
  INSERT INTO public.music_daily_quests(visitor_id, quest_date, quest_type, target_value, reward_coins)
  VALUES (p_visitor_id, v_today, 'comment_song', 1, 25)
  ON CONFLICT (visitor_id, quest_date, quest_type) DO NOTHING;

  -- Quest 4 (BARU): Bagikan 1 lagu → 20 koin
  INSERT INTO public.music_daily_quests(visitor_id, quest_date, quest_type, target_value, reward_coins)
  VALUES (p_visitor_id, v_today, 'share_song', 1, 20)
  ON CONFLICT (visitor_id, quest_date, quest_type) DO NOTHING;

  -- Quest 5 (BARU): Beri 5 reaksi (emoji) → 25 koin
  INSERT INTO public.music_daily_quests(visitor_id, quest_date, quest_type, target_value, reward_coins)
  VALUES (p_visitor_id, v_today, 'react_songs', 5, 25)
  ON CONFLICT (visitor_id, quest_date, quest_type) DO NOTHING;

  -- Quest 6 (BARU): Dengar 5 artis berbeda → 40 koin
  INSERT INTO public.music_daily_quests(visitor_id, quest_date, quest_type, target_value, reward_coins)
  VALUES (p_visitor_id, v_today, 'unique_artists', 5, 40)
  ON CONFLICT (visitor_id, quest_date, quest_type) DO NOTHING;

  -- Quest 7 (BARU): Dengar 30 menit total (sesi panjang) → 80 koin
  INSERT INTO public.music_daily_quests(visitor_id, quest_date, quest_type, target_value, reward_coins)
  VALUES (p_visitor_id, v_today, 'listen_long', 1800, 80)
  ON CONFLICT (visitor_id, quest_date, quest_type) DO NOTHING;

  -- Quest 8 (BARU): Komentar 3 lagu → 50 koin
  INSERT INTO public.music_daily_quests(visitor_id, quest_date, quest_type, target_value, reward_coins)
  VALUES (p_visitor_id, v_today, 'comment_extra', 3, 50)
  ON CONFLICT (visitor_id, quest_date, quest_type) DO NOTHING;

  RETURN QUERY SELECT * FROM public.music_daily_quests
  WHERE visitor_id = p_visitor_id AND quest_date = v_today
  ORDER BY quest_type;
END;
$$;

-- =========================================================
-- 2) Trigger reaksi → quest react_songs
-- =========================================================
CREATE OR REPLACE FUNCTION public.bump_music_react_quest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NEW.visitor_id IS NULL OR trim(NEW.visitor_id) = '' THEN
    RETURN NEW;
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
$$;

DROP TRIGGER IF EXISTS trg_bump_music_react_quest ON public.song_reactions;
CREATE TRIGGER trg_bump_music_react_quest
AFTER INSERT ON public.song_reactions
FOR EACH ROW
EXECUTE FUNCTION public.bump_music_react_quest();

-- =========================================================
-- 3) Trigger comment → tambah quest 'comment_extra' (3 lagu)
-- =========================================================
CREATE OR REPLACE FUNCTION public.bump_music_comment_quest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NEW.visitor_id IS NULL OR trim(NEW.visitor_id) = '' THEN
    RETURN NEW;
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
$$;

-- =========================================================
-- 4) Fungsi server: tambah progres share_song
-- =========================================================
CREATE OR REPLACE FUNCTION public.bump_music_share_quest(p_visitor_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' THEN RETURN; END IF;
  PERFORM public.ensure_music_daily_quests(p_visitor_id);

  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + 1),
      is_completed = (current_value + 1 >= target_value)
  WHERE visitor_id = p_visitor_id
    AND quest_date = v_today
    AND quest_type = 'share_song'
    AND is_completed = false;
END;
$$;

-- =========================================================
-- 5) log_song_listen: update juga listen_long & unique_artists
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_song_listen(p_visitor_id text, p_song_id uuid, p_song_type text, p_song_title text, p_song_artist text, p_seconds integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_level text;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_seconds integer := GREATEST(0, COALESCE(p_seconds, 0));
  v_unique_artists integer;
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

  -- Quest: listen_seconds (10 menit)
  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + v_seconds),
      is_completed = (current_value + v_seconds >= target_value)
  WHERE visitor_id = p_visitor_id
    AND quest_date = v_today
    AND quest_type = 'listen_seconds'
    AND is_completed = false;

  -- Quest BARU: listen_long (30 menit total hari ini)
  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + v_seconds),
      is_completed = (current_value + v_seconds >= target_value)
  WHERE visitor_id = p_visitor_id
    AND quest_date = v_today
    AND quest_type = 'listen_long'
    AND is_completed = false;

  -- Quest BARU: unique_artists (5 artis berbeda hari ini)
  IF p_song_artist IS NOT NULL AND trim(p_song_artist) <> '' THEN
    SELECT COUNT(DISTINCT lower(trim(song_artist)))::int INTO v_unique_artists
    FROM public.song_listening_log
    WHERE visitor_id = p_visitor_id
      AND listened_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta')
      AND song_artist IS NOT NULL
      AND trim(song_artist) <> '';

    UPDATE public.music_daily_quests
    SET current_value = LEAST(target_value, COALESCE(v_unique_artists, 0)),
        is_completed = (COALESCE(v_unique_artists, 0) >= target_value)
    WHERE visitor_id = p_visitor_id
      AND quest_date = v_today
      AND quest_type = 'unique_artists'
      AND is_completed = false;
  END IF;
END;
$$;

-- =========================================================
-- 6) Sinkronkan rank/XP dengan AKUN SALDO
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_account_music_xp(p_visitor_id text)
RETURNS TABLE(level text, total_seconds bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ub_id uuid;
  v_total bigint;
  v_level text;
BEGIN
  -- Cari akun saldo aktif untuk visitor
  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC
  LIMIT 1;

  IF v_ub_id IS NOT NULL THEN
    -- Jumlahkan total_seconds dari semua visitor di akun ini
    SELECT COALESCE(SUM(x.total_seconds), 0)::bigint INTO v_total
    FROM public.music_listener_xp x
    WHERE x.visitor_id IN (
      SELECT DISTINCT blh.visitor_id
      FROM public.balance_login_history blh
      WHERE blh.user_balance_id = v_ub_id
    );
  ELSE
    SELECT COALESCE(x.total_seconds, 0)::bigint INTO v_total
    FROM public.music_listener_xp x
    WHERE x.visitor_id = p_visitor_id;
  END IF;

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

  RETURN QUERY SELECT v_level, COALESCE(v_total, 0);
END;
$$;

-- Top fans per akun saldo (agregasi visitor di akun yg sama)
CREATE OR REPLACE FUNCTION public.get_song_top_fans_account(p_song_id uuid, p_song_type text DEFAULT 'playlist', p_limit integer DEFAULT 10)
RETURNS TABLE(account_key text, display_name text, total_seconds bigint, rank integer, visitor_id text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      l.visitor_id,
      l.seconds,
      (
        SELECT blh.user_balance_id
        FROM public.balance_login_history blh
        WHERE blh.visitor_id = l.visitor_id
        ORDER BY blh.logged_in_at DESC
        LIMIT 1
      ) AS user_balance_id
    FROM public.song_listening_log l
    WHERE l.song_id = p_song_id
      AND l.song_type = COALESCE(p_song_type, 'playlist')
  ),
  grouped AS (
    SELECT
      COALESCE(user_balance_id::text, 'v:' || visitor_id) AS account_key,
      MIN(visitor_id) AS visitor_id,
      SUM(seconds)::bigint AS total_seconds
    FROM base
    GROUP BY COALESCE(user_balance_id::text, 'v:' || visitor_id)
  )
  SELECT
    g.account_key,
    COALESCE(mp.username, ub.username, 'Anonim') AS display_name,
    g.total_seconds,
    ROW_NUMBER() OVER (ORDER BY g.total_seconds DESC)::int AS rank,
    g.visitor_id
  FROM grouped g
  LEFT JOIN public.music_profiles mp ON mp.visitor_id = g.visitor_id
  LEFT JOIN public.user_balances ub ON ub.id::text = g.account_key
  ORDER BY g.total_seconds DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
$$;