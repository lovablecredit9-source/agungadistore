
ALTER TABLE public.streak_limited_skins
  ADD COLUMN IF NOT EXISTS cost_gems integer NOT NULL DEFAULT 0;
UPDATE public.streak_limited_skins
SET cost_gems = GREATEST(1, ROUND(cost_coins / 10.0)::int)
WHERE cost_gems = 0;

ALTER TABLE public.streak_skin_purchases
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'coin';

ALTER TABLE public.streak_group_buy_items
  ADD COLUMN IF NOT EXISTS base_cost_gems integer NOT NULL DEFAULT 0;
UPDATE public.streak_group_buy_items
SET base_cost_gems = GREATEST(1, ROUND(base_cost_coins / 10.0)::int)
WHERE base_cost_gems = 0;

ALTER TABLE public.streak_group_buy_purchases
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'coin';

ALTER TABLE public.streak_battle_pass_seasons
  ADD COLUMN IF NOT EXISTS premium_cost_gems integer NOT NULL DEFAULT 0;
UPDATE public.streak_battle_pass_seasons
SET premium_cost_gems = GREATEST(1, ROUND(premium_cost_coins / 10.0)::int)
WHERE premium_cost_gems = 0;

ALTER TABLE public.streak_battle_pass_progress
  ADD COLUMN IF NOT EXISTS premium_payment_method text NOT NULL DEFAULT 'coin';
