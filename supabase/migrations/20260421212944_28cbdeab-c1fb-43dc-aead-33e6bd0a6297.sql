-- Scratch off cards inventory
CREATE TABLE IF NOT EXISTS public.scratch_off_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'bronze',
  source TEXT DEFAULT 'shop',
  is_scratched BOOLEAN NOT NULL DEFAULT false,
  reward_amount INTEGER,
  scratched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_soc_visitor ON public.scratch_off_cards(visitor_id, is_scratched);
ALTER TABLE public.scratch_off_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view scratch cards" ON public.scratch_off_cards FOR SELECT USING (true);
CREATE POLICY "Admin manage scratch cards" ON public.scratch_off_cards FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Mystery boxes inventory
CREATE TABLE IF NOT EXISTS public.mystery_boxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'silver',
  source TEXT DEFAULT 'shop',
  min_reward INTEGER NOT NULL DEFAULT 100,
  max_reward INTEGER NOT NULL DEFAULT 1000,
  is_opened BOOLEAN NOT NULL DEFAULT false,
  reward_amount INTEGER,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mb_visitor ON public.mystery_boxes(visitor_id, is_opened);
ALTER TABLE public.mystery_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view mystery boxes" ON public.mystery_boxes FOR SELECT USING (true);
CREATE POLICY "Admin manage mystery boxes" ON public.mystery_boxes FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- User cosmetics inventory
CREATE TABLE IF NOT EXISTS public.user_cosmetics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  cosmetic_type TEXT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  cosmetic_name TEXT NOT NULL,
  is_equipped BOOLEAN NOT NULL DEFAULT false,
  source TEXT DEFAULT 'shop',
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, cosmetic_type, cosmetic_id)
);
CREATE INDEX IF NOT EXISTS idx_uc_visitor ON public.user_cosmetics(visitor_id);
ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view cosmetics" ON public.user_cosmetics FOR SELECT USING (true);
CREATE POLICY "Admin manage cosmetics" ON public.user_cosmetics FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());