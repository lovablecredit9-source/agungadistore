CREATE TABLE IF NOT EXISTS public.anon_chat_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  primary_visitor_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anon_chat_account_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.anon_chat_accounts(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  last_login_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_anon_chat_account_devices_visitor ON public.anon_chat_account_devices(visitor_id);

ALTER TABLE public.anon_chat_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anon_chat_account_devices ENABLE ROW LEVEL SECURITY;

-- No client direct access; all via edge function with service role.
CREATE POLICY "no_client_access_accounts" ON public.anon_chat_accounts FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "no_client_access_devices" ON public.anon_chat_account_devices FOR ALL USING (false) WITH CHECK (false);

CREATE TRIGGER anon_chat_accounts_updated_at
BEFORE UPDATE ON public.anon_chat_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();