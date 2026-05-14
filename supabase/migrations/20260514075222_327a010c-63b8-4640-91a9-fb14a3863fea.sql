
-- 1. Call logs
CREATE TABLE IF NOT EXISTS public.anon_chat_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  partner_visitor TEXT NOT NULL,
  partner_nickname TEXT,
  session_id UUID,
  direction TEXT NOT NULL DEFAULT 'outgoing', -- outgoing | incoming
  status TEXT NOT NULL DEFAULT 'missed', -- answered | missed | declined | cancelled | ended
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anon_call_logs_visitor ON public.anon_chat_call_logs(visitor_id, created_at DESC);
ALTER TABLE public.anon_chat_call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_call_logs_all" ON public.anon_chat_call_logs;
CREATE POLICY "anon_call_logs_all" ON public.anon_chat_call_logs FOR ALL USING (true) WITH CHECK (true);

-- 2. Blocked matches (so they cannot be re-matched in random search)
CREATE TABLE IF NOT EXISTS public.anon_chat_blocked_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  blocked_visitor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, blocked_visitor)
);
CREATE INDEX IF NOT EXISTS idx_anon_blocked_visitor ON public.anon_chat_blocked_matches(visitor_id);
ALTER TABLE public.anon_chat_blocked_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_blocked_all" ON public.anon_chat_blocked_matches;
CREATE POLICY "anon_blocked_all" ON public.anon_chat_blocked_matches FOR ALL USING (true) WITH CHECK (true);

-- 3. Match history
CREATE TABLE IF NOT EXISTS public.anon_chat_match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  partner_visitor TEXT NOT NULL,
  partner_nickname TEXT,
  session_id UUID,
  last_session_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, partner_visitor)
);
CREATE INDEX IF NOT EXISTS idx_anon_match_visitor ON public.anon_chat_match_history(visitor_id, last_session_at DESC);
ALTER TABLE public.anon_chat_match_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_match_all" ON public.anon_chat_match_history;
CREATE POLICY "anon_match_all" ON public.anon_chat_match_history FOR ALL USING (true) WITH CHECK (true);

-- 4. New columns on anon_chat_messages
ALTER TABLE public.anon_chat_messages
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT,
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS view_once BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audio_duration INTEGER;

-- 5. Storage bucket for anon chat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('anon-chat-media', 'anon-chat-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "anon_media_read" ON storage.objects;
CREATE POLICY "anon_media_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'anon-chat-media');

DROP POLICY IF EXISTS "anon_media_write" ON storage.objects;
CREATE POLICY "anon_media_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'anon-chat-media');

DROP POLICY IF EXISTS "anon_media_update" ON storage.objects;
CREATE POLICY "anon_media_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'anon-chat-media');

DROP POLICY IF EXISTS "anon_media_delete" ON storage.objects;
CREATE POLICY "anon_media_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'anon-chat-media');

-- 6. Helper: log match (called when entering session)
CREATE OR REPLACE FUNCTION public.anon_chat_log_match(
  p_visitor TEXT,
  p_partner TEXT,
  p_partner_nick TEXT,
  p_session UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.anon_chat_match_history(visitor_id, partner_visitor, partner_nickname, session_id, last_session_at)
  VALUES (p_visitor, p_partner, p_partner_nick, p_session, now())
  ON CONFLICT (visitor_id, partner_visitor) DO UPDATE
    SET partner_nickname = COALESCE(EXCLUDED.partner_nickname, public.anon_chat_match_history.partner_nickname),
        session_id = EXCLUDED.session_id,
        last_session_at = now();
END;
$$;

-- 7. Replace find_or_queue to filter blocked partners on both sides
CREATE OR REPLACE FUNCTION public.anon_chat_find_or_queue(
  p_visitor text,
  p_nickname text,
  p_my_gender text,
  p_pref_gender text,
  p_interest text
) RETURNS TABLE(session_id uuid, partner_nickname text, partner_gender text, queued boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_existing UUID;
  v_session UUID;
BEGIN
  -- Existing active session?
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

  -- Try find a match in queue, excluding blocked
  SELECT * INTO v_match FROM public.anon_chat_queue q
   WHERE q.visitor_id <> p_visitor
     AND (p_pref_gender = 'any' OR q.my_gender = p_pref_gender OR q.my_gender IS NULL)
     AND (q.pref_gender = 'any' OR q.pref_gender = p_my_gender OR p_my_gender IS NULL)
     AND (p_interest = 'any' OR q.interest = 'any' OR q.interest = p_interest)
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
    -- log history both sides
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

-- 8. Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.anon_chat_call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.anon_chat_match_history;
