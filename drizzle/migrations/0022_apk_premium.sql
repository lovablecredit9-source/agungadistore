CREATE TABLE public.apk_premium_provider (
  id text PRIMARY KEY,
  name text NOT NULL,
  base_url text NOT NULL,
  api_key_enc text,
  key_last4 text,
  enabled boolean NOT NULL DEFAULT false,
  last_check_at timestamptz,
  last_check_ok boolean,
  last_check_message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.apk_premium_provider TO service_role;
REVOKE ALL ON public.apk_premium_provider FROM anon, authenticated;
ALTER TABLE public.apk_premium_provider ENABLE ROW LEVEL SECURITY;

INSERT INTO public.apk_premium_provider (id, name, base_url, enabled)
VALUES ('jereapi', 'JereAPI', 'https://api.jerexd.my.id', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.apk_premium_feature_settings (
  feature_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.apk_premium_feature_settings TO service_role;
REVOKE ALL ON public.apk_premium_feature_settings FROM anon, authenticated;
ALTER TABLE public.apk_premium_feature_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.apk_premium_category_settings (
  category text PRIMARY KEY,
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.apk_premium_category_settings TO service_role;
REVOKE ALL ON public.apk_premium_category_settings FROM anon, authenticated;
ALTER TABLE public.apk_premium_category_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.apk_premium_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feature_id text NOT NULL,
  client_hash text NOT NULL,
  status text NOT NULL,
  http_status integer,
  latency_ms integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.apk_premium_usage TO service_role;
REVOKE ALL ON public.apk_premium_usage FROM anon, authenticated;
ALTER TABLE public.apk_premium_usage ENABLE ROW LEVEL SECURITY;
CREATE INDEX apk_premium_usage_client_time ON public.apk_premium_usage (client_hash, created_at DESC);
CREATE INDEX apk_premium_usage_time ON public.apk_premium_usage (created_at DESC);