ALTER TABLE public.confess_threads
  ADD COLUMN IF NOT EXISTS chat_stopped boolean NOT NULL DEFAULT false;