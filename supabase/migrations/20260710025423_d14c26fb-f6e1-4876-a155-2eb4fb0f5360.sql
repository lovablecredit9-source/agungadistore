CREATE TABLE public.game_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL UNIQUE,
  level INTEGER NOT NULL DEFAULT 1,
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.game_levels TO anon, authenticated;
GRANT ALL ON public.game_levels TO service_role;

ALTER TABLE public.game_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view game levels" ON public.game_levels FOR SELECT USING (true);
CREATE POLICY "Anyone can insert game levels" ON public.game_levels FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game levels" ON public.game_levels FOR UPDATE USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_game_levels_updated_at BEFORE UPDATE ON public.game_levels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();