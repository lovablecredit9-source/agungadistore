ALTER TABLE public.balance_login_history
  ADD COLUMN IF NOT EXISTS device_visitor_id text,
  ADD COLUMN IF NOT EXISTS device_brand text,
  ADD COLUMN IF NOT EXISTS device_model text,
  ADD COLUMN IF NOT EXISTS os_name text,
  ADD COLUMN IF NOT EXISTS os_version text,
  ADD COLUMN IF NOT EXISTS browser_name text,
  ADD COLUMN IF NOT EXISTS browser_version text,
  ADD COLUMN IF NOT EXISTS network_type text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS ip_source text,
  ADD COLUMN IF NOT EXISTS login_method text;

COMMENT ON COLUMN public.balance_login_history.network_type IS 'Client-reported (navigator.connection), informational only, never a security signal';
COMMENT ON COLUMN public.balance_login_history.ip_source IS 'server = taken from request headers by the edge function; legacy rows are NULL';

CREATE INDEX IF NOT EXISTS idx_balance_login_history_user_time
  ON public.balance_login_history (user_balance_id, logged_in_at DESC);