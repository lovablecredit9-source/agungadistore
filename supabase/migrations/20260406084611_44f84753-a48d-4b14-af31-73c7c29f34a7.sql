
-- Create playlists table (admin public + user private)
CREATE TABLE public.playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cover_url TEXT,
  playlist_type TEXT NOT NULL DEFAULT 'admin',
  visitor_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create playlist_items linking table
CREATE TABLE public.playlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.playlist_songs(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, song_id)
);

-- RLS for playlists
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Playlists viewable by everyone" ON public.playlists
  FOR SELECT USING (true);

CREATE POLICY "Admin can insert playlists" ON public.playlists
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin can update playlists" ON public.playlists
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admin can delete playlists" ON public.playlists
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Anyone can insert user playlists" ON public.playlists
  FOR INSERT TO public WITH CHECK (playlist_type = 'user');

CREATE POLICY "Anyone can update own user playlists" ON public.playlists
  FOR UPDATE TO public USING (playlist_type = 'user');

CREATE POLICY "Anyone can delete own user playlists" ON public.playlists
  FOR DELETE TO public USING (playlist_type = 'user');

-- RLS for playlist_items
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Playlist items viewable by everyone" ON public.playlist_items
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage playlist items" ON public.playlist_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anyone can insert playlist items" ON public.playlist_items
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Admin can delete playlist items" ON public.playlist_items
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Anyone can delete playlist items" ON public.playlist_items
  FOR DELETE TO public USING (true);
