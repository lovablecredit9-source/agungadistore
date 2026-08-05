CREATE OR REPLACE FUNCTION public.delete_my_notifications(p_visitor_id text, p_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  IF p_visitor_id IS NULL OR length(trim(p_visitor_id)) = 0 THEN RETURN 0; END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    DELETE FROM public.notifications WHERE visitor_id = p_visitor_id;
  ELSE
    DELETE FROM public.notifications WHERE visitor_id = p_visitor_id AND id = ANY(p_ids);
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;