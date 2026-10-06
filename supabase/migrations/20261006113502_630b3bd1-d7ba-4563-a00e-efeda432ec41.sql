
-- ===== LIVE SUPPORT =====
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS assigned_admin text,
  ADD COLUMN IF NOT EXISTS rating smallint,
  ADD COLUMN IF NOT EXISTS rating_note text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS visitor_id text;

CREATE TABLE IF NOT EXISTS public.ticket_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author text,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_internal_notes TO authenticated;
GRANT ALL ON public.ticket_internal_notes TO service_role;
ALTER TABLE public.ticket_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage internal notes" ON public.ticket_internal_notes FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.ticket_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  message text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_quick_replies TO authenticated;
GRANT ALL ON public.ticket_quick_replies TO service_role;
ALTER TABLE public.ticket_quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage quick replies" ON public.ticket_quick_replies FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
INSERT INTO public.ticket_quick_replies(label, message, sort_order) VALUES
  ('Sedang dicek', 'Halo, kami sedang mengecek masalah Anda.', 1),
  ('Terima kasih', 'Terima kasih sudah menunggu.', 2),
  ('Sudah diperbaiki', 'Masalah sudah kami perbaiki.', 3),
  ('Coba lagi', 'Silakan coba kembali.', 4),
  ('Minta info', 'Boleh dibantu kirimkan ID transaksi dan screenshot kendalanya?', 5);

CREATE TABLE IF NOT EXISTS public.admin_presence (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_presence TO anon, authenticated;
GRANT ALL ON public.admin_presence TO service_role;
ALTER TABLE public.admin_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Presence readable by everyone" ON public.admin_presence FOR SELECT USING (true);
INSERT INTO public.admin_presence(id, last_seen_at) VALUES (1, NULL) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_heartbeat()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'Hanya admin'; END IF;
  UPDATE public.admin_presence SET last_seen_at = now(), updated_at = now() WHERE id = 1;
END $$;

CREATE OR REPLACE FUNCTION public.support_admin_online()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT last_seen_at > now() - interval '3 minutes' FROM public.admin_presence WHERE id = 1), false);
$$;

