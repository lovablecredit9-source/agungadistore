-- ============= DIAMOND ELITE =============
CREATE TABLE public.streak_diamond_elite_subs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'elite', -- elite, platinum, diamond
  price_idr INTEGER NOT NULL,
  cashback_percent INTEGER NOT NULL DEFAULT 5,
  duration_days INTEGER NOT NULL DEFAULT 30,
  expires_at TIMESTAMPTZ NOT NULL,
  total_cashback_earned INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_diamond_elite_subs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diamond_select_all" ON public.streak_diamond_elite_subs FOR SELECT USING (true);

-- ============= BOOST SQUAD =============
CREATE TABLE public.streak_boost_squad_subs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  tier TEXT NOT NULL, -- bronze, silver, gold
  multiplier NUMERIC(3,1) NOT NULL DEFAULT 1.5,
  price_idr INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_boost_squad_subs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boost_select_all" ON public.streak_boost_squad_subs FOR SELECT USING (true);

-- ============= LUCKY BOX MEMBERSHIP =============
CREATE TABLE public.streak_lucky_box_subs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  tier TEXT NOT NULL, -- starter, deluxe, royal
  price_idr INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  total_days_claimed INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_lucky_box_subs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "luckybox_select_all" ON public.streak_lucky_box_subs FOR SELECT USING (true);

CREATE TABLE public.streak_lucky_box_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  sub_id UUID NOT NULL REFERENCES public.streak_lucky_box_subs(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL,
  rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sub_id, claim_date)
);
ALTER TABLE public.streak_lucky_box_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "luckybox_claims_select_all" ON public.streak_lucky_box_claims FOR SELECT USING (true);

-- ============= AUTO-STREAK SAVER =============
CREATE TABLE public.streak_auto_saver_subs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  tier TEXT NOT NULL, -- basic, pro, ultra
  price_idr INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  auto_freeze_per_week INTEGER NOT NULL DEFAULT 7,
  restore_per_week INTEGER NOT NULL DEFAULT 1,
  freezes_used_this_week INTEGER NOT NULL DEFAULT 0,
  restores_used_this_week INTEGER NOT NULL DEFAULT 0,
  week_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_auto_saver_subs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saver_select_all" ON public.streak_auto_saver_subs FOR SELECT USING (true);

CREATE INDEX idx_diamond_visitor ON public.streak_diamond_elite_subs(visitor_id, is_active);
CREATE INDEX idx_boost_visitor ON public.streak_boost_squad_subs(visitor_id, is_active);
CREATE INDEX idx_luckybox_visitor ON public.streak_lucky_box_subs(visitor_id, is_active);
CREATE INDEX idx_saver_visitor ON public.streak_auto_saver_subs(visitor_id, is_active);