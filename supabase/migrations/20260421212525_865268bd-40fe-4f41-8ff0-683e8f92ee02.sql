-- Tabel utama flash sale
CREATE TABLE IF NOT EXISTS public.streak_flash_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('coins','freeze','booster','scratch_card','mystery_box','cosmetic')),
  reward_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_coins INTEGER DEFAULT 0,
  price_gems INTEGER DEFAULT 0,
  price_balance INTEGER DEFAULT 0,
  original_price INTEGER DEFAULT 0,
  discount_pct INTEGER DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  total_stock INTEGER,
  remaining_stock INTEGER,
  per_user_daily_limit INTEGER DEFAULT 1,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary','mythic')),
  icon TEXT DEFAULT '⚡',
  gradient TEXT DEFAULT 'from-orange-500 to-red-500',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sfs_active ON public.streak_flash_sales(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_sfs_sort ON public.streak_flash_sales(sort_order);

ALTER TABLE public.streak_flash_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active flash sales"
  ON public.streak_flash_sales FOR SELECT
  USING (true);

CREATE POLICY "Admin manage flash sales"
  ON public.streak_flash_sales FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE TRIGGER update_sfs_updated_at
  BEFORE UPDATE ON public.streak_flash_sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabel pembelian
CREATE TABLE IF NOT EXISTS public.streak_flash_sale_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.streak_flash_sales(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('coins','gems','balance')),
  amount_paid INTEGER NOT NULL,
  reward_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  purchase_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sfsp_visitor ON public.streak_flash_sale_purchases(visitor_id, deal_id, purchase_date);

ALTER TABLE public.streak_flash_sale_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own flash purchases"
  ON public.streak_flash_sale_purchases FOR SELECT
  USING (true);

CREATE POLICY "Admin manage flash purchases"
  ON public.streak_flash_sale_purchases FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Seed 6 deal awal
INSERT INTO public.streak_flash_sales (name, description, item_type, reward_payload, price_coins, price_gems, price_balance, original_price, discount_pct, total_stock, remaining_stock, per_user_daily_limit, ends_at, is_featured, rarity, icon, gradient, sort_order) VALUES
('Mega Coin Pack ⚡', '5000 Streak Coins instan — diskon kilat 50%', 'coins', '{"coins":5000}'::jsonb, 0, 80, 8000, 16000, 50, 500, 500, 1, now() + interval '7 days', true, 'epic', '🪙', 'from-amber-400 to-orange-600', 1),
('Freeze Bundle x5 ❄️', '5x Streak Freeze — anti putus streak seminggu', 'freeze', '{"freeze":5}'::jsonb, 800, 30, 3500, 7000, 50, 300, 300, 1, now() + interval '5 days', true, 'rare', '❄️', 'from-cyan-400 to-blue-600', 2),
('Mystery Box Diamond 💎', 'Kotak misteri tier diamond — hadiah hingga 10000 koin', 'mystery_box', '{"box_tier":"diamond","min":2000,"max":10000}'::jsonb, 1500, 50, 6000, 12000, 50, 200, 200, 1, now() + interval '3 days', true, 'legendary', '💎', 'from-fuchsia-500 to-purple-700', 3),
('Scratch Card Gold x10 🎟️', '10 kartu gosok tier gold — peluang besar', 'scratch_card', '{"card_tier":"gold","count":10}'::jsonb, 1200, 40, 5000, 10000, 50, 250, 250, 2, now() + interval '4 days', false, 'epic', '🎟️', 'from-yellow-400 to-amber-600', 4),
('Avatar Phoenix 🔥 (Limited)', 'Avatar legendaris edisi terbatas — Phoenix Flame', 'cosmetic', '{"cosmetic_type":"avatar","cosmetic_id":"phoenix_flame","name":"Phoenix Flame"}'::jsonb, 5000, 200, 25000, 50000, 50, 50, 50, 1, now() + interval '14 days', true, 'mythic', '🔥', 'from-red-500 via-orange-500 to-yellow-400', 5),
('Booster Combo Pack ⚡', 'Double XP 24jam + 10 Hint + 5 Nyawa Ekstra', 'booster', '{"double_xp_hours":24,"auto_hint":10,"extra_life":5}'::jsonb, 600, 25, 3000, 6000, 50, 400, 400, 1, now() + interval '6 days', false, 'rare', '⚡', 'from-green-400 to-emerald-600', 6);