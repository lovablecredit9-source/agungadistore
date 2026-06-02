ALTER TABLE public.discount_spin_state
ADD COLUMN IF NOT EXISTS claimed_milestones integer[] NOT NULL DEFAULT '{}';