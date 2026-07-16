
-- =========================
-- 1. PREMIUM QUEST VOUCHERS
-- =========================
CREATE TABLE public.premium_quest_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  duration_days INTEGER NOT NULL DEFAULT 1,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  max_per_account INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.premium_quest_vouchers TO anon, authenticated;
GRANT ALL ON public.premium_quest_vouchers TO service_role;
ALTER TABLE public.premium_quest_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active pq voucher" ON public.premium_quest_vouchers FOR SELECT USING (true);
CREATE POLICY "admin manage pq voucher" ON public.premium_quest_vouchers FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.premium_quest_voucher_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL REFERENCES public.premium_quest_vouchers(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  user_balance_id UUID,
  duration_days INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.premium_quest_voucher_redemptions TO anon, authenticated;
GRANT ALL ON public.premium_quest_voucher_redemptions TO service_role;
ALTER TABLE public.premium_quest_voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pq redemption read" ON public.premium_quest_voucher_redemptions FOR SELECT USING (true);
CREATE POLICY "own pq redemption insert" ON public.premium_quest_voucher_redemptions FOR INSERT WITH CHECK (true);
CREATE POLICY "admin manage pq redemption" ON public.premium_quest_voucher_redemptions FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- =========================
-- 2. LAGA QUESTS (weekly)
-- =========================
CREATE TABLE public.laga_quests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '⚡',
  requirement_type TEXT NOT NULL,
  target_value INTEGER NOT NULL DEFAULT 1,
  min_amount BIGINT DEFAULT 0,
  reward_saldo_in INTEGER NOT NULL DEFAULT 0,
  reward_gems INTEGER NOT NULL DEFAULT 0,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'susah',
  week_start DATE NOT NULL,
  active_date DATE NOT NULL,
  duration_hours INTEGER NOT NULL DEFAULT 24,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.laga_quests TO anon, authenticated;
GRANT ALL ON public.laga_quests TO service_role;
ALTER TABLE public.laga_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read laga quests" ON public.laga_quests FOR SELECT USING (true);
CREATE POLICY "admin manage laga quests" ON public.laga_quests FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.laga_quest_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID NOT NULL REFERENCES public.laga_quests(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  user_balance_id UUID,
  current_value INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  is_claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quest_id, visitor_id)
);
GRANT SELECT, INSERT, UPDATE ON public.laga_quest_progress TO anon, authenticated;
GRANT ALL ON public.laga_quest_progress TO service_role;
ALTER TABLE public.laga_quest_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read laga progress" ON public.laga_quest_progress FOR SELECT USING (true);
CREATE POLICY "public insert laga progress" ON public.laga_quest_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "public update laga progress" ON public.laga_quest_progress FOR UPDATE USING (true);

-- =========================
-- 3. FIRE PASS
-- =========================
CREATE TABLE public.fire_pass_seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  free_premium_enabled BOOLEAN NOT NULL DEFAULT false,
  price_saldo_in INTEGER NOT NULL DEFAULT 25000,
  price_gems INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fire_pass_seasons TO anon, authenticated;
GRANT ALL ON public.fire_pass_seasons TO service_role;
ALTER TABLE public.fire_pass_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read fp seasons" ON public.fire_pass_seasons FOR SELECT USING (true);
CREATE POLICY "admin manage fp seasons" ON public.fire_pass_seasons FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.fire_pass_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.fire_pass_seasons(id) ON DELETE CASCADE,
  tier_level INTEGER NOT NULL,
  badge_required INTEGER NOT NULL,
  free_reward_type TEXT,
  free_reward_value INTEGER DEFAULT 0,
  free_reward_duration_hours INTEGER DEFAULT 0,
  free_reward_label TEXT,
  premium_reward_type TEXT,
  premium_reward_value INTEGER DEFAULT 0,
  premium_reward_duration_hours INTEGER DEFAULT 0,
  premium_reward_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(season_id, tier_level)
);
GRANT SELECT ON public.fire_pass_tiers TO anon, authenticated;
GRANT ALL ON public.fire_pass_tiers TO service_role;
ALTER TABLE public.fire_pass_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read fp tiers" ON public.fire_pass_tiers FOR SELECT USING (true);
CREATE POLICY "admin manage fp tiers" ON public.fire_pass_tiers FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.fire_pass_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.fire_pass_seasons(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  user_balance_id UUID,
  badges INTEGER NOT NULL DEFAULT 0,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  premium_activated_at TIMESTAMPTZ,
  claimed_free_tiers INTEGER[] NOT NULL DEFAULT '{}',
  claimed_premium_tiers INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(season_id, visitor_id)
);
GRANT SELECT, INSERT, UPDATE ON public.fire_pass_progress TO anon, authenticated;
GRANT ALL ON public.fire_pass_progress TO service_role;
ALTER TABLE public.fire_pass_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read fp progress" ON public.fire_pass_progress FOR SELECT USING (true);
CREATE POLICY "public insert fp progress" ON public.fire_pass_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "public update fp progress" ON public.fire_pass_progress FOR UPDATE USING (true);

