-- Snapshot profile picture URL per pesan agar tidak ikut berubah saat user WA mengganti foto profil
ALTER TABLE public.confess_thread_messages
  ADD COLUMN IF NOT EXISTS wa_profile_pic_url TEXT,
  ADD COLUMN IF NOT EXISTS wa_display_name TEXT;

-- Tabel voucher diskon Confess (admin generate manual)
CREATE TABLE IF NOT EXISTS public.confess_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.confess_vouchers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.confess_vouchers TO authenticated;
GRANT ALL ON public.confess_vouchers TO service_role;

ALTER TABLE public.confess_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "confess_vouchers_read_all" ON public.confess_vouchers FOR SELECT USING (true);
CREATE POLICY "confess_vouchers_admin_write" ON public.confess_vouchers FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.confess_voucher_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL REFERENCES public.confess_vouchers(id) ON DELETE CASCADE,
  voucher_code TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  user_balance_id UUID,
  discount_percent INTEGER NOT NULL,
  original_price BIGINT NOT NULL,
  final_price BIGINT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.confess_voucher_redemptions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.confess_voucher_redemptions TO authenticated;
GRANT ALL ON public.confess_voucher_redemptions TO service_role;

ALTER TABLE public.confess_voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "confess_vr_read_all" ON public.confess_voucher_redemptions FOR SELECT USING (true);
CREATE POLICY "confess_vr_insert_all" ON public.confess_voucher_redemptions FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_confess_vouchers_code_active ON public.confess_vouchers(code) WHERE is_active = true;

-- ============ BOT GALAU (chat anonim curhat) ============
CREATE TABLE IF NOT EXISTS public.galau_profiles (
  visitor_id TEXT NOT NULL PRIMARY KEY,
  nickname TEXT,
  avatar_preset TEXT NOT NULL DEFAULT 'cloud',
  total_sessions INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.galau_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.galau_profiles TO authenticated;
GRANT ALL ON public.galau_profiles TO service_role;

ALTER TABLE public.galau_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "galau_profiles_all" ON public.galau_profiles FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.galau_queue (
  visitor_id TEXT NOT NULL PRIMARY KEY,
  nickname TEXT,
  mood TEXT NOT NULL DEFAULT 'butuh teman',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.galau_queue TO anon, authenticated;
GRANT ALL ON public.galau_queue TO service_role;
ALTER TABLE public.galau_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "galau_queue_all" ON public.galau_queue FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.galau_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_a TEXT NOT NULL,
  visitor_b TEXT NOT NULL,
  nickname_a TEXT,
  nickname_b TEXT,
  mood_a TEXT,
  mood_b TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  ended_by TEXT,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.galau_sessions TO anon, authenticated;
GRANT ALL ON public.galau_sessions TO service_role;
ALTER TABLE public.galau_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "galau_sessions_all" ON public.galau_sessions FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_galau_sessions_pair ON public.galau_sessions(visitor_a, visitor_b, status);

CREATE TABLE IF NOT EXISTS public.galau_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.galau_sessions(id) ON DELETE CASCADE,
  sender_visitor_id TEXT NOT NULL,
  text TEXT,
  media_url TEXT,
  media_type TEXT,
  media_mime TEXT,
  media_size BIGINT,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  deleted_for TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.galau_messages TO anon, authenticated;
GRANT ALL ON public.galau_messages TO service_role;
ALTER TABLE public.galau_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "galau_messages_all" ON public.galau_messages FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_galau_messages_session ON public.galau_messages(session_id, created_at);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.galau_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.galau_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.galau_queue;

-- Storage bucket untuk media galau
INSERT INTO storage.buckets (id, name, public)
VALUES ('galau-media', 'galau-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "galau_media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'galau-media');
CREATE POLICY "galau_media_public_write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'galau-media');
CREATE POLICY "galau_media_public_update" ON storage.objects FOR UPDATE USING (bucket_id = 'galau-media');

-- Matchmaking RPC: ambil partner di antrian dengan mood sama atau apapun
CREATE OR REPLACE FUNCTION public.galau_find_match(p_visitor TEXT, p_nickname TEXT, p_mood TEXT)
RETURNS TABLE(session_id UUID, partner_visitor TEXT, partner_nickname TEXT, partner_mood TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner RECORD;
  v_sid UUID;
BEGIN
  -- Coba mood sama dulu
  SELECT * INTO v_partner FROM public.galau_queue
   WHERE visitor_id <> p_visitor AND mood = p_mood
   ORDER BY joined_at ASC LIMIT 1;
  IF v_partner.visitor_id IS NULL THEN
    SELECT * INTO v_partner FROM public.galau_queue
     WHERE visitor_id <> p_visitor
     ORDER BY joined_at ASC LIMIT 1;
  END IF;

  IF v_partner.visitor_id IS NULL THEN
    -- Belum ada partner — masukkan diri ke antrian
    INSERT INTO public.galau_queue(visitor_id, nickname, mood)
    VALUES (p_visitor, p_nickname, p_mood)
    ON CONFLICT (visitor_id) DO UPDATE SET nickname = EXCLUDED.nickname, mood = EXCLUDED.mood, joined_at = now();
    RETURN;
  END IF;

  DELETE FROM public.galau_queue WHERE visitor_id IN (p_visitor, v_partner.visitor_id);

  INSERT INTO public.galau_sessions(visitor_a, visitor_b, nickname_a, nickname_b, mood_a, mood_b)
  VALUES (p_visitor, v_partner.visitor_id, p_nickname, v_partner.nickname, p_mood, v_partner.mood)
  RETURNING id INTO v_sid;

  RETURN QUERY SELECT v_sid, v_partner.visitor_id, v_partner.nickname, v_partner.mood;
END;
$$;

CREATE OR REPLACE FUNCTION public.galau_end_session(p_session UUID, p_visitor TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.galau_sessions
     SET status = 'ended', ended_by = p_visitor, ended_at = now()
   WHERE id = p_session AND status = 'active';
$$;