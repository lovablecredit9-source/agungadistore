
-- 1. Tabel paket premium (admin atur)
CREATE TABLE public.store_premium_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  price INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.store_premium_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active premium plans"
ON public.store_premium_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Admin manage premium plans"
ON public.store_premium_plans FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE TRIGGER update_store_premium_plans_updated_at
BEFORE UPDATE ON public.store_premium_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabel langganan aktif
CREATE TABLE public.store_premium_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  user_balance_id UUID,
  plan_id UUID REFERENCES public.store_premium_plans(id),
  plan_name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  price_paid INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sps_visitor ON public.store_premium_subscriptions(visitor_id);
CREATE INDEX idx_sps_balance ON public.store_premium_subscriptions(user_balance_id);
CREATE INDEX idx_sps_active ON public.store_premium_subscriptions(is_active, expires_at);

ALTER TABLE public.store_premium_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read premium subscriptions"
ON public.store_premium_subscriptions FOR SELECT
USING (true);

CREATE POLICY "Admin manage premium subscriptions"
ON public.store_premium_subscriptions FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- 3. Tabel klaim voucher harian
CREATE TABLE public.store_premium_voucher_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  user_balance_id UUID,
  voucher_code TEXT NOT NULL,
  claim_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spvc_visitor_date ON public.store_premium_voucher_claims(visitor_id, claim_date);
CREATE INDEX idx_spvc_balance_date ON public.store_premium_voucher_claims(user_balance_id, claim_date);

ALTER TABLE public.store_premium_voucher_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own claims"
ON public.store_premium_voucher_claims FOR SELECT
USING (true);

-- 4. Fungsi cek premium aktif
CREATE OR REPLACE FUNCTION public.is_store_premium(p_visitor_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ub_id UUID;
  v_active BOOLEAN := false;
BEGIN
  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC LIMIT 1;

  SELECT EXISTS(
    SELECT 1 FROM public.store_premium_subscriptions
    WHERE is_active = true
      AND expires_at > now()
      AND (visitor_id = p_visitor_id OR (v_ub_id IS NOT NULL AND user_balance_id = v_ub_id))
  ) INTO v_active;

  RETURN v_active;
END;
$$;

-- 5. Fungsi info premium
CREATE OR REPLACE FUNCTION public.get_store_premium_info(p_visitor_id TEXT)
RETURNS TABLE(is_premium BOOLEAN, plan_name TEXT, expires_at TIMESTAMPTZ, days_left INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ub_id UUID;
  v_sub RECORD;
BEGIN
  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC LIMIT 1;

  SELECT * INTO v_sub
  FROM public.store_premium_subscriptions
  WHERE is_active = true
    AND expires_at > now()
    AND (visitor_id = p_visitor_id OR (v_ub_id IS NOT NULL AND user_balance_id = v_ub_id))
  ORDER BY expires_at DESC LIMIT 1;

  IF v_sub.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TIMESTAMPTZ, 0;
  ELSE
    RETURN QUERY SELECT true, v_sub.plan_name, v_sub.expires_at,
      GREATEST(0, EXTRACT(DAY FROM (v_sub.expires_at - now()))::INTEGER);
  END IF;
END;
$$;

-- 6. Fungsi klaim voucher harian
CREATE OR REPLACE FUNCTION public.claim_daily_premium_voucher(p_visitor_id TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT, voucher_code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ub_id UUID;
  v_today DATE;
  v_existing UUID;
  v_code TEXT;
  v_expires TIMESTAMPTZ;
  v_is_premium BOOLEAN;
BEGIN
  -- Cek premium
  SELECT public.is_store_premium(p_visitor_id) INTO v_is_premium;
  IF NOT v_is_premium THEN
    RETURN QUERY SELECT false, 'Anda bukan member premium toko'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC LIMIT 1;

  -- WIB date
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;

  -- Cek sudah klaim hari ini?
  SELECT id INTO v_existing
  FROM public.store_premium_voucher_claims
  WHERE claim_date = v_today
    AND (visitor_id = p_visitor_id OR (v_ub_id IS NOT NULL AND user_balance_id = v_ub_id))
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT false, 'Voucher hari ini sudah diklaim. Coba lagi besok!'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Generate kode unik
  LOOP
    v_code := 'PREMIUM-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.discount_vouchers WHERE code = v_code);
  END LOOP;

  -- Expire 24 jam
  v_expires := now() + interval '24 hours';

  -- Buat voucher
  INSERT INTO public.discount_vouchers (code, discount_amount, max_uses, used_count, is_active, expires_at, visitor_id, user_balance_id, source)
  VALUES (v_code, 2000, 1, 0, true, v_expires, p_visitor_id, v_ub_id, 'premium_daily');

  -- Catat klaim
  INSERT INTO public.store_premium_voucher_claims (visitor_id, user_balance_id, voucher_code, claim_date)
  VALUES (p_visitor_id, v_ub_id, v_code, v_today);

  -- Notifikasi
  PERFORM public.create_notification(
    p_visitor_id,
    '👑 Voucher Premium Harian',
    'Voucher Rp 2.000 berhasil diklaim! Kode: ' || v_code || ' (berlaku 24 jam, sekali pakai).',
    'success',
    v_code
  );

  RETURN QUERY SELECT true, 'Voucher berhasil diklaim!'::TEXT, v_code, v_expires;
END;
$$;

-- 7. Seed paket default
INSERT INTO public.store_premium_plans (name, duration_days, price, description, sort_order) VALUES
  ('Premium 1 Bulan', 30, 20000, 'Klaim voucher Rp 2.000/hari + badge 👑', 1),
  ('Premium 2 Bulan', 60, 30000, 'Hemat! 2 bulan klaim voucher harian + chat prioritas', 2),
  ('Premium 6 Bulan', 180, 50000, 'Paket terhemat! 6 bulan penuh keuntungan premium', 3);
