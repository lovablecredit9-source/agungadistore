CREATE OR REPLACE FUNCTION public.streak_freeze_price() RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT 1000::bigint $$;
GRANT EXECUTE ON FUNCTION public.streak_freeze_price() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.buy_streak_freeze(p_visitor_id text, p_source text, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_price bigint := public.streak_freeze_price(); v_ref text; s record; pay jsonb; v_new int;
BEGIN
  IF p_request_id IS NULL OR length(p_request_id) < 8 OR length(p_request_id) > 80 THEN RETURN jsonb_build_object('error','Permintaan tidak valid'); END IF;
  v_ref := 'freeze:' || p_request_id;
  PERFORM pg_advisory_xact_lock(hashtext(v_ref));
  IF EXISTS (SELECT 1 FROM balance_transactions WHERE purchase_ref = v_ref) THEN
    SELECT freeze_count INTO v_new FROM daily_streaks WHERE visitor_id = p_visitor_id;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'freeze_count', v_new, 'price', v_price);
  END IF;
  SELECT id, freeze_count INTO s FROM daily_streaks WHERE visitor_id = p_visitor_id FOR UPDATE;
  IF s.id IS NULL THEN RETURN jsonb_build_object('error','Belum ada streak. Klaim dulu hari ini!'); END IF;
  pay := public._account_pay(p_visitor_id, v_price, p_source, 'Beli Streak Freeze', v_ref);
  IF pay ? 'error' THEN RETURN pay; END IF;
  UPDATE daily_streaks SET freeze_count = coalesce(freeze_count,0) + 1, updated_at = now() WHERE id = s.id RETURNING freeze_count INTO v_new;
  INSERT INTO balance_transactions (visitor_id, type, amount, description, purchase_ref)
  VALUES (p_visitor_id, 'purchase', v_price, 'Beli Streak Freeze (Pelindung Streak) · ' || (pay->>'source_label'), v_ref);
  RETURN pay || jsonb_build_object('success', true, 'freeze_count', v_new, 'price', v_price);
END $$;
REVOKE ALL ON FUNCTION public.buy_streak_freeze(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_streak_freeze(text, text, text) TO service_role;