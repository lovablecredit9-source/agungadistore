-- Add bonus tracking & streak freeze columns to daily_streaks
ALTER TABLE public.daily_streaks
  ADD COLUMN IF NOT EXISTS total_bonus_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freeze_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freeze_used_at date,
  ADD COLUMN IF NOT EXISTS achievements text[] NOT NULL DEFAULT '{}';

-- Mystery reward log per claim
CREATE TABLE IF NOT EXISTS public.streak_rewards_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  claim_date date NOT NULL DEFAULT CURRENT_DATE,
  reward_type text NOT NULL,
  reward_value integer NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  reward_emoji text NOT NULL DEFAULT '🎁',
  rarity text NOT NULL DEFAULT 'common',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_rewards_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reward log"
  ON public.streak_rewards_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reward log"
  ON public.streak_rewards_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can delete reward log"
  ON public.streak_rewards_log FOR DELETE TO authenticated USING (is_admin_user());

CREATE INDEX IF NOT EXISTS idx_streak_rewards_visitor ON public.streak_rewards_log(visitor_id, claim_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_streaks_longest ON public.daily_streaks(longest_streak DESC);
CREATE INDEX IF NOT EXISTS idx_daily_streaks_current ON public.daily_streaks(current_streak DESC);

-- Public leaderboard view (no PII, just visitor_id hash + stats)
CREATE OR REPLACE VIEW public.streak_leaderboard AS
SELECT
  ds.id,
  ds.visitor_id,
  ds.current_streak,
  ds.longest_streak,
  ds.total_claims,
  ds.total_bonus_points,
  COALESCE(gp.display_name, ub.username, 'Pemain Misterius') AS display_name,
  COALESCE(gp.avatar_url, NULL) AS avatar_url
FROM public.daily_streaks ds
LEFT JOIN public.game_profiles gp ON gp.visitor_id = ds.visitor_id
LEFT JOIN public.user_balances ub ON ub.visitor_id = ds.visitor_id
ORDER BY ds.longest_streak DESC, ds.current_streak DESC, ds.total_claims DESC;

GRANT SELECT ON public.streak_leaderboard TO anon, authenticated;