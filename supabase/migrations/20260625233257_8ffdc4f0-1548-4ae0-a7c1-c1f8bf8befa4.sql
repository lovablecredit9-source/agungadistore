CREATE TABLE public.confess_number_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  max_numbers integer NOT NULL DEFAULT 15,
  price integer NOT NULL DEFAULT 0,
  trx_id text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.confess_number_subscriptions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.confess_number_subscriptions TO authenticated;
GRANT ALL ON public.confess_number_subscriptions TO service_role;

ALTER TABLE public.confess_number_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read number subscriptions"
ON public.confess_number_subscriptions FOR SELECT
USING (true);

CREATE INDEX idx_confess_num_sub_visitor ON public.confess_number_subscriptions (visitor_id, expires_at DESC);