
CREATE TABLE IF NOT EXISTS public.anon_chat_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL UNIQUE,
  nickname TEXT,
  my_gender TEXT,
  pref_gender TEXT DEFAULT 'any',
  interest TEXT DEFAULT 'any',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anon_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_a TEXT NOT NULL,
  visitor_b TEXT NOT NULL,
  nickname_a TEXT,
  nickname_b TEXT,
  gender_a TEXT,
  gender_b TEXT,
  interest TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  ended_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_anon_sessions_a ON public.anon_chat_sessions(visitor_a, status);
CREATE INDEX IF NOT EXISTS idx_anon_sessions_b ON public.anon_chat_sessions(visitor_b, status);

CREATE TABLE IF NOT EXISTS public.anon_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.anon_chat_sessions(id) ON DELETE CASCADE,
  sender_visitor_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anon_msg_session ON public.anon_chat_messages(session_id, created_at);

ALTER TABLE public.anon_chat_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anon_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anon_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon queue all" ON public.anon_chat_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon sessions all" ON public.anon_chat_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon messages all" ON public.anon_chat_messages FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.anon_chat_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.anon_chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.anon_chat_messages;

ALTER TABLE public.anon_chat_queue REPLICA IDENTITY FULL;
ALTER TABLE public.anon_chat_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.anon_chat_messages REPLICA IDENTITY FULL;

-- Atomic matchmaking function
CREATE OR REPLACE FUNCTION public.anon_chat_find_or_queue(
  p_visitor TEXT,
  p_nickname TEXT,
  p_my_gender TEXT,
  p_pref_gender TEXT,
  p_interest TEXT
) RETURNS TABLE(session_id UUID, partner_nickname TEXT, partner_gender TEXT, queued BOOLEAN)
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

  -- Try find a match in queue
  SELECT * INTO v_match FROM public.anon_chat_queue q
   WHERE q.visitor_id <> p_visitor
     AND (p_pref_gender = 'any' OR q.my_gender = p_pref_gender OR q.my_gender IS NULL)
     AND (q.pref_gender = 'any' OR q.pref_gender = p_my_gender OR p_my_gender IS NULL)
     AND (p_interest = 'any' OR q.interest = 'any' OR q.interest = p_interest)
   ORDER BY q.created_at ASC LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF v_match.id IS NOT NULL THEN
    DELETE FROM public.anon_chat_queue WHERE id = v_match.id;
    DELETE FROM public.anon_chat_queue WHERE visitor_id = p_visitor;
    INSERT INTO public.anon_chat_sessions(visitor_a, visitor_b, nickname_a, nickname_b, gender_a, gender_b, interest)
    VALUES (v_match.visitor_id, p_visitor, v_match.nickname, p_nickname, v_match.my_gender, p_my_gender,
            CASE WHEN p_interest = v_match.interest THEN p_interest ELSE 'any' END)
    RETURNING id INTO v_session;
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

CREATE OR REPLACE FUNCTION public.anon_chat_end_session(p_session UUID, p_visitor TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.anon_chat_sessions
     SET status = 'ended', ended_by = p_visitor, ended_at = now()
   WHERE id = p_session AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.anon_chat_leave_queue(p_visitor TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.anon_chat_queue WHERE visitor_id = p_visitor;
$$;
