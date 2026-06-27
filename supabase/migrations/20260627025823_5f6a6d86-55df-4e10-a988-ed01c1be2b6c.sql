ALTER TABLE public.confess_thread_messages
  ADD COLUMN IF NOT EXISTS reaction text,
  ADD COLUMN IF NOT EXISTS reaction_by text,
  ADD COLUMN IF NOT EXISTS reaction_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS reaction_wa_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS wa_reaction text,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS wa_edit_sent_at timestamptz;