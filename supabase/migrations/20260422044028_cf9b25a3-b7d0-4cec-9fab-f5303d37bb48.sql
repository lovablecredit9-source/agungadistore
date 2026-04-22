-- ===== Katalog item Power Pack =====
CREATE TABLE public.streak_power_pack_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT '🎁',
  rarity TEXT NOT NULL DEFAULT 'common',
  weight INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_power_pack_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active power pack items"
ON public.streak_power_pack_items FOR SELECT
USING (is_active = true);

CREATE POLICY "Admin can manage power pack items"
ON public.streak_power_pack_items FOR ALL
USING (is_admin_user()) WITH CHECK (is_admin_user());

-- ===== Katalog paket Power Pack =====
CREATE TABLE public.streak_power_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'trial',
  description TEXT,
  duration_days INTEGER NOT NULL DEFAULT 3,
  price_idr INTEGER NOT NULL DEFAULT 0,
  daily_item_min INTEGER NOT NULL DEFAULT 1,
  daily_item_max INTEGER NOT NULL DEFAULT 1,
  instant_item_count INTEGER NOT NULL DEFAULT 3,
  instant_full_pack BOOLEAN NOT NULL DEFAULT false,
  icon TEXT NOT NULL DEFAULT '⚡',
  badge_color TEXT NOT NULL DEFAULT '#a855f7',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_power_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active power packs"
ON public.streak_power_packs FOR SELECT
USING (is_active = true);

CREATE POLICY "Admin can manage power packs"
ON public.streak_power_packs FOR ALL
USING (is_admin_user()) WITH CHECK (is_admin_user());

-- ===== Subscriptions =====
CREATE TABLE public.streak_power_pack_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  pack_id UUID NOT NULL REFERENCES public.streak_power_packs(id) ON DELETE CASCADE,
  pack_name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pp_subs_visitor ON public.streak_power_pack_subscriptions(visitor_id);
CREATE INDEX idx_pp_subs_active ON public.streak_power_pack_subscriptions(visitor_id, is_active, expires_at);

ALTER TABLE public.streak_power_pack_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own power pack subscriptions"
ON public.streak_power_pack_subscriptions FOR SELECT USING (true);

CREATE POLICY "Admin manage power pack subscriptions"
ON public.streak_power_pack_subscriptions FOR ALL
USING (is_admin_user()) WITH CHECK (is_admin_user());

-- ===== Inventory per visitor =====
CREATE TABLE public.streak_power_pack_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  item_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, item_code)
);

CREATE INDEX idx_pp_inv_visitor ON public.streak_power_pack_inventory(visitor_id);

ALTER TABLE public.streak_power_pack_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own power pack inventory"
ON public.streak_power_pack_inventory FOR SELECT USING (true);

CREATE POLICY "Admin manage power pack inventory"
ON public.streak_power_pack_inventory FOR ALL
USING (is_admin_user()) WITH CHECK (is_admin_user());

-- ===== Daily claims log =====
CREATE TABLE public.streak_power_pack_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  subscription_id UUID REFERENCES public.streak_power_pack_subscriptions(id) ON DELETE SET NULL,
  pack_id UUID,
  claim_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  items_awarded JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_instant BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pp_claims_visitor_date ON public.streak_power_pack_claims(visitor_id, claim_date);
CREATE UNIQUE INDEX uniq_pp_daily_claim
  ON public.streak_power_pack_claims(visitor_id, subscription_id, claim_date)
  WHERE is_instant = false AND subscription_id IS NOT NULL;

ALTER TABLE public.streak_power_pack_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own power pack claims"
ON public.streak_power_pack_claims FOR SELECT USING (true);

CREATE POLICY "Admin manage power pack claims"
ON public.streak_power_pack_claims FOR ALL
USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Updated_at triggers
CREATE TRIGGER tr_pp_items_updated BEFORE UPDATE ON public.streak_power_pack_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_pp_packs_updated BEFORE UPDATE ON public.streak_power_packs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_pp_inv_updated BEFORE UPDATE ON public.streak_power_pack_inventory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Seed data: items =====
INSERT INTO public.streak_power_pack_items (code, name, description, icon, rarity, weight, sort_order) VALUES
('nyawa', 'Nyawa Ekstra', 'Tambahan nyawa untuk game AI', '❤️', 'common', 130, 1),
('hint', 'Hint Bonus', 'Petunjuk gratis untuk teka-teki', '💡', 'common', 130, 2),
('freeze', 'Streak Freeze', 'Pelindung streak 1 hari tanpa klaim', '🧊', 'rare', 90, 3),
('double_xp', 'Double 2x', 'Pengganda 2x poin selama 1 jam', '⚡', 'rare', 80, 4),
('level_points', 'Poin Level', '+250 EXP level pemain', '⭐', 'rare', 80, 5),
('shield_streak', 'Shield Streak', 'Perisai anti-putus streak (3 hari)', '🛡️', 'epic', 60, 6),
('mystery_box', 'Mystery Box', 'Kotak misterius dengan hadiah acak', '📦', 'epic', 50, 7),
('lucky_token', 'Lucky Token', 'Token keberuntungan untuk Lucky Wheel', '🍀', 'legendary', 30, 8);

-- ===== Seed data: packs =====
INSERT INTO public.streak_power_packs (name, tier, description, duration_days, price_idr, daily_item_min, daily_item_max, instant_item_count, instant_full_pack, icon, badge_color, is_featured, sort_order) VALUES
('Power Trial', 'trial', '3 hari · 1 item random/hari · instan 3 item', 3, 15000, 1, 1, 3, false, '⚡', '#22d3ee', false, 1),
('Power Weekly', 'weekly', '7 hari · 1-2 item random/hari · instan 5 item', 7, 35000, 1, 2, 5, false, '🔥', '#a855f7', true, 2),
('Power Monthly', 'monthly', '30 hari · 2-3 item random/hari · instan 8 item', 30, 80000, 2, 3, 8, false, '👑', '#f59e0b', false, 3),
('Power Premium', 'premium', '60 hari · 2-3 item random/hari · INSTAN PAKET LENGKAP semua item', 60, 150000, 2, 3, 0, true, '💎', '#ec4899', false, 4);