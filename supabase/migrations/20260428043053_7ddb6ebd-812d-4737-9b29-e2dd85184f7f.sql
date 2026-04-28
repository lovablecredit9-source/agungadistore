DROP FUNCTION IF EXISTS public.generate_follow_voucher(text);

CREATE FUNCTION public.generate_follow_voucher(p_visitor_id text)
RETURNS TABLE(code text, discount_amount bigint, expires_at timestamp with time zone, already_claimed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ub_id uuid;
  v_code text;
  v_expires timestamptz;
  v_existing_count int;
BEGIN
  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC
  LIMIT 1;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.discount_vouchers
  WHERE source = 'follow_store'
    AND (
      (v_ub_id IS NOT NULL AND user_balance_id = v_ub_id)
      OR visitor_id = p_visitor_id
    );

  IF v_existing_count > 0 THEN
    RETURN QUERY SELECT NULL::text, 0::bigint, NULL::timestamptz, true;
    RETURN;
  END IF;

  LOOP
    v_code := 'FOLLOW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.discount_vouchers WHERE code = v_code);
  END LOOP;

  v_expires := now() + interval '30 days';

  INSERT INTO public.discount_vouchers (code, discount_amount, max_uses, used_count, is_active, expires_at, visitor_id, user_balance_id, source)
  VALUES (v_code, 1000, 1, 0, true, v_expires, p_visitor_id, v_ub_id, 'follow_store');

  PERFORM public.create_notification(
    p_visitor_id,
    '🎁 Voucher Diskon Rp 1.000',
    'Terima kasih sudah mengikuti! Kode: ' || v_code || ' (berlaku 30 hari, sekali pakai saat checkout produk).',
    'success',
    v_code
  );

  RETURN QUERY SELECT v_code, 1000::bigint, v_expires, false;
END;
$function$;