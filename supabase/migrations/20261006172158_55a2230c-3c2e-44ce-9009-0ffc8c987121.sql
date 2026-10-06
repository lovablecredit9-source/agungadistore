ALTER TABLE public.game_profiles
  ADD COLUMN IF NOT EXISTS favorite_games text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_played_game text,
  ADD COLUMN IF NOT EXISTS last_played_at timestamptz,
  ADD COLUMN IF NOT EXISTS play_counts jsonb NOT NULL DEFAULT '{}'::jsonb;