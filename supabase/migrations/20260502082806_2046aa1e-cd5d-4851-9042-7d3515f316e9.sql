
ALTER TABLE public.streak_vouchers
  ADD COLUMN IF NOT EXISTS target_visitor_ids text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS target_user_balance_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.streak_vouchers DROP CONSTRAINT IF EXISTS streak_vouchers_reward_type_check;
ALTER TABLE public.streak_vouchers
  ADD CONSTRAINT streak_vouchers_reward_type_check
  CHECK (reward_type = ANY (ARRAY['gems'::text,'streak_coins'::text,'credits'::text,'hints'::text,'streak_freeze'::text,'time_freeze'::text,'extra_life'::text,'saldo'::text]));
