-- Komentar lagu (untuk playlist_songs DAN public_songs; pakai song_id text untuk fleksibel + song_type)
CREATE TABLE IF NOT EXISTS public.song_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL,
  song_type text NOT NULL DEFAULT 'playlist' CHECK (song_type IN ('playlist','public')),
  visitor_id text NOT NULL,
  display_name text NOT NULL DEFAULT 'Anonim',
  avatar_url text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_song_comments_song ON public.song_comments(song_id, song_type, created_at DESC);
ALTER TABLE public.song_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments" ON public.song_comments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert comments" ON public.song_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Owner or admin can update" ON public.song_comments FOR UPDATE USING (true);
CREATE POLICY "Owner or admin can delete" ON public.song_comments FOR DELETE USING (true);

CREATE TRIGGER trg_song_comments_updated BEFORE UPDATE ON public.song_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reaction lagu (emoji per visitor per lagu)
CREATE TABLE IF NOT EXISTS public.song_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL,
  song_type text NOT NULL DEFAULT 'playlist' CHECK (song_type IN ('playlist','public')),
  visitor_id text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(song_id, song_type, visitor_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_song_reactions_song ON public.song_reactions(song_id, song_type);
ALTER TABLE public.song_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reactions" ON public.song_reactions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reactions" ON public.song_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete own reactions" ON public.song_reactions FOR DELETE USING (true);

-- Listening log (granular: tiap pemutaran 30s minimum dapat 0.5 menit)
CREATE TABLE IF NOT EXISTS public.song_listening_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  song_id uuid NOT NULL,
  song_type text NOT NULL DEFAULT 'playlist',
  song_title text,
  song_artist text,
  seconds integer NOT NULL DEFAULT 0,
  listened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listen_log_visitor ON public.song_listening_log(visitor_id, listened_at DESC);
CREATE INDEX IF NOT EXISTS idx_listen_log_song ON public.song_listening_log(song_id, song_type);
ALTER TABLE public.song_listening_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read listen log" ON public.song_listening_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert listen log" ON public.song_listening_log FOR INSERT WITH CHECK (true);

-- XP listener (cache total seconds + level)
CREATE TABLE IF NOT EXISTS public.music_listener_xp (
  visitor_id text PRIMARY KEY,
  total_seconds bigint NOT NULL DEFAULT 0,
  level text NOT NULL DEFAULT 'Bronze',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.music_listener_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read xp" ON public.music_listener_xp FOR SELECT USING (true);
CREATE POLICY "Anyone can upsert xp" ON public.music_listener_xp FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update xp" ON public.music_listener_xp FOR UPDATE USING (true);

-- Daily music quest (per visitor per tanggal WIB)
CREATE TABLE IF NOT EXISTS public.music_daily_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  quest_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  quest_type text NOT NULL,
  target_value integer NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  reward_coins integer NOT NULL DEFAULT 50,
  is_completed boolean NOT NULL DEFAULT false,
  is_claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, quest_date, quest_type)
);
CREATE INDEX IF NOT EXISTS idx_music_quests_visitor ON public.music_daily_quests(visitor_id, quest_date);
ALTER TABLE public.music_daily_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read quests" ON public.music_daily_quests FOR SELECT USING (true);
CREATE POLICY "Anyone can insert quests" ON public.music_daily_quests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update quests" ON public.music_daily_quests FOR UPDATE USING (true);

