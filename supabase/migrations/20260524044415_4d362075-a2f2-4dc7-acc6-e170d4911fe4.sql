ALTER TABLE public.confess_threads
  ADD COLUMN IF NOT EXISTS target_avatar_url text,
  ADD COLUMN IF NOT EXISTS target_avatar_updated_at timestamptz;