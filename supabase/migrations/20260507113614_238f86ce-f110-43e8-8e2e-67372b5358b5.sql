
DROP VIEW IF EXISTS public.user_balances_public;
CREATE VIEW public.user_balances_public AS
SELECT id, visitor_id, username, phone, email, balance, bonus_balance, created_at, updated_at
FROM public.user_balances;
GRANT SELECT ON public.user_balances_public TO anon, authenticated;
