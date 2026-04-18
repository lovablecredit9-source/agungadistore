-- Create streak_coin_packages table for buying streak coins with balance
CREATE TABLE IF NOT EXISTS public.streak_coin_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  coins integer NOT NULL DEFAULT 0,
  price bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_coin_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Streak coin packages viewable by everyone"
  ON public.streak_coin_packages FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert streak coin packages"
  ON public.streak_coin_packages FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "Admin can update streak coin packages"
  ON public.streak_coin_packages FOR UPDATE TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "Admin can delete streak coin packages"
  ON public.streak_coin_packages FOR DELETE TO authenticated
  USING (is_admin_user());

CREATE TRIGGER update_streak_coin_packages_updated_at
  BEFORE UPDATE ON public.streak_coin_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the two requested packages
INSERT INTO public.streak_coin_packages (name, coins, price, sort_order) VALUES
  ('5.000 Koin', 5000, 10000, 1),
  ('15.000 Koin', 15000, 15000, 2);