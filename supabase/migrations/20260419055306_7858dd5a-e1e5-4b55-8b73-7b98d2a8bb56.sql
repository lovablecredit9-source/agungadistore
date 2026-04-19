-- Bundle paket hemat
CREATE TABLE public.event_shop_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🎁',
  contents jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_coins integer NOT NULL DEFAULT 0,
  original_price integer NOT NULL DEFAULT 0,
  weekly_limit integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_shop_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundles_public_read" ON public.event_shop_bundles FOR SELECT USING (true);
CREATE POLICY "bundles_admin_all" ON public.event_shop_bundles FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE TRIGGER trg_bundles_updated BEFORE UPDATE ON public.event_shop_bundles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.event_shop_bundle_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  bundle_id uuid NOT NULL REFERENCES public.event_shop_bundles(id) ON DELETE CASCADE,
  cost_paid integer NOT NULL,
  week_start date NOT NULL,
  contents_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bundle_purchases_visitor_week ON public.event_shop_bundle_purchases(visitor_id, week_start);
ALTER TABLE public.event_shop_bundle_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundle_purchases_public_read" ON public.event_shop_bundle_purchases FOR SELECT USING (true);
CREATE POLICY "bundle_purchases_admin_all" ON public.event_shop_bundle_purchases FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Mystery box
CREATE TABLE public.event_shop_mystery_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '📦',
  price_coins integer NOT NULL DEFAULT 100,
  rarity_pool jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_shop_mystery_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mystery_boxes_public_read" ON public.event_shop_mystery_boxes FOR SELECT USING (true);
CREATE POLICY "mystery_boxes_admin_all" ON public.event_shop_mystery_boxes FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE TRIGGER trg_mystery_boxes_updated BEFORE UPDATE ON public.event_shop_mystery_boxes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.event_shop_mystery_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  box_id uuid NOT NULL REFERENCES public.event_shop_mystery_boxes(id) ON DELETE CASCADE,
  cost_paid integer NOT NULL,
  rarity text NOT NULL,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mystery_openings_visitor ON public.event_shop_mystery_openings(visitor_id, created_at DESC);
ALTER TABLE public.event_shop_mystery_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mystery_openings_public_read" ON public.event_shop_mystery_openings FOR SELECT USING (true);
CREATE POLICY "mystery_openings_admin_all" ON public.event_shop_mystery_openings FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Daily rotation pool
CREATE TABLE public.event_shop_daily_rotation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '✨',
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  base_price_coins integer NOT NULL DEFAULT 50,
  rarity_weight integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_shop_daily_rotation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_rotation_public_read" ON public.event_shop_daily_rotation FOR SELECT USING (true);
CREATE POLICY "daily_rotation_admin_all" ON public.event_shop_daily_rotation FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE TRIGGER trg_daily_rotation_updated BEFORE UPDATE ON public.event_shop_daily_rotation FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.event_shop_daily_active (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotation_date date NOT NULL,
  item_id uuid NOT NULL REFERENCES public.event_shop_daily_rotation(id) ON DELETE CASCADE,
  discount_pct integer NOT NULL DEFAULT 0,
  slot_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rotation_date, slot_order)
);
CREATE INDEX idx_daily_active_date ON public.event_shop_daily_active(rotation_date);
ALTER TABLE public.event_shop_daily_active ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_active_public_read" ON public.event_shop_daily_active FOR SELECT USING (true);
CREATE POLICY "daily_active_admin_all" ON public.event_shop_daily_active FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE TABLE public.event_shop_daily_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  item_id uuid NOT NULL REFERENCES public.event_shop_daily_rotation(id) ON DELETE CASCADE,
  cost_paid integer NOT NULL,
  purchase_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_daily_purchases_visitor_date ON public.event_shop_daily_purchases(visitor_id, purchase_date);
ALTER TABLE public.event_shop_daily_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_purchases_public_read" ON public.event_shop_daily_purchases FOR SELECT USING (true);
CREATE POLICY "daily_purchases_admin_all" ON public.event_shop_daily_purchases FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Wishlist
CREATE TABLE public.event_shop_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  item_kind text NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, item_kind, item_id)
);
CREATE INDEX idx_wishlist_visitor ON public.event_shop_wishlist(visitor_id);
ALTER TABLE public.event_shop_wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist_public_read" ON public.event_shop_wishlist FOR SELECT USING (true);
CREATE POLICY "wishlist_admin_all" ON public.event_shop_wishlist FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Activity feed
CREATE TABLE public.event_shop_activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  action_type text NOT NULL,
  item_name text NOT NULL DEFAULT '',
  item_icon text NOT NULL DEFAULT '🎁',
  rarity text NOT NULL DEFAULT 'common',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_feed_recent ON public.event_shop_activity_feed(created_at DESC);
ALTER TABLE public.event_shop_activity_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_feed_public_read" ON public.event_shop_activity_feed FOR SELECT USING (true);
CREATE POLICY "activity_feed_admin_all" ON public.event_shop_activity_feed FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Top spender weekly aggregate
CREATE TABLE public.event_shop_top_spenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  week_start date NOT NULL,
  total_spent integer NOT NULL DEFAULT 0,
  purchase_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, week_start)
);
CREATE INDEX idx_top_spenders_week ON public.event_shop_top_spenders(week_start, total_spent DESC);
ALTER TABLE public.event_shop_top_spenders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "top_spenders_public_read" ON public.event_shop_top_spenders FOR SELECT USING (true);
CREATE POLICY "top_spenders_admin_all" ON public.event_shop_top_spenders FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE TRIGGER trg_top_spenders_updated BEFORE UPDATE ON public.event_shop_top_spenders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();