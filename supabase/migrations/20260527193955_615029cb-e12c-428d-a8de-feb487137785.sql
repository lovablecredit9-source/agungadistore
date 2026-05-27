
ALTER TABLE public.confess_threads
  ADD COLUMN IF NOT EXISTS wa_profile_pic_url text;

ALTER TABLE public.confess_thread_messages
  ADD COLUMN IF NOT EXISTS wa_revoked_at timestamptz;

INSERT INTO storage.buckets (id, name, public)
VALUES ('confess-media', 'confess-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='confess-media public read') THEN
    CREATE POLICY "confess-media public read" ON storage.objects FOR SELECT USING (bucket_id = 'confess-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='confess-media service write') THEN
    CREATE POLICY "confess-media service write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'confess-media');
  END IF;
END $$;
