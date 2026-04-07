
CREATE TABLE public.liked_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES public.playlist_songs(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(song_id, visitor_id)
);

ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can like songs" ON public.liked_songs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can unlike songs" ON public.liked_songs FOR DELETE TO public USING (true);
CREATE POLICY "Liked songs viewable by everyone" ON public.liked_songs FOR SELECT TO public USING (true);
