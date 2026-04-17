CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() = '7729a4c3-fcf6-4ae1-8424-9e6cc950d0fd'::uuid;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd <> 'SELECT'
      AND array_to_string(roles, ',') LIKE '%authenticated%'
      AND (qual = 'true' OR with_check = 'true')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    IF r.cmd = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin_user())',
        r.policyname, r.schemaname, r.tablename
      );
    ELSIF r.cmd = 'UPDATE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user())',
        r.policyname, r.schemaname, r.tablename
      );
    ELSIF r.cmd = 'DELETE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR DELETE TO authenticated USING (public.is_admin_user())',
        r.policyname, r.schemaname, r.tablename
      );
    ELSIF r.cmd = 'ALL' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user())',
        r.policyname, r.schemaname, r.tablename
      );
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "API keys viewable by authenticated" ON public.api_keys;
CREATE POLICY "API keys viewable by admin only"
ON public.api_keys
FOR SELECT
TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated can read user_balances" ON public.user_balances;
CREATE POLICY "Admin can read user_balances"
ON public.user_balances
FOR SELECT
TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "Token fields readable by authenticated only" ON public.token_fields;
CREATE POLICY "Admin can read token fields"
ON public.token_fields
FOR SELECT
TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "Password reset tokens viewable by everyone" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Anyone can update password reset tokens" ON public.password_reset_tokens;

DROP POLICY IF EXISTS "Reset tokens viewable by everyone" ON public.pin_reset_tokens;
DROP POLICY IF EXISTS "Anyone can update reset tokens" ON public.pin_reset_tokens;

DROP POLICY IF EXISTS "Pins viewable by everyone" ON public.user_pins;
DROP POLICY IF EXISTS "Anyone can create pin" ON public.user_pins;
DROP POLICY IF EXISTS "Anyone can update own pin" ON public.user_pins;