
-- Add tier column to wheel segments (cheap/normal/premium)
ALTER TABLE public.streak_wheel_segments 
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_wheel_segments_tier ON public.streak_wheel_segments(tier, is_active);

-- Tier configuration table (cost & rules per tier)
CREATE TABLE IF NOT EXISTS public.streak_wheel_tier_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key text NOT NULL UNIQUE,
  tier_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🎡',
  cost_coins integer NOT NULL DEFAULT 0,
  cost_gems integer NOT NULL DEFAULT 0,
  cost_balance integer NOT NULL DEFAULT 0,
  free_daily boolean NOT NULL DEFAULT false,
  pity_threshold integer NOT NULL DEFAULT 50,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  color_class text NOT NULL DEFAULT 'from-pink-500 to-cyan-500',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_wheel_tier_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Wheel tier public read" ON public.streak_wheel_tier_config;
CREATE POLICY "Wheel tier public read" ON public.streak_wheel_tier_config
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Wheel tier admin manage" ON public.streak_wheel_tier_config;
CREATE POLICY "Wheel tier admin manage" ON public.streak_wheel_tier_config
  USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE TRIGGER trg_wheel_tier_updated BEFORE UPDATE ON public.streak_wheel_tier_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 3 tiers
INSERT INTO public.streak_wheel_tier_config (tier_key, tier_name, description, icon, cost_coins, cost_gems, cost_balance, free_daily, pity_threshold, sort_order, color_class)
VALUES
  ('cheap',   'Murah',   'Spin murah, hadiah kecil tapi sering', '🎯', 50,   3,  500,  true,  30, 1, 'from-emerald-500 to-teal-600'),
  ('normal',  'Normal',  'Hadiah seimbang & bervariasi',         '🎡', 150,  10, 2000, false, 50, 2, 'from-cyan-500 to-blue-600'),
  ('premium', 'Premium', 'Bid besar, jackpot mega gede!',        '👑', 500,  40, 8000, false, 25, 3, 'from-yellow-500 via-orange-500 to-pink-600')
ON CONFLICT (tier_key) DO NOTHING;
