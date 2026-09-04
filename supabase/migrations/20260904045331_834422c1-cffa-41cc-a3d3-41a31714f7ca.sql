CREATE TABLE IF NOT EXISTS public.seller_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_number BIGINT GENERATED ALWAYS AS IDENTITY,
  visitor_id TEXT NOT NULL,
  application_id UUID REFERENCES public.seller_applications(id) ON DELETE SET NULL,
  store_name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  wa_number TEXT,
  shop_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  fee_percent NUMERIC NOT NULL DEFAULT 5,
  balance BIGINT NOT NULL DEFAULT 0,
  total_sales BIGINT NOT NULL DEFAULT 0,
  rating NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.seller_stores TO anon, authenticated;
GRANT ALL ON public.seller_stores TO service_role;
ALTER TABLE public.seller_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read seller stores" ON public.seller_stores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create seller store" ON public.seller_stores FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update seller store" ON public.seller_stores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.seller_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_number BIGINT GENERATED ALWAYS AS IDENTITY,
  store_id UUID NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price BIGINT NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  image_url TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  wa_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sold_count INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_products TO anon, authenticated;
GRANT ALL ON public.seller_products TO service_role;
ALTER TABLE public.seller_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read seller products" ON public.seller_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can add seller product" ON public.seller_products FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update seller product" ON public.seller_products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete seller product" ON public.seller_products FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.seller_withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wd_number BIGINT GENERATED ALWAYS AS IDENTITY,
  store_id UUID NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  amount BIGINT NOT NULL,
  method TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.seller_withdrawals TO anon, authenticated;
GRANT ALL ON public.seller_withdrawals TO service_role;
ALTER TABLE public.seller_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read seller withdrawals" ON public.seller_withdrawals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can request withdrawal" ON public.seller_withdrawals FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update withdrawal" ON public.seller_withdrawals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.seller_app_to_store()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    IF NOT EXISTS (SELECT 1 FROM public.seller_stores WHERE application_id = NEW.id) THEN
      INSERT INTO public.seller_stores (visitor_id, application_id, store_name, description, shop_url, fee_percent)
      VALUES (NEW.visitor_id, NEW.id, NEW.store_name, NEW.description, NEW.shop_url, COALESCE(NEW.fee_percent, 5));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seller_app_to_store ON public.seller_applications;
CREATE TRIGGER trg_seller_app_to_store
AFTER UPDATE ON public.seller_applications
FOR EACH ROW EXECUTE FUNCTION public.seller_app_to_store();