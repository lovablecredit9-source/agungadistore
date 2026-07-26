CREATE TABLE IF NOT EXISTS public.fire_pass_gem_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL,
  visitor_id text NOT NULL,
  user_balance_id uuid,
  mission_id uuid,
  mission_title text,
  mission_level int NOT NULL DEFAULT 1,
  gems_spent int NOT NULL DEFAULT 0,
  badges_awarded int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.fire_pass_gem_spend TO service_role;

ALTER TABLE public.fire_pass_gem_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages gem spend"
ON public.fire_pass_gem_spend FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_fp_gem_spend_season ON public.fire_pass_gem_spend(season_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fp_gem_spend_visitor ON public.fire_pass_gem_spend(visitor_id);