
-- Add gems column to game_profiles
ALTER TABLE public.game_profiles ADD COLUMN IF NOT EXISTS gems integer NOT NULL DEFAULT 0;

-- Gem packages (admin-managed)
CREATE TABLE IF NOT EXISTS public.gem_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  gems integer NOT NULL DEFAULT 0,
  bonus_gems integer NOT NULL DEFAULT 0,
  price bigint NOT NULL DEFAULT 0,
  icon text NOT NULL DEFAULT '💎',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gem_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gem packages viewable" ON public.gem_packages FOR SELECT USING (true);
CREATE POLICY "Admin manage gem packages" ON public.gem_packages FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Gem transactions (history)
CREATE TABLE IF NOT EXISTS public.gem_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'purchase',
  description text NOT NULL DEFAULT '',
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gem_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gem trx viewable" ON public.gem_transactions FOR SELECT USING (true);
CREATE POLICY "Anyone insert gem trx" ON public.gem_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin delete gem trx" ON public.gem_transactions FOR DELETE TO authenticated USING (is_admin_user());

-- Streak battles (1v1)
CREATE TABLE IF NOT EXISTS public.streak_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id text NOT NULL,
  opponent_id text,
  status text NOT NULL DEFAULT 'open',
  bet_gems integer NOT NULL DEFAULT 0,
  challenger_score integer NOT NULL DEFAULT 0,
  opponent_score integer NOT NULL DEFAULT 0,
  winner_id text,
  prize_gems integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Battles viewable" ON public.streak_battles FOR SELECT USING (true);
CREATE POLICY "Anyone create battle" ON public.streak_battles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update battle" ON public.streak_battles FOR UPDATE USING (true);
CREATE POLICY "Admin delete battle" ON public.streak_battles FOR DELETE TO authenticated USING (is_admin_user());

CREATE INDEX IF NOT EXISTS idx_battles_status ON public.streak_battles(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_battles_challenger ON public.streak_battles(challenger_id);
CREATE INDEX IF NOT EXISTS idx_battles_opponent ON public.streak_battles(opponent_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_gem_packages_updated ON public.gem_packages;
CREATE TRIGGER trg_gem_packages_updated BEFORE UPDATE ON public.gem_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_streak_battles_updated ON public.streak_battles;
CREATE TRIGGER trg_streak_battles_updated BEFORE UPDATE ON public.streak_battles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed gem packages
INSERT INTO public.gem_packages (name, gems, bonus_gems, price, icon, sort_order) VALUES
  ('Starter Gem', 100, 0, 5000, '💎', 1),
  ('Popular Gem', 500, 50, 20000, '💠', 2),
  ('Premium Gem', 1200, 200, 45000, '🔷', 3),
  ('Mega Gem', 3000, 800, 100000, '💍', 4)
ON CONFLICT DO NOTHING;
