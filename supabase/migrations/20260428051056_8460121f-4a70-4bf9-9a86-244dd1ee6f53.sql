ALTER TABLE public.discount_vouchers
ADD COLUMN IF NOT EXISTS user_balance_id uuid;

CREATE INDEX IF NOT EXISTS idx_discount_vouchers_user_balance_source
ON public.discount_vouchers(user_balance_id, source)
WHERE user_balance_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.generate_follow_voucher(text);

CREATE FUNCTION public.generate_follow_voucher(p_visitor_id text)
RETURNS TABLE(code text, discount_amount bigint, expires_at timestamptz, already_claimed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ub_id uuid;
  v_code text;
  v_expires timestamptz;
  v_existing record;
BEGIN
  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC
  LIMIT 1;

  SELECT dv.code, dv.discount_amount, dv.expires_at, dv.used_count, dv.max_uses, dv.is_active
  INTO v_existing
  FROM public.discount_vouchers dv
  WHERE dv.source = 'follow_store'
    AND (
      dv.visitor_id = p_visitor_id
      OR (v_ub_id IS NOT NULL AND dv.user_balance_id = v_ub_id)
      OR (
        v_ub_id IS NOT NULL
        AND dv.visitor_id IN (
          SELECT DISTINCT blh.visitor_id
          FROM public.balance_login_history blh
          WHERE blh.user_balance_id = v_ub_id
        )
      )
    )
  ORDER BY dv.created_at DESC
  LIMIT 1;

  IF v_existing.code IS NOT NULL THEN
    IF COALESCE(v_existing.is_active, false) = true
       AND COALESCE(v_existing.used_count, 0) < COALESCE(v_existing.max_uses, 1)
       AND (v_existing.expires_at IS NULL OR v_existing.expires_at > now()) THEN
      RETURN QUERY SELECT v_existing.code::text, v_existing.discount_amount::bigint, v_existing.expires_at::timestamptz, true;
    ELSE
      RETURN QUERY SELECT NULL::text, 0::bigint, NULL::timestamptz, true;
    END IF;
    RETURN;
  END IF;

  LOOP
    v_code := 'FOLLOW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.discount_vouchers WHERE discount_vouchers.code = v_code);
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
$$;