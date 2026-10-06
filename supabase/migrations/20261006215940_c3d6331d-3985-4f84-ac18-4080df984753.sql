-- Riwayat login hanya ditulis server dan tidak lagi terbaca publik (berisi IP & ID akun).
DROP POLICY IF EXISTS "Anyone can insert login history" ON public.balance_login_history;
DROP POLICY IF EXISTS "Login history viewable by everyone" ON public.balance_login_history;
CREATE POLICY "Admin can read login history" ON public.balance_login_history
  FOR SELECT TO authenticated USING (public.is_admin_user());

-- Perangkat hanya boleh mengetahui ID akun saldo miliknya sendiri.
CREATE OR REPLACE FUNCTION public.my_active_user_balance_id(p_visitor_id text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_active_user_balance_id(p_visitor_id) WHERE coalesce(length(p_visitor_id),0) >= 4;
$$;
REVOKE ALL ON FUNCTION public.my_active_user_balance_id(text) FROM public;
GRANT EXECUTE ON FUNCTION public.my_active_user_balance_id(text) TO anon, authenticated;