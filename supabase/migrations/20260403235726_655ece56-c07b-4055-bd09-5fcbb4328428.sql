
-- User balances table
CREATE TABLE public.user_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  username text NOT NULL,
  phone text NOT NULL DEFAULT '',
  balance bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Balances viewable by everyone" ON public.user_balances FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create balance" ON public.user_balances FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admin can update balances" ON public.user_balances FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete balances" ON public.user_balances FOR DELETE TO authenticated USING (true);

-- Balance transactions table
CREATE TABLE public.balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  type text NOT NULL DEFAULT 'topup',
  amount bigint NOT NULL DEFAULT 0,
  description text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  token_id uuid REFERENCES public.tokens(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transactions viewable by everyone" ON public.balance_transactions FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create transactions" ON public.balance_transactions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admin can delete transactions" ON public.balance_transactions FOR DELETE TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.balance_transactions;
