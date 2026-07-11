CREATE OR REPLACE FUNCTION public.get_account_status(p_visitor_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_banned boolean := false;
  v_ban_reason text;
  v_violations integer := 0;
  v_ban_count integer := 0;
  v_names jsonb;
  v_status text;
BEGIN
  SELECT true, reason INTO v_banned, v_ban_reason
  FROM public.account_bans
  WHERE visitor_id = p_visitor_id AND is_active = true
    AND (is_permanent = true OR banned_until IS NULL OR banned_until > now())
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT COALESCE(count(*), 0)::integer INTO v_ban_count
  FROM public.account_bans
  WHERE visitor_id = p_visitor_id;

  SELECT COALESCE(count(*), 0)::integer INTO v_violations
  FROM public.chat_violations WHERE visitor_id = p_visitor_id;

  v_violations := v_violations + COALESCE(
    (SELECT violation_count FROM public.comment_restrictions WHERE visitor_id = p_visitor_id), 0);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('old', old_username, 'new', new_username, 'at', changed_at) ORDER BY changed_at DESC), '[]'::jsonb)
  INTO v_names
  FROM public.balance_name_changes WHERE visitor_id = p_visitor_id;

  IF v_banned THEN
    v_status := 'red';
  ELSIF v_ban_count > 0 OR v_violations > 0 THEN
    v_status := 'yellow';
  ELSE
    v_status := 'green';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'violations', v_violations,
    'ban_count', v_ban_count,
    'ban_reason', v_ban_reason,
    'previous_names', COALESCE(v_names, '[]'::jsonb)
  );
END;
$function$;