ALTER TABLE public.anon_chat_profiles
  ADD COLUMN IF NOT EXISTS who_can_call text NOT NULL DEFAULT 'friends';

CREATE OR REPLACE FUNCTION public.touch_anon_chat_profile(
  p_visitor_id text,
  p_nickname text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_avatar_preset text DEFAULT NULL,
  p_show_last_seen boolean DEFAULT NULL,
  p_who_can_call text DEFAULT NULL
)
RETURNS public.anon_chat_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.anon_chat_profiles;
BEGIN
  IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' THEN
    RAISE EXCEPTION 'visitor_id required';
  END IF;

  INSERT INTO public.anon_chat_profiles(
    visitor_id, nickname, avatar_url, avatar_preset,
    show_last_seen, who_can_call, last_seen_at, updated_at
  )
  VALUES (
    p_visitor_id, p_nickname, p_avatar_url,
    COALESCE(NULLIF(p_avatar_preset, ''), 'ninja'),
    COALESCE(p_show_last_seen, true),
    COALESCE(NULLIF(p_who_can_call, ''), 'friends'),
    now(), now()
  )
  ON CONFLICT (visitor_id) DO UPDATE SET
    nickname = COALESCE(EXCLUDED.nickname, public.anon_chat_profiles.nickname),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.anon_chat_profiles.avatar_url),
    avatar_preset = COALESCE(NULLIF(EXCLUDED.avatar_preset, ''), public.anon_chat_profiles.avatar_preset),
    show_last_seen = COALESCE(EXCLUDED.show_last_seen, public.anon_chat_profiles.show_last_seen),
    who_can_call = COALESCE(NULLIF(EXCLUDED.who_can_call, ''), public.anon_chat_profiles.who_can_call),
    last_seen_at = now(),
    updated_at = now()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$function$;