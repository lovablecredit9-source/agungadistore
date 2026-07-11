
-- 1. Foto profil akun saldo
ALTER TABLE public.user_balances ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Tanda komentar diedit
ALTER TABLE public.song_comments ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false;

-- 3. Reaksi / like komentar lagu
CREATE TABLE IF NOT EXISTS public.song_comment_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.song_comments(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  emoji text NOT NULL DEFAULT '❤️',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, visitor_id, emoji)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_comment_reactions TO anon, authenticated;
GRANT ALL ON public.song_comment_reactions TO service_role;
ALTER TABLE public.song_comment_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_public_read" ON public.song_comment_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert" ON public.song_comment_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "reactions_delete" ON public.song_comment_reactions FOR DELETE USING (true);

-- 4. Pembatasan komentar (moderasi)
CREATE TABLE IF NOT EXISTS public.comment_restrictions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL UNIQUE,
  restricted_until timestamptz,
  violation_count integer NOT NULL DEFAULT 0,
  last_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_restrictions TO anon, authenticated;
GRANT ALL ON public.comment_restrictions TO service_role;
ALTER TABLE public.comment_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restrictions_public_read" ON public.comment_restrictions FOR SELECT USING (true);
CREATE POLICY "restrictions_upsert_insert" ON public.comment_restrictions FOR INSERT WITH CHECK (true);
CREATE POLICY "restrictions_upsert_update" ON public.comment_restrictions FOR UPDATE USING (true) WITH CHECK (true);

-- Fungsi catat pelanggaran & set pembatasan 3 jam (berulang, makin lama tiap pelanggaran)
CREATE OR REPLACE FUNCTION public.register_comment_violation(p_visitor_id text, p_reason text)
RETURNS TABLE (restricted_until timestamptz, violation_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_hours integer;
  v_until timestamptz;
BEGIN
  INSERT INTO public.comment_restrictions (visitor_id, violation_count, last_reason)
  VALUES (p_visitor_id, 1, p_reason)
  ON CONFLICT (visitor_id) DO UPDATE
    SET violation_count = public.comment_restrictions.violation_count + 1,
        last_reason = p_reason,
        updated_at = now()
  RETURNING public.comment_restrictions.violation_count INTO v_count;

  -- 3 jam per tingkat pelanggaran (berulang & makin lama)
  v_hours := 3 * v_count;
  v_until := now() + make_interval(hours => v_hours);

  UPDATE public.comment_restrictions
    SET restricted_until = v_until, updated_at = now()
    WHERE visitor_id = p_visitor_id;

  RETURN QUERY SELECT v_until, v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_comment_violation(text, text) TO anon, authenticated, service_role;
