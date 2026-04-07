
ALTER TABLE public.sponsors ALTER COLUMN sponsor_number SET DEFAULT floor(random() * 90000 + 10000)::integer;
UPDATE public.sponsors SET sponsor_number = floor(random() * 90000 + 10000)::integer;
DROP SEQUENCE IF EXISTS public.sponsors_sponsor_number_seq;
