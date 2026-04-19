-- ============ STREAK SHOP: BATTLE PASS MINI ============
CREATE TABLE public.streak_battle_pass_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  premium_cost_coins integer NOT NULL DEFAULT 500,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.streak_battle_pass_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.streak_battle_pass_seasons(id) ON DELETE CASCADE,
  tier_number integer NOT NULL,
  required_spent_coins integer NOT NULL DEFAULT 0,
  free_reward_type text NOT NULL DEFAULT 'streak_freeze',
  free_reward_value integer NOT NULL DEFAULT 1,
  free_reward_label text NOT NULL DEFAULT '',
  free_reward_icon text NOT NULL DEFAULT '🎁',
  premium_reward_type text NOT NULL DEFAULT 'streak_freeze',
  premium_reward_value integer NOT NULL DEFAULT 2,
  premium_reward_label text NOT NULL DEFAULT '',
  premium_reward_icon text NOT NULL DEFAULT '💎',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id, tier_number)
);

CREATE TABLE public.streak_battle_pass_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  season_id uuid NOT NULL REFERENCES public.streak_battle_pass_seasons(id) ON DELETE CASCADE,
  total_spent_coins integer NOT NULL DEFAULT 0,
  is_premium boolean NOT NULL DEFAULT false,
  premium_purchased_at timestamptz,
  claimed_free_tiers integer[] NOT NULL DEFAULT '{}',
  claimed_premium_tiers integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, season_id)
);

-- ============ STREAK SHOP: TRADE-IN CENTER ============
CREATE TABLE public.streak_tradein_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🔄',
  input_type text NOT NULL,
  input_amount integer NOT NULL DEFAULT 1,
  output_type text NOT NULL,
  output_amount integer NOT NULL DEFAULT 1,
  output_label text NOT NULL DEFAULT '',
  daily_limit integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.streak_tradein_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  recipe_id uuid NOT NULL REFERENCES public.streak_tradein_recipes(id) ON DELETE CASCADE,
  input_type text NOT NULL,
  input_amount integer NOT NULL,
  output_type text NOT NULL,
  output_amount integer NOT NULL,
  trade_date date NOT NULL DEFAULT (CURRENT_DATE),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_streak_tradein_history_lookup ON public.streak_tradein_history(visitor_id, recipe_id, trade_date);

-- ============ STREAK SHOP: LIMITED EDITION SKINS ============
CREATE TABLE public.streak_limited_skins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  skin_type text NOT NULL DEFAULT 'avatar',
  image_url text NOT NULL DEFAULT '',
  emoji_fallback text NOT NULL DEFAULT '✨',
  rarity text NOT NULL DEFAULT 'rare',
  cost_coins integer NOT NULL DEFAULT 1000,
  total_stock integer NOT NULL DEFAULT 100,
  sold_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.streak_skin_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  skin_id uuid NOT NULL REFERENCES public.streak_limited_skins(id) ON DELETE CASCADE,
  cost_paid integer NOT NULL,
  is_equipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, skin_id)
);

-- ============ STREAK SHOP: GROUP BUY DISCOUNT ============
CREATE TABLE public.streak_group_buy_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '👥',
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 1,
  reward_label text NOT NULL DEFAULT '',
  base_cost_coins integer NOT NULL DEFAULT 200,
  tier1_buyers integer NOT NULL DEFAULT 5,
  tier1_discount_pct integer NOT NULL DEFAULT 10,
  tier2_buyers integer NOT NULL DEFAULT 15,
  tier2_discount_pct integer NOT NULL DEFAULT 25,
  tier3_buyers integer NOT NULL DEFAULT 30,
  tier3_discount_pct integer NOT NULL DEFAULT 40,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.streak_group_buy_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  item_id uuid NOT NULL REFERENCES public.streak_group_buy_items(id) ON DELETE CASCADE,
  cost_paid integer NOT NULL,
  discount_pct_applied integer NOT NULL DEFAULT 0,
  purchase_date date NOT NULL DEFAULT (CURRENT_DATE),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_buy_purchases_lookup ON public.streak_group_buy_purchases(item_id, purchase_date);
