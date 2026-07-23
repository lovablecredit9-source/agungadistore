
CREATE TABLE IF NOT EXISTS public.telegram_test_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tg_test_log_vid_time ON public.telegram_test_log(visitor_id, created_at DESC);
GRANT SELECT ON public.telegram_test_log TO authenticated;
GRANT ALL ON public.telegram_test_log TO service_role;
ALTER TABLE public.telegram_test_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own test log" ON public.telegram_test_log FOR SELECT TO authenticated USING (true);
