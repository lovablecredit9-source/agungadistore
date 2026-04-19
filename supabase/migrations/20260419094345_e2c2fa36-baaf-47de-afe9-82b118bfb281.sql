
ALTER TABLE public.streak_skin_purchases
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'coin';
