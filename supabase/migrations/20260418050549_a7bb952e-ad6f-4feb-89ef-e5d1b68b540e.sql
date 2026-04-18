
-- Tabel inventaris power-up
CREATE TABLE IF NOT EXISTS public.user_power_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  extra_life integer NOT NULL DEFAULT 0,
  auto_hint integer NOT NULL DEFAULT 0,
  time_freeze integer NOT NULL DEFAULT 0,
  double_xp_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_power_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read power ups"
  ON public.user_power_ups FOR SELECT
  USING (true);

CREATE POLICY "Service role manages power ups"
  ON public.user_power_ups FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_user_power_ups_updated_at
  BEFORE UPDATE ON public.user_power_ups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert 4 item power-up baru ke streak shop
INSERT INTO public.streak_shop_items (name, description, icon, cost_coins, reward_type, reward_value, is_active, sort_order)
VALUES
  ('Nyawa Ekstra', 'Hidup lagi setelah game over (1x pakai per soal)', '❤️', 60, 'extra_life', 1, true, 100),
  ('Hint Otomatis', 'Buka 1 hint tambahan saat main game', '💡', 40, 'auto_hint', 1, true, 101),
  ('Time Freeze 30s', 'Tambah 30 detik waktu di game (1x pakai)', '⏱️', 50, 'time_freeze', 1, true, 102),
  ('Double XP 24 Jam', 'Semua XP/poin game digandakan 2x selama 24 jam', '⚡', 150, 'double_xp', 24, true, 103)
ON CONFLICT DO NOTHING;
