
-- 1. Mystery boxes: add gem price
ALTER TABLE public.event_shop_mystery_boxes
  ADD COLUMN IF NOT EXISTS cost_gems integer NOT NULL DEFAULT 0;

UPDATE public.event_shop_mystery_boxes
SET cost_gems = GREATEST(1, ROUND(price_coins / 10.0)::int)
WHERE cost_gems = 0;

ALTER TABLE public.event_shop_mystery_openings
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'coin';

-- 2. Daily rotation: add gem price
ALTER TABLE public.event_shop_daily_rotation
  ADD COLUMN IF NOT EXISTS cost_gems integer NOT NULL DEFAULT 0;

UPDATE public.event_shop_daily_rotation
SET cost_gems = GREATEST(1, ROUND(base_price_coins / 10.0)::int)
WHERE cost_gems = 0;

ALTER TABLE public.event_shop_daily_purchases
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'coin';
