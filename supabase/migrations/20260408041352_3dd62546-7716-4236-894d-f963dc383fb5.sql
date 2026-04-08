ALTER TABLE public.sponsors
  ADD COLUMN has_warranty boolean NOT NULL DEFAULT false,
  ADD COLUMN warranty_duration_value integer NOT NULL DEFAULT 0,
  ADD COLUMN warranty_duration_type text NOT NULL DEFAULT 'days';