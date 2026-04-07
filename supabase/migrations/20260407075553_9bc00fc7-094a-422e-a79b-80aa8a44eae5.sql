
CREATE TABLE public.artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bio text DEFAULT '',
  photo_url text,
  genre text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artists viewable by everyone" ON public.artists FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert artists" ON public.artists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update artists" ON public.artists FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete artists" ON public.artists FOR DELETE TO authenticated USING (true);

-- Add artist_id to playlist_songs for linking
ALTER TABLE public.playlist_songs ADD COLUMN artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL;
