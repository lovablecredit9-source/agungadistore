ALTER TABLE public.daily_streaks 
  ADD COLUMN IF NOT EXISTS free_scratch_date date,
  ADD COLUMN IF NOT EXISTS scratch_stats jsonb NOT NULL DEFAULT '{"total_buys":0,"total_wins":0,"jackpots":0,"diamond_buys":0,"achievements":[]}'::jsonb;