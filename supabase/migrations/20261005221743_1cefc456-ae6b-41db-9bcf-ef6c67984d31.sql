CREATE TABLE IF NOT EXISTS public.wa_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notify_visitor_id text NOT NULL,
  event_type text NOT NULL,
  channel text NOT NULL DEFAULT 'wa',
  wa_number text,
  status text NOT NULL DEFAULT 'sent',
  text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wa_notification_queue TO service_role;
ALTER TABLE public.wa_notification_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS wa_notification_queue_visitor_idx ON public.wa_notification_queue (notify_visitor_id, created_at DESC);