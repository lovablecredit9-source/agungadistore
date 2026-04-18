
-- 1) Update harga & isi gem packages sesuai permintaan user
UPDATE public.gem_packages SET gems = 100, bonus_gems = 0, price = 20000, name = 'Starter Gem', sort_order = 1 WHERE id = '764da01e-6566-42ca-8da3-1baaede12f7f';
UPDATE public.gem_packages SET gems = 500, bonus_gems = 0, price = 80000, name = 'Popular Gem', sort_order = 2 WHERE id = '7325dfc5-f69d-4fe0-b301-d51415be5c83';
UPDATE public.gem_packages SET gems = 1200, bonus_gems = 0, price = 150000, name = 'Premium Gem', sort_order = 3 WHERE id = '4ad74a97-00b6-4ddd-9486-354721b20f52';
UPDATE public.gem_packages SET gems = 3800, bonus_gems = 0, price = 400000, name = 'Mega Gem', sort_order = 4 WHERE id = '5d0d6325-a41f-4681-bc46-c3b69fa248d1';

-- 2) Tabel flash deals (admin-managed) + redemption log untuk limit 1x/hari per user
CREATE TABLE IF NOT EXISTS public.streak_flash_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '⚡',
  original_cost integer NOT NULL DEFAULT 1000,
  discount_pct integer NOT NULL DEFAULT 50,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 1,
  badge text DEFAULT '🔥 HOT',
  gradient text NOT NULL DEFAULT 'from-orange-500/30 to-red-500/30',
  requires_premium boolean NOT NULL DEFAULT true,
  daily_limit integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flash_deal_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.streak_flash_deals(id) ON DELETE CASCADE,
  redemption_date date NOT NULL DEFAULT (timezone('Asia/Jakarta', now()))::date,
  cost_paid integer NOT NULL,
  reward_type text NOT NULL,
  reward_value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flash_deal_redemptions_lookup ON public.flash_deal_redemptions(visitor_id, deal_id, redemption_date);

ALTER TABLE public.streak_flash_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_deal_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read flash deals" ON public.streak_flash_deals;
CREATE POLICY "Public read flash deals" ON public.streak_flash_deals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read own redemptions" ON public.flash_deal_redemptions;
CREATE POLICY "Public read own redemptions" ON public.flash_deal_redemptions FOR SELECT USING (true);

-- Seed default flash deals (premium only, 1x/hari)
INSERT INTO public.streak_flash_deals (name, description, icon, original_cost, discount_pct, reward_type, reward_value, badge, gradient, requires_premium, daily_limit, sort_order) VALUES
  ('Streak Freeze x3', 'Lindungi streak 3 hari (1x/hari)', '❄️', 600, 50, 'streak_freeze', 3, '🔥 HOT', 'from-cyan-500/30 to-blue-500/30', true, 1, 1),
  ('Double XP 24 Jam', 'Gandakan XP streak (1x/hari)', '⚡', 1200, 60, 'double_xp', 24, '⚡ BEST', 'from-yellow-500/30 to-orange-500/30', true, 1, 2),
  ('Mystery Bundle', '5 hint + 3 nyawa ekstra (1x/hari)', '🎁', 1500, 70, 'mystery_bundle', 1, '👑 PREMIUM', 'from-pink-500/30 to-purple-500/30', true, 1, 3),
  ('VIP Power Pack', 'Boost lengkap (1x/hari)', '💎', 3000, 40, 'vip_pack', 1, '💎 VIP', 'from-yellow-500/30 to-amber-600/30', true, 1, 4)
ON CONFLICT DO NOTHING;
