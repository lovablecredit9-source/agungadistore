
CREATE SEQUENCE IF NOT EXISTS public.sponsors_sponsor_number_seq;
ALTER TABLE public.sponsors ADD COLUMN sponsor_number integer;
UPDATE public.sponsors SET sponsor_number = nextval('public.sponsors_sponsor_number_seq');
ALTER TABLE public.sponsors ALTER COLUMN sponsor_number SET NOT NULL;
ALTER TABLE public.sponsors ALTER COLUMN sponsor_number SET DEFAULT nextval('public.sponsors_sponsor_number_seq');
ALTER SEQUENCE public.sponsors_sponsor_number_seq OWNED BY public.sponsors.sponsor_number;
