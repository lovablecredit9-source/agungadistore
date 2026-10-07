-- Satu voucher/token produk hanya boleh terjual sekali (cegah dua pembeli mendapat token yang sama saat bersamaan)
CREATE UNIQUE INDEX IF NOT EXISTS balance_transactions_purchase_token_unique
  ON public.balance_transactions (token_id) WHERE type = 'purchase' AND token_id IS NOT NULL;