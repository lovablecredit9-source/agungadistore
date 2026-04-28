CREATE OR REPLACE FUNCTION public.get_admin_response_rate()
RETURNS TABLE(rate numeric, total_chats bigint, replied_chats bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint := 0;
  v_replied bigint := 0;
BEGIN
  -- Product chats: count chats that have at least one user message
  WITH pc AS (
    SELECT pc.id,
      EXISTS(SELECT 1 FROM public.product_chat_messages m WHERE m.chat_id = pc.id AND m.sender_type = 'visitor') AS has_user,
      EXISTS(SELECT 1 FROM public.product_chat_messages m WHERE m.chat_id = pc.id AND m.sender_type = 'admin') AS has_admin
    FROM public.product_chats pc
  )
  SELECT COUNT(*) FILTER (WHERE has_user), COUNT(*) FILTER (WHERE has_user AND has_admin)
  INTO v_total, v_replied FROM pc;

  -- Add ticket messages
  WITH tk AS (
    SELECT t.id,
      EXISTS(SELECT 1 FROM public.ticket_messages m WHERE m.ticket_id = t.id AND m.sender_type = 'user') AS has_user,
      EXISTS(SELECT 1 FROM public.ticket_messages m WHERE m.ticket_id = t.id AND m.sender_type = 'admin') AS has_admin
    FROM public.tickets t
  )
  SELECT v_total + COUNT(*) FILTER (WHERE has_user),
         v_replied + COUNT(*) FILTER (WHERE has_user AND has_admin)
  INTO v_total, v_replied FROM tk;

  IF v_total = 0 THEN
    RETURN QUERY SELECT 100::numeric, 0::bigint, 0::bigint;
  ELSE
    RETURN QUERY SELECT ROUND((v_replied::numeric / v_total::numeric) * 100, 0), v_total, v_replied;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_response_rate() TO anon, authenticated;