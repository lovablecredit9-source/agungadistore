
-- ============ AUTO FLASH SALES ============
CREATE TABLE IF NOT EXISTS public.auto_flash_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date DATE NOT NULL,
  session_slot TEXT NOT NULL CHECK (session_slot IN ('morning','afternoon','evening')),
  content_type TEXT NOT NULL CHECK (content_type IN ('product','reward')),
  target_id UUID,
  target_kind TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '⚡',
  discount_percent INTEGER NOT NULL DEFAULT 0,
  reward_type TEXT,
  reward_value INTEGER DEFAULT 0,
  cost_coins INTEGER DEFAULT 0,
  cost_gems INTEGER DEFAULT 0,
  original_price INTEGER DEFAULT 0,
  flash_price INTEGER DEFAULT 0,
  total_stock INTEGER NOT NULL DEFAULT 100,
  sold_count INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sale_date, session_slot, content_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_afs_active ON public.auto_flash_sales (is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_afs_date ON public.auto_flash_sales (sale_date);

ALTER TABLE public.auto_flash_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auto_flash_sales_public_select" ON public.auto_flash_sales FOR SELECT USING (true);
CREATE POLICY "auto_flash_sales_admin_all" ON public.auto_flash_sales FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.auto_flash_sale_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.auto_flash_sales(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  cost_paid INTEGER DEFAULT 0,
  payment_method TEXT DEFAULT 'coin',
  reward_type TEXT,
  reward_value INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_afsp_visitor ON public.auto_flash_sale_purchases (visitor_id);
ALTER TABLE public.auto_flash_sale_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "afsp_select_own" ON public.auto_flash_sale_purchases FOR SELECT USING (true);
CREATE POLICY "afsp_insert_own" ON public.auto_flash_sale_purchases FOR INSERT WITH CHECK (true);
CREATE POLICY "afsp_admin_all" ON public.auto_flash_sale_purchases FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- ============ DAILY FREE SPIN ============
CREATE TABLE IF NOT EXISTS public.daily_free_spin_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value INTEGER NOT NULL DEFAULT 0,
  weight INTEGER NOT NULL DEFAULT 10,
  icon TEXT DEFAULT '🎁',
  color TEXT DEFAULT '#f59e0b',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_free_spin_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dfss_public_select" ON public.daily_free_spin_segments FOR SELECT USING (true);
CREATE POLICY "dfss_admin_all" ON public.daily_free_spin_segments FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.daily_free_spin_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  spin_date DATE NOT NULL,
  segment_id UUID,
  reward_label TEXT,
  reward_type TEXT,
  reward_value INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, spin_date)
);

ALTER TABLE public.daily_free_spin_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dfsc_public_select" ON public.daily_free_spin_claims FOR SELECT USING (true);
CREATE POLICY "dfsc_public_insert" ON public.daily_free_spin_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "dfsc_admin_all" ON public.daily_free_spin_claims FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- ============ MYSTERY BOX DROP (every 6h) ============
CREATE TABLE IF NOT EXISTS public.mystery_box_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_date DATE NOT NULL,
  slot_index INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  total_stock INTEGER NOT NULL DEFAULT 500,
  opened_count INTEGER NOT NULL DEFAULT 0,
  rarity_pool JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (drop_date, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_mbd_active ON public.mystery_box_drops (is_active, starts_at, ends_at);

ALTER TABLE public.mystery_box_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mbd_public_select" ON public.mystery_box_drops FOR SELECT USING (true);
CREATE POLICY "mbd_admin_all" ON public.mystery_box_drops FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.mystery_box_drop_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id UUID NOT NULL REFERENCES public.mystery_box_drops(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  reward_label TEXT,
  reward_type TEXT,
  reward_value INTEGER,
  rarity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (drop_id, visitor_id)
);

ALTER TABLE public.mystery_box_drop_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mbdc_public_select" ON public.mystery_box_drop_claims FOR SELECT USING (true);
CREATE POLICY "mbdc_public_insert" ON public.mystery_box_drop_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "mbdc_admin_all" ON public.mystery_box_drop_claims FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- ============ SEED Spin Wheel Segments ============
INSERT INTO public.daily_free_spin_segments (label, reward_type, reward_value, weight, icon, color, sort_order) VALUES
('+50 Koin',         'streak_coins',  50,  25, '🪙', '#f59e0b', 1),
('+5 Gem',           'gem',           5,   12, '💎', '#06b6d4', 2),
('+1 Hint',          'auto_hint',     1,   18, '💡', '#a855f7', 3),
('+1 Nyawa',         'extra_life',    1,   15, '❤️', '#ef4444', 4),
('+200 Koin',        'streak_coins',  200, 8,  '💰', '#eab308', 5),
('+1 Freeze',        'streak_freeze', 1,   10, '🧊', '#3b82f6', 6),
('Double XP 1j',     'double_xp',     1,   6,  '⚡', '#10b981', 7),
('🎉 JACKPOT 1000',  'streak_coins',  1000,2,  '🏆', '#ec4899', 8),
('Coba Lagi',        'nothing',       0,   4,  '😅', '#64748b', 9)
ON CONFLICT DO NOTHING;

-- ============ Enable cron + net ============
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
