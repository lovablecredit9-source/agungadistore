
-- Drop permissive public policies on notifications
DROP POLICY IF EXISTS "Notifications viewable by everyone" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can update own notifications" ON public.notifications;

-- Deny direct SELECT/INSERT/UPDATE from anon/public (admin policies remain)
CREATE POLICY "No direct select on notifications"
  ON public.notifications FOR SELECT
  USING (false);

-- Allow admin to insert (existing admin policies preserved via is_admin_user)
CREATE POLICY "Admin can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admin can update notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Security definer RPC to fetch notifications scoped to a visitor_id
CREATE OR REPLACE FUNCTION public.get_my_notifications(p_visitor_id text, p_limit integer DEFAULT 50)
RETURNS SETOF public.notifications
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.notifications
  WHERE visitor_id = p_visitor_id
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

-- Security definer RPC to mark notifications as read for a specific visitor
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_visitor_id text, p_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notifications
  SET is_read = true
  WHERE visitor_id = p_visitor_id
    AND id = ANY(p_ids);
$$;

-- Security definer RPC for clients to create their own notification (e.g., first-visit hint)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_visitor_id text,
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_related_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.notifications (visitor_id, title, message, type, related_id)
  VALUES (p_visitor_id, p_title, p_message, p_type, p_related_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_notifications(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(text, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(text, text, text, text, text) TO anon, authenticated;
