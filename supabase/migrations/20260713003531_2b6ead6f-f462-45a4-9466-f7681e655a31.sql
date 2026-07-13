UPDATE public.daily_challenges SET target_value = 10000, title = 'Kumpul 10.000 Poin Game', description = 'Kumpulkan 10.000 poin dari game hari ini', reward_coins = 50, reward_gems = 25, reward_saldo_in = 2500, difficulty = 'susah', icon = 'gem', sort_order = 5 WHERE id = 'dd7b87b9-2868-485a-8157-8d5960ee5445';

INSERT INTO public.daily_challenges (challenge_type, title, description, target_value, reward_coins, reward_gems, reward_saldo_in, icon, difficulty, sort_order, is_active) VALUES
('game_points', 'Kumpul 100.000 Poin Game', 'Kumpulkan 100.000 poin dari game hari ini', 100000, 150, 75, 7500, 'gem', 'ekstrem', 30, true),
('game_points', 'Kumpul 1.000.000 Poin Game', 'Kumpulkan 1.000.000 poin dari game hari ini', 1000000, 500, 250, 25000, 'crown', 'mustahil', 31, true);