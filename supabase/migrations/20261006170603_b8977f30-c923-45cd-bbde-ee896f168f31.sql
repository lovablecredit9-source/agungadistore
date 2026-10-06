ALTER TABLE public.admin_posts
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'pengumuman',
  ADD COLUMN IF NOT EXISTS action_tab text,
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_position text NOT NULL DEFAULT 'center';

CREATE OR REPLACE FUNCTION public.admin_post_like(p_post_id uuid, p_liked boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v integer;
BEGIN
  UPDATE public.admin_posts
     SET like_count = GREATEST(0, like_count + CASE WHEN p_liked THEN 1 ELSE -1 END)
   WHERE id = p_post_id AND is_active = true
   RETURNING like_count INTO v;
  RETURN COALESCE(v, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_post_like(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_post_like(uuid, boolean) TO anon, authenticated;