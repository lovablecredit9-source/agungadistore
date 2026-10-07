-- 1) Hapus aksi user lama (siapa pun bisa tutup/buka tiket orang lain)
DROP FUNCTION IF EXISTS public.ticket_user_action(uuid, text, integer, text);

-- Helper: cek & ikat kepemilikan tiket
CREATE OR REPLACE FUNCTION public._ticket_owner_ok(p_ticket public.support_tickets, p_owner text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_owner IS NULL OR length(trim(p_owner)) < 6 THEN RETURN false; END IF;
  IF p_ticket.visitor_id IS NULL THEN
    UPDATE public.support_tickets SET visitor_id = p_owner WHERE id = p_ticket.id AND visitor_id IS NULL;
    RETURN true;
  END IF;
  RETURN p_ticket.visitor_id = p_owner;
END $$;
REVOKE ALL ON FUNCTION public._ticket_owner_ok(public.support_tickets, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ticket_user_action(p_ticket_id uuid, p_owner_id text, p_action text, p_rating integer DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF t.id IS NULL THEN RETURN jsonb_build_object('error','Tiket tidak ditemukan'); END IF;
  IF NOT public._ticket_owner_ok(t, p_owner_id) THEN RETURN jsonb_build_object('error','Tiket ini bukan milik akun kamu'); END IF;
  IF p_action IN ('close','reopen') THEN
    RETURN jsonb_build_object('error','Status tiket hanya bisa diubah oleh admin');
  ELSIF p_action = 'rate' THEN
    IF t.status NOT IN ('closed','resolved') THEN RETURN jsonb_build_object('error','Rating bisa diberikan setelah tiket selesai'); END IF;
    IF t.rating IS NOT NULL THEN RETURN jsonb_build_object('error','Tiket ini sudah diberi rating'); END IF;
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN RETURN jsonb_build_object('error','Rating 1 sampai 5'); END IF;
    UPDATE public.support_tickets SET rating = p_rating, rating_note = left(COALESCE(p_note,''), 300), updated_at = now() WHERE id = t.id;
  ELSE
    RETURN jsonb_build_object('error','Aksi tidak dikenal');
  END IF;
  RETURN jsonb_build_object('success', true);
END $$;
GRANT EXECUTE ON FUNCTION public.ticket_user_action(uuid, text, text, integer, text) TO anon, authenticated;

-- 2) Aksi pesan pengguna: tandai dibaca, hapus untuk semua (pesan sendiri), hapus untuk saya
CREATE OR REPLACE FUNCTION public.ticket_user_message_action(p_ticket_id uuid, p_owner_id text, p_action text, p_message_ids uuid[], p_viewer_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets; n int := 0;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = p_ticket_id;
  IF t.id IS NULL THEN RETURN jsonb_build_object('error','Tiket tidak ditemukan'); END IF;
  IF NOT public._ticket_owner_ok(t, p_owner_id) THEN RETURN jsonb_build_object('error','Tiket ini bukan milik akun kamu'); END IF;
  IF p_message_ids IS NULL OR array_length(p_message_ids,1) IS NULL THEN RETURN jsonb_build_object('success', true, 'count', 0); END IF;
  IF p_action = 'read' THEN
    UPDATE public.ticket_messages SET is_read = true, read_at = now()
      WHERE ticket_id = t.id AND id = ANY(p_message_ids) AND sender_type <> 'user' AND NOT is_read;
  ELSIF p_action = 'delete_all' THEN
    UPDATE public.ticket_messages SET is_deleted = true, message = NULL, image_url = NULL, deleted_at = now()
      WHERE ticket_id = t.id AND id = ANY(p_message_ids) AND sender_type = 'user';
  ELSIF p_action = 'delete_me' THEN
    IF p_viewer_id IS NULL OR length(p_viewer_id) < 6 THEN RETURN jsonb_build_object('error','Identitas tidak valid'); END IF;
    UPDATE public.ticket_messages SET deleted_for = (SELECT array_agg(DISTINCT x) FROM unnest(COALESCE(deleted_for,'{}'::text[]) || p_viewer_id) x)
      WHERE ticket_id = t.id AND id = ANY(p_message_ids);
  ELSE
    RETURN jsonb_build_object('error','Aksi tidak dikenal');
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'count', n);
END $$;
GRANT EXECUTE ON FUNCTION public.ticket_user_message_action(uuid, text, text, uuid[], text) TO anon, authenticated;

-- 3) Kunci tulis pesan
DROP POLICY IF EXISTS "Anyone can update message read status" ON public.ticket_messages;
CREATE POLICY "Admin can update messages" ON public.ticket_messages FOR UPDATE TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Anyone can send messages" ON public.ticket_messages;
CREATE POLICY "Users send to active tickets, admins anywhere" ON public.ticket_messages FOR INSERT TO public
  WITH CHECK (
    public.is_admin_user()
    OR (
      sender_type = 'user'
      AND COALESCE(is_deleted, false) = false
      AND COALESCE(is_read, false) = false
      AND EXISTS (SELECT 1 FROM public.support_tickets s WHERE s.id = ticket_id AND s.status NOT IN ('closed','resolved'))
    )
  );

-- 4) Tiket baru dari pengunjung selalu bersih
DROP POLICY IF EXISTS "Anyone can create tickets" ON public.support_tickets;
CREATE POLICY "Anyone can create clean open tickets" ON public.support_tickets FOR INSERT TO public
  WITH CHECK (
    public.is_admin_user()
    OR (
      status = 'open' AND rating IS NULL AND rating_note IS NULL AND assigned_admin IS NULL
      AND closed_at IS NULL AND first_response_at IS NULL AND COALESCE(reopened_count,0) = 0
      AND COALESCE(is_premium_member,false) = false
      AND priority IN ('low','normal','high','urgent')
    )
  );