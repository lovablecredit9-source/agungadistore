
-- 1) Read receipts: delivered_at + read_at columns
ALTER TABLE public.anon_chat_messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Backfill: anything is_read=true gets read_at + delivered_at = created_at
UPDATE public.anon_chat_messages
   SET read_at = COALESCE(read_at, created_at),
       delivered_at = COALESCE(delivered_at, created_at)
 WHERE is_read = true AND read_at IS NULL;

-- 2) RPCs to mark delivered / read in batch
CREATE OR REPLACE FUNCTION public.anon_chat_mark_delivered(p_session uuid, p_visitor text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.anon_chat_messages
     SET delivered_at = now()
   WHERE session_id = p_session
     AND sender_visitor_id <> p_visitor
     AND delivered_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.anon_chat_mark_read(p_session uuid, p_visitor text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.anon_chat_messages
     SET delivered_at = COALESCE(delivered_at, now()),
         read_at = COALESCE(read_at, now()),
         is_read = true
   WHERE session_id = p_session
     AND sender_visitor_id <> p_visitor
     AND read_at IS NULL;
$$;

-- 3) Strict matchmaking: jika user pilih spesifik, harus cocok mutual; "any" = bebas
CREATE OR REPLACE FUNCTION public.anon_chat_find_or_queue(
  p_visitor text, p_nickname text, p_my_gender text, p_pref_gender text, p_interest text
)
RETURNS TABLE(session_id uuid, partner_nickname text, partner_gender text, queued boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_existing UUID;
  v_session UUID;
BEGIN
  SELECT id INTO v_existing FROM public.anon_chat_sessions
   WHERE status = 'active' AND (visitor_a = p_visitor OR visitor_b = p_visitor)
   ORDER BY created_at DESC LIMIT 1;
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
     -- STRICT: jika saya minta gender spesifik → partner HARUS gender itu
     AND (p_pref_gender = 'any' OR q.my_gender = p_pref_gender)
     -- STRICT: jika partner minta gender spesifik → saya HARUS gender itu
     AND (COALESCE(q.pref_gender, 'any') = 'any' OR q.pref_gender = p_my_gender)
     -- STRICT: jika saya pilih interest spesifik → partner HARUS interest yang sama
     AND (p_interest = 'any' OR q.interest = p_interest)
     -- STRICT: jika partner pilih interest spesifik → saya HARUS sama
     AND (COALESCE(q.interest, 'any') = 'any' OR q.interest = p_interest)
     AND NOT EXISTS (
       SELECT 1 FROM public.anon_chat_blocked_matches b
        WHERE (b.visitor_id = p_visitor AND b.blocked_visitor = q.visitor_id)
           OR (b.visitor_id = q.visitor_id AND b.blocked_visitor = p_visitor)
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
$$;

-- 4) Storage bucket untuk file anon chat (foto/video/dokumen/voice)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('anon-chat-media', 'anon-chat-media', true, 20971520, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 20971520;

-- Public read + open upload (mirip pola bucket lain di proyek)
DROP POLICY IF EXISTS "anon-chat-media public read" ON storage.objects;
CREATE POLICY "anon-chat-media public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'anon-chat-media');

DROP POLICY IF EXISTS "anon-chat-media open upload" ON storage.objects;
CREATE POLICY "anon-chat-media open upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'anon-chat-media');

DROP POLICY IF EXISTS "anon-chat-media open update" ON storage.objects;
CREATE POLICY "anon-chat-media open update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'anon-chat-media');

DROP POLICY IF EXISTS "anon-chat-media open delete" ON storage.objects;
CREATE POLICY "anon-chat-media open delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'anon-chat-media');

-- Tambahan kolom untuk metadata file (nama + size) supaya bubble dokumen bisa tampil
ALTER TABLE public.anon_chat_messages
  ADD COLUMN IF NOT EXISTS media_name text,
  ADD COLUMN IF NOT EXISTS media_size bigint;
