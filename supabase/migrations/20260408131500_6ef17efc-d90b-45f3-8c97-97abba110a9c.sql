CREATE OR REPLACE FUNCTION public.increment_sponsor_views(sponsor_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sponsors SET view_count = view_count + 1 WHERE id = sponsor_id;
$$;