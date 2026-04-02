
-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price BIGINT NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone can view products
CREATE POLICY "Products are viewable by everyone" ON public.products FOR SELECT USING (true);
-- Only authenticated (admin) can manage
CREATE POLICY "Admin can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete products" ON public.products FOR DELETE TO authenticated USING (true);

-- Product field templates (defines what fields each product's accounts have)
CREATE TABLE public.product_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Product fields viewable by everyone" ON public.product_fields FOR SELECT USING (true);
CREATE POLICY "Admin can manage product fields" ON public.product_fields FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update product fields" ON public.product_fields FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete product fields" ON public.product_fields FOR DELETE TO authenticated USING (true);

-- Tokens (each token = one account to sell, one-time claim)
CREATE TABLE public.tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  token_code TEXT NOT NULL UNIQUE,
  is_claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
-- Anyone can read tokens (to verify)
CREATE POLICY "Tokens viewable by everyone" ON public.tokens FOR SELECT USING (true);
CREATE POLICY "Admin can insert tokens" ON public.tokens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update tokens" ON public.tokens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete tokens" ON public.tokens FOR DELETE TO authenticated USING (true);

-- Token field values (the actual account data: email, pw, a2f, etc.)
CREATE TABLE public.token_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.token_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Token fields viewable by everyone" ON public.token_fields FOR SELECT USING (true);
CREATE POLICY "Admin can insert token fields" ON public.token_fields FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update token fields" ON public.token_fields FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete token fields" ON public.token_fields FOR DELETE TO authenticated USING (true);

-- Token claims history (device info, time)
CREATE TABLE public.token_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  device_info TEXT,
  browser TEXT,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.token_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Claims viewable by everyone" ON public.token_claims FOR SELECT USING (true);
CREATE POLICY "Anyone can insert claims" ON public.token_claims FOR INSERT WITH CHECK (true);

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
CREATE POLICY "Product images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Admin can upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "Admin can update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "Admin can delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
