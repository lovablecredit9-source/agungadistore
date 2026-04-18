
-- ============================================
-- BATCH 1: Daily Gift Box, Streak Pass, Weekly Quest, Smart Reminder
-- ============================================

-- 1. DAILY GIFT BOX (7 hari progressive reward, reset weekly)
CREATE TABLE public.daily_gift_box_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number integer NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  reward_type text NOT NULL, -- streak_coins | bonus_points | freeze_token | game_credit | mystery
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🎁',
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(day_number, is_premium)
);

CREATE TABLE public.daily_gift_box_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  week_start date NOT NULL, -- Senin WIB
  day_number integer NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, week_start, day_number)
);

CREATE INDEX idx_gift_box_claims_visitor_week ON public.daily_gift_box_claims(visitor_id, week_start);

ALTER TABLE public.daily_gift_box_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_gift_box_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gift box rewards viewable by everyone" ON public.daily_gift_box_rewards FOR SELECT USING (true);
CREATE POLICY "Admin manage gift box rewards" ON public.daily_gift_box_rewards FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "Gift box claims viewable by everyone" ON public.daily_gift_box_claims FOR SELECT USING (true);
CREATE POLICY "Anyone can insert gift box claim" ON public.daily_gift_box_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can delete gift box claims" ON public.daily_gift_box_claims FOR DELETE TO authenticated USING (is_admin_user());

CREATE TRIGGER trg_gift_box_rewards_updated BEFORE UPDATE ON public.daily_gift_box_rewards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. STREAK PASS (Battle Pass)
CREATE TABLE public.streak_pass_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  premium_price bigint NOT NULL DEFAULT 25000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.streak_pass_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.streak_pass_seasons(id) ON DELETE CASCADE,
  tier_level integer NOT NULL CHECK (tier_level >= 1),
  xp_required integer NOT NULL DEFAULT 100,
  free_reward_type text, -- nullable: tier free bisa kosong
  free_reward_value integer DEFAULT 0,
  free_reward_label text DEFAULT '',
  free_reward_icon text DEFAULT '🎁',
  premium_reward_type text,
  premium_reward_value integer DEFAULT 0,
  premium_reward_label text DEFAULT '',
  premium_reward_icon text DEFAULT '💎',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id, tier_level)
);

CREATE TABLE public.streak_pass_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  season_id uuid NOT NULL REFERENCES public.streak_pass_seasons(id) ON DELETE CASCADE,
  total_xp integer NOT NULL DEFAULT 0,
  is_premium boolean NOT NULL DEFAULT false,
  premium_purchased_at timestamptz,
  claimed_free_tiers integer[] NOT NULL DEFAULT '{}',
  claimed_premium_tiers integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, season_id)
);

CREATE INDEX idx_streak_pass_progress_visitor ON public.streak_pass_progress(visitor_id);

ALTER TABLE public.streak_pass_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_pass_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_pass_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pass seasons viewable" ON public.streak_pass_seasons FOR SELECT USING (true);
CREATE POLICY "Admin manage pass seasons" ON public.streak_pass_seasons FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "Pass tiers viewable" ON public.streak_pass_tiers FOR SELECT USING (true);
CREATE POLICY "Admin manage pass tiers" ON public.streak_pass_tiers FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "Pass progress viewable" ON public.streak_pass_progress FOR SELECT USING (true);
CREATE POLICY "Anyone insert pass progress" ON public.streak_pass_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update pass progress" ON public.streak_pass_progress FOR UPDATE USING (true);
CREATE POLICY "Admin delete pass progress" ON public.streak_pass_progress FOR DELETE TO authenticated USING (is_admin_user());

CREATE TRIGGER trg_pass_seasons_updated BEFORE UPDATE ON public.streak_pass_seasons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pass_progress_updated BEFORE UPDATE ON public.streak_pass_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. WEEKLY QUESTS
CREATE TABLE public.weekly_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  quest_type text NOT NULL, -- game_play | game_win | streak_claim | mystery_box | spin_wheel | gift_box | game_points
  target_value integer NOT NULL DEFAULT 1,
  reward_coins integer NOT NULL DEFAULT 50,
  reward_xp integer NOT NULL DEFAULT 100, -- XP untuk Streak Pass
  icon text NOT NULL DEFAULT '🎯',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.weekly_quest_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  quest_id uuid NOT NULL REFERENCES public.weekly_quests(id) ON DELETE CASCADE,
  week_start date NOT NULL, -- Senin WIB
  current_value integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, quest_id, week_start)
);

CREATE INDEX idx_weekly_quest_progress_visitor_week ON public.weekly_quest_progress(visitor_id, week_start);

ALTER TABLE public.weekly_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_quest_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Weekly quests viewable" ON public.weekly_quests FOR SELECT USING (true);
CREATE POLICY "Admin manage weekly quests" ON public.weekly_quests FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "Weekly quest progress viewable" ON public.weekly_quest_progress FOR SELECT USING (true);
CREATE POLICY "Anyone insert weekly quest progress" ON public.weekly_quest_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update weekly quest progress" ON public.weekly_quest_progress FOR UPDATE USING (true);
CREATE POLICY "Admin delete weekly quest progress" ON public.weekly_quest_progress FOR DELETE TO authenticated USING (is_admin_user());

