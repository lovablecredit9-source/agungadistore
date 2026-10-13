CREATE TABLE public.bot_ai_adapter_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bot_instances(id) ON DELETE CASCADE,
  user_balance_id uuid,
  source_version int NOT NULL,
  result_version int,
  provider text NOT NULL DEFAULT 'lapak_vip_ai_router',
  model text,
  status text NOT NULL DEFAULT 'RUNNING',
  error text,
  input_tokens int, output_tokens int, total_tokens int,
  cost numeric,
  latency_ms int,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX bot_ai_adapter_jobs_bot_idx ON public.bot_ai_adapter_jobs(bot_id, started_at DESC);
GRANT ALL ON public.bot_ai_adapter_jobs TO service_role;
ALTER TABLE public.bot_ai_adapter_jobs ENABLE ROW LEVEL SECURITY;