-- Drop CHECK constraints yang membatasi day_number ke 1-5 atau 1-7
ALTER TABLE public.daily_gift_box_rewards DROP CONSTRAINT IF EXISTS daily_gift_box_rewards_day_number_check;
ALTER TABLE public.daily_gift_box_claims DROP CONSTRAINT IF EXISTS daily_gift_box_claims_day_number_check;
ALTER TABLE public.daily_gift_box_claims DROP CONSTRAINT IF EXISTS daily_gift_box_claims_streak_day_check;

-- Tambah constraint baru: 1 sampai 30
ALTER TABLE public.daily_gift_box_rewards
  ADD CONSTRAINT daily_gift_box_rewards_day_number_check CHECK (day_number BETWEEN 1 AND 30);
ALTER TABLE public.daily_gift_box_claims
  ADD CONSTRAINT daily_gift_box_claims_day_number_check CHECK (day_number BETWEEN 1 AND 30);
ALTER TABLE public.daily_gift_box_claims
  ADD CONSTRAINT daily_gift_box_claims_streak_day_check CHECK (streak_day BETWEEN 1 AND 30);