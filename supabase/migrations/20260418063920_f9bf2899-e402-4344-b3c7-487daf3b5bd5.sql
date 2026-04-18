-- Server Luck Boosters table
CREATE TABLE public.server_luck_boosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  active_tier int NOT NULL DEFAULT 1,
  active_until timestamptz,
  highest_tier_owned int NOT NULL DEFAULT 1,
  total_purchases int NOT NULL DEFAULT 0,
  total_spent int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_slb_visitor ON public.server_luck_boosters(visitor_id);

ALTER TABLE public.server_luck_boosters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read boosters by visitor_id"
ON public.server_luck_boosters FOR SELECT
USING (true);

CREATE POLICY "Service role manages boosters"
ON public.server_luck_boosters FOR ALL
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_slb_updated
BEFORE UPDATE ON public.server_luck_boosters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Booster purchase history
CREATE TABLE public.server_luck_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  tier int NOT NULL,
  duration_hours int NOT NULL,
  price int NOT NULL,
  payment_source text NOT NULL DEFAULT 'main',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_slh_visitor ON public.server_luck_history(visitor_id, created_at DESC);

ALTER TABLE public.server_luck_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read luck history"
ON public.server_luck_history FOR SELECT USING (true);

CREATE POLICY "Service role inserts luck history"
ON public.server_luck_history FOR INSERT WITH CHECK (true);