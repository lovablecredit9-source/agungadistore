CREATE TABLE public.discount_wheel_limit_upgrade (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  user_balance_id uuid,
  is_permanent boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dwlu_visitor ON public.discount_wheel_limit_upgrade(visitor_id);
CREATE INDEX idx_dwlu_balance ON public.discount_wheel_limit_upgrade(user_balance_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_wheel_limit_upgrade TO authenticated;
GRANT SELECT ON public.discount_wheel_limit_upgrade TO anon;
GRANT ALL ON public.discount_wheel_limit_upgrade TO service_role;

ALTER TABLE public.discount_wheel_limit_upgrade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view limit upgrades"
ON public.discount_wheel_limit_upgrade
FOR SELECT
USING (true);

CREATE POLICY "Service role manages limit upgrades"
ON public.discount_wheel_limit_upgrade
FOR ALL
USING (true)
WITH CHECK (true);