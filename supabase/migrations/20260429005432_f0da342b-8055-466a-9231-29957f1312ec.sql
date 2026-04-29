CREATE TYPE public.flash_sale_mode AS ENUM ('discount_percent', 'fixed_price');

CREATE TABLE public.store_flash_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  mode public.flash_sale_mode NOT NULL DEFAULT 'discount_percent',
  discount_percent INTEGER,
  flash_price BIGINT,
  quota INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_store_flash_sale_values CHECK (
    (mode = 'discount_percent' AND discount_percent IS NOT NULL AND discount_percent BETWEEN 1 AND 99)
    OR
    (mode = 'fixed_price' AND flash_price IS NOT NULL AND flash_price >= 0)
  ),
  CONSTRAINT chk_store_flash_sale_period CHECK (ends_at > starts_at),
  CONSTRAINT chk_store_flash_sale_quota CHECK (quota >= 0 AND sold >= 0)
);

CREATE INDEX idx_store_flash_sales_product ON public.store_flash_sales(product_id);
CREATE INDEX idx_store_flash_sales_window ON public.store_flash_sales(is_active, starts_at, ends_at);

ALTER TABLE public.store_flash_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store flash sales viewable by everyone"
ON public.store_flash_sales
FOR SELECT
USING (true);

CREATE POLICY "Admin insert store flash sales"
ON public.store_flash_sales
FOR INSERT
WITH CHECK (public.is_admin_user());

CREATE POLICY "Admin update store flash sales"
ON public.store_flash_sales
FOR UPDATE
USING (public.is_admin_user());

CREATE POLICY "Admin delete store flash sales"
ON public.store_flash_sales
FOR DELETE
USING (public.is_admin_user());

CREATE TRIGGER update_store_flash_sales_updated_at
BEFORE UPDATE ON public.store_flash_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.store_flash_sales;