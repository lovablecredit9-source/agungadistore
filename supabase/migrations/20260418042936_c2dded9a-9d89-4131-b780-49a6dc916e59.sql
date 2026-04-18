-- 1. SCRATCH CARDS (daily free)
CREATE TABLE public.scratch_card_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  claim_date date NOT NULL DEFAULT CURRENT_DATE,
  reward_type text NOT NULL,
  reward_value bigint NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  rarity text NOT NULL DEFAULT 'common',
  voucher_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, claim_date)
);
ALTER TABLE public.scratch_card_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scratch claims viewable" ON public.scratch_card_claims FOR SELECT USING (true);
CREATE POLICY "Anyone can insert scratch claim" ON public.scratch_card_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin delete scratch claims" ON public.scratch_card_claims FOR DELETE TO authenticated USING (is_admin_user());

-- 2. SLOT MACHINE
CREATE TABLE public.slot_machine_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  reels text[] NOT NULL,
  payout_type text NOT NULL DEFAULT 'none',
  payout_value bigint NOT NULL DEFAULT 0,
  payout_label text NOT NULL DEFAULT '',
  cost_credits int NOT NULL DEFAULT 1,
  voucher_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.slot_machine_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Slot history viewable" ON public.slot_machine_history FOR SELECT USING (true);
CREATE POLICY "Anyone insert slot history" ON public.slot_machine_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin delete slot history" ON public.slot_machine_history FOR DELETE TO authenticated USING (is_admin_user());

-- 3. MATCH-3 SCORES
CREATE TABLE public.match3_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  score int NOT NULL DEFAULT 0,
  moves int NOT NULL DEFAULT 0,
  combo_max int NOT NULL DEFAULT 0,
  payout_type text DEFAULT 'none',
  payout_value bigint NOT NULL DEFAULT 0,
  payout_label text NOT NULL DEFAULT '',
  voucher_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.match3_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match3 scores viewable" ON public.match3_scores FOR SELECT USING (true);
CREATE POLICY "Anyone insert match3" ON public.match3_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin delete match3" ON public.match3_scores FOR DELETE TO authenticated USING (is_admin_user());

-- 4. LUCKY DRAW
CREATE TABLE public.lucky_draw_ticket_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  tickets int NOT NULL DEFAULT 1,
  cost_currency text NOT NULL DEFAULT 'gems', -- 'gems' or 'streak_coins'
  cost_amount int NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lucky_draw_ticket_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lucky draw packages viewable" ON public.lucky_draw_ticket_packages FOR SELECT USING (true);
CREATE POLICY "Admin manage lucky draw packages" ON public.lucky_draw_ticket_packages FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE TABLE public.lucky_draw_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  ticket_count int NOT NULL DEFAULT 0,
  total_purchased int NOT NULL DEFAULT 0,
  total_used int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lucky_draw_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lucky draw tickets viewable" ON public.lucky_draw_tickets FOR SELECT USING (true);
CREATE POLICY "Anyone insert lucky tickets" ON public.lucky_draw_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update lucky tickets" ON public.lucky_draw_tickets FOR UPDATE USING (true);
CREATE POLICY "Admin delete lucky tickets" ON public.lucky_draw_tickets FOR DELETE TO authenticated USING (is_admin_user());

CREATE TABLE public.lucky_draw_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  reward_type text NOT NULL,
  reward_value bigint NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  rarity text NOT NULL DEFAULT 'common',
  voucher_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lucky_draw_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lucky history viewable" ON public.lucky_draw_history FOR SELECT USING (true);
CREATE POLICY "Anyone insert lucky history" ON public.lucky_draw_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin delete lucky history" ON public.lucky_draw_history FOR DELETE TO authenticated USING (is_admin_user());

-- 5. FLASH SALES
CREATE TABLE public.flash_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  discount_percent int NOT NULL DEFAULT 0,
  discount_amount bigint NOT NULL DEFAULT 0,
  banner_url text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notify_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Flash sales viewable" ON public.flash_sales FOR SELECT USING (true);
CREATE POLICY "Admin manage flash sales" ON public.flash_sales FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

-- 6. WEEKLY LEADERBOARD REWARDS
CREATE TABLE public.weekly_leaderboard_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rank_position int NOT NULL UNIQUE,
  reward_type text NOT NULL DEFAULT 'gems',
  reward_value bigint NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_leaderboard_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Weekly rewards viewable" ON public.weekly_leaderboard_rewards FOR SELECT USING (true);
CREATE POLICY "Admin manage weekly rewards" ON public.weekly_leaderboard_rewards FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE TABLE public.weekly_leaderboard_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  week_start date NOT NULL,
  rank_position int NOT NULL,
  reward_type text NOT NULL,
  reward_value bigint NOT NULL DEFAULT 0,
  reward_label text NOT NULL DEFAULT '',
  voucher_code text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, week_start)
);
ALTER TABLE public.weekly_leaderboard_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Weekly claims viewable" ON public.weekly_leaderboard_claims FOR SELECT USING (true);
CREATE POLICY "Anyone insert weekly claim" ON public.weekly_leaderboard_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin delete weekly claims" ON public.weekly_leaderboard_claims FOR DELETE TO authenticated USING (is_admin_user());

-- TRIGGERS
CREATE TRIGGER update_lucky_packages_updated BEFORE UPDATE ON public.lucky_draw_ticket_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lucky_tickets_updated BEFORE UPDATE ON public.lucky_draw_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_flash_sales_updated BEFORE UPDATE ON public.flash_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_weekly_rewards_updated BEFORE UPDATE ON public.weekly_leaderboard_rewards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INDEXES
CREATE INDEX idx_scratch_visitor_date ON public.scratch_card_claims(visitor_id, claim_date DESC);
CREATE INDEX idx_slot_visitor ON public.slot_machine_history(visitor_id, created_at DESC);
CREATE INDEX idx_match3_score ON public.match3_scores(score DESC, created_at DESC);
CREATE INDEX idx_match3_visitor ON public.match3_scores(visitor_id, created_at DESC);
CREATE INDEX idx_lucky_history_visitor ON public.lucky_draw_history(visitor_id, created_at DESC);
CREATE INDEX idx_flash_sales_active ON public.flash_sales(is_active, ends_at);
CREATE INDEX idx_weekly_claims_week ON public.weekly_leaderboard_claims(week_start DESC, rank_position);

-- SEED default ticket packages
INSERT INTO public.lucky_draw_ticket_packages (name, tickets, cost_currency, cost_amount, sort_order) VALUES
  ('1 Tiket', 1, 'gems', 5, 1),
  ('5 Tiket', 5, 'gems', 20, 2),
  ('10 Tiket + Bonus', 12, 'gems', 35, 3),
  ('Tiket Coin', 1, 'streak_coins', 50, 4);

-- SEED default weekly rewards (top 5)
INSERT INTO public.weekly_leaderboard_rewards (rank_position, reward_type, reward_value, reward_label) VALUES
  (1, 'balance', 50000, 'Saldo Rp 50.000'),
  (2, 'balance', 25000, 'Saldo Rp 25.000'),
  (3, 'balance', 10000, 'Saldo Rp 10.000'),
  (4, 'gems', 100, '100 Gems'),
  (5, 'gems', 50, '50 Gems');