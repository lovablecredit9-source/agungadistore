ALTER TABLE public.playlist_songs
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_video_id text,
  ADD COLUMN IF NOT EXISTS source_playlist_id text;
CREATE UNIQUE INDEX IF NOT EXISTS playlist_songs_source_video_uq ON public.playlist_songs(source_video_id) WHERE source_video_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS playlist_items_playlist_song_uq ON public.playlist_items(playlist_id, song_id);

CREATE TABLE public.music_youtube_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL UNIQUE,
  title text NOT NULL,
  artist text NOT NULL,
  thumbnail_url text,
  youtube_url text NOT NULL,
  source_playlist_id text,
  position integer NOT NULL DEFAULT 0,
  playlist_id uuid REFERENCES public.playlists(id) ON DELETE SET NULL,
  song_id uuid REFERENCES public.playlist_songs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'awaiting_audio',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.music_youtube_tracks TO anon, authenticated;
GRANT ALL ON public.music_youtube_tracks TO service_role;
ALTER TABLE public.music_youtube_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "YouTube metadata public read" ON public.music_youtube_tracks FOR SELECT USING (true);

CREATE TABLE public.music_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_url text NOT NULL,
  playlist_id text NOT NULL,
  admin_user_id uuid,
  total_items integer NOT NULL DEFAULT 0,
  new_items integer NOT NULL DEFAULT 0,
  existing_items integer NOT NULL DEFAULT 0,
  skipped_items integer NOT NULL DEFAULT 0,
  failed_items integer NOT NULL DEFAULT 0,
  metadata_source text,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.music_import_logs TO authenticated;
GRANT ALL ON public.music_import_logs TO service_role;
ALTER TABLE public.music_import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read import logs" ON public.music_import_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));