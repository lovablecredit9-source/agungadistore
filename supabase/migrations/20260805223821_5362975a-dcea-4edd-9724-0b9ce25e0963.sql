CREATE TABLE public.anon_premium_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  days integer NOT NULL DEFAULT 1,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.anon_premium_vouchers TO anon, authenticated;
GRANT ALL ON public.anon_premium_vouchers TO service_role;
ALTER TABLE public.anon_premium_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon premium vouchers readable" ON public.anon_premium_vouchers FOR SELECT USING (true);

CREATE TABLE public.anon_premium_voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.anon_premium_vouchers(id) ON DELETE CASCADE,
  code text NOT NULL,
  visitor_id text NOT NULL,
  days integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.anon_premium_voucher_redemptions TO anon, authenticated;
GRANT ALL ON public.anon_premium_voucher_redemptions TO service_role;
ALTER TABLE public.anon_premium_voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon premium redemptions readable" ON public.anon_premium_voucher_redemptions FOR SELECT USING (true);
CREATE UNIQUE INDEX anon_premium_redeem_once ON public.anon_premium_voucher_redemptions (voucher_id, visitor_id);

CREATE TABLE public.luck_discount_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  discount_percent integer NOT NULL,
  duration_hours integer NOT NULL,
  price_balance bigint NOT NULL DEFAULT 0,
  price_gems integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.luck_discount_packages TO anon, authenticated;
GRANT ALL ON public.luck_discount_packages TO service_role;
ALTER TABLE public.luck_discount_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "luck discount packages readable" ON public.luck_discount_packages FOR SELECT USING (true);

CREATE TABLE public.luck_discount_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_balance_id uuid,
  package_id uuid REFERENCES public.luck_discount_packages(id) ON DELETE SET NULL,
  name text NOT NULL,
  discount_percent integer NOT NULL,
  expires_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'purchase',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.luck_discount_vouchers TO anon, authenticated;
GRANT ALL ON public.luck_discount_vouchers TO service_role;
ALTER TABLE public.luck_discount_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "luck discount vouchers readable" ON public.luck_discount_vouchers FOR SELECT USING (true);
CREATE INDEX luck_discount_vouchers_visitor_idx ON public.luck_discount_vouchers (visitor_id, expires_at DESC);

CREATE TRIGGER trg_anon_premium_vouchers_updated BEFORE UPDATE ON public.anon_premium_vouchers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_luck_discount_packages_updated BEFORE UPDATE ON public.luck_discount_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.luck_discount_packages (name, discount_percent, duration_hours, price_balance, price_gems, sort_order) VALUES
  ('Diskon 10% - 2 Jam', 10, 2, 10000, 120, 1),
  ('Diskon 20% - 5 Jam', 20, 5, 20000, 240, 2),
  ('Diskon 30% - 8 Jam', 30, 8, 35000, 400, 3),
  ('Diskon 40% - 12 Jam', 40, 12, 55000, 650, 4),
  ('Diskon 50% - 24 Jam', 50, 24, 90000, 1100, 5),
  ('Diskon 15% - 24 Jam (Hemat)', 15, 24, 25000, 300, 6);