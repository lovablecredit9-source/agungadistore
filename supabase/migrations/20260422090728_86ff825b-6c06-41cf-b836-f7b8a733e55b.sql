-- Tabel history spin Luck Royale Nyawa
CREATE TABLE IF NOT EXISTS public.luck_royale_nyawa_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  spin_type text NOT NULL, -- 'single' atau 'bundle5'
  reward_kind text NOT NULL, -- 'extra_life', 'auto_hint', 'time_freeze', 'streak_freeze', 'gems', 'coins'
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL,
  rarity text NOT NULL DEFAULT 'common',
  cost_currency text NOT NULL, -- 'gems' atau 'diamond'
  cost_amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lrn_visitor_created ON public.luck_royale_nyawa_history(visitor_id, created_at DESC);

ALTER TABLE public.luck_royale_nyawa_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read luck royale nyawa"
  ON public.luck_royale_nyawa_history FOR SELECT
  USING (true);

CREATE POLICY "Service role manages luck royale nyawa"
  ON public.luck_royale_nyawa_history FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');