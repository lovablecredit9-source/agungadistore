
-- Tambah lebih banyak Flash Deal Streak Shop (campuran non-premium & premium)
INSERT INTO public.streak_flash_deals
  (name, description, icon, original_cost, discount_pct, cost_gems, reward_type, reward_value, badge, gradient, requires_premium, daily_limit, is_active)
VALUES
  -- Non-premium (untuk semua user)
  ('Mega XP 1 Jam', 'Boost XP 2× selama 1 jam', '⚡', 350, 40, 3, 'double_xp', 1, '⚡ KILAT', 'from-yellow-500 to-amber-600', false, 1, true),
  ('Streak Freeze x2', 'Lindungi streak 2 kali', '❄️', 450, 35, 4, 'streak_freeze', 2, '🛡️ AMAN', 'from-sky-500 to-cyan-700', false, 1, true),
  ('Mystery Mini', 'Power-up campuran ringan', '🎁', 400, 50, 4, 'mystery_bundle', 1, '🎲 SURPRISE', 'from-rose-500 to-pink-700', false, 1, true),
  ('Double XP 3 Jam', 'XP 2× selama 3 jam', '🔥', 700, 45, 5, 'double_xp', 3, '🔥 TRENDING', 'from-orange-500 to-red-600', false, 1, true),
  ('Triple Freeze', 'Streak Freeze x3 hemat', '🧊', 800, 50, 6, 'streak_freeze', 3, '💧 DEAL', 'from-blue-500 to-indigo-700', false, 1, true),
  ('Lucky Bundle', 'Campuran nyawa & hint', '🍀', 550, 45, 4, 'mystery_bundle', 1, '🍀 LUCKY', 'from-emerald-500 to-green-700', false, 1, true),
  ('Power Hour x2', 'XP 2× kilat 2 jam', '💥', 500, 40, 4, 'double_xp', 2, '💥 KILAT', 'from-pink-500 to-rose-700', false, 1, true),
  ('Starter Freeze', 'Freeze 1× super hemat', '🛡️', 200, 40, 2, 'streak_freeze', 1, '🆕 NEW', 'from-cyan-500 to-teal-700', false, 1, true),

  -- Premium VIP deals
  ('VIP Mega Bundle', 'Paket lengkap VIP harian', '👑', 3500, 55, 30, 'vip_pack', 1, '👑 ELITE', 'from-yellow-500/40 to-amber-600/40', true, 1, true),
  ('Premium XP Marathon 72J', 'XP 2× selama 72 jam!', '🚀', 3200, 70, 25, 'double_xp', 72, '🚀 ULTRA', 'from-fuchsia-500/40 to-purple-600/40', true, 1, true),
  ('Premium Mystery Vault', 'Vault hadiah eksklusif', '💎', 2200, 60, 18, 'mystery_bundle', 1, '💎 RARE', 'from-violet-500/40 to-indigo-600/40', true, 1, true),
  ('Premium Freeze Vault', 'Streak Freeze x20 stok', '🏰', 3800, 65, 30, 'streak_freeze', 20, '🏰 STOCK', 'from-blue-500/40 to-cyan-600/40', true, 1, true),
  ('Weekend Booster', 'XP 2× spesial weekend 36J', '🎉', 1800, 60, 14, 'double_xp', 36, '🎉 WEEKEND', 'from-pink-500/40 to-rose-600/40', true, 1, true),
  ('Royal VIP Pack', 'Power-up super lengkap', '🤴', 2800, 50, 22, 'vip_pack', 1, '🤴 ROYAL', 'from-amber-500/40 to-yellow-600/40', true, 1, true),
  ('Premium Lucky Vault', 'Vault hadiah random besar', '🎰', 1500, 55, 12, 'mystery_bundle', 1, '🎰 JACKPOT', 'from-red-500/40 to-orange-600/40', true, 1, true),
  ('Premium XP Sprint', 'XP 2× sprint 4 jam', '⚡', 600, 45, 4, 'double_xp', 4, '⚡ SPRINT', 'from-yellow-500/40 to-orange-500/40', true, 1, true);
