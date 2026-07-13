CREATE TABLE IF NOT EXISTS public.premium_quest_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  duration_seconds integer,
  price_balance integer NOT NULL DEFAULT 0,
  price_saldo_in integer NOT NULL DEFAULT 0,
  is_permanent boolean NOT NULL DEFAULT false,
  is_promo boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.premium_quest_plans TO anon, authenticated;
GRANT ALL ON public.premium_quest_plans TO service_role;
ALTER TABLE public.premium_quest_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active premium quest plans" ON public.premium_quest_plans;
CREATE POLICY "Anyone can view active premium quest plans"
ON public.premium_quest_plans
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.premium_quest_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_balance_id uuid,
  plan_id uuid REFERENCES public.premium_quest_plans(id) ON DELETE SET NULL,
  plan_name text NOT NULL,
  duration_seconds integer,
  price_paid_balance integer NOT NULL DEFAULT 0,
  price_paid_saldo_in integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_permanent boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'purchase',
  admin_note text,
  device_key text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.premium_quest_subscriptions TO authenticated;
GRANT ALL ON public.premium_quest_subscriptions TO service_role;
ALTER TABLE public.premium_quest_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own premium quest subscriptions" ON public.premium_quest_subscriptions;
CREATE POLICY "Users can read own premium quest subscriptions"
ON public.premium_quest_subscriptions
FOR SELECT
TO authenticated
USING (visitor_id = current_setting('request.jwt.claims', true)::jsonb ->> 'visitor_id');

CREATE TABLE IF NOT EXISTS public.premium_quest_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_balance_id uuid,
  device_key text NOT NULL,
  ip_address text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id),
  UNIQUE (device_key)
);
GRANT SELECT, INSERT ON public.premium_quest_trials TO authenticated;
GRANT ALL ON public.premium_quest_trials TO service_role;
ALTER TABLE public.premium_quest_trials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own premium quest trial" ON public.premium_quest_trials;
CREATE POLICY "Users can read own premium quest trial"
ON public.premium_quest_trials
FOR SELECT
TO authenticated
USING (visitor_id = current_setting('request.jwt.claims', true)::jsonb ->> 'visitor_id');

