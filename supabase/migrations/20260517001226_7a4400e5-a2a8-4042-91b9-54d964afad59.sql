
-- ============== confess_threads ==============
CREATE TABLE IF NOT EXISTS public.confess_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_balance_id uuid NULL,
  target_phone text NOT NULL,
  sender_name text NULL,
  last_paid_at timestamptz NOT NULL DEFAULT now(),
  free_until timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text NULL,
  unread_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, target_phone)
);

CREATE INDEX IF NOT EXISTS idx_confess_threads_visitor ON public.confess_threads(visitor_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_confess_threads_phone ON public.confess_threads(target_phone, free_until DESC);

ALTER TABLE public.confess_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "confess_threads_read_own"
  ON public.confess_threads FOR SELECT
  USING (true);

CREATE POLICY "confess_threads_insert_own"
  ON public.confess_threads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "confess_threads_update_own"
  ON public.confess_threads FOR UPDATE
  USING (true);

CREATE TRIGGER trg_confess_threads_updated_at
  BEFORE UPDATE ON public.confess_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== confess_thread_messages ==============
CREATE TABLE IF NOT EXISTS public.confess_thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.confess_threads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('out','in')),
  text text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','delivered','read')),
  trx_id text NULL,
  is_free boolean NOT NULL DEFAULT false,
  error text NULL,
  sent_at timestamptz NULL,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_confess_msgs_thread ON public.confess_thread_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_confess_msgs_pending ON public.confess_thread_messages(status) WHERE status = 'pending' AND direction = 'out';

ALTER TABLE public.confess_thread_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "confess_msgs_read_own"
  ON public.confess_thread_messages FOR SELECT
  USING (true);

CREATE POLICY "confess_msgs_insert_own"
  ON public.confess_thread_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "confess_msgs_update_own"
  ON public.confess_thread_messages FOR UPDATE
  USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.confess_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.confess_thread_messages;

-- ============== Backfill thread dari confess lama (sent only) ==============
INSERT INTO public.confess_threads (visitor_id, target_phone, sender_name, last_paid_at, free_until, last_message_at, last_message_preview)
SELECT DISTINCT ON (c.sender_visitor_id, t.phone)
  c.sender_visitor_id,
  t.phone,
  c.sender_name,
  COALESCE(t.sent_at, c.created_at),
  COALESCE(t.sent_at, c.created_at) + interval '24 hours',
  COALESCE(t.sent_at, c.created_at),
  LEFT(c.message, 80)
FROM public.confession_targets t
JOIN public.confessions c ON c.id = t.confession_id
WHERE t.status = 'sent'
  AND c.sender_visitor_id IS NOT NULL
ORDER BY c.sender_visitor_id, t.phone, COALESCE(t.sent_at, c.created_at) DESC
ON CONFLICT (visitor_id, target_phone) DO NOTHING;
