ALTER TABLE public.user_balances ADD COLUMN IF NOT EXISTS auth_user_id uuid NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_balances_auth_user_id_key ON public.user_balances(auth_user_id) WHERE auth_user_id IS NOT NULL;
COMMENT ON COLUMN public.user_balances.auth_user_id IS 'Login account (auth.users.id) linked to this wallet. Written only by the balance-auth edge function (service role).';