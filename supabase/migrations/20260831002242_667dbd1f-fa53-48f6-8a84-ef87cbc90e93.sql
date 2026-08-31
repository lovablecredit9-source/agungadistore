CREATE TABLE IF NOT EXISTS public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  provider_type text not null default 'custom',
  base_url text not null default 'https://ai.gateway.lovable.dev/v1',
  api_key text,
  model text not null default 'google/gemini-2.5-flash',
  models text[] not null default '{}',
  is_selected boolean not null default false,
  is_active boolean not null default true,
  auto_fallback boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage ai providers" ON public.ai_providers;
CREATE POLICY "Admin manage ai providers" ON public.ai_providers
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE UNIQUE INDEX IF NOT EXISTS ai_providers_one_selected ON public.ai_providers (is_selected) WHERE is_selected;

INSERT INTO public.ai_providers (label, provider_type, base_url, model, is_selected, note)
SELECT 'Lovable AI (bawaan)', 'lovable', 'https://ai.gateway.lovable.dev/v1', 'google/gemini-2.5-flash', true, 'Provider default, tidak perlu API key'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_providers);