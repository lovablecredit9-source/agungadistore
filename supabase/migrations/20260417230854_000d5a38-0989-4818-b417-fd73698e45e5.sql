-- ============================================
-- NEON REVAMP: Streak Multiplier, Mystery Box, 
-- Streak Shop, Weekly Challenge, Game Achievements,
-- Daily Challenge Game, Tournament
-- ============================================

-- 1) Add multiplier to daily_streaks
ALTER TABLE public.daily_streaks 
  ADD COLUMN IF NOT EXISTS current_multiplier numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak_coins integer NOT NULL DEFAULT 0;

-- 2) Mystery Box Claims
CREATE TABLE IF NOT EXISTS public.mystery_box_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  claim_date date NOT NULL DEFAULT CURRENT_DATE,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  rarity text NOT NULL DEFAULT 'common',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, claim_date)
);
ALTER TABLE public.mystery_box_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mystery box claims viewable" ON public.mystery_box_claims FOR SELECT USING (true);
CREATE POLICY "Anyone can insert mystery box claims" ON public.mystery_box_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can delete mystery box claims" ON public.mystery_box_claims FOR DELETE TO authenticated USING (is_admin_user());

-- 3) Streak Shop Items (admin managed)
CREATE TABLE IF NOT EXISTS public.streak_shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🎁',
  cost_coins integer NOT NULL DEFAULT 100,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT -1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Streak shop items viewable" ON public.streak_shop_items FOR SELECT USING (true);
CREATE POLICY "Admin manage streak shop items" ON public.streak_shop_items FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

-- 4) Streak Shop Redemptions
CREATE TABLE IF NOT EXISTS public.streak_shop_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  item_id uuid NOT NULL REFERENCES public.streak_shop_items(id) ON DELETE CASCADE,
  cost_coins integer NOT NULL DEFAULT 0,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  reward_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_shop_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Redemptions viewable" ON public.streak_shop_redemptions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert redemptions" ON public.streak_shop_redemptions FOR INSERT WITH CHECK (true);

-- 5) Weekly Challenges
CREATE TABLE IF NOT EXISTS public.weekly_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  challenge_type text NOT NULL,
  target_value integer NOT NULL DEFAULT 1,
  reward_coins integer NOT NULL DEFAULT 100,
  reward_label text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Weekly challenges viewable" ON public.weekly_challenges FOR SELECT USING (true);
CREATE POLICY "Admin manage weekly challenges" ON public.weekly_challenges FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

-- 6) Weekly Challenge Progress
CREATE TABLE IF NOT EXISTS public.weekly_challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.weekly_challenges(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, visitor_id)
);
ALTER TABLE public.weekly_challenge_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Progress viewable" ON public.weekly_challenge_progress FOR SELECT USING (true);
CREATE POLICY "Anyone insert progress" ON public.weekly_challenge_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update progress" ON public.weekly_challenge_progress FOR UPDATE USING (true);

-- 7) Game Achievements
CREATE TABLE IF NOT EXISTS public.game_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  achievement_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, achievement_key)
);
ALTER TABLE public.game_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements viewable" ON public.game_achievements FOR SELECT USING (true);
CREATE POLICY "Anyone unlock achievements" ON public.game_achievements FOR INSERT WITH CHECK (true);

-- 8) Tournaments
CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Tournament Mingguan',
  description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  prize_first integer NOT NULL DEFAULT 50,
  prize_second integer NOT NULL DEFAULT 30,
  prize_third integer NOT NULL DEFAULT 20,
  is_active boolean NOT NULL DEFAULT true,
  is_settled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournaments viewable" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admin manage tournaments" ON public.tournaments FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

-- 9) Tournament Entries
CREATE TABLE IF NOT EXISTS public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  total_points integer NOT NULL DEFAULT 0,
  total_wins integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, visitor_id)
);
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Entries viewable" ON public.tournament_entries FOR SELECT USING (true);
CREATE POLICY "Anyone insert entries" ON public.tournament_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update entries" ON public.tournament_entries FOR UPDATE USING (true);

-- Seed a few default streak shop items
INSERT INTO public.streak_shop_items (name, description, icon, cost_coins, reward_type, reward_value, sort_order) VALUES
  ('Voucher Diskon 5K', 'Potongan harga Rp 5.000', '🎟️', 500, 'discount_voucher', 5000, 1),
  ('Voucher Diskon 10K', 'Potongan harga Rp 10.000', '💎', 950, 'discount_voucher', 10000, 2),
  ('10 Credit Game', 'Tambahan 10 kredit untuk main game AI', '🎮', 800, 'game_credit', 10, 3),
  ('100MB Storage Musik', 'Tambahan kapasitas musik', '☁️', 700, 'music_storage', 100, 4),
  ('Streak Freeze 1x', 'Lindungi streak 1 hari', '❄️', 1500, 'streak_freeze', 1, 5),
  ('25 Credit Game', 'Tambahan 25 kredit', '🕹️', 1800, 'game_credit', 25, 6)
ON CONFLICT DO NOTHING;

-- Seed default weekly challenges
INSERT INTO public.weekly_challenges (title, description, challenge_type, target_value, reward_coins, reward_label) VALUES
  ('Pejuang Login', 'Login & claim streak 5 hari minggu ini', 'streak_claim', 5, 500, '500 Streak Coins'),
  ('Game Maniac', 'Menangkan 10 game minggu ini', 'game_wins', 10, 800, '800 Streak Coins'),
  ('Mystery Hunter', 'Buka 5 mystery box minggu ini', 'mystery_open', 5, 600, '600 Streak Coins')
ON CONFLICT DO NOTHING;

-- Active tournament
INSERT INTO public.tournaments (name, description, starts_at, ends_at) VALUES
  ('Cyber Arena Weekly', 'Kumpulkan poin terbanyak minggu ini! Top 3 dapat credit game.', now(), now() + interval '7 days')
ON CONFLICT DO NOTHING;