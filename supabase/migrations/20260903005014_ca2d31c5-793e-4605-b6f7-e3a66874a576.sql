CREATE OR REPLACE FUNCTION public.get_store_premium_info(p_visitor_id text)
RETURNS TABLE(is_premium boolean, plan_name text, expires_at timestamp with time zone, days_left integer, is_locked boolean, lock_reason text, locked_until timestamp with time zone)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ub_id UUID;
  v_sub RECORD;
BEGIN
  SELECT blh.user_balance_id INTO v_ub_id
  FROM public.balance_login_history blh
  WHERE blh.visitor_id = p_visitor_id
  ORDER BY blh.logged_in_at DESC
  LIMIT 1;

  IF v_ub_id IS NULL THEN
    SELECT ub.id INTO v_ub_id
    FROM public.user_balances ub
    WHERE ub.visitor_id = p_visitor_id
    LIMIT 1;
  END IF;

  SELECT s.plan_name, s.expires_at, s.locked_until, s.lock_reason INTO v_sub
  FROM public.store_premium_subscriptions s
  WHERE s.is_active = true
    AND s.expires_at > now()
    AND (
      s.visitor_id = p_visitor_id
      OR (v_ub_id IS NOT NULL AND s.user_balance_id = v_ub_id)
      OR (v_ub_id IS NOT NULL AND s.visitor_id IN (
            SELECT blh2.visitor_id FROM public.balance_login_history blh2 WHERE blh2.user_balance_id = v_ub_id
            UNION
            SELECT ub2.visitor_id FROM public.user_balances ub2 WHERE ub2.id = v_ub_id
      ))
    )
  ORDER BY s.expires_at DESC
  LIMIT 1;

  IF v_sub.expires_at IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TIMESTAMPTZ, 0, false, NULL::TEXT, NULL::TIMESTAMPTZ;
  ELSIF v_sub.locked_until IS NOT NULL AND v_sub.locked_until > now() THEN
    RETURN QUERY SELECT false, v_sub.plan_name::TEXT, v_sub.expires_at::TIMESTAMPTZ,
      GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_sub.expires_at - now())) / 86400)::INTEGER),
      true, v_sub.lock_reason::TEXT, v_sub.locked_until::TIMESTAMPTZ;
  ELSE
    RETURN QUERY SELECT true, v_sub.plan_name::TEXT, v_sub.expires_at::TIMESTAMPTZ,
      GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_sub.expires_at - now())) / 86400)::INTEGER),
      false, NULL::TEXT, NULL::TIMESTAMPTZ;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_store_premium(p_visitor_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_premium FROM public.get_store_premium_info(p_visitor_id) LIMIT 1), false);
$$;