
-- 1. Add reply + soft delete columns to product_chat_messages
ALTER TABLE public.product_chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.product_chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Add reply + soft delete columns to ticket_messages
ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.ticket_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 3. Reactions for product chat messages
CREATE TABLE IF NOT EXISTS public.product_chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.product_chat_messages(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  sender_type text NOT NULL DEFAULT 'user',
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, visitor_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_pcr_message ON public.product_chat_reactions(message_id);
ALTER TABLE public.product_chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product chat reactions"
  ON public.product_chat_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can add product chat reactions"
  ON public.product_chat_reactions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can remove product chat reactions"
  ON public.product_chat_reactions FOR DELETE TO public USING (true);

-- 4. Reactions for ticket messages
CREATE TABLE IF NOT EXISTS public.ticket_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.ticket_messages(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  sender_type text NOT NULL DEFAULT 'user',
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, visitor_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_tmr_message ON public.ticket_message_reactions(message_id);
ALTER TABLE public.ticket_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ticket reactions"
  ON public.ticket_message_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can add ticket reactions"
  ON public.ticket_message_reactions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can remove ticket reactions"
  ON public.ticket_message_reactions FOR DELETE TO public USING (true);

-- 5. Typing indicators for product chats
CREATE TABLE IF NOT EXISTS public.product_chat_typing (
  chat_id uuid NOT NULL REFERENCES public.product_chats(id) ON DELETE CASCADE,
  sender_type text NOT NULL,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, sender_type)
);
ALTER TABLE public.product_chat_typing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product typing"
  ON public.product_chat_typing FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert product typing"
  ON public.product_chat_typing FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update product typing"
  ON public.product_chat_typing FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete product typing"
  ON public.product_chat_typing FOR DELETE TO public USING (true);

-- 6. Typing indicators for tickets
CREATE TABLE IF NOT EXISTS public.ticket_typing (
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, sender_type)
);
ALTER TABLE public.ticket_typing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ticket typing"
  ON public.ticket_typing FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert ticket typing"
  ON public.ticket_typing FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update ticket typing"
  ON public.ticket_typing FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete ticket typing"
  ON public.ticket_typing FOR DELETE TO public USING (true);

-- 7. Enable realtime
ALTER TABLE public.product_chat_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.product_chat_typing REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_typing REPLICA IDENTITY FULL;
ALTER TABLE public.product_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.product_chat_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.product_chat_typing;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_typing;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
