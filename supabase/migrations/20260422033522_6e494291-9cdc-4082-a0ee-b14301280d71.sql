ALTER TABLE public.streak_membership_plans
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'coin',
ADD COLUMN IF NOT EXISTS bonus_daily_gems INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.streak_membership_plans
ADD CONSTRAINT streak_membership_plans_category_check
CHECK (category IN ('coin', 'gem'));

CREATE INDEX IF NOT EXISTS idx_streak_membership_plans_category ON public.streak_membership_plans(category);

-- Tabel klaim harian gem (mirror dari streak_membership_daily_claims)
CREATE TABLE IF NOT EXISTS public.streak_membership_daily_gem_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  membership_id UUID,
  plan_id UUID,
  plan_name TEXT,
  claim_date DATE NOT NULL,
  gems_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, claim_date)
);

ALTER TABLE public.streak_membership_daily_gem_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view their gem claims"
  ON public.streak_membership_daily_gem_claims FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert gem claims"
  ON public.streak_membership_daily_gem_claims FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_gem_claims_visitor ON public.streak_membership_daily_gem_claims(visitor_id, claim_date);