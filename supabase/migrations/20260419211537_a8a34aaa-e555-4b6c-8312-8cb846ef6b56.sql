-- Reset Daily Gift Box: pakai gem dengan tier 3/5/10/15/20 (5 hari), reset bila skip

-- 1) Tambah kolom streak_day untuk track urutan klaim berturut-turut (independent dari hari kalender)
ALTER TABLE public.daily_gift_box_claims
  ADD COLUMN IF NOT EXISTS streak_day integer NOT NULL DEFAULT 1;

-- 2) Hapus reward lama (7 hari) dan isi ulang dengan 5 hari berbasis gem
DELETE FROM public.daily_gift_box_rewards;

INSERT INTO public.daily_gift_box_rewards (day_number, is_premium, reward_type, reward_value, reward_label, icon) VALUES
  (1, false, 'gems', 3,  '+3 Gem',  '💎'),
  (2, false, 'gems', 5,  '+5 Gem',  '💎'),
  (3, false, 'gems', 10, '+10 Gem', '💎'),
  (4, false, 'gems', 15, '+15 Gem', '💎'),
  (5, false, 'gems', 20, '+20 Gem', '💎'),
  (1, true,  'gems', 6,  '+6 Gem (Premium)',  '👑'),
  (2, true,  'gems', 10, '+10 Gem (Premium)', '👑'),
  (3, true,  'gems', 20, '+20 Gem (Premium)', '👑'),
  (4, true,  'gems', 30, '+30 Gem (Premium)', '👑'),
  (5, true,  'gems', 40, '+40 Gem (Premium)', '👑');