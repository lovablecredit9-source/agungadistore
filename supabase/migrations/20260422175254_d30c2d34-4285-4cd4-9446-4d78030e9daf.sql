-- Diamond Royale: premium spin pakai Gems
CREATE TABLE public.diamond_royale_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL UNIQUE,
  pity_counter INTEGER NOT NULL DEFAULT 0,
  rare_pity_counter INTEGER NOT NULL DEFAULT 0,
  total_spins INTEGER NOT NULL DEFAULT 0,
  total_legendary INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.diamond_royale_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  spin_type TEXT NOT NULL DEFAULT 'single',
  cost_gems INTEGER NOT NULL DEFAULT 0,
  reward_kind TEXT NOT NULL,
  reward_label TEXT NOT NULL,
  reward_value INTEGER NOT NULL DEFAULT 0,
  rarity TEXT NOT NULL DEFAULT 'common',
  is_pity_break BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diamond_royale_history_visitor ON public.diamond_royale_history(visitor_id, created_at DESC);

ALTER TABLE public.diamond_royale_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diamond_royale_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diamond_royale_state_read_all" ON public.diamond_royale_state FOR SELECT USING (true);
CREATE POLICY "diamond_royale_history_read_all" ON public.diamond_royale_history FOR SELECT USING (true);

CREATE TRIGGER trg_diamond_royale_state_updated
  BEFORE UPDATE ON public.diamond_royale_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();