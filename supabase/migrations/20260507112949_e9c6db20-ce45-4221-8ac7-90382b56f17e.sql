
ALTER TABLE public.user_balances ADD COLUMN IF NOT EXISTS bonus_balance bigint NOT NULL DEFAULT 0;

-- Helper: kurangi saldo, prefer bonus_balance dulu (untuk fitur internal)
CREATE OR REPLACE FUNCTION public.consume_balance_with_bonus(
  p_visitor_id text,
  p_amount bigint
) RETURNS TABLE(new_balance bigint, new_bonus_balance bigint, used_bonus bigint, used_main bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ub_id uuid;
  v_bal bigint;
  v_bonus bigint;
  v_use_bonus bigint;
  v_use_main bigint;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = 'P0001';
  END IF;

  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC LIMIT 1;

  IF v_ub_id IS NULL THEN
    RAISE EXCEPTION 'NO_ACCOUNT' USING ERRCODE = 'P0001';
  END IF;

  SELECT balance, COALESCE(bonus_balance, 0) INTO v_bal, v_bonus
  FROM public.user_balances WHERE id = v_ub_id FOR UPDATE;

  IF (v_bal + v_bonus) < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have=%, need=%', (v_bal + v_bonus), p_amount USING ERRCODE = 'P0001';
  END IF;

  v_use_bonus := LEAST(v_bonus, p_amount);
  v_use_main := p_amount - v_use_bonus;

  UPDATE public.user_balances
  SET balance = v_bal - v_use_main,
      bonus_balance = v_bonus - v_use_bonus,
      updated_at = now()
  WHERE id = v_ub_id;

  RETURN QUERY SELECT (v_bal - v_use_main), (v_bonus - v_use_bonus), v_use_bonus, v_use_main;
END;
$$;

-- Helper: tambah bonus_balance untuk akun aktif visitor
CREATE OR REPLACE FUNCTION public.add_bonus_balance(
  p_visitor_id text,
  p_amount bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ub_id uuid;
  v_new bigint;
BEGIN
  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC LIMIT 1;

  IF v_ub_id IS NULL THEN
    -- fallback: cari user_balances by visitor langsung
    SELECT id INTO v_ub_id FROM public.user_balances WHERE visitor_id = p_visitor_id LIMIT 1;
  END IF;

  IF v_ub_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.user_balances
  SET bonus_balance = COALESCE(bonus_balance, 0) + GREATEST(0, p_amount),
      updated_at = now()
  WHERE id = v_ub_id
  RETURNING bonus_balance INTO v_new;

  RETURN COALESCE(v_new, 0);
END;
$$;
