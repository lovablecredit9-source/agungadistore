CREATE OR REPLACE FUNCTION public.support_admin_last_seen()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT last_seen_at FROM public.admin_presence WHERE id = 1;
$$;
GRANT EXECUTE ON FUNCTION public.support_admin_last_seen() TO anon, authenticated;