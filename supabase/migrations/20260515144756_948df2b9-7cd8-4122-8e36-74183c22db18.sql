CREATE OR REPLACE FUNCTION public.anon_chat_find_or_queue(p_visitor text, p_nickname text, p_my_gender text, p_pref_gender text, p_interest text)
 RETURNS TABLE(session_id uuid, partner_nickname text, partner_gender text, queued boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match RECORD;
  v_existing UUID;
  v_session UUID;
BEGIN
  -- Kalau sesi aktif terakhir adalah dengan orang yang sudah jadi teman,
  -- jangan dikembalikan lagi saat user menekan Cari Anon Acak.
  UPDATE public.anon_chat_sessions s
     SET status = 'ended', ended_by = p_visitor, ended_at = COALESCE(s.ended_at, now())
   WHERE s.status = 'active'
     AND (s.visitor_a = p_visitor OR s.visitor_b = p_visitor)
     AND EXISTS (
       SELECT 1
       FROM public.anon_chat_friends f
       WHERE (f.visitor_id = p_visitor AND f.friend_visitor = CASE WHEN s.visitor_a = p_visitor THEN s.visitor_b ELSE s.visitor_a END)
          OR (f.friend_visitor = p_visitor AND f.visitor_id = CASE WHEN s.visitor_a = p_visitor THEN s.visitor_b ELSE s.visitor_a END)
     );

  SELECT id INTO v_existing FROM public.anon_chat_sessions s
   WHERE s.status = 'active'
     AND (s.visitor_a = p_visitor OR s.visitor_b = p_visitor)
     AND NOT EXISTS (
       SELECT 1
       FROM public.anon_chat_friends f
       WHERE (f.visitor_id = p_visitor AND f.friend_visitor = CASE WHEN s.visitor_a = p_visitor THEN s.visitor_b ELSE s.visitor_a END)
          OR (f.friend_visitor = p_visitor AND f.visitor_id = CASE WHEN s.visitor_a = p_visitor THEN s.visitor_b ELSE s.visitor_a END)
     )
   ORDER BY s.created_at DESC LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY
      SELECT s.id,
             CASE WHEN s.visitor_a = p_visitor THEN s.nickname_b ELSE s.nickname_a END,
             CASE WHEN s.visitor_a = p_visitor THEN s.gender_b ELSE s.gender_a END,
             FALSE
      FROM public.anon_chat_sessions s WHERE s.id = v_existing;
    RETURN;
  END IF;

  SELECT * INTO v_match FROM public.anon_chat_queue q
   WHERE q.visitor_id <> p_visitor
     AND (p_pref_gender = 'any' OR q.my_gender = p_pref_gender)
     AND (COALESCE(q.pref_gender, 'any') = 'any' OR q.pref_gender = p_my_gender)
     AND (p_interest = 'any' OR q.interest = p_interest)
     AND (COALESCE(q.interest, 'any') = 'any' OR q.interest = p_interest)
     AND NOT EXISTS (
       SELECT 1 FROM public.anon_chat_blocked_matches b
        WHERE (b.visitor_id = p_visitor AND b.blocked_visitor = q.visitor_id)
           OR (b.visitor_id = q.visitor_id AND b.blocked_visitor = p_visitor)
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.anon_chat_friends f
        WHERE (f.visitor_id = p_visitor AND f.friend_visitor = q.visitor_id)
           OR (f.visitor_id = q.visitor_id AND f.friend_visitor = p_visitor)
     )
   ORDER BY q.created_at ASC LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF v_match.id IS NOT NULL THEN
    DELETE FROM public.anon_chat_queue WHERE id = v_match.id;
    DELETE FROM public.anon_chat_queue WHERE visitor_id = p_visitor;
    INSERT INTO public.anon_chat_sessions(visitor_a, visitor_b, nickname_a, nickname_b, gender_a, gender_b, interest)
    VALUES (v_match.visitor_id, p_visitor, v_match.nickname, p_nickname, v_match.my_gender, p_my_gender,
            CASE WHEN p_interest = v_match.interest THEN p_interest ELSE 'any' END)
    RETURNING id INTO v_session;
    PERFORM public.anon_chat_log_match(p_visitor, v_match.visitor_id, v_match.nickname, v_session);
    PERFORM public.anon_chat_log_match(v_match.visitor_id, p_visitor, p_nickname, v_session);
    RETURN QUERY SELECT v_session, v_match.nickname, v_match.my_gender, FALSE;
  ELSE
    INSERT INTO public.anon_chat_queue(visitor_id, nickname, my_gender, pref_gender, interest)
    VALUES (p_visitor, p_nickname, p_my_gender, p_pref_gender, p_interest)
    ON CONFLICT (visitor_id) DO UPDATE SET
      nickname = EXCLUDED.nickname,
      my_gender = EXCLUDED.my_gender,
      pref_gender = EXCLUDED.pref_gender,
      interest = EXCLUDED.interest,
      created_at = now();
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, TRUE;
  END IF;
END;
$function$;