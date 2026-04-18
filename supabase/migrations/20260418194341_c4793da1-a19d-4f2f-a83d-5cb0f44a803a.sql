-- Update existing 4 deals: keep them as Premium with proper names
UPDATE public.streak_flash_deals 
SET name = 'Premium Power Pack' 
WHERE name = 'VIP Power Pack';

-- Add 2 new affordable non-premium deals
INSERT INTO public.streak_flash_deals (name, description, icon, original_cost, discount_pct, reward_type, reward_value, badge, gradient, requires_premium, daily_limit, is_active, sort_order)
VALUES
  ('Streak Freeze x1', 'Lindungi streak harian sekali', '🧊', 250, 30, 'streak_freeze', 1, 'HEMAT', 'from-cyan-600 to-blue-700', false, 1, true, 0),
  ('Double XP 6 Jam', 'Boost XP 2x selama 6 jam', '⚡', 500, 35, 'double_xp', 6, 'POPULER', 'from-purple-600 to-pink-700', false, 1, true, 0)
ON CONFLICT DO NOTHING;