CREATE TABLE public.fire_pass_badge_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.fire_pass_seasons(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  source TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.fire_pass_badge_log TO anon, authenticated;
GRANT ALL ON public.fire_pass_badge_log TO service_role;
ALTER TABLE public.fire_pass_badge_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read fp badge log" ON public.fire_pass_badge_log FOR SELECT USING (true);
CREATE POLICY "public insert fp badge log" ON public.fire_pass_badge_log FOR INSERT WITH CHECK (true);

-- =========================
-- updated_at triggers
-- =========================
CREATE TRIGGER trg_pq_voucher_upd BEFORE UPDATE ON public.premium_quest_vouchers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_laga_quest_upd BEFORE UPDATE ON public.laga_quests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_laga_progress_upd BEFORE UPDATE ON public.laga_quest_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fp_season_upd BEFORE UPDATE ON public.fire_pass_seasons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fp_tier_upd BEFORE UPDATE ON public.fire_pass_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fp_progress_upd BEFORE UPDATE ON public.fire_pass_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- seed default Fire Pass season (current month)
-- =========================
INSERT INTO public.fire_pass_seasons(season_number, name, description, starts_at, ends_at, is_active, price_saldo_in, price_gems)
VALUES (
  1,
  'Season 1 - Ignition',
  'Season perdana Fire Pass. Kumpulkan badge dari streak, quest, belanja, dan musik!',
  date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta',
  (date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') + interval '1 month') AT TIME ZONE 'Asia/Jakarta',
  true, 25000, 100
);

-- Seed 20 tiers untuk season 1
DO $$
DECLARE
  v_season UUID;
  i INTEGER;
BEGIN
  SELECT id INTO v_season FROM public.fire_pass_seasons WHERE season_number = 1 LIMIT 1;
  FOR i IN 1..20 LOOP
    INSERT INTO public.fire_pass_tiers(
      season_id, tier_level, badge_required,
      free_reward_type, free_reward_value, free_reward_label,
      premium_reward_type, premium_reward_value, premium_reward_label
    ) VALUES (
      v_season, i, i * 10,
      CASE WHEN i % 5 = 0 THEN 'gems' WHEN i % 3 = 0 THEN 'coins' ELSE 'saldo_in' END,
      CASE WHEN i % 5 = 0 THEN 20 + i*2 WHEN i % 3 = 0 THEN 100 + i*20 ELSE 500 + i*100 END,
      CASE WHEN i % 5 = 0 THEN (20+i*2)||' 💎' WHEN i % 3 = 0 THEN (100+i*20)||' 🪙' ELSE 'Rp '||(500+i*100)||' saldo IN' END,
      CASE WHEN i % 5 = 0 THEN 'gems' WHEN i % 4 = 0 THEN 'premium_quest_days' WHEN i % 2 = 0 THEN 'saldo_in' ELSE 'coins' END,
      CASE WHEN i % 5 = 0 THEN 80 + i*5 WHEN i % 4 = 0 THEN 1 WHEN i % 2 = 0 THEN 1500 + i*200 ELSE 300 + i*40 END,
      CASE WHEN i % 5 = 0 THEN (80+i*5)||' 💎' WHEN i % 4 = 0 THEN '1 Hari Premium Quest' WHEN i % 2 = 0 THEN 'Rp '||(1500+i*200)||' saldo IN' ELSE (300+i*40)||' 🪙' END
    );
  END LOOP;
END $$;
