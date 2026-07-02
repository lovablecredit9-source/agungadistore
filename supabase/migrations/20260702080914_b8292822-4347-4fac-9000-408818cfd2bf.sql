ALTER TABLE public.user_balances
  ADD COLUMN IF NOT EXISTS login_code TEXT,
  ADD COLUMN IF NOT EXISTS name_change_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS name_change_period TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS user_balances_login_code_key
  ON public.user_balances (login_code)
  WHERE login_code IS NOT NULL;