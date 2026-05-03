-- Tabel saldo tiket spin (Normal & Premium) per akun
CREATE TABLE IF NOT EXISTS public.luck_spin_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key TEXT NOT NULL,
  visitor_id TEXT,
  user_balance_id UUID,
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('normal','premium')),
  balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_key, ticket_type)
);

CREATE INDEX IF NOT EXISTS idx_luck_spin_tickets_account ON public.luck_spin_tickets(account_key);

ALTER TABLE public.luck_spin_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tickets"
  ON public.luck_spin_tickets FOR SELECT
  USING (true);

-- Hanya service role yang boleh menulis (lewat edge function)
CREATE POLICY "Service role manages tickets"
  ON public.luck_spin_tickets FOR ALL
  USING (false) WITH CHECK (false);

-- Log pembelian/penggunaan tiket (audit)
CREATE TABLE IF NOT EXISTS public.luck_spin_ticket_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key TEXT NOT NULL,
  visitor_id TEXT,
  ticket_type TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.luck_spin_ticket_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ticket log" ON public.luck_spin_ticket_log FOR SELECT USING (true);
CREATE POLICY "Service role manages ticket log" ON public.luck_spin_ticket_log FOR ALL USING (false) WITH CHECK (false);