-- Function: log listen + auto-update xp + auto-update quest progress
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
BEGIN
  IF p_seconds < 5 THEN RETURN; END IF;
  
  INSERT INTO public.song_listening_log(visitor_id, song_id, song_type, song_title, song_artist, seconds)
  VALUES (p_visitor_id, p_song_id, COALESCE(p_song_type,'playlist'), p_song_title, p_song_artist, p_seconds);
  
  -- Update XP
  INSERT INTO public.music_listener_xp(visitor_id, total_seconds, level, updated_at)
  VALUES (p_visitor_id, p_seconds, 'Bronze', now())
  ON CONFLICT (visitor_id) DO UPDATE
    SET total_seconds = music_listener_xp.total_seconds + EXCLUDED.total_seconds,
        updated_at = now();
  
  SELECT total_seconds INTO v_total FROM public.music_listener_xp WHERE visitor_id = p_visitor_id;
  v_level := CASE
    WHEN v_total >= 360000 THEN 'Diamond'   -- 100 jam
    WHEN v_total >= 144000 THEN 'Platinum'  -- 40 jam
    WHEN v_total >= 36000 THEN 'Gold'       -- 10 jam
    WHEN v_total >= 7200 THEN 'Silver'      -- 2 jam
    ELSE 'Bronze'
  END;
  UPDATE public.music_listener_xp SET level = v_level WHERE visitor_id = p_visitor_id;
  
  -- Update quest "listen_seconds" today if exists
  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + p_seconds),
      is_completed = (current_value + p_seconds >= target_value)
  WHERE visitor_id = p_visitor_id
    AND quest_date = v_today
    AND quest_type = 'listen_seconds'
    AND is_completed = false;
END;
$$;

-- Function: ensure daily quests exist for visitor today
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
  
  RETURN QUERY SELECT * FROM public.music_daily_quests
  WHERE visitor_id = p_visitor_id AND quest_date = v_today
  ORDER BY quest_type;
END;
$$;

-- Function: claim quest reward → tambah koin via add_account_credits
CREATE OR REPLACE FUNCTION public.claim_music_quest(p_visitor_id text, p_quest_id uuid)
RETURNS TABLE(success boolean, message text, coins_added integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quest record;
BEGIN
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
$$;

-- Function: top fans untuk lagu (leaderboard menit dengar)
CREATE OR REPLACE FUNCTION public.get_song_top_fans(p_song_id uuid, p_song_type text DEFAULT 'playlist', p_limit integer DEFAULT 10)
RETURNS TABLE(visitor_id text, display_name text, total_seconds bigint, rank int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    l.visitor_id,
    COALESCE(mp.username, 'Anonim') as display_name,
    SUM(l.seconds)::bigint as total_seconds,
    ROW_NUMBER() OVER (ORDER BY SUM(l.seconds) DESC)::int as rank
  FROM public.song_listening_log l
  LEFT JOIN public.music_profiles mp ON mp.visitor_id = l.visitor_id
  WHERE l.song_id = p_song_id AND l.song_type = COALESCE(p_song_type, 'playlist')
  GROUP BY l.visitor_id, mp.username
  ORDER BY total_seconds DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
$$;

-- Function: daily wrapped (lagu paling sering hari ini + total menit + artist top)
CREATE OR REPLACE FUNCTION public.get_music_wrapped(p_visitor_id text, p_days integer DEFAULT 1)
RETURNS TABLE(
  total_seconds bigint,
  unique_songs bigint,
  top_song_title text,
  top_song_artist text,
  top_song_seconds bigint,
  top_artist text,
  top_artist_seconds bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - (GREATEST(1, p_days) || ' days')::interval;
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT * FROM public.song_listening_log
    WHERE visitor_id = p_visitor_id AND listened_at >= v_since
  ),
  by_song AS (
    SELECT song_title, song_artist, SUM(seconds)::bigint AS s
    FROM base GROUP BY song_title, song_artist
    ORDER BY s DESC LIMIT 1
  ),
  by_artist AS (
    SELECT song_artist, SUM(seconds)::bigint AS s
    FROM base WHERE song_artist IS NOT NULL GROUP BY song_artist
    ORDER BY s DESC LIMIT 1
  )
  SELECT
    COALESCE((SELECT SUM(seconds)::bigint FROM base), 0),
    COALESCE((SELECT COUNT(DISTINCT song_id) FROM base), 0),
    (SELECT song_title FROM by_song),
    (SELECT song_artist FROM by_song),
    COALESCE((SELECT s FROM by_song), 0),
    (SELECT song_artist FROM by_artist),
    COALESCE((SELECT s FROM by_artist), 0);
END;
$$;