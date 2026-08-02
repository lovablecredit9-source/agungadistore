-- 1. Progression
CREATE TABLE public.profile_progression (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL UNIQUE,
  xp BIGINT NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  weekly_xp BIGINT NOT NULL DEFAULT 0,
  monthly_xp BIGINT NOT NULL DEFAULT 0,
  weekly_reset_at DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  monthly_reset_at DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  total_activities INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profile_progression TO anon, authenticated;
GRANT ALL ON public.profile_progression TO service_role;
ALTER TABLE public.profile_progression ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Progression viewable by everyone" ON public.profile_progression FOR SELECT USING (true);
CREATE POLICY "Anyone can create progression" ON public.profile_progression FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update progression" ON public.profile_progression FOR UPDATE USING (true);
CREATE POLICY "Admin can delete progression" ON public.profile_progression FOR DELETE USING (is_admin_user());

-- 2. Level history
CREATE TABLE public.profile_level_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  from_level INTEGER NOT NULL,
  to_level INTEGER NOT NULL,
  reward_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_level_history_visitor ON public.profile_level_history(visitor_id, created_at DESC);
GRANT SELECT, INSERT ON public.profile_level_history TO anon, authenticated;
GRANT ALL ON public.profile_level_history TO service_role;
ALTER TABLE public.profile_level_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Level history viewable by everyone" ON public.profile_level_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert level history" ON public.profile_level_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can delete level history" ON public.profile_level_history FOR DELETE USING (is_admin_user());

-- 3. Achievements
CREATE TABLE public.profile_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  unlocked BOOLEAN NOT NULL DEFAULT false,
  unlocked_at TIMESTAMPTZ,
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, achievement_id)
);
CREATE INDEX idx_profile_achievements_visitor ON public.profile_achievements(visitor_id);
GRANT SELECT, INSERT, UPDATE ON public.profile_achievements TO anon, authenticated;
GRANT ALL ON public.profile_achievements TO service_role;
ALTER TABLE public.profile_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements viewable by everyone" ON public.profile_achievements FOR SELECT USING (true);
CREATE POLICY "Anyone can create achievements" ON public.profile_achievements FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update achievements" ON public.profile_achievements FOR UPDATE USING (true);
CREATE POLICY "Admin can delete achievements" ON public.profile_achievements FOR DELETE USING (is_admin_user());

-- 4. Equipped badges
CREATE TABLE public.profile_equipped_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  slot INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, badge_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_equipped_badges TO anon, authenticated;
GRANT ALL ON public.profile_equipped_badges TO service_role;
ALTER TABLE public.profile_equipped_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipped badges viewable by everyone" ON public.profile_equipped_badges FOR SELECT USING (true);
CREATE POLICY "Anyone can equip badge" ON public.profile_equipped_badges FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update equipped badge" ON public.profile_equipped_badges FOR UPDATE USING (true);
CREATE POLICY "Anyone can unequip badge" ON public.profile_equipped_badges FOR DELETE USING (true);

-- 5. Reward inbox (Pusat Hadiah)
CREATE TABLE public.profile_reward_inbox (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL,
  reward_amount BIGINT NOT NULL DEFAULT 0,
  reward_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reward_inbox_visitor ON public.profile_reward_inbox(visitor_id, claimed, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.profile_reward_inbox TO anon, authenticated;
GRANT ALL ON public.profile_reward_inbox TO service_role;
ALTER TABLE public.profile_reward_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reward inbox viewable by everyone" ON public.profile_reward_inbox FOR SELECT USING (true);
CREATE POLICY "Anyone can create reward inbox" ON public.profile_reward_inbox FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update reward inbox" ON public.profile_reward_inbox FOR UPDATE USING (true);
CREATE POLICY "Admin can delete reward inbox" ON public.profile_reward_inbox FOR DELETE USING (is_admin_user());

-- updated_at triggers
CREATE TRIGGER trg_profile_progression_updated BEFORE UPDATE ON public.profile_progression
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profile_achievements_updated BEFORE UPDATE ON public.profile_achievements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();