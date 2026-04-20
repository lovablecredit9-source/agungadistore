
-- 1. STREAK DAILY MYSTERY BOXES
CREATE TABLE public.streak_daily_mystery_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🎁',
  rarity text NOT NULL DEFAULT 'common',
  cost_coins integer NOT NULL DEFAULT 0,
  cost_gems integer NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  daily_limit integer NOT NULL DEFAULT 1,
  reward_pool jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_daily_mystery_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boxes_public_read" ON public.streak_daily_mystery_boxes FOR SELECT USING (true);
CREATE POLICY "boxes_admin_all" ON public.streak_daily_mystery_boxes FOR ALL USING (public.is_admin_user());
CREATE TRIGGER trg_streak_daily_mystery_boxes_updated BEFORE UPDATE ON public.streak_daily_mystery_boxes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.streak_daily_mystery_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  box_id uuid NOT NULL REFERENCES public.streak_daily_mystery_boxes(id) ON DELETE CASCADE,
  claim_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  payment_method text NOT NULL DEFAULT 'free',
  cost_paid integer NOT NULL DEFAULT 0,
  rarity text NOT NULL DEFAULT 'common',
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_daily_mystery_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claims_admin_read" ON public.streak_daily_mystery_claims FOR SELECT USING (public.is_admin_user());
CREATE INDEX idx_streak_daily_mystery_claims_v ON public.streak_daily_mystery_claims (visitor_id, claim_date);

-- 2. MINI EVENT MINGGUAN
CREATE TABLE public.streak_mini_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🎯',
  event_type text NOT NULL DEFAULT 'streak_count',
  target_value integer NOT NULL DEFAULT 7,
  reward_coins integer NOT NULL DEFAULT 0,
  reward_gems integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_mini_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mini_events_public_read" ON public.streak_mini_events FOR SELECT USING (true);
CREATE POLICY "mini_events_admin_all" ON public.streak_mini_events FOR ALL USING (public.is_admin_user());
CREATE TRIGGER trg_streak_mini_events_updated BEFORE UPDATE ON public.streak_mini_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.streak_mini_event_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.streak_mini_events(id) ON DELETE CASCADE,
  current_value integer NOT NULL DEFAULT 0,
  is_claimed boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, event_id)
);
ALTER TABLE public.streak_mini_event_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mini_event_progress_admin_read" ON public.streak_mini_event_progress FOR SELECT USING (public.is_admin_user());
CREATE TRIGGER trg_streak_mini_event_progress_updated BEFORE UPDATE ON public.streak_mini_event_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. TOKO DISKON BERPUTAR
CREATE TABLE public.streak_rotating_shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '✨',
  rarity text NOT NULL DEFAULT 'common',
  base_cost_coins integer NOT NULL DEFAULT 100,
  base_cost_gems integer NOT NULL DEFAULT 0,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 1,
  reward_label text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_rotating_shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rotating_items_public_read" ON public.streak_rotating_shop_items FOR SELECT USING (true);
CREATE POLICY "rotating_items_admin_all" ON public.streak_rotating_shop_items FOR ALL USING (public.is_admin_user());
CREATE TRIGGER trg_streak_rotating_shop_items_updated BEFORE UPDATE ON public.streak_rotating_shop_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.streak_rotating_shop_active (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.streak_rotating_shop_items(id) ON DELETE CASCADE,
  rotation_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  slot_order integer NOT NULL DEFAULT 0,
  discount_pct integer NOT NULL DEFAULT 0,
  daily_limit integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rotation_date, slot_order)
);
ALTER TABLE public.streak_rotating_shop_active ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rotating_active_public_read" ON public.streak_rotating_shop_active FOR SELECT USING (true);
CREATE POLICY "rotating_active_admin_all" ON public.streak_rotating_shop_active FOR ALL USING (public.is_admin_user());

