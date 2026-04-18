
-- Schedule jam Power Hour harian (1 jam acak per tanggal)
CREATE TABLE IF NOT EXISTS public.streak_power_hour_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_date date NOT NULL UNIQUE,
  hour_start integer NOT NULL CHECK (hour_start >= 0 AND hour_start <= 23),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_power_hour_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read power hour schedule"
  ON public.streak_power_hour_schedule FOR SELECT
  USING (true);

-- Klaim Power Hour per visitor per hari
CREATE TABLE IF NOT EXISTS public.streak_power_hour_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  claim_date date NOT NULL,
  hour_target integer NOT NULL,
  hour_claimed integer NOT NULL,
  success boolean NOT NULL DEFAULT false,
  bonus_coins integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, claim_date)
);

CREATE INDEX IF NOT EXISTS idx_power_hour_claims_visitor ON public.streak_power_hour_claims(visitor_id, claim_date DESC);

ALTER TABLE public.streak_power_hour_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read own power hour claims"
  ON public.streak_power_hour_claims FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage power hour claims"
  ON public.streak_power_hour_claims FOR ALL
  USING (true)
  WITH CHECK (true);
