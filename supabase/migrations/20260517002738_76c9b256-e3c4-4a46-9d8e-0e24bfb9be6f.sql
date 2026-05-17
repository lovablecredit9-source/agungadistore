ALTER TABLE public.confess_thread_messages
ADD COLUMN IF NOT EXISTS target_id uuid REFERENCES public.confession_targets(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_confess_threads_balance_phone
ON public.confess_threads(user_balance_id, target_phone)
WHERE user_balance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_confess_thread_messages_target
ON public.confess_thread_messages(target_id)
WHERE target_id IS NOT NULL;