
-- 1. FLASH DEALS (Limited Time Deals)
CREATE TABLE public.event_shop_flash_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '⚡',
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  original_price integer NOT NULL DEFAULT 0,
  flash_price integer NOT NULL DEFAULT 0,
  total_stock integer NOT NULL DEFAULT 100,
  sold_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.event_shop_flash_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.event_shop_flash_deals(id) ON DELETE CASCADE,
  cost_paid integer NOT NULL,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. GACHA WHEEL (Lucky Spin Shop)
CREATE TABLE public.event_shop_gacha_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🎁',
  rarity text NOT NULL DEFAULT 'common',
  weight integer NOT NULL DEFAULT 100,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.event_shop_gacha_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  item_id uuid NOT NULL REFERENCES public.event_shop_gacha_items(id) ON DELETE CASCADE,
  cost_paid integer NOT NULL,
  rarity text NOT NULL,
  reward_label text NOT NULL,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. VIP MEMBERSHIP PASS
CREATE TABLE public.event_shop_vip_pass (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  free_box_last_claim date,
  total_purchases integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. DAILY LOGIN CALENDAR
CREATE TABLE public.event_shop_login_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  cycle_start date NOT NULL,
  day_number integer NOT NULL,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, cycle_start, day_number)
);

-- 5. ACHIEVEMENT SHOP UNLOCKS
CREATE TABLE public.event_shop_achievement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🏆',
  unlock_requirement text NOT NULL DEFAULT 'spent',
  unlock_threshold integer NOT NULL DEFAULT 1000,
  price_coins integer NOT NULL DEFAULT 500,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.event_shop_achievement_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  item_id uuid NOT NULL REFERENCES public.event_shop_achievement_items(id) ON DELETE CASCADE,
  cost_paid integer NOT NULL,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ENABLE RLS
ALTER TABLE public.event_shop_flash_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_shop_flash_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_shop_gacha_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_shop_gacha_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_shop_vip_pass ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_shop_login_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_shop_achievement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_shop_achievement_purchases ENABLE ROW LEVEL SECURITY;

-- POLICIES (public read for catalog, all writes via edge function with service role)
CREATE POLICY "flash_deals_read" ON public.event_shop_flash_deals FOR SELECT USING (true);
CREATE POLICY "flash_purchases_read" ON public.event_shop_flash_purchases FOR SELECT USING (true);
CREATE POLICY "gacha_items_read" ON public.event_shop_gacha_items FOR SELECT USING (true);
CREATE POLICY "gacha_history_read" ON public.event_shop_gacha_history FOR SELECT USING (true);
CREATE POLICY "vip_pass_read" ON public.event_shop_vip_pass FOR SELECT USING (true);
CREATE POLICY "login_cal_read" ON public.event_shop_login_calendar FOR SELECT USING (true);
CREATE POLICY "ach_items_read" ON public.event_shop_achievement_items FOR SELECT USING (true);
CREATE POLICY "ach_purchases_read" ON public.event_shop_achievement_purchases FOR SELECT USING (true);

-- INDEXES
CREATE INDEX idx_flash_purch_visitor ON public.event_shop_flash_purchases(visitor_id);
CREATE INDEX idx_gacha_hist_visitor ON public.event_shop_gacha_history(visitor_id, created_at DESC);
CREATE INDEX idx_login_cal_visitor ON public.event_shop_login_calendar(visitor_id, cycle_start);
CREATE INDEX idx_ach_purch_visitor ON public.event_shop_achievement_purchases(visitor_id);

-- TRIGGERS for updated_at
CREATE TRIGGER trg_flash_deals_updated BEFORE UPDATE ON public.event_shop_flash_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vip_pass_updated BEFORE UPDATE ON public.event_shop_vip_pass
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED DATA
-- Flash deals contoh
INSERT INTO public.event_shop_flash_deals (name, description, icon, reward_type, reward_value, reward_label, original_price, flash_price, total_stock, ends_at, sort_order) VALUES
('⚡ Mega Coin Pack', 'Hadiah kilat 6 jam saja!', '💎', 'streak_coins', 5000, '+5000 Streak Coins', 8000, 2400, 50, now() + interval '6 hours', 1),
('🔥 Triple XP Boost', 'Boost XP 3x selama 2 jam', '🚀', 'double_xp_hours', 2, 'Double XP 2 jam', 3500, 999, 30, now() + interval '4 hours', 2),
('❄️ Freeze Combo', 'Lindungi streak 3 hari', '🧊', 'streak_freeze', 3, '+3 Streak Freeze', 4500, 1499, 40, now() + interval '8 hours', 3);

-- Gacha items pool
INSERT INTO public.event_shop_gacha_items (name, icon, rarity, weight, reward_type, reward_value, reward_label) VALUES
('Coin Receh', '🪙', 'common', 400, 'streak_coins', 50, '+50 Coins'),
('Coin Standar', '💰', 'common', 300, 'streak_coins', 100, '+100 Coins'),
('Hint Bantuan', '💡', 'rare', 150, 'auto_hint', 1, '+1 Auto Hint'),
('Streak Freeze', '❄️', 'rare', 100, 'streak_freeze', 1, '+1 Streak Freeze'),
('XP Boost 1 Jam', '⚡', 'epic', 35, 'double_xp_hours', 1, 'Double XP 1 jam'),
('Coin Jackpot', '💎', 'epic', 12, 'streak_coins', 2000, '+2000 Coins'),
('Mega Boost 6 Jam', '👑', 'legendary', 3, 'double_xp_hours', 6, 'Double XP 6 jam');

-- VIP pass info disimpan di seed admin, harga diatur di edge function

-- Achievement items
INSERT INTO public.event_shop_achievement_items (name, description, icon, unlock_requirement, unlock_threshold, price_coins, reward_type, reward_value, reward_label, sort_order) VALUES
('Crown of Spender', 'Hanya untuk pemain yang sudah belanja 10K coins', '👑', 'spent', 10000, 5000, 'streak_coins', 8000, '+8000 Coins (Bonus 60%)', 1),
('Diamond Cache', 'Unlock setelah belanja 25K coins', '💎', 'spent', 25000, 8000, 'double_xp_hours', 24, 'Double XP 24 jam', 2),
('Legendary Vault', 'Item langka, butuh 50K spending lifetime', '🏆', 'spent', 50000, 15000, 'streak_freeze', 10, '+10 Streak Freeze', 3),
('Mythic Bundle', 'Hadiah ultimate untuk top spender 100K+', '⚜️', 'spent', 100000, 25000, 'streak_coins', 50000, '+50000 Coins Mega Pack', 4);
