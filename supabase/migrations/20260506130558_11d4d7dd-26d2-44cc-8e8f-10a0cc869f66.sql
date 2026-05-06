-- Tambah kolom bonus_game_credits ke gem_packages untuk paket Komplit (gem + kredit game)
ALTER TABLE public.gem_packages
ADD COLUMN IF NOT EXISTS bonus_game_credits integer NOT NULL DEFAULT 0;

-- Insert 4 paket Top Up Komplit baru
INSERT INTO public.gem_packages (name, gems, bonus_gems, bonus_streak_coins, bonus_game_credits, price, icon, sort_order, is_active, is_first_purchase_only)
VALUES
  ('Komplit Starter',  100,  0, 0, 100,  30000,  '🎁', 101, true, false),
  ('Komplit Bronze',   200,  0, 0, 300,  60000,  '🥉', 102, true, false),
  ('Komplit Gold',     500,  0, 0, 1000, 125000, '🥇', 103, true, false),
  ('Komplit Diamond',  1000, 0, 0, 2500, 250000, '💠', 104, true, false);