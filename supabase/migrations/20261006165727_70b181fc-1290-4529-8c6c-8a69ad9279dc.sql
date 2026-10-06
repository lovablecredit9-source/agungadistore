ALTER TABLE public.streak_shop_items
  ADD COLUMN IF NOT EXISTS rarity text NOT NULL DEFAULT 'common',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'utility',
  ADD COLUMN IF NOT EXISTS required_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plus_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_price_coins integer,
  ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duration_hours integer;

UPDATE public.streak_shop_items SET
  rarity = CASE WHEN cost_coins >= 5000 THEN 'mythic' WHEN cost_coins >= 2000 THEN 'legendary' WHEN cost_coins >= 750 THEN 'epic' WHEN cost_coins >= 200 THEN 'rare' ELSE 'common' END,
  category = CASE reward_type WHEN 'streak_freeze' THEN 'protection' WHEN 'discount_voucher' THEN 'voucher' WHEN 'double_xp' THEN 'boost' WHEN 'game_credit' THEN 'reward' WHEN 'music_storage' THEN 'reward' ELSE 'utility' END;

INSERT INTO public.streak_shop_items (name, description, icon, cost_coins, cost_gems, reward_type, reward_value, stock, is_active, sort_order, rarity, category, required_streak, plus_only, is_featured, duration_hours, sale_price_coins, sale_ends_at) VALUES
('Streak Boost 3 Hari','Bonus +50% coin klaim streak selama 3 hari','🔥',450,45,'streak_boost',50,-1,true,100,'rare','boost',7,false,true,72,NULL,NULL),
('Streak Shield','Melindungi streak saat kamu melewatkan 1 hari','🛡️',500,50,'streak_freeze',1,-1,true,101,'rare','protection',7,false,true,NULL,350,now() + interval '3 days'),
('Double Reward','Coin klaim streak berikutnya jadi 2x','⚡',500,50,'double_reward',1,-1,true,102,'rare','boost',0,false,true,NULL,NULL,NULL),
('Lucky Boost','Klaim berikutnya dapat bonus roll hadiah rarity tinggi','💎',900,90,'lucky_boost',1,-1,true,103,'epic','boost',14,false,false,NULL,NULL,NULL),
('Mystery Box Streak','Hadiah coin acak: Common sampai Mythic','🎁',300,30,'mystery_box',1,-1,true,104,'rare','reward',0,false,true,NULL,NULL,NULL),
('Profile Aura Neon','Efek aura khusus di profil streak','🎨',120,12,'cosmetic_aura',1,-1,true,110,'common','profile',0,false,false,NULL,NULL,NULL),
('Flame Effect Biru','Mengubah visual api streak jadi api biru','🔥',1200,120,'cosmetic_flame',1,-1,true,111,'epic','effect',14,false,false,NULL,NULL,NULL),
('Royal Badge','Badge profil eksklusif mahkota','👑',2500,250,'cosmetic_badge',1,-1,true,112,'legendary','badge',30,false,true,NULL,NULL,NULL),
('Name Effect Glow','Efek nama berkilau','🌟',800,80,'cosmetic_name',1,-1,true,113,'epic','profile',14,false,false,NULL,NULL,NULL),
('Claim Effect Burst','Efek khusus saat klaim streak','💫',350,35,'cosmetic_claim',1,-1,true,114,'rare','effect',7,false,false,NULL,NULL,NULL),
('Avatar Frame Api','Bingkai avatar bertema api','🖼️',220,22,'cosmetic_frame',1,-1,true,115,'rare','avatar',7,false,false,NULL,NULL,NULL),
('Voucher Diskon Rp1.000','Voucher belanja toko Rp1.000 (30 hari)','🎟️',600,60,'discount_voucher',1000,50,true,116,'rare','voucher',0,false,false,NULL,NULL,NULL),
('Royal Flame','Api kerajaan emas — khusus Streak Plus','🔥',2000,200,'cosmetic_flame',2,-1,true,120,'legendary','exclusive',0,true,true,NULL,NULL,NULL),
('Golden Avatar','Bingkai avatar emas — khusus Streak Plus','🖼️',2200,220,'cosmetic_frame',2,-1,true,121,'legendary','exclusive',0,true,false,NULL,NULL,NULL),
('Premium Name Effect','Efek nama premium — khusus Streak Plus','🌟',1500,150,'cosmetic_name',2,-1,true,122,'epic','exclusive',0,true,false,NULL,NULL,NULL),
('Legendary Claim Effect','Efek klaim legendaris — khusus Streak Plus','💫',3000,300,'cosmetic_claim',2,-1,true,123,'legendary','exclusive',30,true,false,NULL,NULL,NULL),
('Exclusive Profile Frame','Bingkai profil eksklusif','👑',5000,500,'cosmetic_frame',3,-1,true,124,'mythic','exclusive',100,true,false,NULL,NULL,NULL),
('Monthly Mystery Box','Mystery box premium dengan peluang Mythic lebih besar','🎁',1500,150,'mystery_box',2,-1,true,125,'epic','exclusive',0,true,true,NULL,NULL,NULL);

CREATE TABLE public.streak_shop_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  item_id uuid REFERENCES public.streak_shop_items(id) ON DELETE SET NULL,
  reward_type text NOT NULL,
  item_name text NOT NULL,
  icon text,
  rarity text NOT NULL DEFAULT 'common',
  quantity integer NOT NULL DEFAULT 1,
  is_equipped boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  last_applied_date text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX streak_shop_inventory_visitor_idx ON public.streak_shop_inventory(visitor_id);
GRANT ALL ON public.streak_shop_inventory TO service_role;
ALTER TABLE public.streak_shop_inventory ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_streak_shop_inventory_updated_at BEFORE UPDATE ON public.streak_shop_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.streak_membership_plans DROP CONSTRAINT streak_membership_plans_category_check;
ALTER TABLE public.streak_membership_plans ADD CONSTRAINT streak_membership_plans_category_check CHECK (category = ANY (ARRAY['coin'::text, 'gem'::text, 'plus'::text]));

INSERT INTO public.streak_membership_plans (name, description, duration_days, price_idr, price_coins, price_gems, bonus_multiplier, bonus_freeze_count, bonus_streak_coins, bonus_gems, icon, badge_color, is_active, is_featured, sort_order, daily_reward_coins, category, bonus_daily_gems) VALUES
('PLUS','Bonus reward, daily bonus, akses item exclusive',30,9900,0,0,1.2,1,200,0,'👑','amber',true,false,1,10,'plus',0),
('PLUS PRO','Bonus lebih besar, proteksi tambahan, efek premium',30,19900,0,0,1.5,3,600,20,'💎','cyan',true,true,2,25,'plus',2),
('PLUS ELITE','Multiplier tertinggi, proteksi terbanyak, mystery box bulanan',30,39900,0,0,2.0,6,1500,60,'🔥','rose',true,false,3,50,'plus',5);