-- Aksi pengguna atas tiket miliknya: tutup, buka kembali, beri rating
CREATE OR REPLACE FUNCTION public.ticket_user_action(p_ticket_id uuid, p_action text, p_rating integer DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF t.id IS NULL THEN RETURN jsonb_build_object('error','Tiket tidak ditemukan'); END IF;
  IF p_action = 'close' THEN
    UPDATE public.support_tickets SET status = 'closed', closed_at = now(), updated_at = now() WHERE id = t.id;
  ELSIF p_action = 'reopen' THEN
    IF t.status NOT IN ('closed','resolved') THEN RETURN jsonb_build_object('error','Tiket masih aktif'); END IF;
    UPDATE public.support_tickets SET status = 'open', closed_at = NULL, reopened_count = reopened_count + 1, updated_at = now() WHERE id = t.id;
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

-- Pesan baru: catat waktu, respon pertama admin, notifikasi ke pengguna
CREATE OR REPLACE FUNCTION public.ticket_after_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF t.id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.support_tickets
     SET last_message_at = NEW.created_at,
         first_response_at = CASE WHEN NEW.sender_type = 'admin' AND first_response_at IS NULL THEN NEW.created_at ELSE first_response_at END
   WHERE id = t.id;
  IF NEW.sender_type = 'admin' AND t.visitor_id IS NOT NULL THEN
    INSERT INTO public.notifications(visitor_id, title, message, type, related_id)
    VALUES (t.visitor_id, 'Tiket #' || t.ticket_number || ' dibalas admin',
            left(COALESCE(NULLIF(NEW.message,''), '📷 Gambar'), 120), 'ticket', t.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ticket_after_message ON public.ticket_messages;
CREATE TRIGGER trg_ticket_after_message AFTER INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.ticket_after_message();

CREATE OR REPLACE FUNCTION public.ticket_after_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.visitor_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('closed','resolved') THEN
    INSERT INTO public.notifications(visitor_id, title, message, type, related_id)
    VALUES (NEW.visitor_id, 'Tiket #' || NEW.ticket_number || ' selesai', 'Beri rating untuk layanan kami ya ⭐', 'ticket', NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ticket_after_status ON public.support_tickets;
CREATE TRIGGER trg_ticket_after_status AFTER UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.ticket_after_status();

CREATE OR REPLACE FUNCTION public.ticket_support_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'Hanya admin'; END IF;
  SELECT jsonb_build_object(
    'new_today', (SELECT count(*) FROM support_tickets WHERE created_at > now() - interval '24 hours'),
    'unanswered', (SELECT count(*) FROM support_tickets t WHERE t.status NOT IN ('closed','resolved') AND NOT EXISTS (
        SELECT 1 FROM ticket_messages m WHERE m.ticket_id = t.id AND m.sender_type = 'admin' AND m.created_at >= COALESCE((SELECT max(u.created_at) FROM ticket_messages u WHERE u.ticket_id = t.id AND u.sender_type='user'), t.created_at))),
    'high_priority', (SELECT count(*) FROM support_tickets WHERE status NOT IN ('closed','resolved') AND priority IN ('high','urgent')),
    'active', (SELECT count(*) FROM support_tickets WHERE status NOT IN ('closed','resolved')),
    'avg_response_min', (SELECT round(avg(extract(epoch FROM (first_response_at - created_at)) / 60)::numeric, 1) FROM support_tickets WHERE first_response_at IS NOT NULL AND created_at > now() - interval '30 days'),
    'avg_rating', (SELECT round(avg(rating)::numeric, 2) FROM support_tickets WHERE rating IS NOT NULL)
  ) INTO r;
  RETURN r;
END $$;

-- ===== LUCKY ROYALE (agregat dari riwayat spin yang sudah ada) =====
CREATE OR REPLACE VIEW public.royale_all_spins WITH (security_invoker = true) AS
  SELECT visitor_id, 'royale'::text AS source, reward_label, reward_value::bigint AS reward_value, lower(COALESCE(rarity,'common')) AS rarity, false AS is_jackpot, created_at FROM public.luck_royale_nyawa_history
  UNION ALL SELECT visitor_id, 'diamond', reward_label, reward_value::bigint, lower(COALESCE(rarity,'common')), false, created_at FROM public.diamond_royale_history
  UNION ALL SELECT visitor_id, 'lucky_draw', reward_label, reward_value, lower(COALESCE(rarity,'common')), false, created_at FROM public.lucky_draw_history
  UNION ALL SELECT visitor_id, 'lucky_wheel', reward_label, reward_value::bigint, CASE WHEN is_jackpot THEN 'jackpot' ELSE 'common' END, is_jackpot, created_at FROM public.streak_wheel_spins;
REVOKE ALL ON public.royale_all_spins FROM anon, authenticated;
GRANT SELECT ON public.royale_all_spins TO service_role;

CREATE OR REPLACE FUNCTION public.royale_mask_name(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p IS NULL OR length(p) = 0 THEN 'Player' WHEN length(p) <= 3 THEN left(p,1) || '**' ELSE left(p,3) || repeat('*', least(4, length(p)-3)) END;
$$;

CREATE OR REPLACE FUNCTION public.royale_leaderboard(p_metric text DEFAULT 'points', p_limit integer DEFAULT 20, p_visitor_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  WITH s AS (
    SELECT visitor_id,
      count(*) AS total_spin,
      count(*) FILTER (WHERE reward_value > 0) AS total_win,
      count(*) FILTER (WHERE is_jackpot OR rarity IN ('jackpot','mythic')) AS jackpot,
      count(*) FILTER (WHERE rarity IN ('legendary','mythic','jackpot')) AS legendary
    FROM (SELECT * FROM public.luck_royale_nyawa_history_v) x GROUP BY visitor_id
  ), scored AS (
    SELECT s.*, (total_spin + total_win + legendary * 10 + jackpot * 25) AS points,
      COALESCE((SELECT current_streak FROM daily_streaks d WHERE d.visitor_id = s.visitor_id LIMIT 1), 0) AS streak
    FROM s
  ), ranked AS (
    SELECT sc.*, row_number() OVER (ORDER BY CASE p_metric
        WHEN 'spin' THEN total_spin WHEN 'win' THEN total_win WHEN 'jackpot' THEN jackpot
        WHEN 'legendary' THEN legendary WHEN 'streak' THEN streak ELSE points END DESC, total_spin DESC) AS rank,
      COALESCE((SELECT g.display_name FROM game_profiles g WHERE g.visitor_id = sc.visitor_id AND g.display_name IS NOT NULL LIMIT 1),
               (SELECT u.username FROM user_balances u WHERE u.visitor_id = sc.visitor_id LIMIT 1)) AS raw_name,
      (SELECT g.avatar_url FROM game_profiles g WHERE g.visitor_id = sc.visitor_id LIMIT 1) AS avatar_url
    FROM scored sc
  )
  SELECT jsonb_build_object(
    'top', COALESCE((SELECT jsonb_agg(jsonb_build_object('rank', rank, 'name', royale_mask_name(raw_name), 'avatar_url', avatar_url,
        'total_spin', total_spin, 'total_win', total_win, 'jackpot', jackpot, 'legendary', legendary, 'points', points, 'streak', streak,
        'is_me', visitor_id = p_visitor_id) ORDER BY rank) FROM ranked WHERE rank <= GREATEST(1, LEAST(p_limit, 100))), '[]'::jsonb),
    'me', (SELECT jsonb_build_object('rank', rank, 'name', raw_name, 'total_spin', total_spin, 'total_win', total_win, 'jackpot', jackpot,
        'legendary', legendary, 'points', points, 'streak', streak) FROM ranked WHERE visitor_id = p_visitor_id)
  ) INTO r;
  RETURN r;
END $$;
