CREATE TABLE IF NOT EXISTS public.quest_song_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  song_id uuid NOT NULL,
  completion_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
  seconds_played integer NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, song_id, completion_date)
);
GRANT SELECT, INSERT ON public.quest_song_completions TO authenticated;
GRANT ALL ON public.quest_song_completions TO service_role;
ALTER TABLE public.quest_song_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own quest song completions" ON public.quest_song_completions;
CREATE POLICY "Users can read own quest song completions"
ON public.quest_song_completions
FOR SELECT
TO authenticated
USING (visitor_id = current_setting('request.jwt.claims', true)::jsonb ->> 'visitor_id');
CREATE INDEX IF NOT EXISTS idx_quest_song_completions_visitor_date ON public.quest_song_completions(visitor_id, completion_date);