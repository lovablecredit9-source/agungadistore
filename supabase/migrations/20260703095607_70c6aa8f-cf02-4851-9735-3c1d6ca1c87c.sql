
ALTER TABLE public.user_balances ADD COLUMN IF NOT EXISTS device_bound_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.balance_wa_reset_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_balance_id uuid REFERENCES public.user_balances(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  purpose text NOT NULL,
  code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  is_used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_reset_visitor ON public.balance_wa_reset_codes (visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_reset_lookup ON public.balance_wa_reset_codes (user_balance_id, purpose, is_used);

GRANT ALL ON public.balance_wa_reset_codes TO service_role;
ALTER TABLE public.balance_wa_reset_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no client access wa reset codes" ON public.balance_wa_reset_codes FOR ALL USING (false) WITH CHECK (false);