CREATE TABLE public.streak_rotating_shop_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  active_id uuid NOT NULL REFERENCES public.streak_rotating_shop_active(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.streak_rotating_shop_items(id) ON DELETE CASCADE,
  purchase_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  payment_method text NOT NULL DEFAULT 'coin',
  cost_paid integer NOT NULL DEFAULT 0,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 1,
  reward_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_rotating_shop_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rotating_purchases_admin_read" ON public.streak_rotating_shop_purchases FOR SELECT USING (public.is_admin_user());
CREATE INDEX idx_rotating_purchases_v ON public.streak_rotating_shop_purchases (visitor_id, purchase_date);

-- 4. BOSS RAID KOMUNITAS
CREATE TABLE public.streak_community_bosses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🐉',
  max_hp bigint NOT NULL DEFAULT 100000,
  current_hp bigint NOT NULL DEFAULT 100000,
  attack_cost_coins integer NOT NULL DEFAULT 5,
  attack_damage_min integer NOT NULL DEFAULT 50,
  attack_damage_max integer NOT NULL DEFAULT 200,
  reward_coins integer NOT NULL DEFAULT 100,
  reward_gems integer NOT NULL DEFAULT 5,
  reward_label text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  is_active boolean NOT NULL DEFAULT true,
  is_defeated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_community_bosses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bosses_public_read" ON public.streak_community_bosses FOR SELECT USING (true);
CREATE POLICY "bosses_admin_all" ON public.streak_community_bosses FOR ALL USING (public.is_admin_user());
CREATE TRIGGER trg_streak_community_bosses_updated BEFORE UPDATE ON public.streak_community_bosses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.streak_community_boss_attacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  boss_id uuid NOT NULL REFERENCES public.streak_community_bosses(id) ON DELETE CASCADE,
  damage_dealt integer NOT NULL DEFAULT 0,
  cost_paid integer NOT NULL DEFAULT 0,
  is_killing_blow boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_community_boss_attacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boss_attacks_public_read" ON public.streak_community_boss_attacks FOR SELECT USING (true);
CREATE INDEX idx_boss_attacks_boss ON public.streak_community_boss_attacks (boss_id, created_at DESC);
CREATE INDEX idx_boss_attacks_visitor ON public.streak_community_boss_attacks (visitor_id, boss_id);

-- SEED DATA
INSERT INTO public.streak_daily_mystery_boxes (name, description, icon, rarity, cost_coins, cost_gems, is_free, daily_limit, sort_order, reward_pool) VALUES
('Box Pemula', 'Box gratis harian — coba keberuntunganmu!', '📦', 'common', 0, 0, true, 1, 1, '[
  {"type":"streak_coins","value":10,"weight":40,"label":"+10 Coin","icon":"🪙","rarity":"common"},
  {"type":"streak_coins","value":25,"weight":25,"label":"+25 Coin","icon":"🪙","rarity":"common"},
  {"type":"streak_coins","value":50,"weight":15,"label":"+50 Coin","icon":"🪙","rarity":"rare"},
  {"type":"gems","value":1,"weight":15,"label":"+1 Gem","icon":"💎","rarity":"rare"},
  {"type":"gems","value":3,"weight":5,"label":"+3 Gem","icon":"💎","rarity":"epic"}
]'::jsonb),
('Box Premium', 'Box berbayar dengan hadiah lebih besar!', '🎁', 'rare', 100, 0, false, 3, 2, '[
  {"type":"streak_coins","value":50,"weight":30,"label":"+50 Coin","icon":"🪙","rarity":"common"},
  {"type":"streak_coins","value":150,"weight":25,"label":"+150 Coin","icon":"🪙","rarity":"rare"},
  {"type":"gems","value":2,"weight":20,"label":"+2 Gem","icon":"💎","rarity":"rare"},
  {"type":"gems","value":5,"weight":15,"label":"+5 Gem","icon":"💎","rarity":"epic"},
  {"type":"streak_coins","value":300,"weight":7,"label":"+300 Coin","icon":"🪙","rarity":"epic"},
  {"type":"gems","value":10,"weight":3,"label":"+10 Gem","icon":"💎","rarity":"legendary"}
]'::jsonb),
('Box Diamond', 'Box top-tier — bayar pakai gem, hadiah jackpot!', '💎', 'epic', 0, 5, false, 2, 3, '[
  {"type":"streak_coins","value":200,"weight":25,"label":"+200 Coin","icon":"🪙","rarity":"rare"},
  {"type":"gems","value":3,"weight":25,"label":"+3 Gem","icon":"💎","rarity":"rare"},
  {"type":"streak_coins","value":500,"weight":20,"label":"+500 Coin","icon":"🪙","rarity":"epic"},
  {"type":"gems","value":8,"weight":15,"label":"+8 Gem","icon":"💎","rarity":"epic"},
  {"type":"gems","value":15,"weight":10,"label":"+15 Gem","icon":"💎","rarity":"legendary"},
  {"type":"gems","value":30,"weight":5,"label":"+30 Gem JACKPOT!","icon":"💎","rarity":"legendary"}
]'::jsonb);

INSERT INTO public.streak_mini_events (name, description, icon, event_type, target_value, reward_coins, reward_gems, reward_label, starts_at, ends_at, sort_order) VALUES
('Streak Master', 'Capai streak 7 hari berturut-turut minggu ini!', '🔥', 'streak_count', 7, 200, 5, '+200 Coin & +5 Gem', now(), now() + interval '7 days', 1),
('Coin Collector', 'Kumpulkan 1000 streak coin minggu ini', '🪙', 'coin_earned', 1000, 100, 3, '+100 Coin & +3 Gem', now(), now() + interval '7 days', 2),
('Klaim Marathon', 'Klaim streak harian 5x minggu ini', '✅', 'claim_count', 5, 150, 4, '+150 Coin & +4 Gem', now(), now() + interval '7 days', 3),
('Gem Hunter', 'Kumpulkan 20 gem dari box/wheel minggu ini', '💎', 'gem_earned', 20, 250, 8, '+250 Coin & +8 Gem', now(), now() + interval '7 days', 4);

INSERT INTO public.streak_rotating_shop_items (name, description, icon, rarity, base_cost_coins, base_cost_gems, reward_type, reward_value, reward_label) VALUES
('Mini Coin Pack', 'Paket koin instan', '🪙', 'common', 50, 0, 'streak_coins', 75, '+75 Coin'),
('Mini Gem Pack', 'Paket gem instan', '💎', 'rare', 200, 0, 'gems', 3, '+3 Gem'),
('Streak Freeze ×1', 'Lindungi streak 1 hari', '❄️', 'rare', 80, 2, 'streak_freeze', 1, '+1 Freeze'),
('Hint Pack ×3', 'Power-up hint untuk game', '💡', 'common', 60, 1, 'auto_hint', 3, '+3 Hint'),
('Extra Life ×2', 'Power-up nyawa untuk game', '❤️', 'rare', 100, 2, 'extra_life', 2, '+2 Nyawa'),
('Time Freeze ×3', 'Power-up freeze timer game', '⏸️', 'rare', 120, 3, 'time_freeze', 3, '+3 Time Freeze'),
('Double XP 2j', 'Boost XP 2× selama 2 jam', '⚡', 'epic', 180, 4, 'double_xp', 2, '+2j Double XP'),
('Mega Coin Pack', 'Paket besar koin', '🪙', 'epic', 250, 5, 'streak_coins', 400, '+400 Coin'),
('Mega Gem Pack', 'Paket besar gem', '💎', 'legendary', 500, 0, 'gems', 8, '+8 Gem'),
('Mystery Pack', 'Paket misterius — bisa apa aja!', '🎁', 'epic', 300, 6, 'streak_coins', 250, '+250 Coin');

INSERT INTO public.streak_community_bosses (name, description, icon, max_hp, current_hp, attack_cost_coins, attack_damage_min, attack_damage_max, reward_coins, reward_gems, reward_label, starts_at, ends_at) VALUES
('Naga Es Krimsi', 'Boss komunitas pertama — serang bareng-bareng untuk hadiah!', '🐉', 500000, 500000, 5, 50, 250, 200, 8, '+200 Coin & +8 Gem (jika kontribusi top 50%)', now(), now() + interval '3 days');
