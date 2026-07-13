ALTER TABLE public.telegram_chats
  ADD COLUMN IF NOT EXISTS tg_state text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tg_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tg_visitor_id text;