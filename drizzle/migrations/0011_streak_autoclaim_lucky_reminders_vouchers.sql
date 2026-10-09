-- lovable-cron-fallback-reviewed: time-based expiry reminders (3d/1d/1h) must fire while the app is closed; 15-min cadence keeps the 1h reminder within its window
ALTER TABLE public.streak_vouchers DROP CONSTRAINT IF EXISTS streak_vouchers_reward_type_check;
ALTER TABLE public.streak_vouchers ADD CONSTRAINT streak_vouchers_reward_type_check CHECK (reward_type = ANY (ARRAY['gems','streak_coins','credits','hints','streak_freeze','time_freeze','extra_life','saldo','storage','streak_days','membership_discount']));
ALTER TABLE public.streak_vouchers ADD COLUMN IF NOT EXISTS reward_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.streak_voucher_claims ADD COLUMN IF NOT EXISTS reward_label text;

CREATE TABLE IF NOT EXISTS public.streak_membership_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  discount_percent int NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),
  expires_at timestamptz NOT NULL,
  source text NOT NULL,
  source_ref text,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.streak_membership_discounts TO anon, authenticated;
GRANT ALL ON public.streak_membership_discounts TO service_role;
ALTER TABLE public.streak_membership_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membership discounts readable" ON public.streak_membership_discounts FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_smd_visitor ON public.streak_membership_discounts(visitor_id, expires_at);

CREATE TABLE IF NOT EXISTS public.streak_lucky_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_ref text NOT NULL UNIQUE,
  visitor_id text NOT NULL,
  reward_type text NOT NULL,
  reward_value int NOT NULL DEFAULT 0,
  reward_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.streak_lucky_bonuses TO anon, authenticated;
GRANT ALL ON public.streak_lucky_bonuses TO service_role;
ALTER TABLE public.streak_lucky_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lucky bonuses readable" ON public.streak_lucky_bonuses FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_slb_visitor ON public.streak_lucky_bonuses(visitor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.roll_streak_lucky_bonus(p_visitor_id text, p_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev record; r numeric := random(); t text; v int := 0; lbl text;
BEGIN
  IF coalesce(p_ref,'') = '' OR NOT EXISTS (SELECT 1 FROM balance_transactions WHERE purchase_ref = p_ref AND visitor_id = p_visitor_id) THEN
    RETURN jsonb_build_object('error','Pembelian tidak ditemukan');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('lucky:' || p_ref));
  SELECT * INTO prev FROM streak_lucky_bonuses WHERE purchase_ref = p_ref;
  IF FOUND THEN RETURN jsonb_build_object('reward_type', prev.reward_type, 'reward_value', prev.reward_value, 'reward_label', prev.reward_label, 'duplicate', true); END IF;
  IF r < 0.50 THEN t := 'none'; lbl := 'Belum mendapatkan bonus kali ini';
  ELSIF r < 0.65 THEN t := 'gems'; v := 10 + floor(random()*21)::int; lbl := format('+%s Gem', v);
    PERFORM add_account_gems(p_visitor_id, v);
  ELSIF r < 0.80 THEN t := 'streak_coins'; v := 100 + floor(random()*401)::int; lbl := format('+%s Koin Streak', v);
    UPDATE daily_streaks SET streak_coins = coalesce(streak_coins,0) + v WHERE visitor_id = p_visitor_id;
    IF NOT FOUND THEN t := 'none'; v := 0; lbl := 'Belum mendapatkan bonus kali ini'; END IF;
  ELSIF r < 0.88 THEN t := 'streak_freeze'; v := 1; lbl := '+1 Streak Freeze';
    UPDATE daily_streaks SET freeze_count = coalesce(freeze_count,0) + 1 WHERE visitor_id = p_visitor_id;
    IF NOT FOUND THEN t := 'none'; v := 0; lbl := 'Belum mendapatkan bonus kali ini'; END IF;
  ELSIF r < 0.94 THEN t := 'storage'; v := 100; lbl := '+100 MB Storage Musik';
    INSERT INTO user_music_storage (visitor_id, storage_mb, purchase_ref) VALUES (p_visitor_id, 100, 'lucky:' || p_ref);
  ELSIF r < 0.98 THEN t := 'membership_discount'; v := 10; lbl := 'Diskon membership 10% selama 7 hari';
    INSERT INTO streak_membership_discounts (visitor_id, discount_percent, expires_at, source, source_ref) VALUES (p_visitor_id, 10, now() + interval '7 days', 'lucky_bonus', p_ref);
  ELSE t := 'membership_discount'; v := 20; lbl := 'Diskon membership 20% selama 7 hari';
    INSERT INTO streak_membership_discounts (visitor_id, discount_percent, expires_at, source, source_ref) VALUES (p_visitor_id, 20, now() + interval '7 days', 'lucky_bonus', p_ref);
  END IF;
  INSERT INTO streak_lucky_bonuses (purchase_ref, visitor_id, reward_type, reward_value, reward_label) VALUES (p_ref, p_visitor_id, t, v, lbl);
  RETURN jsonb_build_object('reward_type', t, 'reward_value', v, 'reward_label', lbl, 'duplicate', false);
