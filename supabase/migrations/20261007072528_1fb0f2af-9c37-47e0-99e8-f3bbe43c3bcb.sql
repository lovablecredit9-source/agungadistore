CREATE TABLE IF NOT EXISTS public.ticket_presence (
  ticket_id uuid PRIMARY KEY REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_last_seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ticket_presence TO service_role;
ALTER TABLE public.ticket_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read ticket presence" ON public.ticket_presence FOR SELECT TO authenticated USING (public.is_admin_user());
GRANT SELECT ON public.ticket_presence TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_heartbeat()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'Hanya admin'; END IF;
  INSERT INTO public.admin_presence (id, last_seen_at, updated_at) VALUES (1, now(), now())
  ON CONFLICT (id) DO UPDATE SET last_seen_at = now(), updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.support_admin_presence()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('online', coalesce(last_seen_at > now() - interval '3 minutes', false), 'last_seen_at', last_seen_at)
  FROM public.admin_presence WHERE id = 1
  UNION ALL SELECT jsonb_build_object('online', false, 'last_seen_at', null) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.support_admin_presence() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ticket_user_heartbeat(p_ticket_id uuid, p_owner_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = p_ticket_id;
  IF t.id IS NULL THEN RETURN jsonb_build_object('error','Tiket tidak ditemukan'); END IF;
  IF NOT public._ticket_owner_ok(t, p_owner_id) THEN RETURN jsonb_build_object('error','Tiket ini bukan milik akun kamu'); END IF;
  INSERT INTO public.ticket_presence (ticket_id, user_last_seen_at, updated_at) VALUES (t.id, now(), now())
  ON CONFLICT (ticket_id) DO UPDATE SET user_last_seen_at = now(), updated_at = now()
    WHERE ticket_presence.user_last_seen_at IS NULL OR ticket_presence.user_last_seen_at < now() - interval '5 seconds';
  RETURN jsonb_build_object('success', true);
END $$;
GRANT EXECUTE ON FUNCTION public.ticket_user_heartbeat(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_ticket_user_presence(p_ticket_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ls timestamptz;
BEGIN
  IF NOT public.is_admin_user() THEN RETURN jsonb_build_object('error','Hanya admin'); END IF;
  SELECT user_last_seen_at INTO ls FROM public.ticket_presence WHERE ticket_id = p_ticket_id;
  RETURN jsonb_build_object('online', coalesce(ls > now() - interval '75 seconds', false), 'last_seen_at', ls);
END $$;
REVOKE ALL ON FUNCTION public.admin_ticket_user_presence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ticket_user_presence(uuid) TO authenticated;