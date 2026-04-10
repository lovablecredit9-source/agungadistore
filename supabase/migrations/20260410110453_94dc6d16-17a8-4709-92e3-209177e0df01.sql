
CREATE TABLE public.user_game_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  credits integer NOT NULL DEFAULT 0,
  unlimited_until timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_game_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game credits viewable by everyone"
  ON public.user_game_credits FOR SELECT
  TO public USING (true);

CREATE POLICY "Anyone can create game credits"
  ON public.user_game_credits FOR INSERT
  TO public WITH CHECK (true);

CREATE POLICY "Anyone can update game credits"
  ON public.user_game_credits FOR UPDATE
  TO public USING (true);
