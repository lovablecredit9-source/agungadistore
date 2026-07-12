ALTER TABLE public.daily_challenges
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'mudah';

ALTER TABLE public.weekly_quests
  ADD COLUMN IF NOT EXISTS reward_saldo_in integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_gems integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'normal';