ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0;

-- Backfill berdasarkan transaksi pembelian yang sudah ada
UPDATE public.products p
SET sold_count = COALESCE(sub.total, 0)
FROM (
  SELECT product_id, COUNT(*) AS total
  FROM public.balance_transactions
  WHERE type = 'purchase' AND product_id IS NOT NULL
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id;