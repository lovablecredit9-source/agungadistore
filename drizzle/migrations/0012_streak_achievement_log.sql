CREATE TABLE IF NOT EXISTS public.streak_achievement_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  achievement_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, achievement_id)
);
GRANT SELECT ON public.streak_achievement_log TO anon, authenticated;
GRANT ALL ON public.streak_achievement_log TO service_role;
ALTER TABLE public.streak_achievement_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievement log readable" ON public.streak_achievement_log FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.log_streak_achievements() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO streak_achievement_log (visitor_id, achievement_id)
  SELECT NEW.visitor_id, a FROM unnest(coalesce(NEW.achievements, '{}')) a
  WHERE NOT (a = ANY (coalesce(OLD.achievements, '{}')))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_streak_achievements ON public.daily_streaks;
CREATE TRIGGER trg_log_streak_achievements AFTER UPDATE OF achievements ON public.daily_streaks
FOR EACH ROW WHEN (NEW.achievements IS DISTINCT FROM OLD.achievements) EXECUTE FUNCTION public.log_streak_achievements();