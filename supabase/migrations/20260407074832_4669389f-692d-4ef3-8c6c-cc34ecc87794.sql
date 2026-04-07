
-- Music profiles for community users
CREATE TABLE public.music_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  description text DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.music_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Music profiles viewable by everyone" ON public.music_profiles FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create music profile" ON public.music_profiles FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update own music profile" ON public.music_profiles FOR UPDATE TO public USING (true);

-- User-uploaded public songs with moderation
CREATE TABLE public.public_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL DEFAULT '',
  description text DEFAULT '',
  file_url text NOT NULL,
  cover_url text,
  duration integer DEFAULT 0,
  file_size bigint DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  ai_check_result text,
  admin_note text,
  visibility text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public songs viewable by everyone" ON public.public_songs FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can upload public songs" ON public.public_songs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update own public songs" ON public.public_songs FOR UPDATE TO public USING (true);
CREATE POLICY "Admin can delete public songs" ON public.public_songs FOR DELETE TO authenticated USING (true);

-- Follow relationships
CREATE TABLE public.user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_visitor_id text NOT NULL,
  following_visitor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_visitor_id, following_visitor_id)
);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows viewable by everyone" ON public.user_follows FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can follow" ON public.user_follows FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can unfollow" ON public.user_follows FOR DELETE TO public USING (true);

-- Enable realtime for public_songs
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_songs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_follows;
