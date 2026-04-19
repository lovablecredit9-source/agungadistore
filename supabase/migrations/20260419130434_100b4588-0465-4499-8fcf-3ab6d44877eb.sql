-- ============= MYSTERY BOX =============
CREATE TABLE public.streak_mystery_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🎁',
  rarity TEXT NOT NULL DEFAULT 'common',
  cost_coins INTEGER NOT NULL DEFAULT 0,
  cost_gems INTEGER NOT NULL DEFAULT 0,
  cost_balance INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER NOT NULL DEFAULT 1,
  reward_pool JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_mystery_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read mystery boxes" ON public.streak_mystery_boxes FOR SELECT USING (true);
CREATE POLICY "admin manage mystery boxes" ON public.streak_mystery_boxes FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.streak_mystery_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  box_id UUID NOT NULL REFERENCES public.streak_mystery_boxes(id) ON DELETE CASCADE,
  opened_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  payment_method TEXT NOT NULL,
  cost_paid INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value INTEGER NOT NULL,
  reward_label TEXT NOT NULL DEFAULT '',
  rarity TEXT NOT NULL DEFAULT 'common',
  voucher_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_mystery_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own openings" ON public.streak_mystery_openings FOR SELECT USING (true);
CREATE INDEX idx_mystery_open_visitor_date ON public.streak_mystery_openings(visitor_id, opened_date);

-- ============= AUCTION HOUSE =============
CREATE TABLE public.streak_auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '💎',
  rarity TEXT NOT NULL DEFAULT 'epic',
  starting_bid INTEGER NOT NULL DEFAULT 100,
  min_increment INTEGER NOT NULL DEFAULT 50,
  current_bid INTEGER NOT NULL DEFAULT 0,
  current_winner_visitor_id TEXT,
  current_winner_name TEXT,
  bid_currency TEXT NOT NULL DEFAULT 'coin',
  reward_type TEXT NOT NULL,
  reward_value INTEGER NOT NULL,
  reward_label TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  total_bids INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_auctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read auctions" ON public.streak_auctions FOR SELECT USING (true);