CREATE UNIQUE INDEX uq_group_buy_purchases_user_day ON public.streak_group_buy_purchases(visitor_id, item_id, purchase_date);

-- ============ STREAK EVENT: BOSS RAID KOMUNITAS ============
CREATE TABLE public.streak_boss_raids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_name text NOT NULL,
  boss_description text NOT NULL DEFAULT '',
  boss_emoji text NOT NULL DEFAULT '🐉',
  boss_image_url text DEFAULT '',
  total_hp bigint NOT NULL DEFAULT 100000,
  current_hp bigint NOT NULL DEFAULT 100000,
  attack_cost_coins integer NOT NULL DEFAULT 10,
  damage_per_attack integer NOT NULL DEFAULT 100,
  victory_reward_pool integer NOT NULL DEFAULT 5000,
  participation_reward integer NOT NULL DEFAULT 50,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status text NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.streak_boss_raid_attacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id uuid NOT NULL REFERENCES public.streak_boss_raids(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  display_name text NOT NULL DEFAULT 'Pemain',
  damage_dealt integer NOT NULL DEFAULT 0,
  total_damage integer NOT NULL DEFAULT 0,
  attack_count integer NOT NULL DEFAULT 0,
  coins_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(raid_id, visitor_id)
);

CREATE INDEX idx_boss_raid_attacks_leaderboard ON public.streak_boss_raid_attacks(raid_id, total_damage DESC);

CREATE TABLE public.streak_boss_raid_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id uuid NOT NULL REFERENCES public.streak_boss_raids(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  reward_coins integer NOT NULL DEFAULT 0,
  rank_position integer,
  contribution_pct numeric(5,2) DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(raid_id, visitor_id)
);

-- ============ STREAK EVENT: EVENT CALENDAR ============
CREATE TABLE public.streak_event_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL,
  event_name text NOT NULL,
  event_description text NOT NULL DEFAULT '',
  event_icon text NOT NULL DEFAULT '🎉',
  event_type text NOT NULL DEFAULT 'xp_boost',
  multiplier numeric(4,2) NOT NULL DEFAULT 1.5,
  bonus_value integer NOT NULL DEFAULT 0,
  color_theme text NOT NULL DEFAULT 'red',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(day_of_week)
);

-- ============ TRIGGERS for updated_at ============
CREATE TRIGGER trg_bp_seasons_updated BEFORE UPDATE ON public.streak_battle_pass_seasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bp_progress_updated BEFORE UPDATE ON public.streak_battle_pass_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tradein_recipes_updated BEFORE UPDATE ON public.streak_tradein_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_limited_skins_updated BEFORE UPDATE ON public.streak_limited_skins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_group_buy_items_updated BEFORE UPDATE ON public.streak_group_buy_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_boss_raids_updated BEFORE UPDATE ON public.streak_boss_raids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_boss_attacks_updated BEFORE UPDATE ON public.streak_boss_raid_attacks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_event_calendar_updated BEFORE UPDATE ON public.streak_event_calendar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS ============
ALTER TABLE public.streak_battle_pass_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_battle_pass_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_battle_pass_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_tradein_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_tradein_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_limited_skins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_skin_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_group_buy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_group_buy_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_boss_raids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_boss_raid_attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_boss_raid_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_event_calendar ENABLE ROW LEVEL SECURITY;

-- Public read on catalog & event tables
CREATE POLICY "public read bp seasons" ON public.streak_battle_pass_seasons FOR SELECT USING (true);
CREATE POLICY "public read bp tiers" ON public.streak_battle_pass_tiers FOR SELECT USING (true);
CREATE POLICY "public read bp progress" ON public.streak_battle_pass_progress FOR SELECT USING (true);
CREATE POLICY "public read tradein recipes" ON public.streak_tradein_recipes FOR SELECT USING (true);
CREATE POLICY "public read tradein history" ON public.streak_tradein_history FOR SELECT USING (true);
CREATE POLICY "public read skins" ON public.streak_limited_skins FOR SELECT USING (true);
CREATE POLICY "public read skin purchases" ON public.streak_skin_purchases FOR SELECT USING (true);
CREATE POLICY "public read group buy items" ON public.streak_group_buy_items FOR SELECT USING (true);
CREATE POLICY "public read group buy purchases" ON public.streak_group_buy_purchases FOR SELECT USING (true);
CREATE POLICY "public read boss raids" ON public.streak_boss_raids FOR SELECT USING (true);
CREATE POLICY "public read boss attacks" ON public.streak_boss_raid_attacks FOR SELECT USING (true);
CREATE POLICY "public read boss rewards" ON public.streak_boss_raid_rewards FOR SELECT USING (true);
CREATE POLICY "public read event calendar" ON public.streak_event_calendar FOR SELECT USING (true);

