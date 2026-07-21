
INSERT INTO public.fire_pass_missions (season_id, code, title, description, mission_type, requirement_type, target_value, badge_reward, is_active, sort_order)
SELECT s.id, v.code, v.title, v.description, v.mission_type, v.requirement_type, v.target_value, v.badge_reward, true, v.sort_order
FROM (SELECT id FROM public.fire_pass_seasons WHERE is_active = true ORDER BY season_number DESC LIMIT 1) s,
(VALUES
  -- HARIAN tambahan
  ('d_listen_3','Dengar 3 Lagu','Putar 3 lagu berbeda hari ini','daily','listen_song',3,8,101),
  ('d_listen_15','Music Lover','Putar 15 lagu hari ini','daily','listen_song',15,28,102),
  ('d_listen_25','Playlist Marathon','Putar 25 lagu hari ini','daily','listen_song',25,45,103),
  ('d_listen_40','Non-stop Beat','Putar 40 lagu hari ini','daily','listen_song',40,70,104),
  ('d_purchase_2','Belanja Dobel','2 transaksi hari ini','daily','purchase_count',2,18,105),
  ('d_purchase_5','Borongan Harian','5 transaksi hari ini','daily','purchase_count',5,45,106),
  ('d_purchase_10','Sultan Sejati','10 transaksi hari ini','daily','purchase_count',10,90,107),
  ('d_topup_10k','Top-up 10rb','Isi saldo min. Rp 10.000','daily','topup_amount',10000,22,108),
  ('d_topup_50k','Top-up 50rb','Isi saldo min. Rp 50.000','daily','topup_amount',50000,60,109),
  ('d_topup_100k','Top-up 100rb','Isi saldo min. Rp 100.000','daily','topup_amount',100000,110,110),
  ('d_topup_250k','Top-up 250rb','Isi saldo min. Rp 250.000','daily','topup_amount',250000,240,111),
  ('d_topup_500k','Top-up 500rb','Isi saldo min. Rp 500.000','daily','topup_amount',500000,450,112),
  -- MINGGUAN tambahan
  ('w_login_7','Rajin Sepekan','Aktif setiap hari (7)','weekly','daily_login',7,80,201),
  ('w_listen_50','Music Freak','Putar 50 lagu minggu ini','weekly','listen_song_week',50,90,202),
  ('w_listen_200','Legenda Musik','Putar 200 lagu minggu ini','weekly','listen_song_week',200,260,203),
  ('w_listen_500','Dewa Musik','Putar 500 lagu minggu ini','weekly','listen_song_week',500,600,204),
  ('w_purchase_3','Belanja Aktif','3 transaksi minggu ini','weekly','purchase_count_week',3,40,205),
  ('w_purchase_10','Sultan Regular','10 transaksi minggu ini','weekly','purchase_count_week',10,110,206),
  ('w_purchase_25','Sultan Mania','25 transaksi minggu ini','weekly','purchase_count_week',25,260,207),
  ('w_purchase_50','Raja Belanja','50 transaksi minggu ini','weekly','purchase_count_week',50,550,208),
  ('w_topup_20k','Top-up 20rb Weekly','Total Top-up 20rb','weekly','topup_amount_week',20000,45,209),
  ('w_topup_100k','Top-up 100rb Weekly','Total Top-up 100rb','weekly','topup_amount_week',100000,130,210),
  ('w_topup_1jt','Top-up Sultan','Total Top-up Rp 1jt','weekly','topup_amount_week',1000000,900,211),
  ('w_topup_2jt','Top-up Konglomerat','Total Top-up Rp 2jt','weekly','topup_amount_week',2000000,1800,212),
  ('w_quest_10','Quest Kolektor+','Klaim 10 quest minggu ini','weekly','quest_claim_week',10,150,213),
  ('w_quest_30','Grandmaster Quest','Klaim 30 quest minggu ini','weekly','quest_claim_week',30,500,214)
) AS v(code,title,description,mission_type,requirement_type,target_value,badge_reward,sort_order)
ON CONFLICT DO NOTHING;
