CREATE OR REPLACE FUNCTION public.gem_purchase_pay(
  p_visitor_id text, p_account_id uuid, p_source text, p_total bigint,
  p_gems integer, p_package_id text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_main bigint; v_game bigint := 0; v_gb_id uuid;
  v_from_game bigint := 0; v_from_main bigint := 0; v_label text;
BEGIN
  IF p_total <= 0 OR p_gems < 0 THEN RAISE EXCEPTION 'Nominal tidak valid'; END IF;
  SELECT balance INTO v_main FROM user_balances WHERE id = p_account_id FOR UPDATE;
  IF v_main IS NULL THEN RAISE EXCEPTION 'Akun saldo tidak ditemukan'; END IF;
  SELECT id, amount INTO v_gb_id, v_game FROM game_balance WHERE visitor_id = p_visitor_id FOR UPDATE;
  v_game := COALESCE(v_game, 0);

  IF p_source = 'game' THEN
    IF v_game < p_total THEN
      RETURN jsonb_build_object('ok', false, 'error', format('Saldo IN kurang. Butuh Rp%s, tersedia Rp%s.', to_char(p_total,'FM999G999G999G999'), to_char(v_game,'FM999G999G999G999')));
    END IF;
    v_from_game := p_total; v_label := 'Saldo IN';
  ELSIF p_source = 'main' THEN
    IF v_main < p_total THEN
      RETURN jsonb_build_object('ok', false, 'error', format('Saldo Utama kurang. Butuh Rp%s, tersedia Rp%s.', to_char(p_total,'FM999G999G999G999'), to_char(v_main,'FM999G999G999G999')));
    END IF;
    v_from_main := p_total; v_label := 'Saldo Utama';
  ELSE
    v_from_game := LEAST(v_game, p_total);
    v_from_main := p_total - v_from_game;
    IF v_main < v_from_main THEN
      RETURN jsonb_build_object('ok', false, 'error', format('Saldo tidak cukup. Butuh Rp%s, Saldo IN Rp%s + Saldo Utama Rp%s.', to_char(p_total,'FM999G999G999G999'), to_char(v_game,'FM999G999G999G999'), to_char(v_main,'FM999G999G999G999')));
    END IF;
    v_label := CASE WHEN v_from_game > 0 AND v_from_main > 0 THEN 'Saldo IN + Saldo Utama' WHEN v_from_game > 0 THEN 'Saldo IN' ELSE 'Saldo Utama' END;
  END IF;

  IF v_from_game > 0 THEN
    UPDATE game_balance SET amount = amount - v_from_game, total_spent = COALESCE(total_spent,0) + v_from_game, updated_at = now() WHERE id = v_gb_id;
    INSERT INTO game_balance_transactions(visitor_id, type, amount, description, reference_id)
      VALUES (p_visitor_id, 'spend', -v_from_game, p_description || ' [Saldo IN]', p_package_id);
  END IF;
  IF v_from_main > 0 THEN
    UPDATE user_balances SET balance = balance - v_from_main, updated_at = now() WHERE id = p_account_id;
    INSERT INTO balance_transactions(visitor_id, amount, type, description)
      VALUES (p_visitor_id, -v_from_main, 'gem_purchase', p_description || ' [Saldo Utama]');
  END IF;
  IF p_gems > 0 THEN PERFORM add_account_gems(p_visitor_id, p_gems); END IF;
  INSERT INTO gem_transactions(visitor_id, amount, type, description, reference_id)
    VALUES (p_visitor_id, p_gems, 'purchase', p_description || ' [' || v_label || ']', p_package_id);

  RETURN jsonb_build_object('ok', true, 'paid_from_game', v_from_game, 'paid_from_main', v_from_main,
    'source_label', v_label, 'new_balance', v_main - v_from_main, 'game_balance_remaining', v_game - v_from_game);
END $$;
REVOKE ALL ON FUNCTION public.gem_purchase_pay(text, uuid, text, bigint, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gem_purchase_pay(text, uuid, text, bigint, integer, text, text) TO service_role;