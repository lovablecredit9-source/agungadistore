CREATE TABLE IF NOT EXISTS public.streak_user_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  plan_id UUID REFERENCES public.streak_membership_plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  payment_method TEXT NOT NULL,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  bonus_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_streak_user_memberships_visitor ON public.streak_user_memberships(visitor_id);
CREATE INDEX IF NOT EXISTS idx_streak_user_memberships_expires ON public.streak_user_memberships(expires_at);

ALTER TABLE public.streak_user_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view memberships"
ON public.streak_user_memberships FOR SELECT USING (true);

CREATE POLICY "Only admin can manage memberships"
ON public.streak_user_memberships FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TRIGGER update_streak_user_memberships_updated_at
BEFORE UPDATE ON public.streak_user_memberships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();