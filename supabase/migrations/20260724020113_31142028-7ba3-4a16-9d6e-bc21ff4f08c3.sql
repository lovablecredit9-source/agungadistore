
DELETE FROM fire_pass_tiers WHERE season_id = '70bc9a52-fe9b-4d57-bab4-3fe8ab312e15';

INSERT INTO fire_pass_tiers (
  season_id, tier_level, badge_required,
  free_reward_type, free_reward_value, free_reward_duration_hours, free_reward_label,
  premium_reward_type, premium_reward_value, premium_reward_duration_hours, premium_reward_label
)
SELECT
  '70bc9a52-fe9b-4d57-bab4-3fe8ab312e15'::uuid,
  t,
  t * 8,
  -- FREE type
  CASE
    WHEN t % 10 = 0 THEN 'saldo_in'
    WHEN t % 7 = 0 THEN 'gems'
    WHEN t % 5 = 0 THEN 'streak_coins'
    WHEN t % 4 = 0 THEN 'coins'
    WHEN t % 3 = 0 THEN 'hint'
    WHEN t % 2 = 0 THEN 'extra_life'
    ELSE 'coins'
  END,
  -- FREE value
  CASE
    WHEN t % 10 = 0 THEN 500 + (t / 10) * 500  -- 1k, 1.5k, ... 5.5k
    WHEN t % 7 = 0 THEN 10 + t
    WHEN t % 5 = 0 THEN 100 + t * 5
    WHEN t % 4 = 0 THEN 60 + t * 8
    WHEN t % 3 = 0 THEN 2
    WHEN t % 2 = 0 THEN 1
    ELSE 40 + t * 4
  END,
  0,
  -- FREE label
  CASE
    WHEN t % 10 = 0 THEN 'Rp ' || (500 + (t / 10) * 500) || ' Saldo IN 💰'
    WHEN t % 7 = 0 THEN (10 + t) || ' 💎 Gem'
    WHEN t % 5 = 0 THEN (100 + t * 5) || ' 🔥 Streak Coin'
    WHEN t % 4 = 0 THEN (60 + t * 8) || ' 🪙 Koin'
    WHEN t % 3 = 0 THEN '2 💡 Hint'
    WHEN t % 2 = 0 THEN '1 ❤️ Nyawa'
    ELSE (40 + t * 4) || ' 🪙 Koin'
  END,
  -- PREMIUM type
  CASE
    WHEN t = 100 THEN 'saldo_in'
    WHEN t % 25 = 0 THEN 'saldo_in'
    WHEN t % 20 = 0 THEN 'server_luck_x10_hours'
    WHEN t % 15 = 0 THEN 'server_luck_x8_hours'
    WHEN t % 10 = 0 THEN 'server_luck_x6_hours'
    WHEN t % 8 = 0  THEN 'premium_quest_days'
    WHEN t % 7 = 0  THEN 'server_luck_x2_hours'
    WHEN t % 6 = 0  THEN 'voucher_saldo'
    WHEN t % 5 = 0  THEN 'streak_coins'
    WHEN t % 4 = 0  THEN 'lucky_ticket'
    WHEN t % 3 = 0  THEN 'gems'
    WHEN t % 2 = 0  THEN 'coins'
    ELSE 'gems'
  END,
  -- PREMIUM value
  CASE
    WHEN t = 100 THEN 100000
    WHEN t % 25 = 0 THEN 5000 * (t / 25)   -- t=25:5k, 50:10k, 75:15k
    WHEN t % 20 = 0 THEN 6                 -- jam
    WHEN t % 15 = 0 THEN 4                 -- jam
    WHEN t % 10 = 0 THEN 6                 -- jam
    WHEN t % 8 = 0  THEN 3                 -- hari
    WHEN t % 7 = 0  THEN 10                -- jam
    WHEN t % 6 = 0  THEN 3000              -- voucher saldo rp
    WHEN t % 5 = 0  THEN 1000 + t * 20     -- streak coins
    WHEN t % 4 = 0  THEN 3                 -- tiket lucky
    WHEN t % 3 = 0  THEN 30 + t
    WHEN t % 2 = 0  THEN 250 + t * 12
    ELSE 20 + t
  END,
  CASE
    WHEN t % 20 = 0 THEN 6
    WHEN t % 15 = 0 THEN 4
    WHEN t % 10 = 0 THEN 6
    WHEN t % 7 = 0  THEN 10
    ELSE 0
  END,
  -- PREMIUM label
  CASE
    WHEN t = 100 THEN 'Rp 100.000 Saldo IN 🏆 GRAND PRIZE'
    WHEN t % 25 = 0 THEN 'Rp ' || (5000 * (t / 25)) || ' Saldo IN 💰'
    WHEN t % 20 = 0 THEN 'Server Luck x10 · 6 Jam ⚡'
    WHEN t % 15 = 0 THEN 'Server Luck x8 · 4 Jam ⚡'
    WHEN t % 10 = 0 THEN 'Server Luck x6 · 6 Jam ⚡'
    WHEN t % 8 = 0  THEN '3 Hari Premium Quest 👑'
    WHEN t % 7 = 0  THEN 'Server Luck x2 · 10 Jam ⚡'
    WHEN t % 6 = 0  THEN 'Voucher Rp 3.000 🎟️'
    WHEN t % 5 = 0  THEN (1000 + t * 20) || ' 🔥 Streak Coin'
    WHEN t % 4 = 0  THEN '3 🎫 Tiket Lucky Draw'
    WHEN t % 3 = 0  THEN (30 + t) || ' 💎 Gem'
    WHEN t % 2 = 0  THEN (250 + t * 12) || ' 🪙 Koin'
    ELSE (20 + t) || ' 💎 Gem'
  END
FROM generate_series(1, 100) AS t;
