
ALTER TABLE public.confess_threads
  ADD COLUMN IF NOT EXISTS wa_display_name text,
  ADD COLUMN IF NOT EXISTS wa_last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS wa_presence text;

ALTER TABLE public.confess_thread_messages
  ADD COLUMN IF NOT EXISTS wa_message_id text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text;

CREATE INDEX IF NOT EXISTS idx_confess_thread_messages_wa_message_id
  ON public.confess_thread_messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL;
