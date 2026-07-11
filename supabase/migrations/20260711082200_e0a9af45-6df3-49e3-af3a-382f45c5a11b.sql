CREATE TABLE public.product_wishlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  target_price bigint,
  last_price bigint NOT NULL DEFAULT 0,
  last_stock integer NOT NULL DEFAULT 0,
  notify_price_drop boolean NOT NULL DEFAULT true,
  notify_restock boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_wishlist TO anon, authenticated;
GRANT ALL ON public.product_wishlist TO service_role;

ALTER TABLE public.product_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view wishlist by visitor"
  ON public.product_wishlist FOR SELECT USING (true);
CREATE POLICY "Anyone can add to wishlist"
  ON public.product_wishlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own wishlist"
  ON public.product_wishlist FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete own wishlist"
  ON public.product_wishlist FOR DELETE USING (true);

CREATE INDEX idx_product_wishlist_visitor ON public.product_wishlist(visitor_id);
CREATE INDEX idx_product_wishlist_product ON public.product_wishlist(product_id);

CREATE TRIGGER update_product_wishlist_updated_at
  BEFORE UPDATE ON public.product_wishlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();