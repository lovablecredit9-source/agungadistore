
-- Create trigger for auto-generating trx_id on balance_transactions
CREATE OR REPLACE TRIGGER set_trx_id_on_insert
  BEFORE INSERT ON public.balance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_trx_id();

-- Backfill existing transactions without trx_id
UPDATE public.balance_transactions
SET trx_id = 'TRX-' || to_char(created_at, 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 6))
WHERE trx_id IS NULL OR trx_id = '';
