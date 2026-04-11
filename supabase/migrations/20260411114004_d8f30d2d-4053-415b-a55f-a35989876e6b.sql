
CREATE TABLE public.credit_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credits integer NOT NULL DEFAULT 0,
  price bigint NOT NULL DEFAULT 0,
  label text NOT NULL DEFAULT '',
  is_unlimited boolean NOT NULL DEFAULT false,
  unlimited_days integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Credit packages viewable by everyone"
ON public.credit_packages FOR SELECT
TO public
USING (true);

CREATE POLICY "Admin can insert credit packages"
ON public.credit_packages FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admin can update credit packages"
ON public.credit_packages FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admin can delete credit packages"
ON public.credit_packages FOR DELETE
TO authenticated
USING (true);
