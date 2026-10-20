CREATE TABLE public.apk_youtube_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  type text NOT NULL CHECK (type IN ('search','select','mp3','mp4','play')),
  title text NOT NULL,
  url text,
  thumbnail text,
  media_url text,
  media_kind text CHECK (media_kind IN ('audio','video') OR media_kind IS NULL),
  quality text,
  duration text,
  status text CHECK (status IN ('ok','fail','pending') OR status IS NULL),
  error text,
  at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, dedupe_key)
);
GRANT ALL ON public.apk_youtube_history TO service_role;
ALTER TABLE public.apk_youtube_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX apk_youtube_history_wallet_at ON public.apk_youtube_history (wallet_id, at DESC);