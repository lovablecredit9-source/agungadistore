CREATE OR REPLACE FUNCTION public.anon_chat_start_friend_session(p_visitor text, p_my_nickname text, p_my_gender text, p_friend_visitor text)
 RETURNS TABLE(session_id uuid, partner_nickname text, partner_gender text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_friend_nick TEXT;
  v_existing UUID;
  v_id UUID;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.anon_chat_friends WHERE visitor_id = p_visitor AND friend_visitor = p_friend_visitor) THEN
    RAISE EXCEPTION 'NOT_FRIENDS';
  END IF;

  SELECT friend_nickname INTO v_friend_nick FROM public.anon_chat_friends WHERE visitor_id = p_visitor AND friend_visitor = p_friend_visitor;

  -- Reuse the most recent session between these two friends (any status) so history persists
  SELECT id INTO v_existing FROM public.anon_chat_sessions
   WHERE ((visitor_a = p_visitor AND visitor_b = p_friend_visitor) OR (visitor_a = p_friend_visitor AND visitor_b = p_visitor))
   ORDER BY created_at DESC LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.anon_chat_sessions
       SET status = 'active', ended_at = NULL, nickname_a = CASE WHEN visitor_a = p_visitor THEN p_my_nickname ELSE nickname_a END,
           nickname_b = CASE WHEN visitor_b = p_visitor THEN p_my_nickname ELSE nickname_b END
     WHERE id = v_existing;
    RETURN QUERY SELECT v_existing, v_friend_nick, NULL::TEXT; RETURN;
  END IF;

  INSERT INTO public.anon_chat_sessions(visitor_a, visitor_b, nickname_a, nickname_b, gender_a, gender_b, interest)
  VALUES (p_visitor, p_friend_visitor, p_my_nickname, v_friend_nick, p_my_gender, NULL, 'friend')
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, v_friend_nick, NULL::TEXT;
END;
$function$;