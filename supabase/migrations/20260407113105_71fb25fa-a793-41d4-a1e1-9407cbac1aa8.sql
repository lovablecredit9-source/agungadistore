
CREATE TABLE public.sponsors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price BIGINT NOT NULL DEFAULT 0,
  image_url TEXT,
  seller_name TEXT NOT NULL DEFAULT '',
  seller_contact TEXT NOT NULL DEFAULT '',
  duration_type TEXT NOT NULL DEFAULT 'days',
  duration_value INTEGER NOT NULL DEFAULT 1,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  custom_note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sponsors viewable by everyone" ON public.sponsors FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert sponsors" ON public.sponsors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update sponsors" ON public.sponsors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete sponsors" ON public.sponsors FOR DELETE TO authenticated USING (true);
