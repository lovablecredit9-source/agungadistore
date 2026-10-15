ALTER TABLE public.apk_premium_provider ADD COLUMN IF NOT EXISTS rotation_mode text NOT NULL DEFAULT 'auto';
ALTER TABLE public.apk_premium_provider DROP CONSTRAINT IF EXISTS apk_premium_provider_rotation_mode_chk;
ALTER TABLE public.apk_premium_provider ADD CONSTRAINT apk_premium_provider_rotation_mode_chk CHECK (rotation_mode IN ('auto','priority'));

CREATE TABLE IF NOT EXISTS public.apk_premium_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL DEFAULT 'jereapi',
  label text NOT NULL,
  key_enc text NOT NULL,
  key_last4 text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown','ok','exhausted','invalid','error')),
  status_message text,
  quota_limit integer,
  quota_limit_source text CHECK (quota_limit_source IN ('provider_message','provider_header','admin')),
  quota_remaining integer,
  quota_remaining_source text CHECK (quota_remaining_source IN ('provider_header','provider_429')),
  quota_checked_at timestamptz,
  exhausted_until timestamptz,
  used_day date,
  used_today integer NOT NULL DEFAULT 0,
  total_used bigint NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT ALL ON public.apk_premium_keys TO service_role;
ALTER TABLE public.apk_premium_keys ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS apk_premium_keys_pick_idx ON public.apk_premium_keys (provider_id, enabled, priority);

CREATE TABLE IF NOT EXISTS public.apk_premium_key_audit (
  id bigserial PRIMARY KEY,
  key_id uuid,
  action text NOT NULL,
  actor uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.apk_premium_key_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.apk_premium_key_audit_id_seq TO service_role;
ALTER TABLE public.apk_premium_key_audit ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.apk_premium_usage ADD COLUMN IF NOT EXISTS key_id uuid;
ALTER TABLE public.apk_premium_usage ADD COLUMN IF NOT EXISTS attempts smallint;

-- Migrate the existing single key as "API Key 1" (old column is left untouched).
INSERT INTO public.apk_premium_keys (provider_id, label, key_enc, key_last4, enabled, priority, status, status_message)
SELECT p.id, 'API Key 1', p.api_key_enc, COALESCE(p.key_last4, '????'), true, 1, 'unknown', 'Dipindahkan dari key tunggal lama'
FROM public.apk_premium_provider p
WHERE p.api_key_enc IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.apk_premium_keys k WHERE k.provider_id = p.id);

-- Pick the next usable key. 'priority' = strict admin order; 'auto' = least used today (spread load), ties by priority.
CREATE OR REPLACE FUNCTION public.apk_premium_pick_key(_provider text, _mode text, _exclude uuid[])
RETURNS TABLE(id uuid, key_enc text, label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT k.id, k.key_enc, k.label FROM public.apk_premium_keys k
  WHERE k.provider_id = _provider AND k.enabled
    AND k.status <> 'invalid'
    AND (k.exhausted_until IS NULL OR k.exhausted_until <= now())
    AND NOT (k.id = ANY(COALESCE(_exclude, '{}'::uuid[])))
  ORDER BY
    CASE WHEN _mode = 'auto' THEN (CASE WHEN k.used_day = (now() AT TIME ZONE 'Asia/Jakarta')::date THEN k.used_today ELSE 0 END) ELSE 0 END,
    k.priority, k.created_at
  LIMIT 1
$$;

-- Record the outcome of one provider call atomically (row lock via UPDATE).
CREATE OR REPLACE FUNCTION public.apk_premium_key_result(_id uuid, _outcome text, _counted boolean, _limit integer, _limit_source text, _remaining integer, _remaining_source text, _message text, _exhausted_until timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  UPDATE public.apk_premium_keys k SET
    used_today = CASE WHEN _counted THEN (CASE WHEN k.used_day = today THEN k.used_today ELSE 0 END) + 1
                      ELSE (CASE WHEN k.used_day = today THEN k.used_today ELSE 0 END) END,
    used_day = today,
    total_used = k.total_used + CASE WHEN _counted THEN 1 ELSE 0 END,
    last_used_at = now(),
    status = CASE WHEN _outcome IN ('ok','exhausted','invalid','error') THEN _outcome ELSE k.status END,
    status_message = COALESCE(left(_message, 300), k.status_message),
    quota_limit = COALESCE(_limit, k.quota_limit),
    quota_limit_source = CASE WHEN _limit IS NOT NULL THEN _limit_source ELSE k.quota_limit_source END,
    quota_remaining = CASE WHEN _remaining IS NOT NULL THEN _remaining
                           WHEN _outcome = 'ok' AND k.quota_remaining_source = 'provider_429' THEN NULL
                           ELSE k.quota_remaining END,
    quota_remaining_source = CASE WHEN _remaining IS NOT NULL THEN _remaining_source
                                  WHEN _outcome = 'ok' AND k.quota_remaining_source = 'provider_429' THEN NULL
                                  ELSE k.quota_remaining_source END,
    quota_checked_at = CASE WHEN _remaining IS NOT NULL OR _limit IS NOT NULL THEN now() ELSE k.quota_checked_at END,
    exhausted_until = CASE WHEN _outcome = 'exhausted' THEN _exhausted_until WHEN _outcome = 'ok' THEN NULL ELSE k.exhausted_until END,
    last_error_at = CASE WHEN _outcome IN ('exhausted','invalid','error') THEN now() ELSE k.last_error_at END,
    updated_at = now()
  WHERE k.id = _id;
END $$;

REVOKE ALL ON FUNCTION public.apk_premium_pick_key(text, text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apk_premium_key_result(uuid, text, boolean, integer, text, integer, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apk_premium_pick_key(text, text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.apk_premium_key_result(uuid, text, boolean, integer, text, integer, text, text, timestamptz) TO service_role;