
-- Tabel profil khusus Streak (terpisah dari game_profiles)
CREATE TABLE IF NOT EXISTS public.streak_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL UNIQUE,
  username text NOT NULL,
  avatar_url text,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create streak profile"
  ON public.streak_profiles FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update streak profile"
  ON public.streak_profiles FOR UPDATE TO public USING (true);

CREATE POLICY "Streak profiles direct read denied"
  ON public.streak_profiles FOR SELECT TO public USING (false);

CREATE TRIGGER update_streak_profiles_updated_at
  BEFORE UPDATE ON public.streak_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update view streak_leaderboard agar PRIORITAS dari streak_profiles
CREATE OR REPLACE VIEW public.streak_leaderboard AS
SELECT 
  ds.id,
  ds.visitor_id,
  ds.current_streak,
  ds.longest_streak,
  ds.total_claims,
  ds.total_bonus_points,
  COALESCE(sp.username, 'Pemain Misterius'::text) AS display_name,
  sp.avatar_url
FROM public.daily_streaks ds
LEFT JOIN public.streak_profiles sp ON sp.visitor_id = ds.visitor_id
WHERE sp.username IS NOT NULL
ORDER BY ds.longest_streak DESC, ds.current_streak DESC, ds.total_claims DESC;

-- Public view (safe): expose streak profile minimal info
CREATE OR REPLACE VIEW public.streak_profiles_public AS
SELECT id, visitor_id, username, avatar_url, description, created_at, updated_at
FROM public.streak_profiles;
