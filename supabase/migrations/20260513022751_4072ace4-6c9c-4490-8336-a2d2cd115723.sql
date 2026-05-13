
ALTER TABLE public.anon_chat_messages
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_to_id uuid,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.anon_chat_messages ALTER COLUMN content DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.anon_chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.anon_chat_messages(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, visitor_id, emoji)
);
ALTER TABLE public.anon_chat_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon reactions all" ON public.anon_chat_reactions;
CREATE POLICY "anon reactions all" ON public.anon_chat_reactions FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.anon_chat_typing (
  session_id uuid NOT NULL,
  sender_visitor_id text NOT NULL,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, sender_visitor_id)
);
ALTER TABLE public.anon_chat_typing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon typing all" ON public.anon_chat_typing;
CREATE POLICY "anon typing all" ON public.anon_chat_typing FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.anon_chat_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.anon_chat_typing;
