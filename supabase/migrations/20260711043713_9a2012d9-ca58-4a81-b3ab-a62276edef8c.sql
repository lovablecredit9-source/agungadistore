ALTER TABLE public.user_balances ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE OR REPLACE FUNCTION public.touch_user_presence(p_visitor_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ub_id uuid;
BEGIN
  IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' THEN RETURN; END IF;

  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC
  LIMIT 1;

  IF v_ub_id IS NULL THEN
    SELECT id INTO v_ub_id FROM public.user_balances WHERE visitor_id = p_visitor_id LIMIT 1;
  END IF;

  IF v_ub_id IS NOT NULL THEN
    UPDATE public.user_balances SET last_seen_at = now() WHERE id = v_ub_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_user_presence(text) TO anon, authenticated, service_role;