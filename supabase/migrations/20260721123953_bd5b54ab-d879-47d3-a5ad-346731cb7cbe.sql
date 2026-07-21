
INSERT INTO public.fire_pass_missions (season_id, code, title, description, mission_type, requirement_type, target_value, badge_reward, is_active, sort_order) VALUES
-- Premium daily missions (eksklusif user Premium)
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','prem_daily_login','👑 Login Harian Premium','Login hari ini sebagai Premium','premium','daily_login',1,5,true,100),
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','prem_daily_streak','👑 Klaim Streak Premium','Klaim streak harian hari ini','premium','streak_claim',1,5,true,101),
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','prem_daily_listen','👑 Dengar 5 Lagu Premium','Dengarkan 5 lagu berbeda hari ini','premium','listen_song',5,6,true,102),
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','prem_daily_purchase','👑 Transaksi Premium','Lakukan 1 pembelian hari ini','premium','purchase_count',1,8,true,103),
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','prem_daily_topup','👑 Top Up 50k Premium','Top up minimal Rp 50.000 hari ini','premium','topup_amount',50000,10,true,104),
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','prem_daily_quest','👑 Klaim 1 Quest Premium','Klaim 1 Premium Quest hari ini','premium','quest_claim_week',1,7,true,105),
-- Monthly missions
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','mon_listen_100','📆 Marathon Lagu Bulanan','Dengarkan 100 lagu bulan ini','monthly','listen_song_month',100,25,true,200),
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','mon_purchase_20','📆 20 Transaksi Bulanan','Lakukan 20 pembelian bulan ini','monthly','purchase_count_month',20,30,true,201),
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','mon_topup_500k','📆 Top Up 500k Bulanan','Top up total Rp 500.000 bulan ini','monthly','topup_amount_month',500000,40,true,202),
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','mon_topup_2jt','📆 Sultan Bulanan','Top up total Rp 2.000.000 bulan ini','monthly','topup_amount_month',2000000,80,true,203),
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','mon_login_25','📆 Login 25 Hari','Login 25 hari berbeda bulan ini','monthly','login_days_month',25,50,true,204),
('70bc9a52-fe9b-4d57-bab4-3fe8ab312e15','mon_quest_15','📆 15 Quest Bulanan','Klaim 15 Premium Quest bulan ini','monthly','quest_claim_month',15,35,true,205)
ON CONFLICT DO NOTHING;
