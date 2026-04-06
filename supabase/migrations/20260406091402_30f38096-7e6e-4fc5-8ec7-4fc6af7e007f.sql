
CREATE TABLE public.song_lyrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES public.playlist_songs(id) ON DELETE CASCADE,
  time_seconds NUMERIC(8,2) NOT NULL DEFAULT 0,
  text TEXT NOT NULL DEFAULT '',
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.song_lyrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lyrics viewable by everyone" ON public.song_lyrics
  FOR SELECT USING (true);

CREATE POLICY "Admin can insert lyrics" ON public.song_lyrics
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin can update lyrics" ON public.song_lyrics
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admin can delete lyrics" ON public.song_lyrics
  FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_song_lyrics_song_id ON public.song_lyrics(song_id, time_seconds);
