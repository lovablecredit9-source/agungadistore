CREATE TABLE public.mystery_shop_rolls (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  week_key text not null,
  slot_index int not null,
  item_code text not null,
  item_label text not null,
  reward_type text not null,
  reward_value bigint not null default 0,
  base_price_gems int not null default 0,
  base_price_coins int not null default 0,
  discount_percent int not null default 0,
  purchased boolean not null default false,
  purchased_at timestamptz,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.mystery_shop_rolls TO anon, authenticated;
GRANT ALL ON public.mystery_shop_rolls TO service_role;
ALTER TABLE public.mystery_shop_rolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mystery_shop_rolls_read" ON public.mystery_shop_rolls FOR SELECT USING (true);
CREATE INDEX idx_mystery_shop_rolls_visitor_week ON public.mystery_shop_rolls (visitor_id, week_key);