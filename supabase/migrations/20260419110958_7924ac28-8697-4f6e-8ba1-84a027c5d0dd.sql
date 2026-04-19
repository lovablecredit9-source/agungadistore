ALTER TABLE public.event_shop_bundles ADD COLUMN IF NOT EXISTS cost_gems integer NOT NULL DEFAULT 0;
UPDATE public.event_shop_bundles SET cost_gems = GREATEST(1, CEIL(price_coins::numeric / 10)::int) WHERE cost_gems = 0;
ALTER TABLE public.event_shop_bundle_purchases ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'coin';