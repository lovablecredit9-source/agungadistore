
ALTER TABLE public.gem_packages ADD COLUMN IF NOT EXISTS is_first_purchase_only boolean NOT NULL DEFAULT false;

INSERT INTO public.gem_packages (name, gems, bonus_gems, price, icon, sort_order, is_active, is_first_purchase_only)
VALUES
  ('First Top Up 100', 100, 0, 10000, '🎁', 0, true, true),
  ('First Top Up 500', 500, 0, 50000, '🎉', 0, true, true);
