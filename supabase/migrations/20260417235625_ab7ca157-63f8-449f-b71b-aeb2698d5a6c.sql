-- Daily challenges table (admin-defined daily missions)
CREATE TABLE public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  challenge_type text NOT NULL,
  target_value integer NOT NULL DEFAULT 1,
  reward_coins integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily challenges viewable by everyone"
  ON public.daily_challenges FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert daily challenges"
  ON public.daily_challenges FOR INSERT TO authenticated WITH CHECK (is_admin_user());
CREATE POLICY "Admin can update daily challenges"
  ON public.daily_challenges FOR UPDATE TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "Admin can delete daily challenges"
  ON public.daily_challenges FOR DELETE TO authenticated USING (is_admin_user());

CREATE TRIGGER update_daily_challenges_updated_at
  BEFORE UPDATE ON public.daily_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Daily challenge progress (per visitor per day)
CREATE TABLE public.daily_challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  challenge_date date NOT NULL DEFAULT CURRENT_DATE,
  current_value integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, visitor_id, challenge_date)
);

ALTER TABLE public.daily_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily progress viewable by everyone"
  ON public.daily_challenge_progress FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert daily progress"
  ON public.daily_challenge_progress FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update daily progress"
  ON public.daily_challenge_progress FOR UPDATE TO public USING (true);
CREATE POLICY "Admin can delete daily progress"
  ON public.daily_challenge_progress FOR DELETE TO authenticated USING (is_admin_user());

CREATE TRIGGER update_daily_challenge_progress_updated_at
  BEFORE UPDATE ON public.daily_challenge_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_daily_chall_prog_visitor_date ON public.daily_challenge_progress(visitor_id, challenge_date);

-- Seed default daily missions
INSERT INTO public.daily_challenges (title, description, challenge_type, target_value, reward_coins, sort_order) VALUES
('🎮 Main 3 Game', 'Selesaikan 3 sesi game apa pun hari ini', 'game_play', 3, 15, 1),
('🏆 Menang 5 Kali', 'Menangkan 5 ronde game hari ini', 'game_win', 5, 25, 2),
('🔥 Klaim Streak Harian', 'Klaim bonus streak harian hari ini', 'streak_claim', 1, 10, 3),
('🎁 Buka Mystery Box', 'Buka mystery box harian', 'mystery_box', 1, 10, 4),
('💎 Kumpul 100 Poin Game', 'Dapatkan 100 poin dari game hari ini', 'game_points', 100, 30, 5);