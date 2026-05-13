ALTER TABLE public.anon_chat_messages
ADD COLUMN IF NOT EXISTS deleted_for text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.anon_chat_profiles (
  visitor_id text PRIMARY KEY,
  nickname text,
  avatar_url text,
  avatar_preset text NOT NULL DEFAULT 'ninja',
  show_last_seen boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anon_chat_profiles_last_seen
ON public.anon_chat_profiles(last_seen_at DESC);

ALTER TABLE public.anon_chat_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon profiles visible" ON public.anon_chat_profiles;
DROP POLICY IF EXISTS "anon profiles insert" ON public.anon_chat_profiles;
DROP POLICY IF EXISTS "anon profiles update" ON public.anon_chat_profiles;

CREATE POLICY "anon profiles visible"
ON public.anon_chat_profiles
FOR SELECT
USING (true);

CREATE POLICY "anon profiles insert"
ON public.anon_chat_profiles
FOR INSERT
WITH CHECK (true);

CREATE POLICY "anon profiles update"
ON public.anon_chat_profiles
FOR UPDATE
USING (true)
WITH CHECK (true);

ALTER TABLE public.anon_chat_profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.anon_chat_profiles;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.touch_anon_chat_profile(
  p_visitor_id text,
  p_nickname text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_avatar_preset text DEFAULT NULL,
  p_show_last_seen boolean DEFAULT NULL
)
RETURNS public.anon_chat_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile public.anon_chat_profiles;
BEGIN
  IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' THEN
    RAISE EXCEPTION 'visitor_id required';
  END IF;

  INSERT INTO public.anon_chat_profiles(
    visitor_id,
    nickname,
    avatar_url,
    avatar_preset,
    show_last_seen,
    last_seen_at,
    updated_at
  )
  VALUES (
    p_visitor_id,
    p_nickname,
    p_avatar_url,
    COALESCE(NULLIF(p_avatar_preset, ''), 'ninja'),
    COALESCE(p_show_last_seen, true),
    now(),
    now()
  )
  ON CONFLICT (visitor_id) DO UPDATE SET
    nickname = COALESCE(EXCLUDED.nickname, public.anon_chat_profiles.nickname),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.anon_chat_profiles.avatar_url),
    avatar_preset = COALESCE(NULLIF(EXCLUDED.avatar_preset, ''), public.anon_chat_profiles.avatar_preset),
    show_last_seen = COALESCE(EXCLUDED.show_last_seen, public.anon_chat_profiles.show_last_seen),
    last_seen_at = now(),
    updated_at = now()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_anon_chat_profile(text, text, text, text, boolean) TO anon, authenticated;