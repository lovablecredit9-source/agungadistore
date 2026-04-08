
-- API Keys table for external bot access
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text NOT NULL DEFAULT '',
  api_key text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  permissions text NOT NULL DEFAULT 'all',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage api keys" ON public.api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "API keys viewable by authenticated" ON public.api_keys FOR SELECT TO authenticated USING (true);

-- Sponsor history/log table
CREATE TABLE public.sponsor_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'created',
  details text,
  old_expires_at timestamp with time zone,
  new_expires_at timestamp with time zone,
  amount bigint DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sponsor history" ON public.sponsor_history FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert sponsor history" ON public.sponsor_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can delete sponsor history" ON public.sponsor_history FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anyone can insert sponsor history public" ON public.sponsor_history FOR INSERT TO public WITH CHECK (true);
