
-- ============ LUCKY WHEEL SHOP ============
CREATE TABLE IF NOT EXISTS public.streak_wheel_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎁',
  reward_type TEXT NOT NULL,
  reward_value INTEGER NOT NULL DEFAULT 0,
  weight INTEGER NOT NULL DEFAULT 10,
  color_class TEXT NOT NULL DEFAULT 'from-pink-500 to-cyan-500',
  is_jackpot BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.streak_wheel_spins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  segment_id UUID REFERENCES public.streak_wheel_segments(id) ON DELETE SET NULL,
  reward_label TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value INTEGER NOT NULL DEFAULT 0,
  cost_paid INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'free',
  is_jackpot BOOLEAN NOT NULL DEFAULT false,
  is_pity BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_visitor ON public.streak_wheel_spins(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_jackpot ON public.streak_wheel_spins(is_jackpot, created_at DESC) WHERE is_jackpot = true;

CREATE TABLE IF NOT EXISTS public.streak_wheel_pity (
  visitor_id TEXT NOT NULL PRIMARY KEY,
  spins_since_jackpot INTEGER NOT NULL DEFAULT 0,
  total_jackpots INTEGER NOT NULL DEFAULT 0,
  total_spins INTEGER NOT NULL DEFAULT 0,
  free_spin_used_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_wheel_segments_updated BEFORE UPDATE ON public.streak_wheel_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.streak_wheel_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_wheel_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_wheel_pity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wheel segments are public" ON public.streak_wheel_segments FOR SELECT USING (is_active = true);
CREATE POLICY "Wheel segments admin manage" ON public.streak_wheel_segments FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Allow public read of recent jackpot spins for live ticker (no PII beyond display_name)
CREATE POLICY "Wheel jackpot spins readable" ON public.streak_wheel_spins FOR SELECT USING (is_jackpot = true);
