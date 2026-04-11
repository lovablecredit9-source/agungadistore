
-- Game profiles table
CREATE TABLE public.game_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT 'Pemain',
  description TEXT DEFAULT '',
  avatar_url TEXT,
  email TEXT,
  phone TEXT,
  password_hash TEXT,
  is_guest BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.game_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game profiles viewable by everyone" ON public.game_profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can create game profile" ON public.game_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game profile" ON public.game_profiles FOR UPDATE USING (true);

-- Game stats table
CREATE TABLE public.game_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  game_type TEXT NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, game_type)
);

ALTER TABLE public.game_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game stats viewable by everyone" ON public.game_stats FOR SELECT USING (true);
CREATE POLICY "Anyone can create game stats" ON public.game_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game stats" ON public.game_stats FOR UPDATE USING (true);

-- Game follows table
CREATE TABLE public.game_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_visitor_id TEXT NOT NULL,
  following_visitor_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_visitor_id, following_visitor_id)
);

ALTER TABLE public.game_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game follows viewable by everyone" ON public.game_follows FOR SELECT USING (true);
CREATE POLICY "Anyone can follow" ON public.game_follows FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can unfollow" ON public.game_follows FOR DELETE USING (true);
