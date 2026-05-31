ALTER TABLE public.discount_spin_state
  ADD COLUMN IF NOT EXISTS total_saved integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claims jsonb NOT NULL DEFAULT '[]'::jsonb;