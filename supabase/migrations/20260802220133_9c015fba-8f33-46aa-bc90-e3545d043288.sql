CREATE TABLE IF NOT EXISTS public.anon_premium_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_balance_id uuid,
  plan_code text NOT NULL,
  plan_name text NOT NULL,
  method text NOT NULL,
  price bigint NOT NULL DEFAULT 0,
  gems integer NOT NULL DEFAULT 0,
  trx_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anon_premium_visitor ON public.anon_premium_subscriptions (visitor_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_anon_premium_ub ON public.anon_premium_subscriptions (user_balance_id, expires_at DESC);

GRANT SELECT ON public.anon_premium_subscriptions TO anon, authenticated;
GRANT ALL ON public.anon_premium_subscriptions TO service_role;

ALTER TABLE public.anon_premium_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon premium readable" ON public.anon_premium_subscriptions;
CREATE POLICY "anon premium readable" ON public.anon_premium_subscriptions FOR SELECT USING (true);