CREATE TABLE IF NOT EXISTS public.premium_spin_daily_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  day_wib date NOT NULL,
  spin_count integer NOT NULL DEFAULT 0,
  claimed_milestones integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, day_wib)
);

ALTER TABLE public.premium_spin_daily_milestones ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_psdm_visitor_day ON public.premium_spin_daily_milestones(visitor_id, day_wib);

CREATE TRIGGER trg_psdm_updated_at
  BEFORE UPDATE ON public.premium_spin_daily_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();