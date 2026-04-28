-- Function to recalc product stock from available (unclaimed, unsold) tokens
CREATE OR REPLACE FUNCTION public.recalc_product_stock(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_available int;
BEGIN
  SELECT COUNT(*) INTO v_available
  FROM public.tokens t
  WHERE t.product_id = p_product_id
    AND t.is_claimed = false
    AND NOT EXISTS (
      SELECT 1 FROM public.balance_transactions bt
      WHERE bt.token_id = t.id AND bt.type = 'purchase'
    );

  UPDATE public.products SET stock = COALESCE(v_available, 0) WHERE id = p_product_id;
END;
$$;

-- Trigger function for tokens table
CREATE OR REPLACE FUNCTION public.tokens_sync_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_product_stock(OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_product_stock(NEW.product_id);
    IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
      PERFORM public.recalc_product_stock(OLD.product_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_tokens_sync_stock ON public.tokens;
CREATE TRIGGER trg_tokens_sync_stock
AFTER INSERT OR UPDATE OR DELETE ON public.tokens
FOR EACH ROW EXECUTE FUNCTION public.tokens_sync_product_stock();

-- Trigger function for balance_transactions (when a purchase records token_id, stock should reflect)
CREATE OR REPLACE FUNCTION public.bt_sync_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.product_id IS NOT NULL THEN
      PERFORM public.recalc_product_stock(OLD.product_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.product_id IS NOT NULL AND NEW.type = 'purchase' THEN
      PERFORM public.recalc_product_stock(NEW.product_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_bt_sync_stock ON public.balance_transactions;
CREATE TRIGGER trg_bt_sync_stock
AFTER INSERT OR UPDATE OR DELETE ON public.balance_transactions
FOR EACH ROW EXECUTE FUNCTION public.bt_sync_product_stock();

-- Initial sync: recalc stock for all products
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.products LOOP
    PERFORM public.recalc_product_stock(r.id);
  END LOOP;
END $$;