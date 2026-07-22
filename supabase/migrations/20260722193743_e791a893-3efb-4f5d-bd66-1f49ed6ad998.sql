
ALTER TABLE public.fire_pass_progress ADD COLUMN IF NOT EXISTS pro_missions_until timestamptz;
ALTER TABLE public.fire_pass_seasons ADD COLUMN IF NOT EXISTS pro_price_saldo_in integer NOT NULL DEFAULT 30000;
ALTER TABLE public.fire_pass_seasons ADD COLUMN IF NOT EXISTS pro_price_gems integer NOT NULL DEFAULT 500;

-- Seed misi PRO untuk season aktif
DO $$
DECLARE sid uuid;
BEGIN
  SELECT id INTO sid FROM public.fire_pass_seasons WHERE is_active = true ORDER BY season_number DESC LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.fire_pass_missions (season_id, code, title, description, mission_type, requirement_type, target_value, badge_reward, sort_order, is_active) VALUES
    (sid, 'pro_login_30', '👑 Login 30 Hari', 'Login setiap hari selama sebulan penuh', 'pro', 'login_days_month', 30, 25, 1, true),
    (sid, 'pro_listen_500', '🎵 Dengar 500 Lagu (PRO)', 'Dengarkan 500 lagu bulan ini', 'pro', 'listen_song_month', 500, 20, 2, true),
    (sid, 'pro_purchase_50', '🛒 50 Transaksi PRO', 'Lakukan 50 pembelian bulan ini', 'pro', 'purchase_count_month', 50, 30, 3, true),
    (sid, 'pro_topup_500k', '💎 Top Up Rp 500.000', 'Akumulasi top up Rp 500rb bulan ini', 'pro', 'topup_amount_month', 500000, 40, 4, true),
    (sid, 'pro_quest_100', '⚔️ 100 Quest Selesai', 'Klaim 100 quest bulan ini', 'pro', 'quest_claim_month', 100, 30, 5, true),
    (sid, 'pro_topup_1m', '💰 Top Up Rp 1.000.000', 'Akumulasi top up Rp 1jt bulan ini', 'pro', 'topup_amount_month', 1000000, 60, 6, true),
    (sid, 'pro_purchase_100', '🔥 100 Transaksi PRO', 'Lakukan 100 pembelian bulan ini', 'pro', 'purchase_count_month', 100, 55, 7, true),
    (sid, 'pro_listen_1000', '🎧 Dengar 1000 Lagu PRO', 'Dengarkan 1000 lagu bulan ini', 'pro', 'listen_song_month', 1000, 45, 8, true),
    (sid, 'pro_quest_200', '🏆 200 Quest PRO', 'Klaim 200 quest bulan ini', 'pro', 'quest_claim_month', 200, 65, 9, true),
    (sid, 'pro_login_25_v2', '💼 Login 25 Hari PRO', 'Login 25 hari di bulan ini', 'pro', 'login_days_month', 25, 20, 10, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