END $$;
REVOKE ALL ON FUNCTION public.roll_streak_lucky_bonus(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roll_streak_lucky_bonus(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_streak_autoclaim_status(p_visitor_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('until', max(expires_at), 'active_days_total', coalesce(sum(plan_days),0), 'active_packages', count(*), 'server_now', now())
  FROM streak_subscriptions WHERE visitor_id = p_visitor_id AND is_active AND expires_at > now();
$$;
GRANT EXECUTE ON FUNCTION public.get_streak_autoclaim_status(text) TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.streak_expiry_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  until_at timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('3d','1d','1h')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, until_at, kind)
);
GRANT ALL ON public.streak_expiry_reminders TO service_role;
ALTER TABLE public.streak_expiry_reminders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.streak_reminder_kind(p_left interval)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_left <= interval '0' THEN NULL WHEN p_left <= interval '1 hour' THEN '1h'
    WHEN p_left <= interval '1 day' THEN '1d' WHEN p_left <= interval '3 days' THEN '3d' END;
$$;
GRANT EXECUTE ON FUNCTION public.streak_reminder_kind(interval) TO service_role;

CREATE OR REPLACE FUNCTION public.send_streak_expiry_reminders(p_now timestamptz DEFAULT now())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; k text; n int := 0; ttl text; msg text;
BEGIN
  FOR r IN SELECT visitor_id, max(expires_at) AS until_at FROM streak_subscriptions
           WHERE is_active AND expires_at > p_now GROUP BY visitor_id HAVING max(expires_at) <= p_now + interval '3 days' LOOP
    k := streak_reminder_kind(r.until_at - p_now);
    CONTINUE WHEN k IS NULL;
    INSERT INTO streak_expiry_reminders (visitor_id, until_at, kind) VALUES (r.visitor_id, r.until_at, k) ON CONFLICT DO NOTHING;
    CONTINUE WHEN NOT FOUND;
    ttl := CASE k WHEN '3d' THEN '⏰ Auto-Klaim hampir habis' WHEN '1d' THEN '⚠️ Auto-Klaim berakhir besok' ELSE '🚨 Auto-Klaim berakhir dalam 1 jam' END;
    msg := format('Berakhir %s WIB. Perpanjang sekarang agar streak tetap diklaim otomatis.', to_char(r.until_at AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI'));
    INSERT INTO notifications (visitor_id, title, message, type, related_id) VALUES (r.visitor_id, ttl, msg, 'streak_reminder', 'autoclaim:' || k);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.send_streak_expiry_reminders(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_streak_expiry_reminders(timestamptz) TO service_role;

SELECT cron.schedule('streak-expiry-reminders', '*/15 * * * *', $$SELECT public.send_streak_expiry_reminders();$$);