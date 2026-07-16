
CREATE TABLE IF NOT EXISTS public.fire_pass_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES public.fire_pass_seasons(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  mission_type TEXT NOT NULL DEFAULT 'daily',
  requirement_type TEXT NOT NULL,
  target_value INT NOT NULL DEFAULT 1,
  badge_reward INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fire_pass_missions TO anon, authenticated;
GRANT ALL ON public.fire_pass_missions TO service_role;
ALTER TABLE public.fire_pass_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpm_read_all" ON public.fire_pass_missions FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.fire_pass_mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  mission_id UUID NOT NULL REFERENCES public.fire_pass_missions(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  current_value INT NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  is_claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, mission_id, period_key)
);
GRANT SELECT, INSERT, UPDATE ON public.fire_pass_mission_progress TO authenticated;
GRANT ALL ON public.fire_pass_mission_progress TO service_role;
ALTER TABLE public.fire_pass_mission_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpmp_read_own" ON public.fire_pass_mission_progress FOR SELECT USING (true);
