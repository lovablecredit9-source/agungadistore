
-- FRIEND REQUESTS
CREATE TABLE public.anon_chat_friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_visitor TEXT NOT NULL,
  from_nickname TEXT NOT NULL,
  to_visitor TEXT NOT NULL,
  to_nickname TEXT,
  session_id UUID REFERENCES public.anon_chat_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(from_visitor, to_visitor, status)
);
CREATE INDEX idx_anon_friend_req_to ON public.anon_chat_friend_requests(to_visitor, status);
CREATE INDEX idx_anon_friend_req_from ON public.anon_chat_friend_requests(from_visitor, status);

ALTER TABLE public.anon_chat_friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon req read all" ON public.anon_chat_friend_requests FOR SELECT USING (true);
CREATE POLICY "anon req insert all" ON public.anon_chat_friend_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "anon req update all" ON public.anon_chat_friend_requests FOR UPDATE USING (true);

-- FRIENDS (mutual entries)
CREATE TABLE public.anon_chat_friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  friend_visitor TEXT NOT NULL,
  friend_nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, friend_visitor)
);
CREATE INDEX idx_anon_friends_v ON public.anon_chat_friends(visitor_id);

ALTER TABLE public.anon_chat_friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon friends read all" ON public.anon_chat_friends FOR SELECT USING (true);
CREATE POLICY "anon friends insert all" ON public.anon_chat_friends FOR INSERT WITH CHECK (true);
CREATE POLICY "anon friends delete all" ON public.anon_chat_friends FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.anon_chat_friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.anon_chat_friends;

-- RPC: send friend request
CREATE OR REPLACE FUNCTION public.anon_chat_send_friend_request(
  p_from_visitor TEXT, p_from_nickname TEXT,
  p_to_visitor TEXT, p_to_nickname TEXT,
  p_session_id UUID
) RETURNS TABLE(request_id UUID, already_friend BOOLEAN, already_pending BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing UUID;
  v_friend BOOLEAN;
  v_id UUID;
BEGIN
  IF p_from_visitor = p_to_visitor THEN
    RAISE EXCEPTION 'CANNOT_FRIEND_SELF';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.anon_chat_friends WHERE visitor_id = p_from_visitor AND friend_visitor = p_to_visitor) INTO v_friend;
  IF v_friend THEN
    RETURN QUERY SELECT NULL::UUID, TRUE, FALSE; RETURN;
  END IF;

  SELECT id INTO v_existing FROM public.anon_chat_friend_requests
   WHERE from_visitor = p_from_visitor AND to_visitor = p_to_visitor AND status = 'pending';
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, FALSE, TRUE; RETURN;
  END IF;

  -- Auto-accept if reverse pending exists
  SELECT id INTO v_existing FROM public.anon_chat_friend_requests
   WHERE from_visitor = p_to_visitor AND to_visitor = p_from_visitor AND status = 'pending';
  IF v_existing IS NOT NULL THEN
    UPDATE public.anon_chat_friend_requests SET status = 'accepted', responded_at = now() WHERE id = v_existing;
    INSERT INTO public.anon_chat_friends(visitor_id, friend_visitor, friend_nickname)
      VALUES (p_from_visitor, p_to_visitor, COALESCE(p_to_nickname, 'Stranger')) ON CONFLICT DO NOTHING;
    INSERT INTO public.anon_chat_friends(visitor_id, friend_visitor, friend_nickname)
      VALUES (p_to_visitor, p_from_visitor, COALESCE(p_from_nickname, 'Stranger')) ON CONFLICT DO NOTHING;
    RETURN QUERY SELECT v_existing, TRUE, FALSE; RETURN;
  END IF;

  INSERT INTO public.anon_chat_friend_requests(from_visitor, from_nickname, to_visitor, to_nickname, session_id)
  VALUES (p_from_visitor, p_from_nickname, p_to_visitor, p_to_nickname, p_session_id)
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, FALSE, FALSE;
END;
$$;

-- RPC: respond
CREATE OR REPLACE FUNCTION public.anon_chat_respond_friend_request(
  p_request_id UUID, p_visitor TEXT, p_my_nickname TEXT, p_accept BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.anon_chat_friend_requests WHERE id = p_request_id AND to_visitor = p_visitor AND status = 'pending';
  IF r IS NULL THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;

  IF p_accept THEN
    UPDATE public.anon_chat_friend_requests SET status = 'accepted', responded_at = now() WHERE id = p_request_id;
    INSERT INTO public.anon_chat_friends(visitor_id, friend_visitor, friend_nickname)
      VALUES (r.to_visitor, r.from_visitor, r.from_nickname) ON CONFLICT DO NOTHING;
    INSERT INTO public.anon_chat_friends(visitor_id, friend_visitor, friend_nickname)
      VALUES (r.from_visitor, r.to_visitor, COALESCE(p_my_nickname, r.to_nickname, 'Stranger')) ON CONFLICT DO NOTHING;
  ELSE
    UPDATE public.anon_chat_friend_requests SET status = 'rejected', responded_at = now() WHERE id = p_request_id;
  END IF;
END;
$$;

-- RPC: start session with friend (find existing active or create new)
CREATE OR REPLACE FUNCTION public.anon_chat_start_friend_session(
  p_visitor TEXT, p_my_nickname TEXT, p_my_gender TEXT,
  p_friend_visitor TEXT
) RETURNS TABLE(session_id UUID, partner_nickname TEXT, partner_gender TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_friend_nick TEXT;
  v_existing UUID;
  v_id UUID;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.anon_chat_friends WHERE visitor_id = p_visitor AND friend_visitor = p_friend_visitor) THEN
    RAISE EXCEPTION 'NOT_FRIENDS';
  END IF;

  SELECT friend_nickname INTO v_friend_nick FROM public.anon_chat_friends WHERE visitor_id = p_visitor AND friend_visitor = p_friend_visitor;

  SELECT id INTO v_existing FROM public.anon_chat_sessions
   WHERE status = 'active'
     AND ((visitor_a = p_visitor AND visitor_b = p_friend_visitor) OR (visitor_a = p_friend_visitor AND visitor_b = p_visitor))
   ORDER BY created_at DESC LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, v_friend_nick, NULL::TEXT; RETURN;
  END IF;

  INSERT INTO public.anon_chat_sessions(visitor_a, visitor_b, nickname_a, nickname_b, gender_a, gender_b, interest)
  VALUES (p_visitor, p_friend_visitor, p_my_nickname, v_friend_nick, p_my_gender, NULL, 'friend')
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, v_friend_nick, NULL::TEXT;
END;
$$;
