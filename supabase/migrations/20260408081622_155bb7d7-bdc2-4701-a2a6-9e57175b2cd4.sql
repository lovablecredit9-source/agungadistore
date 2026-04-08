
CREATE TABLE public.liked_sponsors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, sponsor_id)
);

ALTER TABLE public.liked_sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Liked sponsors viewable by everyone" ON public.liked_sponsors FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can like sponsors" ON public.liked_sponsors FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can unlike sponsors" ON public.liked_sponsors FOR DELETE TO public USING (true);
