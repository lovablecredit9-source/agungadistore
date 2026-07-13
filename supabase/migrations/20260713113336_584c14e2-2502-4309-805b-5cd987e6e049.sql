ALTER TABLE public.telegram_chats
  ADD COLUMN IF NOT EXISTS last_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_url text NOT NULL DEFAULT '';
