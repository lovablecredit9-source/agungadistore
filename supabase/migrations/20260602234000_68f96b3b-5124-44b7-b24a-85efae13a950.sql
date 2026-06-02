CREATE TABLE public.discount_limit_upgrades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  user_balance_id uuid,
  tier text NOT NULL CHECK (tier IN ('month','permanent')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discount_limit_upgrades_visitor ON public.discount_limit_upgrades(visitor_id);
CREATE INDEX idx_discount_limit_upgrades_ub ON public.discount_limit_upgrades(user_balance_id);

GRANT SELECT ON public.discount_limit_upgrades TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_limit_upgrades TO authenticated;
GRANT ALL ON public.discount_limit_upgrades TO service_role;

ALTER TABLE public.discount_limit_upgrades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view limit upgrades"
ON public.discount_limit_upgrades FOR SELECT USING (true);

CREATE POLICY "Service role manages limit upgrades"
ON public.discount_limit_upgrades FOR ALL TO service_role USING (true) WITH CHECK (true);