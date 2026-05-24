
CREATE TABLE IF NOT EXISTS public.confess_free_trial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_balance_id uuid,
  ip_address text,
  device_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS confess_free_trial_visitor_uidx ON public.confess_free_trial(visitor_id);
CREATE UNIQUE INDEX IF NOT EXISTS confess_free_trial_ub_uidx ON public.confess_free_trial(user_balance_id) WHERE user_balance_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS confess_free_trial_fp_uidx ON public.confess_free_trial(device_fingerprint) WHERE device_fingerprint IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS confess_free_trial_ip_uidx ON public.confess_free_trial(ip_address) WHERE ip_address IS NOT NULL;

ALTER TABLE public.confess_free_trial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_confess_free_trial"
ON public.confess_free_trial FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
