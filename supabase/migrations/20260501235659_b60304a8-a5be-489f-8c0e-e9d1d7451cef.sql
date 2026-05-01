ALTER TABLE public.faded_wheel_state
  ADD COLUMN IF NOT EXISTS pending_claims jsonb NOT NULL DEFAULT '[]'::jsonb;