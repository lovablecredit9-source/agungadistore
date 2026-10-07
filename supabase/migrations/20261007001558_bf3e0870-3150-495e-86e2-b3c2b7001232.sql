CREATE OR REPLACE FUNCTION public.deposit_bonus_amount(p_amount bigint)
RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT CASE WHEN p_amount >= 10000 THEN floor(p_amount * 0.1)::bigint ELSE 0 END $$;

CREATE OR REPLACE FUNCTION public.get_deposit_bonus_preview(p_amount bigint)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public'
AS $$ SELECT jsonb_build_object('amount', p_amount, 'bonus', public.deposit_bonus_amount(p_amount),
  'total_saldo_in', p_amount + public.deposit_bonus_amount(p_amount), 'min_bonus_amount', 10000, 'bonus_percent', 10,
  'min_amount', 1000, 'max_amount', 10000000) $$;
GRANT EXECUTE ON FUNCTION public.get_deposit_bonus_preview(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_deposit_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d record; v_bonus bigint := 0; v_new bigint;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT * INTO d FROM deposits WHERE id = p_deposit_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deposit tidak ditemukan'; END IF;
  IF d.status <> 'pending' THEN RAISE EXCEPTION 'Deposit sudah diproses (%)', d.status; END IF;
  IF d.amount IS NULL OR d.amount <= 0 THEN RAISE EXCEPTION 'Nominal deposit tidak valid'; END IF;
  UPDATE user_balances SET balance = balance + d.amount, updated_at = now()
    WHERE visitor_id = d.visitor_id RETURNING balance INTO v_new;
  IF v_new IS NULL THEN RAISE EXCEPTION 'Akun saldo user tidak ditemukan'; END IF;
  UPDATE deposits SET status = 'approved', updated_at = now() WHERE id = d.id;
  INSERT INTO balance_transactions(visitor_id, type, amount, description, trx_id)
    VALUES (d.visitor_id, 'topup', d.amount, 'Deposit ' || upper(coalesce(d.payment_method,'')) || ' - TRX: ' || coalesce(d.trx_id,''), d.trx_id);
  v_bonus := public.deposit_bonus_amount(d.amount);
  IF v_bonus > 0 THEN
    PERFORM public.add_topup_bonus_to_saldo_in(d.visitor_id, v_bonus::int);
    INSERT INTO balance_transactions(visitor_id, type, amount, description, trx_id)
      VALUES (d.visitor_id, 'topup_bonus', v_bonus, '🎁 Bonus 10% deposit → Saldo IN (TRX: ' || coalesce(d.trx_id,'') || ')', d.trx_id);
  END IF;
  RETURN jsonb_build_object('ok', true, 'amount', d.amount, 'bonus', v_bonus, 'balance', v_new, 'visitor_id', d.visitor_id);
END $function$;