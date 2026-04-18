
-- Spin wheel daily attempts
CREATE TABLE IF NOT EXISTS public.spin_wheel_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  spin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reward_type TEXT NOT NULL,
  reward_value INTEGER NOT NULL DEFAULT 0,
  reward_label TEXT NOT NULL DEFAULT '',
  rarity TEXT NOT NULL DEFAULT 'common',
  cost_coins INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spin_wheel_visitor_date ON public.spin_wheel_history(visitor_id, spin_date);
ALTER TABLE public.spin_wheel_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spin history viewable by everyone" ON public.spin_wheel_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert spin history" ON public.spin_wheel_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can delete spin history" ON public.spin_wheel_history FOR DELETE USING (is_admin_user());

-- Streak Milestones (admin-configured rewards)
CREATE TABLE IF NOT EXISTS public.streak_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_days INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reward_type TEXT NOT NULL DEFAULT 'coins',
  reward_value INTEGER NOT NULL DEFAULT 0,
  badge_icon TEXT NOT NULL DEFAULT '🏆',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Milestones viewable by everyone" ON public.streak_milestones FOR SELECT USING (true);
CREATE POLICY "Admin manage milestones" ON public.streak_milestones FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE TABLE IF NOT EXISTS public.streak_milestone_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  milestone_id UUID NOT NULL REFERENCES public.streak_milestones(id) ON DELETE CASCADE,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, milestone_id)
);
CREATE INDEX IF NOT EXISTS idx_milestone_claims_visitor ON public.streak_milestone_claims(visitor_id);
ALTER TABLE public.streak_milestone_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Milestone claims viewable by everyone" ON public.streak_milestone_claims FOR SELECT USING (true);
CREATE POLICY "Anyone can insert milestone claims" ON public.streak_milestone_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can delete milestone claims" ON public.streak_milestone_claims FOR DELETE USING (is_admin_user());

-- Active boosters per visitor
CREATE TABLE IF NOT EXISTS public.streak_active_boosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  booster_type TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_active_boosters_visitor ON public.streak_active_boosters(visitor_id, expires_at);
ALTER TABLE public.streak_active_boosters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active boosters viewable by everyone" ON public.streak_active_boosters FOR SELECT USING (true);
CREATE POLICY "Anyone can insert boosters" ON public.streak_active_boosters FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update boosters" ON public.streak_active_boosters FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete boosters" ON public.streak_active_boosters FOR DELETE USING (true);

-- Streak avatar evolution stages (admin configurable)
CREATE TABLE IF NOT EXISTS public.streak_avatar_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_streak INTEGER NOT NULL UNIQUE,
  stage_name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🥚',
  color_from TEXT NOT NULL DEFAULT '#888',
  color_to TEXT NOT NULL DEFAULT '#444',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_avatar_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avatar stages viewable by everyone" ON public.streak_avatar_stages FOR SELECT USING (true);
CREATE POLICY "Admin manage avatar stages" ON public.streak_avatar_stages FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Triggers for updated_at
CREATE TRIGGER update_streak_milestones_updated_at
BEFORE UPDATE ON public.streak_milestones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default milestones
INSERT INTO public.streak_milestones (milestone_days, title, description, reward_type, reward_value, badge_icon) VALUES
(7, 'Pemula Konsisten', 'Streak 7 hari berturut-turut!', 'coins', 100, '🔥'),
(14, 'Streaker Tangguh', 'Streak 2 minggu non-stop!', 'coins', 250, '⚡'),
(30, 'Pejuang 30 Hari', 'Streak sebulan penuh!', 'freeze', 3, '👑'),
(50, 'Master Streak', 'Streak 50 hari!', 'coins', 500, '💎'),
(100, 'Legenda Streak', 'Streak 100 hari! Sebuah pencapaian luar biasa!', 'coins', 1500, '🏆'),
(365, 'Dewa Streak', 'Streak 1 tahun penuh! Anda legenda!', 'coins', 10000, '🌟')
ON CONFLICT (milestone_days) DO NOTHING;

-- Seed default avatar stages
INSERT INTO public.streak_avatar_stages (min_streak, stage_name, emoji, color_from, color_to) VALUES
(0, 'Telur', '🥚', '#fde68a', '#a8a29e'),
(3, 'Anak Ayam', '🐤', '#fde047', '#fbbf24'),
(7, 'Burung Api', '🐦‍🔥', '#fb923c', '#ef4444'),
(14, 'Phoenix Muda', '🦅', '#f97316', '#dc2626'),
(30, 'Phoenix Sejati', '🔥', '#ef4444', '#a855f7'),
(50, 'Naga Api', '🐉', '#a855f7', '#ec4899'),
(100, 'Dewa Naga', '🐲', '#06b6d4', '#a855f7'),
(365, 'Imortal', '👑', '#fbbf24', '#ec4899')
ON CONFLICT (min_streak) DO NOTHING;
