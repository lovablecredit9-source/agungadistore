
CREATE TABLE public.streak_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  plan_name text NOT NULL,
  plan_days integer NOT NULL,
  price_paid bigint NOT NULL DEFAULT 0,
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Streak subscriptions viewable by everyone"
ON public.streak_subscriptions FOR SELECT
USING (true);

CREATE POLICY "Anyone can create streak subscription"
ON public.streak_subscriptions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update streak subscription"
ON public.streak_subscriptions FOR UPDATE
USING (true);

CREATE INDEX idx_streak_subscriptions_visitor ON public.streak_subscriptions(visitor_id);
CREATE INDEX idx_streak_subscriptions_active ON public.streak_subscriptions(is_active, expires_at);
