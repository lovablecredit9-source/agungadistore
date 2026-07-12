CREATE TABLE public.ruangku_mission_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  week_start date NOT NULL,
  mission_key text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, week_start, mission_key)
);
GRANT SELECT ON public.ruangku_mission_claims TO authenticated, anon;
GRANT ALL ON public.ruangku_mission_claims TO service_role;
ALTER TABLE public.ruangku_mission_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruangku_mission_public_read" ON public.ruangku_mission_claims FOR SELECT USING (true);

CREATE TABLE public.ruangku_luckybox_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  claim_date date NOT NULL,
  source text NOT NULL DEFAULT 'daily',
  reward_type text NOT NULL DEFAULT 'saldo_in',
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ruangku_luckybox_daily_uniq ON public.ruangku_luckybox_claims (visitor_id, claim_date) WHERE source = 'daily';
GRANT SELECT ON public.ruangku_luckybox_claims TO authenticated, anon;
GRANT ALL ON public.ruangku_luckybox_claims TO service_role;
ALTER TABLE public.ruangku_luckybox_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruangku_luckybox_public_read" ON public.ruangku_luckybox_claims FOR SELECT USING (true);