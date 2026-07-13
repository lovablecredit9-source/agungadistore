-- Telegram bot config (single row, admin-managed). Token kept private (no anon access).
CREATE TABLE public.telegram_bot_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_token text NOT NULL DEFAULT '',
  owner_id text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  welcome_message text NOT NULL DEFAULT '',
  webhook_secret text NOT NULL DEFAULT '',
  bot_username text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_bot_config TO authenticated;
GRANT ALL ON public.telegram_bot_config TO service_role;

ALTER TABLE public.telegram_bot_config ENABLE ROW LEVEL SECURITY;

-- Only authenticated admin can read/manage. Edge functions use service_role (bypasses RLS).
CREATE POLICY "Admin can view telegram config" ON public.telegram_bot_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert telegram config" ON public.telegram_bot_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update telegram config" ON public.telegram_bot_config FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete telegram config" ON public.telegram_bot_config FOR DELETE TO authenticated USING (true);

-- Live CS chats (one row per Telegram chat)
CREATE TABLE public.telegram_chats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id text NOT NULL UNIQUE,
  first_name text NOT NULL DEFAULT '',
  username text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  last_message text NOT NULL DEFAULT '',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_chats TO authenticated;
GRANT ALL ON public.telegram_chats TO service_role;

ALTER TABLE public.telegram_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view telegram chats" ON public.telegram_chats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can update telegram chats" ON public.telegram_chats FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete telegram chats" ON public.telegram_chats FOR DELETE TO authenticated USING (true);

-- Live CS messages
CREATE TABLE public.telegram_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id text NOT NULL,
  direction text NOT NULL DEFAULT 'in',
  text text NOT NULL DEFAULT '',
  telegram_message_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages (chat_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_messages TO authenticated;
GRANT ALL ON public.telegram_messages TO service_role;

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view telegram messages" ON public.telegram_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can delete telegram messages" ON public.telegram_messages FOR DELETE TO authenticated USING (true);

-- Realtime for live CS
ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_messages;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_telegram_bot_config_updated_at BEFORE UPDATE ON public.telegram_bot_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_telegram_chats_updated_at BEFORE UPDATE ON public.telegram_chats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();