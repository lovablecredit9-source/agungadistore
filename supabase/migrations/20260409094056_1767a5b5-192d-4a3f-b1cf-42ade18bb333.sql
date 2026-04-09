
CREATE TABLE public.wholesale_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL DEFAULT 'product',
  entity_id UUID NOT NULL,
  min_quantity INTEGER NOT NULL DEFAULT 2,
  price_per_item BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wholesale_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wholesale prices viewable by everyone"
ON public.wholesale_prices FOR SELECT
TO public USING (true);

CREATE POLICY "Admin can insert wholesale prices"
ON public.wholesale_prices FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Admin can update wholesale prices"
ON public.wholesale_prices FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Admin can delete wholesale prices"
ON public.wholesale_prices FOR DELETE
TO authenticated USING (true);

CREATE INDEX idx_wholesale_prices_entity ON public.wholesale_prices (entity_type, entity_id);
