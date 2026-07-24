
ALTER TABLE public.discount_vouchers ADD COLUMN IF NOT EXISTS min_purchase bigint NOT NULL DEFAULT 0;
ALTER TABLE public.fire_pass_tiers ADD COLUMN IF NOT EXISTS free_reward_min_purchase bigint NOT NULL DEFAULT 0;
ALTER TABLE public.fire_pass_tiers ADD COLUMN IF NOT EXISTS premium_reward_min_purchase bigint NOT NULL DEFAULT 0;

UPDATE public.fire_pass_tiers
SET premium_reward_value = 5000,
    premium_reward_duration_hours = 24,
    premium_reward_min_purchase = 50000,
    premium_reward_label = 'Voucher Rp 5.000 🎟️ · min. belanja Rp 50rb · 24 jam'
WHERE premium_reward_type = 'voucher_saldo' AND premium_reward_value = 3000;

-- Dedup safety for missions code before adding constraint
DELETE FROM public.fire_pass_missions a USING public.fire_pass_missions b
WHERE a.ctid < b.ctid AND a.code = b.code;
ALTER TABLE public.fire_pass_missions ADD CONSTRAINT fire_pass_missions_code_key UNIQUE (code);

DO $$
DECLARE
  s_id uuid;
  i int;
  badge_req int;
  free_type text; free_val int; free_dur int; free_label text; free_min bigint;
  prem_type text; prem_val int; prem_dur int; prem_label text; prem_min bigint;
BEGIN
  SELECT id INTO s_id FROM public.fire_pass_seasons WHERE is_active = true ORDER BY season_number DESC LIMIT 1;
  IF s_id IS NULL THEN RETURN; END IF;

  FOR i IN 101..300 LOOP
    badge_req := 1000 + (i - 100) * 25;
    free_min := 0; prem_min := 0;

    CASE (i % 7)
      WHEN 0 THEN free_type := 'saldo_in';     free_val := 500 + (i * 15);   free_dur := 0; free_label := 'Rp ' || to_char(500 + (i * 15), 'FM999,999') || ' Saldo IN 💰';
      WHEN 1 THEN free_type := 'coins';        free_val := 500 + i * 10;     free_dur := 0; free_label := (500 + i*10)::text || ' 🪙 Koin';
      WHEN 2 THEN free_type := 'streak_coins'; free_val := 300 + i * 8;      free_dur := 0; free_label := (300 + i*8)::text || ' 🔥 Streak Coin';
      WHEN 3 THEN free_type := 'gems';         free_val := 50 + (i/4);       free_dur := 0; free_label := (50 + (i/4))::text || ' 💎 Gem';
      WHEN 4 THEN free_type := 'hint';         free_val := 3;                free_dur := 0; free_label := '3 💡 Hint';
      WHEN 5 THEN free_type := 'extra_life';   free_val := 2;                free_dur := 0; free_label := '2 ❤️ Nyawa';
      ELSE       free_type := 'lucky_ticket';  free_val := 2;                free_dur := 0; free_label := '2 🎫 Tiket Lucky Draw';
    END CASE;

    CASE (i % 10)
      WHEN 0 THEN prem_type := 'saldo_in';       prem_val := 10000 + (i * 100);  prem_dur := 0; prem_label := 'Rp ' || to_char(10000 + (i*100), 'FM999,999') || ' Saldo IN 💰';
      WHEN 1 THEN prem_type := 'saldo_in';       prem_val := 5000 + (i * 50);    prem_dur := 0; prem_label := 'Rp ' || to_char(5000 + (i*50), 'FM999,999') || ' Saldo IN 💰';
      WHEN 2 THEN prem_type := 'saldo_in';       prem_val := 15000 + (i * 75);   prem_dur := 0; prem_label := 'Rp ' || to_char(15000 + (i*75), 'FM999,999') || ' Saldo IN 💰';
      WHEN 3 THEN prem_type := 'voucher_saldo'; prem_val := 5000 + ((i/20)*1000); prem_dur := 24;
                  prem_min  := 50000 + ((i/40)*10000);
                  prem_label := 'Voucher Rp ' || to_char(5000 + ((i/20)*1000),'FM999,999') || ' 🎟️ · min. Rp ' || to_char(prem_min,'FM999,999') || ' · 24 jam';
      WHEN 4 THEN prem_type := 'gems';           prem_val := 150 + i;            prem_dur := 0; prem_label := (150 + i)::text || ' 💎 Gem';
      WHEN 5 THEN prem_type := 'server_luck_x6_hours'; prem_val := 6 + (i/50);   prem_dur := 0; prem_label := 'Server Luck x6 · ' || (6+(i/50))::text || ' Jam ⚡';
      WHEN 6 THEN prem_type := 'streak_coins';   prem_val := 2000 + i * 20;      prem_dur := 0; prem_label := (2000 + i*20)::text || ' 🔥 Streak Coin';
      WHEN 7 THEN prem_type := 'premium_quest_days'; prem_val := 3 + (i/50);     prem_dur := 0; prem_label := (3 + (i/50))::text || ' Hari Premium Quest 👑';
      WHEN 8 THEN prem_type := 'lucky_ticket';   prem_val := 3 + (i/30);         prem_dur := 0; prem_label := (3 + (i/30))::text || ' 🎫 Tiket Lucky Draw';
      ELSE       prem_type := 'server_luck_x8_hours'; prem_val := 4 + (i/60);    prem_dur := 0; prem_label := 'Server Luck x8 · ' || (4+(i/60))::text || ' Jam ⚡';
    END CASE;

    IF i % 50 = 0 THEN
      prem_type := 'saldo_in'; prem_val := 50000 + (i * 500); prem_dur := 0; prem_min := 0;
      prem_label := '🏆 MEGA Rp ' || to_char(50000 + (i*500),'FM999,999') || ' Saldo IN';
    END IF;

    INSERT INTO public.fire_pass_tiers
      (season_id, tier_level, badge_required,
       free_reward_type, free_reward_value, free_reward_duration_hours, free_reward_label, free_reward_min_purchase,
       premium_reward_type, premium_reward_value, premium_reward_duration_hours, premium_reward_label, premium_reward_min_purchase)
    VALUES
      (s_id, i, badge_req, free_type, free_val, free_dur, free_label, free_min,
       prem_type, prem_val, prem_dur, prem_label, prem_min)
    ON CONFLICT (season_id, tier_level) DO NOTHING;
  END LOOP;
