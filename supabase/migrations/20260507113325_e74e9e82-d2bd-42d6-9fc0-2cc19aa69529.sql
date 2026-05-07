
CREATE OR REPLACE FUNCTION public.consume_main_balance_only(
  p_balance_id uuid,
  p_amount bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bal bigint;
BEGIN
  SELECT balance INTO v_bal FROM public.user_balances WHERE id = p_balance_id FOR UPDATE;
  IF v_bal IS NULL THEN
    RAISE EXCEPTION 'BALANCE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_bal < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_MAIN_BALANCE: have=%, need=%', v_bal, p_amount USING ERRCODE = 'P0001';
  END IF;
  -- bypass trigger dengan setel session var
  PERFORM set_config('app.skip_bonus', 'true', true);
  UPDATE public.user_balances SET balance = v_bal - p_amount, updated_at = now() WHERE id = p_balance_id;
  PERFORM set_config('app.skip_bonus', 'false', true);
  RETURN v_bal - p_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_main_balance_only(
  p_balance_id uuid,
  p_amount bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bal bigint;
BEGIN
  SELECT balance INTO v_bal FROM public.user_balances WHERE id = p_balance_id FOR UPDATE;
  PERFORM set_config('app.skip_bonus', 'true', true);
  UPDATE public.user_balances SET balance = COALESCE(v_bal, 0) + GREATEST(0, p_amount), updated_at = now() WHERE id = p_balance_id;
  PERFORM set_config('app.skip_bonus', 'false', true);
  RETURN COALESCE(v_bal, 0) + GREATEST(0, p_amount);
END;
$$;
