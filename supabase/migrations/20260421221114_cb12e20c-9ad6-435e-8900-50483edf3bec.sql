-- Tabel klaim harian membership
CREATE TABLE IF NOT EXISTS public.streak_membership_daily_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  membership_id UUID,
  plan_id UUID,
  plan_name TEXT,
  claim_date DATE NOT NULL,
  coins_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, claim_date)
);

CREATE INDEX IF NOT EXISTS idx_smdc_visitor_date 
  ON public.streak_membership_daily_claims (visitor_id, claim_date DESC);

ALTER TABLE public.streak_membership_daily_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner select daily claims" ON public.streak_membership_daily_claims;
CREATE POLICY "owner select daily claims"
ON public.streak_membership_daily_claims FOR SELECT
USING (true);

-- Tambah kolom daily_reward_coins di plan kalau belum ada
ALTER TABLE public.streak_membership_plans
  ADD COLUMN IF NOT EXISTS daily_reward_coins INTEGER NOT NULL DEFAULT 0;