END $$;

INSERT INTO public.fire_pass_missions (code, title, description, mission_type, requirement_type, target_value, badge_reward, is_active, sort_order)
VALUES
  ('fp_d_login_ext','Login Harian Bonus','Login ke akun','daily','daily_login',1,3,true,100),
  ('fp_d_streak_ext','Klaim Streak Harian','Klaim daily streak','daily','streak_claim',1,4,true,101),
  ('fp_d_listen_3','Dengar 3 Lagu Berbeda','Putar 3 lagu berbeda','daily','listen_song',3,3,true,102),
  ('fp_d_listen_5','Dengar 5 Lagu Berbeda','Putar 5 lagu berbeda','daily','listen_song',5,5,true,103),
  ('fp_d_listen_10','Melodi Harian','Putar 10 lagu berbeda hari ini','daily','listen_song',10,8,true,104),
  ('fp_d_topup_5k','Top Up Rp 5rb','Top up minimal Rp 5.000','daily','topup_amount',5000,5,true,105),
  ('fp_d_topup_25k','Top Up Rp 25rb','Top up minimal Rp 25.000','daily','topup_amount',25000,12,true,106),
  ('fp_d_purchase_1','Belanja Sekali','Lakukan 1 pembelian','daily','purchase_count',1,4,true,107),
  ('fp_d_quest_1','Klaim 1 Quest','Klaim 1 quest apa saja','daily','quest_claim_week',1,3,true,108),
  ('fp_d_quest_3','Klaim 3 Quest','Klaim 3 quest hari ini','daily','quest_claim_week',3,6,true,109),
  ('fp_w_listen_50','Pendengar Setia','Putar 50 lagu minggu ini','weekly','listen_song_week',50,20,true,200),
  ('fp_w_listen_100','DJ Mingguan','Putar 100 lagu minggu ini','weekly','listen_song_week',100,35,true,201),
  ('fp_w_purchase_5','Sultan Mingguan','Belanja 5 kali','weekly','purchase_count_week',5,25,true,202),
  ('fp_w_purchase_10','Kolektor Mingguan','Belanja 10 kali','weekly','purchase_count_week',10,45,true,203),
  ('fp_w_topup_100k','Top Up Rp 100rb','Total top up Rp 100.000','weekly','topup_amount_week',100000,30,true,204),
  ('fp_w_topup_300k','Top Up Rp 300rb','Total top up Rp 300.000','weekly','topup_amount_week',300000,60,true,205),
  ('fp_w_quest_10','10 Quest/Minggu','Klaim 10 quest minggu ini','weekly','quest_claim_week',10,25,true,206),
  ('fp_w_quest_20','20 Quest/Minggu','Klaim 20 quest minggu ini','weekly','quest_claim_week',20,50,true,207),
  ('fp_m_listen_500','Music Lover','Putar 500 lagu bulan ini','monthly','listen_song_month',500,80,true,300),
  ('fp_m_purchase_20','Super Shopper','Belanja 20 kali bulan ini','monthly','purchase_count_month',20,100,true,301),
  ('fp_m_topup_1jt','Top Up Rp 1 juta','Total top up Rp 1.000.000','monthly','topup_amount_month',1000000,150,true,302),
  ('fp_m_login_25','Rajin 25 Hari','Login 25 hari bulan ini','monthly','login_days_month',25,90,true,303),
  ('fp_m_login_30','Absen Sempurna','Login 30 hari bulan ini','monthly','login_days_month',30,150,true,304),
  ('fp_p_login_prem','Premium Daily','Login harian (Premium)','premium','daily_login',1,10,true,400),
  ('fp_p_listen_15','Premium Melodi','Putar 15 lagu (Premium)','premium','listen_song',15,15,true,401),
  ('fp_p_topup_50k','Premium Top Up','Top up Rp 50rb (Premium)','premium','topup_amount',50000,20,true,402),
  ('fp_p_purchase_2','Premium Belanja','Belanja 2 kali (Premium)','premium','purchase_count',2,15,true,403),
  ('fp_pro_listen_1000','PRO Music Master','Putar 1000 lagu 30 hari','pro','listen_song_month',1000,180,true,500),
  ('fp_pro_topup_500k','PRO Sultan','Top up Rp 500rb 30 hari','pro','topup_amount_month',500000,200,true,501),
  ('fp_pro_login_30','PRO Absen Penuh','Login 30 hari penuh','pro','login_days_month',30,250,true,502),
  ('fp_pro_purchase_30','PRO Kolektor','Belanja 30 kali 30 hari','pro','purchase_count_month',30,220,true,503),
  ('fp_pro_quest_50','PRO Quest Master','Klaim 50 quest 30 hari','pro','quest_claim_month',50,180,true,504)
ON CONFLICT (code) DO NOTHING;
