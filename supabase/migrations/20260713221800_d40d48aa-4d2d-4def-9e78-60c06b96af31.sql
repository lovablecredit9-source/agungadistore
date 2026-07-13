ALTER TABLE public.telegram_bot_config
  ADD COLUMN IF NOT EXISTS qris_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS qris_caption text NOT NULL DEFAULT '';