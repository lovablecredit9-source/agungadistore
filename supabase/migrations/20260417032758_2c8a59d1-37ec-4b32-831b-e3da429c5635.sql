
-- Create a sanitized public view that excludes password_hash
CREATE OR REPLACE VIEW public.user_balances_public
WITH (security_invoker=on) AS
SELECT
  id,
  visitor_id,
  username,
  phone,
  email,
  balance,
  created_at,
  updated_at
FROM public.user_balances;

GRANT SELECT ON public.user_balances_public TO anon, authenticated;

-- Lock down direct SELECT on the base table for anon (public) role.
-- Authenticated role (admin dashboard) keeps full access.
DROP POLICY IF EXISTS "Balances viewable by everyone" ON public.user_balances;
DROP POLICY IF EXISTS "User balances viewable by everyone" ON public.user_balances;
DROP POLICY IF EXISTS "Anyone can view user balances" ON public.user_balances;
DROP POLICY IF EXISTS "Public can view user balances" ON public.user_balances;
DROP POLICY IF EXISTS "Anyone can read user_balances" ON public.user_balances;

-- Ensure RLS is enabled
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

-- Block all anonymous direct SELECT on the sensitive base table
CREATE POLICY "Block anon direct select on user_balances"
ON public.user_balances
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- Allow authenticated (admin) to read everything
CREATE POLICY "Authenticated can read user_balances"
ON public.user_balances
FOR SELECT
TO authenticated
USING (true);
