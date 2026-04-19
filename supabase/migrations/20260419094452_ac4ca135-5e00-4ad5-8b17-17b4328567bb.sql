
ALTER TABLE public.streak_group_buy_purchases
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'coin';
