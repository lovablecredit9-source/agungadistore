-- Admin: setujui deposit secara atomik (status + saldo + bonus + riwayat dalam satu transaksi)
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_deposit_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF d.amount >= 10000 THEN
    v_bonus := floor(d.amount * 0.1);
    PERFORM public.add_topup_bonus_to_saldo_in(d.visitor_id, v_bonus::int);
    INSERT INTO balance_transactions(visitor_id, type, amount, description, trx_id)
      VALUES (d.visitor_id, 'topup_bonus', v_bonus, '🎁 Bonus 10% deposit → Saldo IN (TRX: ' || coalesce(d.trx_id,'') || ')', d.trx_id);
  END IF;
  RETURN jsonb_build_object('ok', true, 'amount', d.amount, 'bonus', v_bonus, 'balance', v_new, 'visitor_id', d.visitor_id);
END $$;
REVOKE ALL ON FUNCTION public.admin_approve_deposit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(uuid) TO authenticated;

-- Admin: ubah saldo secara atomik (add / subtract / reset). Subtract & reset ditolak bila saldo jadi negatif.
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_visitor_id text, p_mode text, p_amount bigint, p_note text DEFAULT NULL, p_tx_type text DEFAULT 'admin_adjustment')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before bigint; v_after bigint; v_delta bigint;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_mode IN ('subtract') AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Hanya SUPER_ADMIN yang bisa mengurangi saldo' USING ERRCODE = '42501';
  END IF;
  IF p_tx_type NOT IN ('admin_adjustment','topup','admin_reset') THEN RAISE EXCEPTION 'Jenis transaksi tidak valid'; END IF;
  SELECT balance INTO v_before FROM user_balances WHERE visitor_id = p_visitor_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'User tidak ditemukan'; END IF;
  IF p_mode = 'reset' THEN v_after := 0;
  ELSIF p_mode IN ('add','subtract') THEN
    IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Jumlah harus lebih dari 0'; END IF;
    v_after := CASE WHEN p_mode = 'add' THEN v_before + p_amount ELSE v_before - p_amount END;
  ELSE RAISE EXCEPTION 'Mode tidak valid'; END IF;
  IF v_after < 0 THEN RAISE EXCEPTION 'Saldo tidak boleh negatif'; END IF;
  v_delta := v_after - v_before;
  UPDATE user_balances SET balance = v_after, updated_at = now() WHERE visitor_id = p_visitor_id;
  IF v_delta <> 0 THEN
    INSERT INTO balance_transactions(visitor_id, type, amount, description)
      VALUES (p_visitor_id, p_tx_type, v_delta, coalesce(nullif(trim(p_note),''), 'Koreksi saldo oleh admin'));
  END IF;
  RETURN jsonb_build_object('ok', true, 'before', v_before, 'after', v_after, 'delta', v_delta);
END $$;
REVOKE ALL ON FUNCTION public.admin_adjust_balance(text, text, bigint, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(text, text, bigint, text, text) TO authenticated;