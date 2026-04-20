-- ============ ACCOUNT BANS ============
CREATE TABLE public.account_bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  user_balance_id UUID NULL,
  reason TEXT NOT NULL DEFAULT 'Pelanggaran aturan',
  is_permanent BOOLEAN NOT NULL DEFAULT false,
  banned_until TIMESTAMP WITH TIME ZONE NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  banned_by TEXT NOT NULL DEFAULT 'admin',
  unbanned_at TIMESTAMP WITH TIME ZONE NULL,
  unban_reason TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_bans_visitor ON public.account_bans(visitor_id) WHERE is_active = true;
CREATE INDEX idx_account_bans_balance ON public.account_bans(user_balance_id) WHERE is_active = true;

ALTER TABLE public.account_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bans (used to check own status)"
ON public.account_bans FOR SELECT USING (true);

CREATE POLICY "Only admin can insert bans"
ON public.account_bans FOR INSERT WITH CHECK (public.is_admin_user());

CREATE POLICY "Only admin can update bans"
ON public.account_bans FOR UPDATE USING (public.is_admin_user());

CREATE POLICY "Only admin can delete bans"
ON public.account_bans FOR DELETE USING (public.is_admin_user());

CREATE TRIGGER update_account_bans_updated_at
BEFORE UPDATE ON public.account_bans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STREAK MEMBERSHIP PLANS ============
CREATE TABLE public.streak_membership_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_days INTEGER NOT NULL DEFAULT 30,
  price_idr INTEGER NOT NULL DEFAULT 0,
  price_coins INTEGER NOT NULL DEFAULT 0,
  price_gems INTEGER NOT NULL DEFAULT 0,
  bonus_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  bonus_freeze_count INTEGER NOT NULL DEFAULT 0,
  bonus_streak_coins INTEGER NOT NULL DEFAULT 0,
  bonus_gems INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '👑',
  badge_color TEXT NOT NULL DEFAULT '#FFD700',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active membership plans"
ON public.streak_membership_plans FOR SELECT USING (true);

CREATE POLICY "Only admin can manage membership plans"
ON public.streak_membership_plans FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TRIGGER update_streak_membership_plans_updated_at
BEFORE UPDATE ON public.streak_membership_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WEEKLY SPIN WHEEL ============
CREATE TABLE public.weekly_spin_wheel_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'coins',
  reward_value INTEGER NOT NULL DEFAULT 0,
  weight INTEGER NOT NULL DEFAULT 10,
  color TEXT NOT NULL DEFAULT '#8B5CF6',
  icon TEXT NOT NULL DEFAULT '🎁',
  rarity TEXT NOT NULL DEFAULT 'common',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_spin_wheel_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spin segments"
ON public.weekly_spin_wheel_segments FOR SELECT USING (true);

CREATE POLICY "Only admin can manage spin segments"
ON public.weekly_spin_wheel_segments FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TRIGGER update_weekly_spin_segments_updated_at
BEFORE UPDATE ON public.weekly_spin_wheel_segments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.weekly_spin_event_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT true,
  cost_coins INTEGER NOT NULL DEFAULT 100,
  cost_gems INTEGER NOT NULL DEFAULT 0,
  cost_idr INTEGER NOT NULL DEFAULT 0,
  free_spin_per_week INTEGER NOT NULL DEFAULT 1,
  max_spin_per_week INTEGER NOT NULL DEFAULT 10,
  event_starts_at TIMESTAMP WITH TIME ZONE NULL,
  event_ends_at TIMESTAMP WITH TIME ZONE NULL,
  banner_title TEXT NOT NULL DEFAULT 'Weekly Spin Event',
  banner_description TEXT NOT NULL DEFAULT 'Putar roda mingguan untuk hadiah eksklusif!',
  banner_color TEXT NOT NULL DEFAULT '#A855F7',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_spin_event_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spin event settings"
ON public.weekly_spin_event_settings FOR SELECT USING (true);

CREATE POLICY "Only admin can manage spin event settings"
ON public.weekly_spin_event_settings FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TRIGGER update_weekly_spin_event_settings_updated_at
BEFORE UPDATE ON public.weekly_spin_event_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Default row
INSERT INTO public.weekly_spin_event_settings (is_active, cost_coins) VALUES (true, 100);

-- ============ RPC FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.is_account_banned(p_visitor_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ub_id UUID;
  v_banned BOOLEAN := false;
BEGIN
  -- Check by visitor_id directly
  SELECT EXISTS(
    SELECT 1 FROM public.account_bans
    WHERE visitor_id = p_visitor_id
      AND is_active = true
      AND (is_permanent = true OR (banned_until IS NOT NULL AND banned_until > now()))
  ) INTO v_banned;

  IF v_banned THEN RETURN true; END IF;

  -- Check by linked balance account
  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC LIMIT 1;

  IF v_ub_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.account_bans
      WHERE user_balance_id = v_ub_id
        AND is_active = true
        AND (is_permanent = true OR (banned_until IS NOT NULL AND banned_until > now()))
    ) INTO v_banned;
  END IF;

  RETURN v_banned;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_account_ban_info(p_visitor_id TEXT)
RETURNS TABLE (
  id UUID,
  reason TEXT,
  is_permanent BOOLEAN,
  banned_until TIMESTAMP WITH TIME ZONE,
  banned_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ub_id UUID;
BEGIN
  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC LIMIT 1;

  RETURN QUERY
  SELECT b.id, b.reason, b.is_permanent, b.banned_until, b.banned_by, b.created_at
  FROM public.account_bans b
  WHERE b.is_active = true
    AND (b.is_permanent = true OR (b.banned_until IS NOT NULL AND b.banned_until > now()))
    AND (b.visitor_id = p_visitor_id OR (v_ub_id IS NOT NULL AND b.user_balance_id = v_ub_id))
  ORDER BY b.is_permanent DESC, b.banned_until DESC NULLS LAST
  LIMIT 1;
END;
$$;

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_bans;