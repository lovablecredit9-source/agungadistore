
-- Tabel master voucher
CREATE TABLE public.streak_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  reward_type TEXT NOT NULL CHECK (reward_type IN ('gems','streak_coins','credits','hints','streak_freeze','time_freeze','extra_life')),
  reward_amount INTEGER NOT NULL CHECK (reward_amount > 0),
  max_claims INTEGER NOT NULL DEFAULT 1 CHECK (max_claims > 0),
  current_claims INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_streak_vouchers_active ON public.streak_vouchers(is_active, expires_at);
CREATE INDEX idx_streak_vouchers_code ON public.streak_vouchers(code);

ALTER TABLE public.streak_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view streak vouchers" ON public.streak_vouchers
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage streak vouchers" ON public.streak_vouchers
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE TRIGGER trg_streak_vouchers_updated_at
BEFORE UPDATE ON public.streak_vouchers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabel claim
CREATE TABLE public.streak_voucher_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES public.streak_vouchers(id) ON DELETE CASCADE,
  voucher_code TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  user_balance_id UUID,
  reward_type TEXT NOT NULL,
  reward_amount INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (voucher_id, visitor_id)
);

CREATE INDEX idx_streak_voucher_claims_visitor ON public.streak_voucher_claims(visitor_id);
CREATE INDEX idx_streak_voucher_claims_voucher ON public.streak_voucher_claims(voucher_id);

ALTER TABLE public.streak_voucher_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims" ON public.streak_voucher_claims
  FOR SELECT USING (true);

CREATE POLICY "Service role manages claims" ON public.streak_voucher_claims
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admin can view all claims" ON public.streak_voucher_claims
  FOR SELECT TO authenticated USING (public.is_admin_user());