CREATE TRIGGER trg_weekly_quests_updated BEFORE UPDATE ON public.weekly_quests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_weekly_quest_progress_updated BEFORE UPDATE ON public.weekly_quest_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. SMART REMINDER
CREATE TABLE public.streak_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT false,
  preferred_hour integer NOT NULL DEFAULT 19 CHECK (preferred_hour BETWEEN 0 AND 23),
  preferred_minute integer NOT NULL DEFAULT 0 CHECK (preferred_minute BETWEEN 0 AND 59),
  smart_mode boolean NOT NULL DEFAULT true, -- pakai jam klaim rata-rata user
  last_notified_date date,
  notify_browser boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reminders viewable by everyone" ON public.streak_reminders FOR SELECT USING (true);
CREATE POLICY "Anyone insert reminders" ON public.streak_reminders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update reminders" ON public.streak_reminders FOR UPDATE USING (true);
CREATE POLICY "Admin delete reminders" ON public.streak_reminders FOR DELETE TO authenticated USING (is_admin_user());

CREATE TRIGGER trg_streak_reminders_updated BEFORE UPDATE ON public.streak_reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SEED DATA
-- ============================================

-- 7 hari Daily Gift Box (free tier)
INSERT INTO public.daily_gift_box_rewards (day_number, reward_type, reward_value, reward_label, icon, is_premium) VALUES
(1, 'streak_coins', 20, '+20 Streak Coins', '🪙', false),
(2, 'streak_coins', 35, '+35 Streak Coins', '✨', false),
(3, 'bonus_points', 50, '+50 Poin Bonus', '💫', false),
(4, 'streak_coins', 75, '+75 Streak Coins', '🎁', false),
(5, 'game_credit', 5, '+5 Game Credit', '🎮', false),
(6, 'freeze_token', 1, '+1 Streak Freeze', '🛡️', false),
(7, 'mystery', 0, '🎉 Hadiah Spesial Mystery', '👑', false);

-- Premium gifts (untuk Streak Pass premium owner)
INSERT INTO public.daily_gift_box_rewards (day_number, reward_type, reward_value, reward_label, icon, is_premium) VALUES
(1, 'streak_coins', 50, '+50 Streak Coins (Premium)', '💎', true),
(2, 'streak_coins', 80, '+80 Streak Coins (Premium)', '💎', true),
(3, 'bonus_points', 120, '+120 Poin Bonus (Premium)', '💎', true),
(4, 'streak_coins', 150, '+150 Streak Coins (Premium)', '💎', true),
(5, 'game_credit', 15, '+15 Game Credit (Premium)', '💎', true),
(6, 'freeze_token', 3, '+3 Streak Freeze (Premium)', '💎', true),
(7, 'mystery', 0, '👑 LEGENDARY Reward', '👑', true);

-- Streak Pass Season 1 (30 hari ke depan)
INSERT INTO public.streak_pass_seasons (id, name, description, ends_at, premium_price)
VALUES ('00000000-0000-0000-0000-000000000001', 'Season 1: Awakening', 'Season pertama Streak Pass! Naik tier dengan klaim, main game, dan menyelesaikan quest.', now() + interval '30 days', 25000)
ON CONFLICT (id) DO NOTHING;

-- 20 tier untuk Season 1
INSERT INTO public.streak_pass_tiers (season_id, tier_level, xp_required, free_reward_type, free_reward_value, free_reward_label, free_reward_icon, premium_reward_type, premium_reward_value, premium_reward_label, premium_reward_icon)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  lvl,
  lvl * 150,
  CASE WHEN lvl % 2 = 0 THEN 'streak_coins' ELSE NULL END,
  CASE WHEN lvl % 2 = 0 THEN 25 + lvl * 5 ELSE 0 END,
  CASE WHEN lvl % 2 = 0 THEN '+' || (25 + lvl * 5) || ' Coins' ELSE '' END,
  '🪙',
  CASE
    WHEN lvl % 5 = 0 THEN 'game_credit'
    WHEN lvl % 3 = 0 THEN 'freeze_token'
    ELSE 'streak_coins'
  END,
  CASE
    WHEN lvl % 5 = 0 THEN 10
    WHEN lvl % 3 = 0 THEN 1
    ELSE 50 + lvl * 10
  END,
  CASE
    WHEN lvl % 5 = 0 THEN '+10 Game Credit'
    WHEN lvl % 3 = 0 THEN '+1 Streak Freeze'
    ELSE '+' || (50 + lvl * 10) || ' Coins'
  END,
  CASE
    WHEN lvl % 5 = 0 THEN '🎮'
    WHEN lvl % 3 = 0 THEN '🛡️'
    ELSE '💎'
  END
FROM generate_series(1, 20) AS lvl;

-- 6 Weekly Quests
INSERT INTO public.weekly_quests (title, description, quest_type, target_value, reward_coins, reward_xp, icon, sort_order) VALUES
('Pemain Setia', 'Klaim streak harian 5 kali minggu ini', 'streak_claim', 5, 100, 200, '🔥', 1),
('Gamer Mingguan', 'Mainkan 20 game minggu ini', 'game_play', 20, 150, 250, '🎮', 2),
('Juara Sejati', 'Menang 10 game minggu ini', 'game_win', 10, 200, 300, '🏆', 3),
('Pemburu Mystery', 'Buka Mystery Box 5 kali minggu ini', 'mystery_box', 5, 80, 150, '🎁', 4),
('Spin Master', 'Spin Wheel 7 kali minggu ini', 'spin_wheel', 7, 120, 200, '🎡', 5),
('Kolektor Hadiah', 'Klaim Daily Gift Box 5 kali minggu ini', 'gift_box', 5, 100, 200, '🎁', 6);
