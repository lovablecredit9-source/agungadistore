
CREATE TABLE public.bundle_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  credits INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  storage_mb INTEGER NOT NULL DEFAULT 0,
  price BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bundle_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bundle packages viewable by everyone" ON public.bundle_packages FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert bundle packages" ON public.bundle_packages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update bundle packages" ON public.bundle_packages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete bundle packages" ON public.bundle_packages FOR DELETE TO authenticated USING (true);
