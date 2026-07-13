
CREATE TABLE public.monthly_quests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  quest_type text NOT NULL,
  target_value integer NOT NULL DEFAULT 1,
  reward_coins integer NOT NULL DEFAULT 100,
  reward_xp integer NOT NULL DEFAULT 200,
  reward_saldo_in integer NOT NULL DEFAULT 0,
  reward_gems integer NOT NULL DEFAULT 0,
  icon text NOT NULL DEFAULT '🗓️',
  difficulty text NOT NULL DEFAULT 'normal',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.monthly_quest_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  quest_id uuid NOT NULL,
  month_start date NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, quest_id, month_start)
);

GRANT SELECT ON public.monthly_quests TO anon, authenticated;
GRANT ALL ON public.monthly_quests TO service_role;
GRANT SELECT ON public.monthly_quest_progress TO anon, authenticated;
GRANT ALL ON public.monthly_quest_progress TO service_role;

ALTER TABLE public.monthly_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_quest_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active monthly quests"
  ON public.monthly_quests FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view monthly quest progress"
  ON public.monthly_quest_progress FOR SELECT
  USING (true);

CREATE TRIGGER update_monthly_quests_updated_at
  BEFORE UPDATE ON public.monthly_quests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_quest_progress_updated_at
  BEFORE UPDATE ON public.monthly_quest_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.monthly_quests (title, description, quest_type, target_value, reward_coins, reward_xp, reward_saldo_in, reward_gems, icon, difficulty, sort_order) VALUES
  ('Maraton Game', 'Main game apa saja sebanyak 100 kali bulan ini', 'game_play', 100, 500, 500, 0, 30, '🎮', 'normal', 1),
  ('Sang Juara', 'Menangkan game sebanyak 40 kali bulan ini', 'game_win', 40, 800, 600, 0, 50, '🏆', 'susah', 2),
  ('Pendengar Setia', 'Dengarkan 60 lagu berbeda (min 2 menit) bulan ini', 'music_listen', 60, 600, 500, 0, 40, '🎧', 'normal', 3),
  ('Raja Spin', 'Putar roda keberuntungan 50 kali bulan ini', 'spin_wheel', 50, 500, 400, 0, 35, '🎡', 'normal', 4),
  ('Streak Konsisten', 'Klaim streak harian 25 kali bulan ini', 'streak_claim', 25, 700, 500, 0, 45, '🔥', 'susah', 5),
  ('Pemburu Kotak', 'Buka 20 mystery box bulan ini', 'mystery_box', 20, 400, 350, 0, 30, '🎁', 'normal', 6),
  ('Kolektor Poin', 'Kumpulkan 20.000 poin game bulan ini', 'game_points', 20000, 600, 450, 0, 40, '💎', 'susah', 7),
  ('Sultan Belanja', 'Belanja 10 kali bulan ini', 'purchase', 10, 1000, 800, 5000, 60, '🛍️', 'ekstrem', 8),
  ('Gacor Gift Box', 'Klaim gift box harian 20 kali bulan ini', 'gift_box', 20, 400, 350, 0, 30, '🎀', 'normal', 9),
  ('Gosok Beruntung', 'Mainkan scratch card 25 kali bulan ini', 'scratch_card', 25, 450, 350, 0, 30, '🎫', 'normal', 10),
  ('Lucky Draw Maniak', 'Ikut lucky draw 30 kali bulan ini', 'lucky_draw', 30, 500, 400, 0, 35, '🍀', 'susah', 11),
  ('Legenda Bulan Ini', 'Menangkan game sebanyak 100 kali bulan ini', 'game_win', 100, 2000, 1500, 10000, 150, '👑', 'mustahil', 12);
