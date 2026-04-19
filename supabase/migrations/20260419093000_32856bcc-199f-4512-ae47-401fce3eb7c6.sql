
-- Tambah kolom cost_gems untuk flash deal (harga gem langsung, lebih murah dari top up)
ALTER TABLE public.streak_flash_deals
  ADD COLUMN IF NOT EXISTS cost_gems integer NOT NULL DEFAULT 0;

-- Set harga gem default berdasarkan tier (BUKAN konversi koin → gem)
-- Tier murah biar pengguna tertarik pakai gem hasil top up
UPDATE public.streak_flash_deals
SET cost_gems = CASE
  WHEN original_cost <= 500 THEN 3
  WHEN original_cost <= 1000 THEN 5
  WHEN original_cost <= 2000 THEN 15
  WHEN original_cost <= 3000 THEN 25
  ELSE 35
END
WHERE cost_gems = 0;

-- Tabel untuk track redemption pakai gem (terpisah dari coin agar limit tetap 1x/hari per deal apapun pembayarannya - tetap pakai flash_deal_redemptions yang ada)
-- Tambah kolom payment_method ke flash_deal_redemptions untuk track
ALTER TABLE public.flash_deal_redemptions
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'coin';
