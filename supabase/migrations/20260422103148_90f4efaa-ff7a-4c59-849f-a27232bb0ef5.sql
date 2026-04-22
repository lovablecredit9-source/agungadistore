-- Tabel state Faded Wheel per visitor
CREATE TABLE IF NOT EXISTS public.faded_wheel_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  grid_prizes jsonb NOT NULL DEFAULT '[]'::jsonb, -- array hadiah yang masih tersedia
  claimed_indexes integer[] NOT NULL DEFAULT '{}', -- index hadiah yang sudah diambil di grid saat ini
  spins_in_round integer NOT NULL DEFAULT 0, -- jumlah spin di ronde grid saat ini
  total_spins_lifetime integer NOT NULL DEFAULT 0, -- total spin kumulatif untuk bonus tambahan
  current_round integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faded_wheel_visitor ON public.faded_wheel_state(visitor_id);

ALTER TABLE public.faded_wheel_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read faded wheel"
  ON public.faded_wheel_state FOR SELECT
  USING (true);

CREATE POLICY "Service role manages faded wheel"
  ON public.faded_wheel_state FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_faded_wheel_updated_at
  BEFORE UPDATE ON public.faded_wheel_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();