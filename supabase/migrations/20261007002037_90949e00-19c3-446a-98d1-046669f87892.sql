CREATE OR REPLACE FUNCTION public.create_deposit_atomic(p_visitor_id text, p_username text, p_amount bigint, p_method text, p_trx_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r record; v_dup boolean := false;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('deposit:' || p_visitor_id));
  SELECT id, visitor_id, username, amount, payment_method, trx_id, status, created_at INTO r FROM deposits
   WHERE visitor_id = p_visitor_id AND amount = p_amount AND payment_method = p_method AND status = 'pending'
     AND created_at >= now() - interval '30 seconds'
   ORDER BY created_at DESC LIMIT 1;
  IF r.id IS NOT NULL THEN v_dup := true;
  ELSE
    INSERT INTO deposits(visitor_id, username, amount, payment_method, trx_id)
    VALUES (p_visitor_id, p_username, p_amount, p_method, p_trx_id)
    RETURNING id, visitor_id, username, amount, payment_method, trx_id, status, created_at INTO r;
  END IF;
  RETURN jsonb_build_object('duplicate', v_dup, 'deposit', to_jsonb(r));
END $$;
REVOKE ALL ON FUNCTION public.create_deposit_atomic(text, text, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_deposit_atomic(text, text, bigint, text, text) TO service_role;