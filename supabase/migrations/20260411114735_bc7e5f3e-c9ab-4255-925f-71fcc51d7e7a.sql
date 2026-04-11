
CREATE TABLE public.streak_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  days integer NOT NULL DEFAULT 0,
  price bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Streak packages viewable by everyone" ON public.streak_packages FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert streak packages" ON public.streak_packages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update streak packages" ON public.streak_packages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete streak packages" ON public.streak_packages FOR DELETE TO authenticated USING (true);

CREATE TABLE public.storage_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  storage_mb integer NOT NULL DEFAULT 0,
  price bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.storage_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Storage packages viewable by everyone" ON public.storage_packages FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert storage packages" ON public.storage_packages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update storage packages" ON public.storage_packages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete storage packages" ON public.storage_packages FOR DELETE TO authenticated USING (true);
