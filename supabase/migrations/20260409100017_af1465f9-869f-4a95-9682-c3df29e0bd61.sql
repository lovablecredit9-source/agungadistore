CREATE TABLE public.daily_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  last_claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_streak INTEGER NOT NULL DEFAULT 1,
  longest_streak INTEGER NOT NULL DEFAULT 1,
  total_claims INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(visitor_id)
);

ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Streaks viewable by everyone" ON public.daily_streaks FOR SELECT USING (true);
CREATE POLICY "Anyone can create streak" ON public.daily_streaks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update streak" ON public.daily_streaks FOR UPDATE USING (true);