CREATE TABLE IF NOT EXISTS public.seller_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_number BIGINT GENERATED ALWAYS AS IDENTITY,
  visitor_id TEXT NOT NULL,
  store_name TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  fee_accepted BOOLEAN NOT NULL DEFAULT false,
  fee_percent NUMERIC NOT NULL DEFAULT 5,
  shop_url TEXT,
  product_photos TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  seen_by_admin_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.seller_applications TO anon, authenticated;
GRANT ALL ON public.seller_applications TO service_role;
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit application" ON public.seller_applications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read applications" ON public.seller_applications FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users update own pending application" ON public.seller_applications FOR UPDATE TO anon, authenticated USING (status = 'pending') WITH CHECK (status = 'pending');

CREATE POLICY "Public read seller photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'seller-photos');
CREATE POLICY "Anyone upload seller photos" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'seller-photos');