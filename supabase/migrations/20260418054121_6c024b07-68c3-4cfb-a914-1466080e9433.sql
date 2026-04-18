
-- Saldo game terbatas (hanya untuk streak/game/storage/gem)
CREATE TABLE IF NOT EXISTS public.game_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read game_balance" ON public.game_balance FOR SELECT USING (true);
CREATE POLICY "Public insert game_balance" ON public.game_balance FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update game_balance" ON public.game_balance FOR UPDATE USING (true);

CREATE TRIGGER update_game_balance_updated_at
BEFORE UPDATE ON public.game_balance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Transaksi saldo game
CREATE TABLE IF NOT EXISTS public.game_balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'win',
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gbt_visitor ON public.game_balance_transactions(visitor_id, created_at DESC);

ALTER TABLE public.game_balance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read gbt" ON public.game_balance_transactions FOR SELECT USING (true);
CREATE POLICY "Public insert gbt" ON public.game_balance_transactions FOR INSERT WITH CHECK (true);

-- Riwayat Mine Sweeper
CREATE TABLE IF NOT EXISTS public.mine_sweeper_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  bet_credits INTEGER NOT NULL DEFAULT 1,
  mines_count INTEGER NOT NULL DEFAULT 3,
  tiles_revealed INTEGER NOT NULL DEFAULT 0,
  multiplier NUMERIC NOT NULL DEFAULT 1,
  payout_type TEXT NOT NULL DEFAULT 'none',
  payout_value INTEGER NOT NULL DEFAULT 0,
  payout_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'cashout',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msh_visitor ON public.mine_sweeper_history(visitor_id, created_at DESC);

ALTER TABLE public.mine_sweeper_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read msh" ON public.mine_sweeper_history FOR SELECT USING (true);
CREATE POLICY "Public insert msh" ON public.mine_sweeper_history FOR INSERT WITH CHECK (true);