-- ============ SEED DATA ============
-- Battle Pass Season
INSERT INTO public.streak_battle_pass_seasons (name, description, premium_cost_coins)
VALUES ('Season Carnival', 'Battle Pass perdana dengan 10 tier reward meriah!', 500);

-- Tiers (10 tier)
INSERT INTO public.streak_battle_pass_tiers (season_id, tier_number, required_spent_coins, free_reward_type, free_reward_value, free_reward_label, free_reward_icon, premium_reward_type, premium_reward_value, premium_reward_label, premium_reward_icon)
SELECT s.id, t.tier, t.spent, t.frt, t.frv, t.frl, t.fri, t.prt, t.prv, t.prl, t.pri
FROM public.streak_battle_pass_seasons s
CROSS JOIN (VALUES
  (1, 50,    'auto_hint',     1, '+1 Hint',           '💡', 'auto_hint',     3, '+3 Hint',           '💡'),
  (2, 100,   'extra_life',    1, '+1 Nyawa',          '❤️', 'extra_life',    3, '+3 Nyawa',          '❤️'),
  (3, 200,   'streak_freeze', 1, '+1 Freeze',         '🧊', 'streak_freeze', 2, '+2 Freeze',         '🧊'),
  (4, 350,   'time_freeze',   1, '+1 Time Freeze',    '⏱️', 'time_freeze',   3, '+3 Time Freeze',    '⏱️'),
  (5, 500,   'auto_hint',     3, '+3 Hint',           '💡', 'double_xp',     6, 'Double XP 6j',      '⚡'),
  (6, 750,   'extra_life',    2, '+2 Nyawa',          '❤️', 'extra_life',    5, '+5 Nyawa',          '❤️'),
  (7, 1000,  'streak_freeze', 2, '+2 Freeze',         '🧊', 'double_xp',    12, 'Double XP 12j',     '⚡'),
  (8, 1500,  'auto_hint',     5, '+5 Hint',           '💡', 'auto_hint',    15, '+15 Hint',          '💡'),
  (9, 2000,  'time_freeze',   3, '+3 Time Freeze',    '⏱️', 'extra_life',   10, '+10 Nyawa',         '❤️'),
  (10, 3000, 'streak_freeze', 3, '+3 Freeze',         '🧊', 'double_xp',    24, 'Double XP 24j MAX', '🌟')
) AS t(tier, spent, frt, frv, frl, fri, prt, prv, prl, pri);

-- Trade-in recipes
INSERT INTO public.streak_tradein_recipes (name, description, icon, input_type, input_amount, output_type, output_amount, output_label, daily_limit, sort_order) VALUES
('Hint → Coins',         'Tukar 5 hint berlebih jadi 50 coins',        '💡', 'auto_hint',     5, 'coins',        50,  '+50 Coins',         3, 1),
('Nyawa → Coins',        'Tukar 3 nyawa berlebih jadi 60 coins',       '❤️', 'extra_life',    3, 'coins',        60,  '+60 Coins',         3, 2),
('Freeze → Coins',       'Tukar 2 freeze jadi 80 coins',               '🧊', 'streak_freeze', 2, 'coins',        80,  '+80 Coins',         2, 3),
('Time Freeze → Hint',   'Tukar 1 time freeze jadi 3 hint',            '⏱️', 'time_freeze',   1, 'auto_hint',    3,   '+3 Hint',           5, 4),
('Coins → Double XP',    'Tukar 200 coins jadi Double XP 2 jam',       '⚡', 'coins',         200, 'double_xp',  2,   'Double XP 2 jam',   2, 5);

