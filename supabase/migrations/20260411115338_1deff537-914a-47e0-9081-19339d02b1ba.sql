
-- Add trx_id column
ALTER TABLE public.balance_transactions ADD COLUMN trx_id text;

-- Create function to generate trx_id
CREATE OR REPLACE FUNCTION public.generate_trx_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.trx_id := 'TRX-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER set_trx_id_on_insert
BEFORE INSERT ON public.balance_transactions
FOR EACH ROW
WHEN (NEW.trx_id IS NULL)
EXECUTE FUNCTION public.generate_trx_id();

-- Backfill existing rows
UPDATE public.balance_transactions 
SET trx_id = 'TRX-' || to_char(created_at, 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 6))
WHERE trx_id IS NULL;