CREATE TABLE IF NOT EXISTS public.premium_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  quest_type text NOT NULL,
  period text NOT NULL DEFAULT 'daily',
  difficulty text NOT NULL DEFAULT 'susah',
  filter_group text NOT NULL DEFAULT 'premium',
  target_value integer NOT NULL DEFAULT 1,
  min_purchase_amount integer NOT NULL DEFAULT 0,
  reward_coins integer NOT NULL DEFAULT 0,
  reward_saldo_in integer NOT NULL DEFAULT 0,
  reward_gems integer NOT NULL DEFAULT 0,
  icon text NOT NULL DEFAULT '👑',
  starts_at timestamptz,
  ends_at timestamptz,
  is_premium_only boolean NOT NULL DEFAULT true,
  is_pro_legend boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT premium_quests_period_check CHECK (period IN ('daily','weekly','monthly','event'))
);
GRANT SELECT ON public.premium_quests TO anon, authenticated;
GRANT ALL ON public.premium_quests TO service_role;
ALTER TABLE public.premium_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active premium quests" ON public.premium_quests;
CREATE POLICY "Anyone can view active premium quests"
ON public.premium_quests
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.premium_quest_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid NOT NULL REFERENCES public.premium_quests(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  user_balance_id uuid,
  period text NOT NULL,
  period_start date NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quest_id, visitor_id, period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.premium_quest_progress TO authenticated;
GRANT ALL ON public.premium_quest_progress TO service_role;
ALTER TABLE public.premium_quest_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own premium quest progress" ON public.premium_quest_progress;
CREATE POLICY "Users can read own premium quest progress"
ON public.premium_quest_progress
FOR SELECT
TO authenticated
USING (visitor_id = current_setting('request.jwt.claims', true)::jsonb ->> 'visitor_id');

CREATE INDEX IF NOT EXISTS idx_premium_quest_subs_visitor_active ON public.premium_quest_subscriptions(visitor_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_premium_quest_subs_user_balance ON public.premium_quest_subscriptions(user_balance_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_premium_quests_active_period ON public.premium_quests(is_active, period, quest_type);
CREATE INDEX IF NOT EXISTS idx_premium_quest_progress_visitor_period ON public.premium_quest_progress(visitor_id, period, period_start);

CREATE OR REPLACE FUNCTION public.premium_quest_period_start(p_period text)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_day integer;
BEGIN
  IF p_period = 'weekly' THEN
    v_day := EXTRACT(ISODOW FROM v_today)::integer;
    RETURN v_today - (v_day - 1);
  ELSIF p_period = 'monthly' THEN
    RETURN date_trunc('month', v_today)::date;
  ELSE
    RETURN v_today;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_premium_quest_active(p_visitor_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ub_id uuid;
  v_active boolean := false;
BEGIN
  SELECT blh.user_balance_id INTO v_ub_id
  FROM public.balance_login_history blh
  WHERE blh.visitor_id = p_visitor_id
  ORDER BY blh.logged_in_at DESC
  LIMIT 1;

  SELECT EXISTS(
    SELECT 1
    FROM public.premium_quest_subscriptions s
    WHERE s.is_active = true
      AND (
        s.is_permanent = true
        OR s.expires_at IS NULL
        OR s.expires_at > now()
      )
      AND (
        s.visitor_id = p_visitor_id
        OR (v_ub_id IS NOT NULL AND s.user_balance_id = v_ub_id)
      )
  ) INTO v_active;

  RETURN COALESCE(v_active, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_premium_quest_info(p_visitor_id text)
RETURNS TABLE(is_active boolean, plan_name text, expires_at timestamptz, is_permanent boolean, seconds_left integer, can_trial boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ub_id uuid;
  v_sub record;
  v_can_trial boolean;
BEGIN
  SELECT blh.user_balance_id INTO v_ub_id
  FROM public.balance_login_history blh
  WHERE blh.visitor_id = p_visitor_id
  ORDER BY blh.logged_in_at DESC
  LIMIT 1;

  SELECT s.plan_name, s.expires_at, s.is_permanent INTO v_sub
  FROM public.premium_quest_subscriptions s
  WHERE s.is_active = true
    AND (s.is_permanent = true OR s.expires_at IS NULL OR s.expires_at > now())
    AND (s.visitor_id = p_visitor_id OR (v_ub_id IS NOT NULL AND s.user_balance_id = v_ub_id))
  ORDER BY s.is_permanent DESC, s.expires_at DESC NULLS LAST
  LIMIT 1;

  SELECT NOT EXISTS(
    SELECT 1 FROM public.premium_quest_trials t
    WHERE t.visitor_id = p_visitor_id OR (v_ub_id IS NOT NULL AND t.user_balance_id = v_ub_id)
  ) INTO v_can_trial;

  IF v_sub.plan_name IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz, false, 0, COALESCE(v_can_trial, true);
  ELSE
    RETURN QUERY SELECT true, v_sub.plan_name::text, v_sub.expires_at::timestamptz, COALESCE(v_sub.is_permanent, false),
      CASE WHEN COALESCE(v_sub.is_permanent, false) OR v_sub.expires_at IS NULL THEN 2147483647 ELSE GREATEST(0, EXTRACT(EPOCH FROM (v_sub.expires_at - now()))::integer) END,
      false;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_premium_quest_defaults()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tomorrow timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta' + interval '1 day';
  v_next_week timestamptz := now() + interval '7 days';
BEGIN
  INSERT INTO public.premium_quest_plans(code, name, description, duration_seconds, price_balance, price_saldo_in, is_permanent, is_promo, sort_order) VALUES
    ('TRIAL_1D', 'Gratis 1 Hari', 'Trial pertama untuk 1 akun dan 1 perangkat.', 86400, 0, 0, false, false, 0),
    ('PQ_1D', 'Premium Quest 1 Hari', 'Akses misi premium harian.', 86400, 5000, 0, false, false, 1),
    ('PQ_5D', 'Premium Quest 5 Hari', 'Paket hemat untuk push quest mingguan.', 432000, 20000, 0, false, false, 2),
    ('PQ_15D', 'Premium Quest 15 Hari', 'Cocok untuk target misi susah.', 1296000, 30000, 0, false, false, 3),
    ('PQ_1M', 'Premium Quest 1 Bulan', 'Akses harian, mingguan, bulanan premium.', 2592000, 35000, 0, false, false, 4),
    ('PQ_1Y_PROMO', 'Promo 1 Tahun', 'Promo Premium Quest 1 tahun.', 31536000, 100000, 0, false, true, 5),
    ('PQ_PERMANENT', 'Permanen', 'Akses Premium Quest permanen.', NULL, 200000, 0, true, false, 6)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    duration_seconds = EXCLUDED.duration_seconds,
    price_balance = EXCLUDED.price_balance,
    price_saldo_in = EXCLUDED.price_saldo_in,
    is_permanent = EXCLUDED.is_permanent,
    is_promo = EXCLUDED.is_promo,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = now();

  INSERT INTO public.premium_quests(title, description, quest_type, period, difficulty, filter_group, target_value, min_purchase_amount, reward_coins, reward_saldo_in, reward_gems, icon, starts_at, ends_at, is_pro_legend, sort_order) VALUES
    ('PRO LEGEND: 5 Lagu Valid', 'Dengarkan 5 lagu berbeda. Tiap lagu wajib diputar minimal 2 menit, lagu sama baru boleh dihitung lagi besok.', 'music_listen', 'daily', 'susah', 'pro_legend', 5, 0, 1200, 1500, 15, '🎧', NULL, NULL, true, 10),
    ('PRO LEGEND: Belanja Mini 2K', 'Belanja produk minimal Rp 2.000 untuk membuka progres belanja premium.', 'purchase', 'daily', 'susah', 'pro_legend', 1, 2000, 700, 1000, 8, '🛒', NULL, NULL, true, 20),
    ('PRO LEGEND: Belanja Serius 10K', 'Belanja produk minimal Rp 10.000. Progress berjalan bertahap dan tidak instan.', 'purchase', 'weekly', 'ekstrem', 'pro_legend', 3, 10000, 4500, 5000, 40, '💎', NULL, NULL, true, 30),
    ('Premium Harian: Streak Otomatis', 'Claim streak harian tetap berjalan otomatis dan dihitung untuk premium quest.', 'streak_claim', 'daily', 'susah', 'premium', 1, 0, 600, 800, 5, '🔥', NULL, NULL, false, 40),
    ('Premium Mingguan: Mystery Box Benar', 'Buka Mystery Box dari area streak/shop mystery, reward tampil sebagai 💎 + 🪙 + IN.', 'mystery_box', 'weekly', 'susah', 'premium', 4, 0, 3500, 2500, 25, '🎁', NULL, NULL, false, 50),
    ('Premium Bulanan: Marathon Quest', 'Selesaikan 25 progres quest premium dalam bulan berjalan.', 'quest_claim', 'monthly', 'mustahil', 'pro_legend', 25, 0, 15000, 10000, 100, '👑', NULL, NULL, true, 60),
    ('Event Besok: Locked Preview', 'Event premium terbuka besok. Misi terlihat gelap sampai event aktif.', 'music_listen', 'event', 'ekstrem', 'premium_event', 7, 0, 5000, 3000, 35, '⚡', v_tomorrow, v_tomorrow + interval '7 days', false, 70),
    ('Event 1 Minggu: Premium Rush', 'Event premium satu minggu lagi dengan reward besar untuk user aktif.', 'purchase', 'event', 'mustahil', 'premium_event', 5, 5000, 12000, 7500, 80, '🚀', v_next_week, v_next_week + interval '7 days', true, 80)
  ON CONFLICT DO NOTHING;
END;
$$;

SELECT public.seed_premium_quest_defaults();