CREATE TABLE public.store_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_balance_id uuid NOT NULL UNIQUE,
  visitor_id text NOT NULL,
  code text NOT NULL UNIQUE,
  uses_count integer NOT NULL DEFAULT 0,
  total_reward bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.store_referral_codes TO service_role;
ALTER TABLE public.store_referral_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.store_referral_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  referrer_balance_id uuid NOT NULL,
  referred_balance_id uuid NOT NULL UNIQUE,
  referred_visitor_id text NOT NULL,
  reward_amount bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.store_referral_uses TO service_role;
ALTER TABLE public.store_referral_uses ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_store_referral_uses_referrer ON public.store_referral_uses (referrer_balance_id);