-- Allow public read access through the safe view (excludes password_hash)
-- Switch from security_invoker to security_definer so anon clients can read
-- non-sensitive columns via the view while base table remains locked down.
ALTER VIEW public.user_balances_public SET (security_invoker = off);

-- Ensure anon/authenticated can SELECT the view
GRANT SELECT ON public.user_balances_public TO anon, authenticated;