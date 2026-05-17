-- Add media columns
ALTER TABLE public.confess_thread_messages
  ALTER COLUMN text SET DEFAULT '',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_name text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS media_size bigint;

-- Allow empty text
ALTER TABLE public.confess_thread_messages
  DROP CONSTRAINT IF EXISTS confess_thread_messages_text_not_empty;

-- Create public storage bucket for confess media
INSERT INTO storage.buckets (id, name, public)
VALUES ('confess-media', 'confess-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policies
DROP POLICY IF EXISTS "confess_media_read" ON storage.objects;
CREATE POLICY "confess_media_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'confess-media');

DROP POLICY IF EXISTS "confess_media_insert" ON storage.objects;
CREATE POLICY "confess_media_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'confess-media');

DROP POLICY IF EXISTS "confess_media_update" ON storage.objects;
CREATE POLICY "confess_media_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'confess-media');