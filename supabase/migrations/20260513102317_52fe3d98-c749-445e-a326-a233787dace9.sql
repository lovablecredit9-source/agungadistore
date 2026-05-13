CREATE OR REPLACE FUNCTION public.report_chat_violation(p_visitor_id text, p_kind text, p_detail text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' THEN RETURN 0; END IF;
  INSERT INTO public.chat_violations(visitor_id, kind, detail) VALUES (p_visitor_id, p_kind, LEFT(COALESCE(p_detail,''),300));
  SELECT COUNT(*) INTO v_count FROM public.chat_violations
   WHERE visitor_id = p_visitor_id AND created_at > now() - interval '24 hours';
  -- Auto-blokir dinonaktifkan: cukup catat pelanggaran tanpa membuat ban.
  RETURN v_count;
END;
$function$;