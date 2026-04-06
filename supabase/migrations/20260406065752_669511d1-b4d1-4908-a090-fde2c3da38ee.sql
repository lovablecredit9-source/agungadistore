
CREATE TABLE public.playlist_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL,
  cover_url TEXT,
  duration INTEGER DEFAULT 0,
  file_size BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Songs viewable by everyone" ON public.playlist_songs FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert songs" ON public.playlist_songs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update songs" ON public.playlist_songs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete songs" ON public.playlist_songs FOR DELETE TO authenticated USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('music-files', 'music-files', true);

CREATE POLICY "Music files viewable by everyone" ON storage.objects FOR SELECT TO public USING (bucket_id = 'music-files');
CREATE POLICY "Admin can upload music files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'music-files');
CREATE POLICY "Admin can update music files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'music-files');
CREATE POLICY "Admin can delete music files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'music-files');