-- Limited Edition Skins (Festive Carnival theme)
INSERT INTO public.streak_limited_skins (name, description, skin_type, emoji_fallback, rarity, cost_coins, total_stock, ends_at, sort_order) VALUES
('Frame Karnaval Emas',  'Bingkai avatar emas berkilau edisi karnaval',   'border', '🎪', 'legendary', 2500, 50,  now() + interval '7 days', 1),
('Avatar Pesta Confetti','Avatar dengan efek confetti meriah',            'avatar', '🎉', 'epic',      1500, 100, now() + interval '7 days', 2),
('Frame Pita Merah',     'Bingkai pita merah & kuning festive',            'border', '🎀', 'rare',      800,  200, now() + interval '7 days', 3),
('Avatar Topi Pesta',    'Avatar dengan topi pesta lucu',                  'avatar', '🥳', 'rare',      600,  200, now() + interval '7 days', 4),
('Frame Bintang Karnaval','Bingkai bintang berputar emas',                 'border', '⭐', 'epic',      1800, 80,  now() + interval '7 days', 5);

-- Group Buy Items
INSERT INTO public.streak_group_buy_items (name, description, icon, reward_type, reward_value, reward_label, base_cost_coins, tier1_buyers, tier1_discount_pct, tier2_buyers, tier2_discount_pct, tier3_buyers, tier3_discount_pct, sort_order) VALUES
('Bundle Hint Massal',    'Beli rame-rame, diskon makin gede!',  '💡', 'auto_hint',     10, '+10 Hint',          300, 5, 15, 15, 30, 30, 50, 1),
('Bundle Nyawa Massal',   '+5 Nyawa, harga makin murah rame-rame','❤️', 'extra_life',    5,  '+5 Nyawa',          400, 5, 15, 15, 30, 30, 50, 2),
('Bundle Freeze Massal',  '+3 Freeze, group buy ekonomis',        '🧊', 'streak_freeze', 3,  '+3 Freeze',         500, 5, 20, 15, 35, 30, 55, 3),
('Bundle Double XP Pesta','Double XP 8 jam, diskon komunitas',    '⚡', 'double_xp',     8,  'Double XP 8 jam',   600, 10, 20, 25, 40, 50, 60, 4);

-- Boss Raid (1 active raid)
INSERT INTO public.streak_boss_raids (boss_name, boss_description, boss_emoji, total_hp, current_hp, attack_cost_coins, damage_per_attack, victory_reward_pool, participation_reward, ends_at) VALUES
('Naga Karnaval Agung', 'Boss raksasa! Serang bareng komunitas untuk dapat reward besar!', '🐲', 500000, 500000, 10, 250, 50000, 100, now() + interval '7 days');

-- Event Calendar (7 hari)
INSERT INTO public.streak_event_calendar (day_of_week, event_name, event_description, event_icon, event_type, multiplier, bonus_value, color_theme, sort_order) VALUES
(1, 'Senin XP Boost',     'Klaim streak hari ini dapat XP 2x lipat!',          '⚡', 'xp_boost',     2.0, 0,   'yellow', 1),
(2, 'Selasa Coin Rain',   'Bonus +50 coins setiap klaim streak hari ini!',     '💰', 'coin_bonus',   1.0, 50,  'green',  2),
(3, 'Rabu Game Frenzy',   'Reward game 1.5x lipat seharian!',                  '🎮', 'game_boost',   1.5, 0,   'blue',   3),
(4, 'Kamis Mystery Day',  'Diskon 30% di Mystery Box hari ini!',                '🎁', 'mystery_disc', 0.7, 0,   'purple', 4),
(5, 'Jumat Flash Deal',   'Flash deal eksklusif aktif hari ini!',              '⚡', 'flash_deal',   1.0, 0,   'orange', 5),
(6, 'Sabtu Boss Raid',    'Damage ke boss 2x lipat seharian!',                  '🐲', 'boss_boost',   2.0, 0,   'red',    6),
(0, 'Minggu Mega Bonus',  'Bonus coin streak 3x + free spin tambahan!',        '🌟', 'mega_bonus',   3.0, 100, 'pink',   0);