CREATE POLICY "admin manage auctions" ON public.streak_auctions FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.streak_auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.streak_auctions(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Anonim',
  bid_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'coin',
  refunded BOOLEAN NOT NULL DEFAULT false,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_auction_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read bids" ON public.streak_auction_bids FOR SELECT USING (true);
CREATE INDEX idx_bids_auction ON public.streak_auction_bids(auction_id, created_at DESC);

-- ============= LOYALTY TIER =============
CREATE TABLE public.streak_loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key TEXT NOT NULL UNIQUE,
  tier_name TEXT NOT NULL,
  tier_order INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '🥉',
  color TEXT NOT NULL DEFAULT '#cd7f32',
  required_lifetime_spent INTEGER NOT NULL DEFAULT 0,
  discount_pct INTEGER NOT NULL DEFAULT 0,
  monthly_coins_reward INTEGER NOT NULL DEFAULT 0,
  monthly_gems_reward INTEGER NOT NULL DEFAULT 0,
  monthly_freeze_reward INTEGER NOT NULL DEFAULT 0,
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_loyalty_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read tiers" ON public.streak_loyalty_tiers FOR SELECT USING (true);
CREATE POLICY "admin manage tiers" ON public.streak_loyalty_tiers FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.streak_loyalty_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL UNIQUE,
  current_tier_key TEXT NOT NULL DEFAULT 'bronze',
  lifetime_spent_coins INTEGER NOT NULL DEFAULT 0,
  last_monthly_claim_month TEXT,
  total_monthly_claims INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_loyalty_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read progress" ON public.streak_loyalty_progress FOR SELECT USING (true);

-- ============= REFERRAL VAULT =============
CREATE TABLE public.streak_referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL UNIQUE,
  total_referred INTEGER NOT NULL DEFAULT 0,
  total_coins_earned INTEGER NOT NULL DEFAULT 0,
  total_gems_earned INTEGER NOT NULL DEFAULT 0,
  display_name TEXT NOT NULL DEFAULT 'Anonim',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read codes" ON public.streak_referral_codes FOR SELECT USING (true);

CREATE TABLE public.streak_referral_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_visitor_id TEXT NOT NULL,
  referred_visitor_id TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  reward_coins_to_referrer INTEGER NOT NULL DEFAULT 0,
  reward_gems_to_referrer INTEGER NOT NULL DEFAULT 0,
  reward_coins_to_referred INTEGER NOT NULL DEFAULT 0,
  reward_gems_to_referred INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.streak_referral_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read uses" ON public.streak_referral_uses FOR SELECT USING (true);
CREATE INDEX idx_referral_uses_referrer ON public.streak_referral_uses(referrer_visitor_id);

-- updated_at triggers
CREATE TRIGGER trg_mb_upd BEFORE UPDATE ON public.streak_mystery_boxes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_au_upd BEFORE UPDATE ON public.streak_auctions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lp_upd BEFORE UPDATE ON public.streak_loyalty_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed Mystery Boxes
INSERT INTO public.streak_mystery_boxes (name, description, icon, rarity, cost_coins, cost_gems, cost_balance, daily_limit, reward_pool, sort_order) VALUES
('Box Pemula', 'Box gratis harian — coba keberuntunganmu!', '📦', 'common', 0, 0, 0, 1, '[
  {"type":"streak_coins","value":50,"label":"50 Coins","weight":50,"rarity":"common"},
  {"type":"streak_coins","value":100,"label":"100 Coins","weight":30,"rarity":"common"},
  {"type":"gems","value":2,"label":"2 Gems","weight":15,"rarity":"rare"},
  {"type":"freeze","value":1,"label":"1 Freeze","weight":4,"rarity":"epic"},
  {"type":"streak_coins","value":1000,"label":"JACKPOT 1000 Coins!","weight":1,"rarity":"legendary"}
]'::jsonb, 1),
('Box Premium', 'Box premium dengan reward lebih besar', '🎁', 'rare', 200, 0, 0, 3, '[
  {"type":"streak_coins","value":300,"label":"300 Coins","weight":40,"rarity":"common"},
  {"type":"streak_coins","value":600,"label":"600 Coins","weight":25,"rarity":"rare"},
  {"type":"gems","value":10,"label":"10 Gems","weight":20,"rarity":"rare"},
  {"type":"gems","value":25,"label":"25 Gems","weight":10,"rarity":"epic"},
  {"type":"freeze","value":2,"label":"2 Freeze","weight":4,"rarity":"epic"},
  {"type":"streak_coins","value":5000,"label":"JACKPOT 5000 Coins!","weight":1,"rarity":"legendary"}
]'::jsonb, 2),
('Box Mythic', 'Box ultra rare — hanya untuk pemberani', '💠', 'legendary', 0, 50, 0, 5, '[
  {"type":"gems","value":30,"label":"30 Gems","weight":40,"rarity":"rare"},
  {"type":"gems","value":75,"label":"75 Gems","weight":25,"rarity":"epic"},
  {"type":"streak_coins","value":2000,"label":"2000 Coins","weight":20,"rarity":"epic"},
  {"type":"freeze","value":5,"label":"5 Freeze","weight":10,"rarity":"epic"},
  {"type":"gems","value":250,"label":"JACKPOT 250 Gems!","weight":4,"rarity":"legendary"},
  {"type":"streak_coins","value":15000,"label":"MEGA JACKPOT 15K Coins!","weight":1,"rarity":"legendary"}
]'::jsonb, 3);

-- Seed Loyalty Tiers
INSERT INTO public.streak_loyalty_tiers (tier_key, tier_name, tier_order, icon, color, required_lifetime_spent, discount_pct, monthly_coins_reward, monthly_gems_reward, monthly_freeze_reward, perks) VALUES
('bronze', 'Bronze', 1, '🥉', '#cd7f32', 0, 0, 100, 0, 0, '["Akses dasar","Reward bulanan"]'::jsonb),
('silver', 'Silver', 2, '🥈', '#c0c0c0', 1000, 5, 300, 5, 1, '["Diskon 5%","300 coins/bulan","5 gems/bulan"]'::jsonb),
('gold', 'Gold', 3, '🥇', '#ffd700', 5000, 10, 800, 15, 2, '["Diskon 10%","800 coins/bulan","15 gems/bulan","Akses lelang prioritas"]'::jsonb),
('platinum', 'Platinum', 4, '💎', '#e5e4e2', 20000, 15, 2000, 40, 4, '["Diskon 15%","2000 coins/bulan","40 gems/bulan","Mystery box bonus"]'::jsonb),
('diamond', 'Diamond', 5, '👑', '#b9f2ff', 50000, 20, 5000, 100, 8, '["Diskon 20%","5000 coins/bulan","100 gems/bulan","Akses VIP semua fitur"]'::jsonb);

-- Seed 3 active auctions (24 jam ke depan)
INSERT INTO public.streak_auctions (name, description, icon, rarity, starting_bid, min_increment, current_bid, bid_currency, reward_type, reward_value, reward_label, ends_at) VALUES
('Mythic Gem Hoard', 'Stash 500 gems untuk pemenang lelang', '💎', 'legendary', 1000, 100, 1000, 'coin', 'gems', 500, '500 Gems', now() + interval '6 hours'),
('Coin Vault Master', '20.000 streak coins untuk bidder tertinggi', '🪙', 'epic', 100, 25, 100, 'gem', 'streak_coins', 20000, '20K Coins', now() + interval '12 hours'),
('Freeze Pack Legendary', '15 streak freeze sekaligus', '🧊', 'epic', 500, 50, 500, 'coin', 'freeze', 15, '15 Freeze', now() + interval '24 hours');