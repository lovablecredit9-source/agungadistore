ALTER TABLE public.discount_spin_state
  ADD COLUMN IF NOT EXISTS won_discounts integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_bought integer NOT NULL DEFAULT 0;