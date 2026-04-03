
CREATE TABLE public.product_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  image_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product images viewable by everyone" ON public.product_images FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert product images" ON public.product_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update product images" ON public.product_images FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete product images" ON public.product_images FOR DELETE TO authenticated USING (true);

-- Allow admin to delete claims
CREATE POLICY "Admin can delete claims" ON public.token_claims FOR DELETE TO authenticated USING (true);
