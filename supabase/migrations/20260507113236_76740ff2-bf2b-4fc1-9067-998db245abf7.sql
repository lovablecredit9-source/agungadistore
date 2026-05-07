
CREATE OR REPLACE FUNCTION public.auto_use_bonus_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_skip text;
  v_delta bigint;
  v_use_bonus bigint;
BEGIN
  -- Hanya proses jika balance turun
  IF NEW.balance >= OLD.balance THEN
    RETURN NEW;
  END IF;

  -- Opt-out: pembelian produk biasa set GUC ini
  BEGIN
    v_skip := current_setting('app.skip_bonus', true);
  EXCEPTION WHEN others THEN
    v_skip := NULL;
  END;
  IF v_skip = 'true' THEN
    RETURN NEW;
  END IF;

  -- Jangan ganggu kalau bonus tidak diubah berarti sistem tidak sengaja
  -- Kalau bonus_balance sudah berubah eksplisit, biarkan
  IF NEW.bonus_balance IS DISTINCT FROM OLD.bonus_balance THEN
    RETURN NEW;
  END IF;

  v_delta := OLD.balance - NEW.balance;
  v_use_bonus := LEAST(COALESCE(OLD.bonus_balance, 0), v_delta);

  IF v_use_bonus > 0 THEN
    NEW.bonus_balance := COALESCE(OLD.bonus_balance, 0) - v_use_bonus;
    NEW.balance := OLD.balance - (v_delta - v_use_bonus);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_use_bonus_balance ON public.user_balances;
CREATE TRIGGER trg_auto_use_bonus_balance
BEFORE UPDATE OF balance ON public.user_balances
FOR EACH ROW
EXECUTE FUNCTION public.auto_use_bonus_balance();
