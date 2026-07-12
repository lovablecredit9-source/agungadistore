ALTER TABLE public.daily_challenges
  ADD COLUMN IF NOT EXISTS reward_saldo_in integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_gems integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '🎯';

UPDATE public.daily_challenges
SET icon = CASE challenge_type
  WHEN 'game_play' THEN '🎮'
  WHEN 'game_win' THEN '🏆'
  WHEN 'music_listen' THEN '🎧'
  WHEN 'purchase' THEN '🛍️'
  WHEN 'spin_wheel' THEN '🎡'
  WHEN 'streak_claim' THEN '🔥'
  WHEN 'mystery_box' THEN '🎁'
  WHEN 'game_points' THEN '💎'
  ELSE icon
END
WHERE icon = '🎯' OR icon IS NULL;

UPDATE public.daily_challenges
SET reward_saldo_in = 15, reward_gems = 3, reward_coins = GREATEST(reward_coins, 10), icon = '🎮', title = '🎮 Main Game', description = 'Main 3 sesi game hari ini', target_value = 3, sort_order = 1, is_active = true
WHERE challenge_type = 'game_play';

UPDATE public.daily_challenges
SET reward_saldo_in = 10, reward_gems = 2, reward_coins = GREATEST(reward_coins, 10), icon = '🎧', title = '🎧 Dengar Musik', description = 'Dengarkan musik 5 kali progres hari ini', target_value = 5, sort_order = 2, is_active = true
WHERE challenge_type = 'music_listen';

UPDATE public.daily_challenges
SET reward_saldo_in = 25, reward_gems = 5, reward_coins = GREATEST(reward_coins, 15), icon = '🛍️', title = '🛍️ Belanja Produk', description = 'Beli 1 produk pakai saldo hari ini', target_value = 1, sort_order = 3, is_active = true
WHERE challenge_type = 'purchase';

INSERT INTO public.daily_challenges (title, description, challenge_type, target_value, reward_coins, reward_saldo_in, reward_gems, icon, sort_order, is_active)
SELECT '🎧 Dengar Musik', 'Dengarkan musik 5 kali progres hari ini', 'music_listen', 5, 10, 10, 2, '🎧', 2, true
WHERE NOT EXISTS (SELECT 1 FROM public.daily_challenges WHERE challenge_type = 'music_listen');

INSERT INTO public.daily_challenges (title, description, challenge_type, target_value, reward_coins, reward_saldo_in, reward_gems, icon, sort_order, is_active)
SELECT '🛍️ Belanja Produk', 'Beli 1 produk pakai saldo hari ini', 'purchase', 1, 15, 25, 5, '🛍️', 3, true
WHERE NOT EXISTS (SELECT 1 FROM public.daily_challenges WHERE challenge_type = 'purchase');

INSERT INTO public.daily_challenges (title, description, challenge_type, target_value, reward_coins, reward_saldo_in, reward_gems, icon, sort_order, is_active)
SELECT '🎡 Putar Spin', 'Putar roda/luck spin 1 kali hari ini', 'spin_wheel', 1, 10, 10, 2, '🎡', 4, true
WHERE NOT EXISTS (SELECT 1 FROM public.daily_challenges WHERE challenge_type = 'spin_wheel');

INSERT INTO public.daily_challenges (title, description, challenge_type, target_value, reward_coins, reward_saldo_in, reward_gems, icon, sort_order, is_active)
SELECT '🔥 Klaim Streak', 'Klaim streak harian untuk bonus kecil', 'streak_claim', 1, 10, 10, 2, '🔥', 5, true
WHERE NOT EXISTS (SELECT 1 FROM public.daily_challenges WHERE challenge_type = 'streak_claim');

INSERT INTO public.daily_challenges (title, description, challenge_type, target_value, reward_coins, reward_saldo_in, reward_gems, icon, sort_order, is_active)
SELECT '🎁 Buka Hadiah', 'Buka mystery/gift box harian', 'mystery_box', 1, 10, 10, 2, '🎁', 6, true
WHERE NOT EXISTS (SELECT 1 FROM public.daily_challenges WHERE challenge_type = 'mystery_box');