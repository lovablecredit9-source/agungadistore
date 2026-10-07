// Raw Lucky Royale prize lists. Rarity/weights are normalized by ../_shared/royale-economy.ts.
import type { PoolPrize } from "../_shared/royale-economy.ts";

export const RAW_NORMAL_PRIZES: PoolPrize[] = [
  // === STOK BESAR (susah, tapi hadiahnya gede) ===
  { kind: "extra_life",    value: 500,    label: "🔥 +500 Nyawa",            emoji: "❤️", rarity: "legendary", weight: 0.9,   color: "#fbbf24" },
  { kind: "auto_hint",     value: 500,    label: "🔥 +500 Hint",             emoji: "💡", rarity: "legendary", weight: 0.9,   color: "#fbbf24" },
  { kind: "extra_life",    value: 1000,   label: "🌟 +1.000 Nyawa",          emoji: "❤️", rarity: "mythic",    weight: 0.35,  color: "#f0abfc" },
  { kind: "auto_hint",     value: 1000,   label: "🌟 +1.000 Hint",           emoji: "💡", rarity: "mythic",    weight: 0.35,  color: "#f0abfc" },
  { kind: "extra_life",    value: 2000,   label: "👑 +2.000 Nyawa GOD",      emoji: "❤️", rarity: "mythic",    weight: 0.12,  color: "#fef08a" },
  { kind: "auto_hint",     value: 2000,   label: "👑 +2.000 Hint GOD",       emoji: "💡", rarity: "mythic",    weight: 0.12,  color: "#fef08a" },
  { kind: "extra_life",    value: 5000,   label: "💥 +5.000 Nyawa JACKPOT",  emoji: "❤️", rarity: "mythic",    weight: 0.03,  color: "#fef08a" },
  { kind: "auto_hint",     value: 5000,   label: "💥 +5.000 Hint JACKPOT",   emoji: "💡", rarity: "mythic",    weight: 0.03,  color: "#fef08a" },
  { kind: "streak_freeze", value: 50,     label: "🛡️ +50 Streak Freeze",     emoji: "🛡️", rarity: "legendary", weight: 0.6,   color: "#f59e0b" },
  { kind: "streak_freeze", value: 200,    label: "🛡️ +200 Streak Freeze",    emoji: "🛡️", rarity: "mythic",    weight: 0.12,  color: "#fef08a" },
  { kind: "time_freeze",   value: 300,    label: "⏱️ +300 Freeze 30s",       emoji: "⏱️", rarity: "mythic",    weight: 0.15,  color: "#f0abfc" },
  { kind: "streak_coins",  value: 2000,   label: "🪙 +2.000 Streak Coin",    emoji: "🪙", rarity: "epic",      weight: 3,     color: "#fb923c" },
  { kind: "streak_coins",  value: 5000,   label: "🪙 +5.000 Streak Coin",    emoji: "🪙", rarity: "epic",      weight: 2,     color: "#fb923c" },
  { kind: "streak_coins",  value: 10000,  label: "🪙 +10.000 Streak Coin",   emoji: "🪙", rarity: "legendary", weight: 1.1,   color: "#fbbf24" },
  { kind: "streak_coins",  value: 300000, label: "👑 +300.000 Streak GOD",   emoji: "🪙", rarity: "mythic",    weight: 0.02,  color: "#fef08a" },
  { kind: "game_credits",  value: 500,    label: "🔑 +500 Kredit Game",      emoji: "🔑", rarity: "mythic",    weight: 0.05,  color: "#fef08a" },
  { kind: "game_credits",  value: 2000,   label: "👑 +2.000 Kredit JACKPOT", emoji: "🔑", rarity: "mythic",    weight: 0.01,  color: "#fef08a" },

  // === COMMON (sering keluar) ===
  { kind: "auto_hint",     value: 2,     label: "+2 Hint Otomatis",        emoji: "💡", rarity: "common",    weight: 22,    color: "#94a3b8" },
  { kind: "extra_life",    value: 2,     label: "+2 Nyawa Ekstra",         emoji: "❤️", rarity: "common",    weight: 22,    color: "#ef4444" },
  { kind: "time_freeze",   value: 2,     label: "+2 Freeze 30s",           emoji: "⏱️", rarity: "common",    weight: 16,    color: "#0ea5e9" },
  { kind: "auto_hint",     value: 3,     label: "+3 Hint Otomatis",        emoji: "💡", rarity: "common",    weight: 14,    color: "#94a3b8" },
  { kind: "extra_life",    value: 3,     label: "+3 Nyawa Ekstra",         emoji: "❤️", rarity: "common",    weight: 14,    color: "#ef4444" },

  // === RARE ===
  { kind: "streak_freeze", value: 2,     label: "+2 Streak Freeze",        emoji: "🛡️", rarity: "rare",      weight: 12,    color: "#10b981" },
  { kind: "auto_hint",     value: 5,     label: "+5 Hint Otomatis",        emoji: "💡", rarity: "rare",      weight: 10,    color: "#06b6d4" },
  { kind: "extra_life",    value: 5,     label: "+5 Nyawa Ekstra",         emoji: "❤️", rarity: "rare",      weight: 10,    color: "#f43f5e" },
  { kind: "auto_hint",     value: 8,     label: "+8 Hint Otomatis",        emoji: "💡", rarity: "rare",      weight: 7,     color: "#06b6d4" },
  { kind: "extra_life",    value: 8,     label: "+8 Nyawa Ekstra",         emoji: "❤️", rarity: "rare",      weight: 7,     color: "#f43f5e" },
  { kind: "time_freeze",   value: 5,     label: "+5 Freeze 30s",           emoji: "⏱️", rarity: "rare",      weight: 7,     color: "#0ea5e9" },
  { kind: "streak_coins",  value: 200,   label: "🪙 +200 Streak Coin",      emoji: "🪙", rarity: "rare",      weight: 10,    color: "#f59e0b" },
  { kind: "streak_coins",  value: 500,   label: "🪙 +500 Streak Coin",      emoji: "🪙", rarity: "rare",      weight: 7,     color: "#f59e0b" },
  // TIKET NORMAL — 1 tiket = 1 spin Normal gratis
  { kind: "spin_ticket_normal" as any, value: 1, label: "🎫 +1 Tiket Spin Normal", emoji: "🎫", rarity: "rare",   weight: 4,     color: "#22d3ee" },
  { kind: "spin_ticket_normal" as any, value: 3, label: "🎫 +3 Tiket Spin Normal", emoji: "🎫", rarity: "epic",   weight: 1.2,   color: "#06b6d4" },
  { kind: "spin_ticket_normal" as any, value: 10, label: "🎫 +10 Tiket Spin Normal", emoji: "🎫", rarity: "legendary", weight: 0.25, color: "#fbbf24" },

  // === EPIC ===
  { kind: "auto_hint",     value: 12,    label: "💡 +12 Hint",             emoji: "💡", rarity: "epic",      weight: 5,     color: "#a855f7" },
  { kind: "extra_life",    value: 12,    label: "❤️ +12 Nyawa",            emoji: "❤️", rarity: "epic",      weight: 5,     color: "#a855f7" },
  { kind: "time_freeze",   value: 8,     label: "+8 Freeze 30s",           emoji: "⏱️", rarity: "epic",      weight: 4.5,   color: "#a855f7" },
  { kind: "streak_freeze", value: 4,     label: "+4 Streak Freeze",        emoji: "🛡️", rarity: "epic",      weight: 4.5,   color: "#ec4899" },
  { kind: "gems",          value: 100,   label: "💎 +100 Gem",             emoji: "💎", rarity: "epic",      weight: 3.5,   color: "#8b5cf6" },
  { kind: "auto_hint",     value: 20,    label: "💡 +20 Hint",             emoji: "💡", rarity: "epic",      weight: 2.8,   color: "#a855f7" },
  { kind: "extra_life",    value: 20,    label: "❤️ +20 Nyawa",            emoji: "❤️", rarity: "epic",      weight: 2.8,   color: "#a855f7" },
  { kind: "streak_coins",  value: 1500,  label: "🪙 +1.500 Streak Coin",    emoji: "🪙", rarity: "epic",      weight: 4,     color: "#fb923c" },
  { kind: "streak_coins",  value: 3000,  label: "🪙 +3.000 Streak Coin",    emoji: "🪙", rarity: "epic",      weight: 2.5,   color: "#fb923c" },

  // === LEGENDARY (susah) ===
  { kind: "extra_life",    value: 35,    label: "❤️ +35 Nyawa",            emoji: "❤️", rarity: "legendary", weight: 2,     color: "#fbbf24" },
  { kind: "auto_hint",     value: 35,    label: "💡 +35 Hint",             emoji: "💡", rarity: "legendary", weight: 2,     color: "#fbbf24" },
  { kind: "streak_freeze", value: 10,    label: "🛡️ +10 Streak Freeze",    emoji: "🛡️", rarity: "legendary", weight: 1.8,   color: "#f59e0b" },
  { kind: "gems",          value: 300,   label: "💎 +300 Gem",             emoji: "💎", rarity: "legendary", weight: 1.5,   color: "#facc15" },
  { kind: "extra_life",    value: 50,    label: "❤️ +50 Nyawa",            emoji: "❤️", rarity: "legendary", weight: 1.2,   color: "#fbbf24" },
  { kind: "auto_hint",     value: 50,    label: "💡 +50 Hint",             emoji: "💡", rarity: "legendary", weight: 1.2,   color: "#fbbf24" },
  { kind: "gems",          value: 500,   label: "💎 +500 Gem",             emoji: "💎", rarity: "legendary", weight: 0.9,   color: "#facc15" },
  { kind: "streak_coins",  value: 8000,  label: "🪙 +8.000 Streak Coin",    emoji: "🪙", rarity: "legendary", weight: 1.5,   color: "#fbbf24" },
  { kind: "streak_coins",  value: 20000, label: "🪙 +20.000 Streak Coin",   emoji: "🪙", rarity: "legendary", weight: 0.8,   color: "#fbbf24" },

  // === MYTHIC (sangat susah) ===
  { kind: "extra_life",    value: 80,    label: "🌈 +80 Nyawa",            emoji: "❤️", rarity: "mythic",    weight: 0.7,   color: "#f0abfc" },
  { kind: "auto_hint",     value: 80,    label: "🌈 +80 Hint",             emoji: "💡", rarity: "mythic",    weight: 0.7,   color: "#f0abfc" },
  { kind: "extra_life",    value: 150,   label: "🌟 +150 Nyawa",           emoji: "❤️", rarity: "mythic",    weight: 0.4,   color: "#f0abfc" },
  { kind: "auto_hint",     value: 150,   label: "🌟 +150 Hint",            emoji: "💡", rarity: "mythic",    weight: 0.4,   color: "#f0abfc" },
  { kind: "gems",          value: 800,   label: "💎 +800 Gem",             emoji: "💎", rarity: "mythic",    weight: 0.4,   color: "#fde68a" },
  { kind: "gems",          value: 2500,  label: "💎 +2.500 Gem",           emoji: "💎", rarity: "mythic",    weight: 0.15,  color: "#fde68a" },
  { kind: "extra_life",    value: 300,   label: "👑 +300 Nyawa GOD",       emoji: "❤️", rarity: "mythic",    weight: 0.12,  color: "#fef08a" },
  { kind: "auto_hint",     value: 300,   label: "👑 +300 Hint GOD",        emoji: "💡", rarity: "mythic",    weight: 0.12,  color: "#fef08a" },
  { kind: "gems",          value: 8000,  label: "💎 +8.000 Gem",           emoji: "💎", rarity: "mythic",    weight: 0.05,  color: "#fde68a" },
  { kind: "gems",          value: 10000, label: "👑 +10.000 Gem",          emoji: "💎", rarity: "mythic",    weight: 0.025, color: "#fef08a" },
  { kind: "streak_coins",  value: 50000, label: "🪙 +50.000 Streak Coin",   emoji: "🪙", rarity: "mythic",    weight: 0.3,   color: "#fde68a" },
  { kind: "streak_coins",  value: 150000,label: "👑 +150.000 Streak JACKPOT", emoji: "🪙", rarity: "mythic",  weight: 0.05,  color: "#fef08a" },

  // === KREDIT GAME (Kunci Jawaban) ===
  { kind: "game_credits",  value: 1,     label: "🔑 +1 Kredit Game",        emoji: "🔑", rarity: "rare",      weight: 8,     color: "#22d3ee" },
  { kind: "game_credits",  value: 3,     label: "🔑 +3 Kredit Game",        emoji: "🔑", rarity: "rare",      weight: 5,     color: "#06b6d4" },
  { kind: "game_credits",  value: 5,     label: "🔑 +5 Kredit Game",        emoji: "🔑", rarity: "epic",      weight: 3,     color: "#a855f7" },
  { kind: "game_credits",  value: 10,    label: "🔑 +10 Kredit Game",       emoji: "🔑", rarity: "epic",      weight: 1.5,   color: "#a855f7" },
  { kind: "game_credits",  value: 25,    label: "🔑 +25 Kredit Game",       emoji: "🔑", rarity: "legendary", weight: 0.7,   color: "#fbbf24" },
  { kind: "game_credits",  value: 50,    label: "🔑 +50 Kredit Game",       emoji: "🔑", rarity: "legendary", weight: 0.3,   color: "#facc15" },
  { kind: "game_credits",  value: 100,   label: "🌟 +100 Kredit Game",      emoji: "🔑", rarity: "mythic",    weight: 0.12,  color: "#f0abfc" },
  { kind: "game_credits",  value: 250,   label: "👑 +250 Kredit JACKPOT",   emoji: "🔑", rarity: "mythic",    weight: 0.025, color: "#fef08a" },

  // === SALDO IN (Saldo dalam game) — nominal Rupiah kecil tapi lumayan biar rajin main ===
  { kind: "game_balance",  value: 200,   label: "💵 +Rp 200 Saldo IN",      emoji: "💵", rarity: "rare",      weight: 10,    color: "#34d399" },
  { kind: "game_balance",  value: 500,   label: "💵 +Rp 500 Saldo IN",      emoji: "💵", rarity: "rare",      weight: 7,     color: "#34d399" },
  { kind: "game_balance",  value: 1000,  label: "💵 +Rp 1.000 Saldo IN",    emoji: "💵", rarity: "rare",      weight: 4.5,   color: "#10b981" },
  { kind: "game_balance",  value: 2000,  label: "💵 +Rp 2.000 Saldo IN",    emoji: "💵", rarity: "epic",      weight: 2,     color: "#059669" },
  { kind: "game_balance",  value: 3500,  label: "💵 +Rp 3.500 Saldo IN",    emoji: "💵", rarity: "epic",      weight: 1,     color: "#a855f7" },
  { kind: "game_balance",  value: 5000,  label: "💸 +Rp 5.000 Saldo IN",    emoji: "💵", rarity: "legendary", weight: 0.45,  color: "#fbbf24" },
  { kind: "game_balance",  value: 10000, label: "💸 +Rp 10.000 Saldo IN",   emoji: "💵", rarity: "legendary", weight: 0.18,  color: "#facc15" },
  { kind: "game_balance",  value: 15000, label: "🌟 +Rp 15.000 Saldo IN",   emoji: "💵", rarity: "mythic",    weight: 0.05,  color: "#f0abfc" },


  // === MEGA JACKPOT (PALING SUSAH SEKALI — super rare) ===
  { kind: "gems",          value: 25000, label: "🔥 +25.000 Gem MEGA",     emoji: "💎", rarity: "mythic",    weight: 0.008, color: "#fef08a" },
  { kind: "gems",          value: 50000, label: "👑 +50.000 GEM JACKPOT",  emoji: "💎", rarity: "mythic",    weight: 0.002, color: "#fef08a" },

  // === 🎫 TIKET SPIN PREMIUM (drop langka di pool normal) ===
  { kind: "spin_ticket_premium" as any, value: 1,  label: "🎫 +1 Tiket Spin Premium",  emoji: "🎫", rarity: "epic",      weight: 1.5,   color: "#e879f9" },
  { kind: "spin_ticket_premium" as any, value: 3,  label: "🎫 +3 Tiket Spin Premium",  emoji: "🎫", rarity: "legendary", weight: 0.5,   color: "#f0abfc" },
  { kind: "spin_ticket_premium" as any, value: 10, label: "🎫 +10 Tiket Spin Premium", emoji: "🎫", rarity: "mythic",    weight: 0.12,  color: "#fef08a" },

  // === 🔥 FIRE PASS BADGE (progres season langsung) ===
  { kind: "fire_pass_badge" as any,   value: 10,  label: "🔥 +10 Badge Fire Pass",  emoji: "🔥", rarity: "rare",      weight: 3,     color: "#fb923c" },
  { kind: "fire_pass_badge" as any,   value: 25,  label: "🔥 +25 Badge Fire Pass",  emoji: "🔥", rarity: "epic",      weight: 1.6,   color: "#f97316" },
  { kind: "fire_pass_badge" as any,   value: 50,  label: "🔥 +50 Badge Fire Pass",  emoji: "🔥", rarity: "legendary", weight: 0.7,   color: "#fbbf24" },
  { kind: "fire_pass_badge" as any,   value: 100, label: "🔥 +100 Badge Fire Pass", emoji: "🔥", rarity: "mythic",    weight: 0.25,  color: "#fef08a" },
  { kind: "fire_pass_badge" as any,   value: 250, label: "👑 +250 Badge FIRE GOD",  emoji: "🔥", rarity: "mythic",    weight: 0.05,  color: "#fef08a" },

  // === 🎟️ FIRE PASS PREMIUM (aktivasi 1x season) ===
  { kind: "fire_pass_premium" as any, value: 1,   label: "🎟️ Fire Pass PREMIUM (1x Season)", emoji: "🎟️", rarity: "mythic", weight: 0.06, color: "#fef08a" },


  // === 💬 VOUCHER ANON CHAT PREMIUM ===
  { kind: "anon_premium" as any, value: 1, label: "💬 Anon Premium 1 Hari", emoji: "💬", rarity: "rare", weight: 2.4, color: "#22d3ee" },
  { kind: "anon_premium" as any, value: 2, label: "💬 Anon Premium 2 Hari", emoji: "💬", rarity: "rare", weight: 1.6, color: "#22d3ee" },
  { kind: "anon_premium" as any, value: 5, label: "💬 Anon Premium 5 Hari", emoji: "💬", rarity: "epic", weight: 1.0, color: "#a855f7" },
  { kind: "anon_premium" as any, value: 7, label: "💬 Anon Premium 7 Hari", emoji: "💬", rarity: "epic", weight: 0.7, color: "#a855f7" },
  { kind: "anon_premium" as any, value: 10, label: "💬 Anon Premium 10 Hari", emoji: "💬", rarity: "legendary", weight: 0.45, color: "#fbbf24" },
  { kind: "anon_premium" as any, value: 30, label: "💬 Anon Premium 1 Bulan", emoji: "💬", rarity: "legendary", weight: 0.22, color: "#fbbf24" },
  { kind: "anon_premium" as any, value: 60, label: "💬 👑 Anon Premium 2 Bulan", emoji: "💬", rarity: "mythic", weight: 0.1, color: "#fef08a" },
  { kind: "anon_premium" as any, value: 180, label: "💬 👑 Anon Premium 6 Bulan", emoji: "💬", rarity: "mythic", weight: 0.04, color: "#fef08a" },
  { kind: "anon_premium" as any, value: 365, label: "💬 👑 Anon Premium 1 Tahun", emoji: "💬", rarity: "mythic", weight: 0.012, color: "#fef08a" },

  // === 🏆 VOUCHER PREMIUM QUEST ===
  { kind: "pq_voucher" as any, value: 1, label: "🏆 Voucher Quest 1 Hari", emoji: "🏆", rarity: "rare", weight: 1.92, color: "#22d3ee" },
  { kind: "pq_voucher" as any, value: 2, label: "🏆 Voucher Quest 2 Hari", emoji: "🏆", rarity: "rare", weight: 1.28, color: "#22d3ee" },
  { kind: "pq_voucher" as any, value: 5, label: "🏆 Voucher Quest 5 Hari", emoji: "🏆", rarity: "epic", weight: 0.8, color: "#a855f7" },
  { kind: "pq_voucher" as any, value: 7, label: "🏆 Voucher Quest 7 Hari", emoji: "🏆", rarity: "epic", weight: 0.56, color: "#a855f7" },
  { kind: "pq_voucher" as any, value: 10, label: "🏆 Voucher Quest 10 Hari", emoji: "🏆", rarity: "legendary", weight: 0.36, color: "#fbbf24" },
  { kind: "pq_voucher" as any, value: 30, label: "🏆 Voucher Quest 1 Bulan", emoji: "🏆", rarity: "legendary", weight: 0.176, color: "#fbbf24" },
  { kind: "pq_voucher" as any, value: 60, label: "🏆 👑 Voucher Quest 2 Bulan", emoji: "🏆", rarity: "mythic", weight: 0.08, color: "#fef08a" },
  { kind: "pq_voucher" as any, value: 180, label: "🏆 👑 Voucher Quest 6 Bulan", emoji: "🏆", rarity: "mythic", weight: 0.032, color: "#fef08a" },
  { kind: "pq_voucher" as any, value: 365, label: "🏆 👑 Voucher Quest 1 Tahun", emoji: "🏆", rarity: "mythic", weight: 0.01, color: "#fef08a" },

  // === 🤫 VOUCHER CONFESS ===
  { kind: "confess_voucher" as any, value: 10, label: "🤫 Voucher Confess 10%", emoji: "🤫", rarity: "common", weight: 4.0, color: "#f9a8d4" },
  { kind: "confess_voucher" as any, value: 25, label: "🤫 Voucher Confess 25%", emoji: "🤫", rarity: "rare", weight: 2.6, color: "#f472b6" },
  { kind: "confess_voucher" as any, value: 50, label: "🤫 Voucher Confess 50%", emoji: "🤫", rarity: "epic", weight: 1.2, color: "#ec4899" },
  { kind: "confess_voucher" as any, value: 75, label: "🤫 Voucher Confess 75%", emoji: "🤫", rarity: "legendary", weight: 0.5, color: "#fbbf24" },
  { kind: "confess_voucher" as any, value: 90, label: "🤫 Voucher Confess 90%", emoji: "🤫", rarity: "legendary", weight: 0.3, color: "#fbbf24" },
  { kind: "confess_voucher" as any, value: 100, label: "👑 Voucher Confess GRATIS 100%", emoji: "🤫", rarity: "mythic", weight: 0.09, color: "#fef08a" },

  // === 🔥 FIRE PASS ===
  { kind: "fire_pass_badge" as any, value: 20, label: "🔥 +20 Badge Fire Pass", emoji: "🔥", rarity: "rare", weight: 3.0, color: "#fb923c" },
  { kind: "fire_pass_badge" as any, value: 30, label: "🔥 +30 Badge Fire Pass", emoji: "🔥", rarity: "rare", weight: 2.2, color: "#fb923c" },
  { kind: "fire_pass_badge" as any, value: 50, label: "🔥 +50 Badge Fire Pass", emoji: "🔥", rarity: "epic", weight: 1.4, color: "#f97316" },
  { kind: "fire_pass_badge" as any, value: 100, label: "🔥 +100 Badge Fire Pass", emoji: "🔥", rarity: "legendary", weight: 0.6, color: "#fbbf24" },
  { kind: "fire_pass_badge" as any, value: 200, label: "🔥 +200 Badge Fire Pass", emoji: "🔥", rarity: "mythic", weight: 0.18, color: "#fef08a" },
  { kind: "fire_pass_badge" as any, value: 300, label: "🔥 +300 Badge Fire Pass", emoji: "🔥", rarity: "mythic", weight: 0.07, color: "#fef08a" },
  { kind: "fire_pass_premium" as any, value: 1, label: "🎟️ Fire Pass PREMIUM (1x Season)", emoji: "🎟️", rarity: "mythic", weight: 0.06, color: "#fef08a" },

  // === 📦 STOK BESAR ===
  { kind: "extra_life" as any, value: 20, label: "❤️ +20 Nyawa", emoji: "❤️", rarity: "rare", weight: 8.0, color: "#f43f5e" },
  { kind: "auto_hint" as any, value: 20, label: "💡 +20 Hint", emoji: "💡", rarity: "rare", weight: 8.0, color: "#f43f5e" },
  { kind: "extra_life" as any, value: 30, label: "❤️ +30 Nyawa", emoji: "❤️", rarity: "rare", weight: 6.0, color: "#f43f5e" },
  { kind: "auto_hint" as any, value: 30, label: "💡 +30 Hint", emoji: "💡", rarity: "rare", weight: 6.0, color: "#f43f5e" },
  { kind: "extra_life" as any, value: 50, label: "❤️ +50 Nyawa", emoji: "❤️", rarity: "epic", weight: 3.0, color: "#a855f7" },
  { kind: "auto_hint" as any, value: 50, label: "💡 +50 Hint", emoji: "💡", rarity: "epic", weight: 3.0, color: "#a855f7" },
  { kind: "extra_life" as any, value: 100, label: "❤️ +100 Nyawa", emoji: "❤️", rarity: "legendary", weight: 1.2, color: "#fbbf24" },
  { kind: "auto_hint" as any, value: 100, label: "💡 +100 Hint", emoji: "💡", rarity: "legendary", weight: 1.2, color: "#fbbf24" },
  { kind: "extra_life" as any, value: 300, label: "❤️ +300 Nyawa", emoji: "❤️", rarity: "mythic", weight: 0.2, color: "#f0abfc" },
  { kind: "auto_hint" as any, value: 300, label: "💡 +300 Hint", emoji: "💡", rarity: "mythic", weight: 0.2, color: "#f0abfc" },
  { kind: "streak_coins" as any, value: 2000, label: "🪙 +2.000 Koin Streak", emoji: "🪙", rarity: "rare", weight: 7.0, color: "#f59e0b" },
  { kind: "streak_coins" as any, value: 5000, label: "🪙 +5.000 Koin Streak", emoji: "🪙", rarity: "epic", weight: 4.0, color: "#fb923c" },
  { kind: "streak_coins" as any, value: 10000, label: "🪙 +10.000 Koin Streak", emoji: "🪙", rarity: "epic", weight: 2.5, color: "#fb923c" },
  { kind: "streak_coins" as any, value: 20000, label: "🪙 +20.000 Koin Streak", emoji: "🪙", rarity: "legendary", weight: 1.2, color: "#fbbf24" },
  { kind: "streak_coins" as any, value: 100000, label: "🪙 +100.000 Koin Streak", emoji: "🪙", rarity: "mythic", weight: 0.22, color: "#fef08a" },
  { kind: "streak_coins" as any, value: 200000, label: "🪙 +200.000 Koin Streak", emoji: "🪙", rarity: "mythic", weight: 0.06, color: "#fef08a" },
];

export const RAW_PREMIUM_PRIZES: PoolPrize[] = [
  // === STOK BESAR (susah, tapi hadiahnya gede) ===
  { kind: "extra_life",    value: 500,    label: "🔥 +500 Nyawa",            emoji: "❤️", rarity: "legendary", weight: 0.9,   color: "#fbbf24" },
  { kind: "auto_hint",     value: 500,    label: "🔥 +500 Hint",             emoji: "💡", rarity: "legendary", weight: 0.9,   color: "#fbbf24" },
  { kind: "extra_life",    value: 1000,   label: "🌟 +1.000 Nyawa",          emoji: "❤️", rarity: "mythic",    weight: 0.35,  color: "#f0abfc" },
  { kind: "auto_hint",     value: 1000,   label: "🌟 +1.000 Hint",           emoji: "💡", rarity: "mythic",    weight: 0.35,  color: "#f0abfc" },
  { kind: "extra_life",    value: 2000,   label: "👑 +2.000 Nyawa GOD",      emoji: "❤️", rarity: "mythic",    weight: 0.12,  color: "#fef08a" },
  { kind: "auto_hint",     value: 2000,   label: "👑 +2.000 Hint GOD",       emoji: "💡", rarity: "mythic",    weight: 0.12,  color: "#fef08a" },
  { kind: "extra_life",    value: 5000,   label: "💥 +5.000 Nyawa JACKPOT",  emoji: "❤️", rarity: "mythic",    weight: 0.03,  color: "#fef08a" },
  { kind: "auto_hint",     value: 5000,   label: "💥 +5.000 Hint JACKPOT",   emoji: "💡", rarity: "mythic",    weight: 0.03,  color: "#fef08a" },
  { kind: "streak_freeze", value: 50,     label: "🛡️ +50 Streak Freeze",     emoji: "🛡️", rarity: "legendary", weight: 0.6,   color: "#f59e0b" },
  { kind: "streak_freeze", value: 200,    label: "🛡️ +200 Streak Freeze",    emoji: "🛡️", rarity: "mythic",    weight: 0.12,  color: "#fef08a" },
  { kind: "time_freeze",   value: 300,    label: "⏱️ +300 Freeze 30s",       emoji: "⏱️", rarity: "mythic",    weight: 0.15,  color: "#f0abfc" },
  { kind: "streak_coins",  value: 2000,   label: "🪙 +2.000 Streak Coin",    emoji: "🪙", rarity: "epic",      weight: 3,     color: "#fb923c" },
  { kind: "streak_coins",  value: 5000,   label: "🪙 +5.000 Streak Coin",    emoji: "🪙", rarity: "epic",      weight: 2,     color: "#fb923c" },
  { kind: "streak_coins",  value: 10000,  label: "🪙 +10.000 Streak Coin",   emoji: "🪙", rarity: "legendary", weight: 1.1,   color: "#fbbf24" },
  { kind: "streak_coins",  value: 300000, label: "👑 +300.000 Streak GOD",   emoji: "🪙", rarity: "mythic",    weight: 0.02,  color: "#fef08a" },
  { kind: "game_credits",  value: 500,    label: "🔑 +500 Kredit Game",      emoji: "🔑", rarity: "mythic",    weight: 0.05,  color: "#fef08a" },
  { kind: "game_credits",  value: 2000,   label: "👑 +2.000 Kredit JACKPOT", emoji: "🔑", rarity: "mythic",    weight: 0.01,  color: "#fef08a" },

  // === COMMON (sering keluar — hadiah kecil, mayoritas bukan gem) ===
  { kind: "auto_hint",     value: 2,     label: "+2 Hint Otomatis",         emoji: "💡", rarity: "common",    weight: 22,    color: "#94a3b8" },
  { kind: "extra_life",    value: 2,     label: "+2 Nyawa Ekstra",          emoji: "❤️", rarity: "common",    weight: 22,    color: "#ef4444" },
  { kind: "time_freeze",   value: 2,     label: "+2 Freeze 30s",            emoji: "⏱️", rarity: "common",    weight: 18,    color: "#0ea5e9" },
  { kind: "auto_hint",     value: 3,     label: "+3 Hint Otomatis",         emoji: "💡", rarity: "common",    weight: 16,    color: "#94a3b8" },
  { kind: "extra_life",    value: 3,     label: "+3 Nyawa Ekstra",          emoji: "❤️", rarity: "common",    weight: 16,    color: "#ef4444" },
  { kind: "streak_coins",  value: 100,   label: "🪙 +100 Streak Coin",       emoji: "🪙", rarity: "common",    weight: 22,    color: "#f59e0b" },
  // GEM common — sering keluar tapi nominal kecil (sumber gem konsisten)
  { kind: "gems",          value: 50,    label: "💎 +50 Gem",                emoji: "💎", rarity: "common",    weight: 4,     color: "#8b5cf6" },
  { kind: "gems",          value: 100,   label: "💎 +100 Gem",               emoji: "💎", rarity: "common",    weight: 2.5,   color: "#8b5cf6" },
  { kind: "gems",          value: 200,   label: "💎 +200 Gem",               emoji: "💎", rarity: "common",    weight: 1.2,   color: "#8b5cf6" },

  // === RARE (lumayan — base konsisten) ===
  { kind: "streak_freeze", value: 3,     label: "+3 Streak Freeze",         emoji: "🛡️", rarity: "rare",      weight: 8,     color: "#10b981" },
  { kind: "auto_hint",     value: 6,     label: "+6 Hint Otomatis",         emoji: "💡", rarity: "rare",      weight: 7,     color: "#06b6d4" },
  { kind: "extra_life",    value: 6,     label: "+6 Nyawa Ekstra",          emoji: "❤️", rarity: "rare",      weight: 7,     color: "#f43f5e" },
  { kind: "auto_hint",     value: 10,    label: "+10 Hint Otomatis",        emoji: "💡", rarity: "rare",      weight: 5,     color: "#06b6d4" },
  { kind: "extra_life",    value: 10,    label: "+10 Nyawa Ekstra",         emoji: "❤️", rarity: "rare",      weight: 5,     color: "#f43f5e" },
  { kind: "time_freeze",   value: 6,     label: "+6 Freeze 30s",            emoji: "⏱️", rarity: "rare",      weight: 5,     color: "#0ea5e9" },
  { kind: "streak_coins",  value: 300,   label: "🪙 +300 Streak Coin",       emoji: "🪙", rarity: "rare",      weight: 6,     color: "#f59e0b" },
  { kind: "streak_coins",  value: 600,   label: "🪙 +600 Streak Coin",       emoji: "🪙", rarity: "rare",      weight: 4,     color: "#f59e0b" },
  // GEM rare — lumayan, kadang-kadang
  { kind: "gems",          value: 500,   label: "💎 +500 Gem PREMIUM",       emoji: "💎", rarity: "rare",      weight: 0.6,   color: "#8b5cf6" },
  { kind: "gems",          value: 1000,  label: "💎 +1.000 Gem PREMIUM",     emoji: "💎", rarity: "rare",      weight: 0.25,  color: "#8b5cf6" },
  { kind: "gems",          value: 2000,  label: "💎 +2.000 Gem PREMIUM",     emoji: "💎", rarity: "rare",      weight: 0.10,  color: "#8b5cf6" },
  { kind: "lucky_token" as any, value: 1, label: "🎟️ +1 Lucky Token",        emoji: "🎟️", rarity: "rare",      weight: 3,     color: "#22d3ee" },
  // TIKET PREMIUM — 1 tiket = 1 spin Premium gratis
  { kind: "spin_ticket_premium" as any, value: 1, label: "🎫 +1 Tiket Spin Premium", emoji: "🎫", rarity: "rare",   weight: 2.5,   color: "#f0abfc" },
  { kind: "spin_ticket_premium" as any, value: 3, label: "🎫 +3 Tiket Spin Premium", emoji: "🎫", rarity: "epic",   weight: 0.8,   color: "#e879f9" },
  { kind: "spin_ticket_premium" as any, value: 10, label: "🎫 +10 Tiket Spin Premium", emoji: "🎫", rarity: "legendary", weight: 0.15, color: "#fbbf24" },

  // === EPIC ===
  { kind: "auto_hint",     value: 15,    label: "💡 +15 Hint",              emoji: "💡", rarity: "epic",      weight: 5,     color: "#a855f7" },
  { kind: "extra_life",    value: 15,    label: "❤️ +15 Nyawa",             emoji: "❤️", rarity: "epic",      weight: 5,     color: "#a855f7" },
  { kind: "time_freeze",   value: 10,    label: "+10 Freeze 30s",           emoji: "⏱️", rarity: "epic",      weight: 4.5,   color: "#a855f7" },
  { kind: "streak_freeze", value: 5,     label: "+5 Streak Freeze",         emoji: "🛡️", rarity: "epic",      weight: 4.5,   color: "#ec4899" },
  // GEM epic — jarang, hadiah cukup besar
  { kind: "gems",          value: 5000,  label: "💎 +5.000 Gem PREMIUM",     emoji: "💎", rarity: "epic",      weight: 0.04,  color: "#8b5cf6" },
  { kind: "auto_hint",     value: 25,    label: "💡 +25 Hint",              emoji: "💡", rarity: "epic",      weight: 3,     color: "#a855f7" },
  { kind: "extra_life",    value: 25,    label: "❤️ +25 Nyawa",             emoji: "❤️", rarity: "epic",      weight: 3,     color: "#a855f7" },
  { kind: "streak_coins",  value: 2000,  label: "🪙 +2.000 Streak Coin",     emoji: "🪙", rarity: "epic",      weight: 4,     color: "#fb923c" },
  { kind: "streak_coins",  value: 3500,  label: "🪙 +3.500 Streak Coin",     emoji: "🪙", rarity: "epic",      weight: 2.5,   color: "#fb923c" },

  // === LEGENDARY ===
  { kind: "extra_life",    value: 40,    label: "❤️ +40 Nyawa",             emoji: "❤️", rarity: "legendary", weight: 2,     color: "#fbbf24" },
  { kind: "auto_hint",     value: 40,    label: "💡 +40 Hint",              emoji: "💡", rarity: "legendary", weight: 2,     color: "#fbbf24" },
  { kind: "streak_freeze", value: 12,    label: "🛡️ +12 Streak Freeze",     emoji: "🛡️", rarity: "legendary", weight: 1.8,   color: "#f59e0b" },
  // GEM legend/mythic dihapus dari pool utama agar tidak tembus 100K+ total gem
  { kind: "extra_life",    value: 60,    label: "❤️ +60 Nyawa",             emoji: "❤️", rarity: "legendary", weight: 1.2,   color: "#fbbf24" },
  { kind: "auto_hint",     value: 60,    label: "💡 +60 Hint",              emoji: "💡", rarity: "legendary", weight: 1.2,   color: "#fbbf24" },
  { kind: "streak_coins",  value: 10000, label: "🪙 +10.000 Streak Coin",    emoji: "🪙", rarity: "legendary", weight: 1.5,   color: "#fbbf24" },
  { kind: "streak_coins",  value: 22000, label: "🪙 +22.000 Streak Coin",    emoji: "🪙", rarity: "legendary", weight: 0.8,   color: "#fbbf24" },
  { kind: "lucky_token" as any, value: 2, label: "🎟️ +2 Lucky Token",        emoji: "🎟️", rarity: "legendary", weight: 0.8,   color: "#fbbf24" },
  // GEM legendary — sangat jarang
  { kind: "gems",          value: 10000, label: "💎 +10.000 Gem PREMIUM",    emoji: "💎", rarity: "legendary", weight: 0.015, color: "#facc15" },

  // === MYTHIC (susah tapi konsisten) ===
  { kind: "extra_life",    value: 100,   label: "🌈 +100 Nyawa",            emoji: "❤️", rarity: "mythic",    weight: 0.7,   color: "#f0abfc" },
  { kind: "auto_hint",     value: 100,   label: "🌈 +100 Hint",             emoji: "💡", rarity: "mythic",    weight: 0.7,   color: "#f0abfc" },
  { kind: "extra_life",    value: 180,   label: "🌟 +180 Nyawa",            emoji: "❤️", rarity: "mythic",    weight: 0.4,   color: "#f0abfc" },
  { kind: "auto_hint",     value: 180,   label: "🌟 +180 Hint",             emoji: "💡", rarity: "mythic",    weight: 0.4,   color: "#f0abfc" },
  { kind: "streak_coins",  value: 60000, label: "🪙 +60.000 Streak Coin",    emoji: "🪙", rarity: "mythic",    weight: 0.3,   color: "#fde68a" },
  // GEM mythic JACKPOT — super jarang, hadiah besar yang dinanti
  { kind: "gems",          value: 25000, label: "🔥 +25.000 GEM JACKPOT",    emoji: "💎", rarity: "mythic",    weight: 0.004, color: "#fef08a" },
  { kind: "gems",          value: 50000, label: "👑 +50.000 GEM MEGA",       emoji: "💎", rarity: "mythic",    weight: 0.0008, color: "#fef08a" },

  // === SALDO IN (Saldo dalam game) — pool premium: kecil tapi lumayan, peluang lebih sering ===
  { kind: "game_balance",  value: 500,   label: "💵 +Rp 500 Saldo IN",      emoji: "💵", rarity: "rare",      weight: 9,     color: "#34d399" },
  { kind: "game_balance",  value: 1000,  label: "💵 +Rp 1.000 Saldo IN",    emoji: "💵", rarity: "rare",      weight: 6,     color: "#10b981" },
  { kind: "game_balance",  value: 2000,  label: "💵 +Rp 2.000 Saldo IN",    emoji: "💵", rarity: "epic",      weight: 2.5,   color: "#059669" },
  { kind: "game_balance",  value: 3500,  label: "💵 +Rp 3.500 Saldo IN",    emoji: "💵", rarity: "epic",      weight: 1.3,   color: "#a855f7" },
  { kind: "game_balance",  value: 5000,  label: "💸 +Rp 5.000 Saldo IN",    emoji: "💵", rarity: "legendary", weight: 0.6,   color: "#fbbf24" },
  { kind: "game_balance",  value: 10000, label: "💸 +Rp 10.000 Saldo IN",   emoji: "💵", rarity: "legendary", weight: 0.25,  color: "#facc15" },
  { kind: "game_balance",  value: 20000, label: "🌟 +Rp 20.000 Saldo IN",   emoji: "💵", rarity: "mythic",    weight: 0.06,  color: "#f0abfc" },
  { kind: "game_balance",  value: 50000, label: "👑 +Rp 50.000 Saldo IN",   emoji: "💵", rarity: "mythic",    weight: 0.01,  color: "#fef08a" },

  // === 🔥 FIRE PASS BADGE (premium: lebih besar & lebih sering) ===
  { kind: "fire_pass_badge" as any,   value: 15,  label: "🔥 +15 Badge Fire Pass",  emoji: "🔥", rarity: "rare",      weight: 4,     color: "#fb923c" },
  { kind: "fire_pass_badge" as any,   value: 30,  label: "🔥 +30 Badge Fire Pass",  emoji: "🔥", rarity: "epic",      weight: 2.2,   color: "#f97316" },
  { kind: "fire_pass_badge" as any,   value: 50,  label: "🔥 +50 Badge Fire Pass",  emoji: "🔥", rarity: "epic",      weight: 1.4,   color: "#fbbf24" },
  { kind: "fire_pass_badge" as any,   value: 100, label: "🔥 +100 Badge Fire Pass", emoji: "🔥", rarity: "legendary", weight: 0.6,   color: "#fbbf24" },
  { kind: "fire_pass_badge" as any,   value: 300, label: "👑 +300 Badge FIRE GOD",  emoji: "🔥", rarity: "mythic",    weight: 0.09,  color: "#fef08a" },

  // === 🎟️ FIRE PASS PREMIUM (aktivasi 1x season) ===
  { kind: "fire_pass_premium" as any, value: 1,   label: "🎟️ Fire Pass PREMIUM (1x Season)", emoji: "🎟️", rarity: "mythic", weight: 0.12, color: "#fef08a" },


  // === 💬 VOUCHER ANON CHAT PREMIUM ===
  { kind: "anon_premium" as any, value: 1, label: "💬 Anon Premium 1 Hari", emoji: "💬", rarity: "rare", weight: 3.84, color: "#22d3ee" },
  { kind: "anon_premium" as any, value: 2, label: "💬 Anon Premium 2 Hari", emoji: "💬", rarity: "rare", weight: 2.56, color: "#22d3ee" },
  { kind: "anon_premium" as any, value: 5, label: "💬 Anon Premium 5 Hari", emoji: "💬", rarity: "epic", weight: 1.6, color: "#a855f7" },
  { kind: "anon_premium" as any, value: 7, label: "💬 Anon Premium 7 Hari", emoji: "💬", rarity: "epic", weight: 1.12, color: "#a855f7" },
  { kind: "anon_premium" as any, value: 10, label: "💬 Anon Premium 10 Hari", emoji: "💬", rarity: "legendary", weight: 0.72, color: "#fbbf24" },
  { kind: "anon_premium" as any, value: 30, label: "💬 Anon Premium 1 Bulan", emoji: "💬", rarity: "legendary", weight: 0.352, color: "#fbbf24" },
  { kind: "anon_premium" as any, value: 60, label: "💬 👑 Anon Premium 2 Bulan", emoji: "💬", rarity: "mythic", weight: 0.16, color: "#fef08a" },
  { kind: "anon_premium" as any, value: 180, label: "💬 👑 Anon Premium 6 Bulan", emoji: "💬", rarity: "mythic", weight: 0.064, color: "#fef08a" },
  { kind: "anon_premium" as any, value: 365, label: "💬 👑 Anon Premium 1 Tahun", emoji: "💬", rarity: "mythic", weight: 0.019, color: "#fef08a" },

  // === 🏆 VOUCHER PREMIUM QUEST ===
  { kind: "pq_voucher" as any, value: 1, label: "🏆 Voucher Quest 1 Hari", emoji: "🏆", rarity: "rare", weight: 3.072, color: "#22d3ee" },
  { kind: "pq_voucher" as any, value: 2, label: "🏆 Voucher Quest 2 Hari", emoji: "🏆", rarity: "rare", weight: 2.048, color: "#22d3ee" },
  { kind: "pq_voucher" as any, value: 5, label: "🏆 Voucher Quest 5 Hari", emoji: "🏆", rarity: "epic", weight: 1.28, color: "#a855f7" },
  { kind: "pq_voucher" as any, value: 7, label: "🏆 Voucher Quest 7 Hari", emoji: "🏆", rarity: "epic", weight: 0.896, color: "#a855f7" },
  { kind: "pq_voucher" as any, value: 10, label: "🏆 Voucher Quest 10 Hari", emoji: "🏆", rarity: "legendary", weight: 0.576, color: "#fbbf24" },
  { kind: "pq_voucher" as any, value: 30, label: "🏆 Voucher Quest 1 Bulan", emoji: "🏆", rarity: "legendary", weight: 0.282, color: "#fbbf24" },
  { kind: "pq_voucher" as any, value: 60, label: "🏆 👑 Voucher Quest 2 Bulan", emoji: "🏆", rarity: "mythic", weight: 0.128, color: "#fef08a" },
  { kind: "pq_voucher" as any, value: 180, label: "🏆 👑 Voucher Quest 6 Bulan", emoji: "🏆", rarity: "mythic", weight: 0.051, color: "#fef08a" },
  { kind: "pq_voucher" as any, value: 365, label: "🏆 👑 Voucher Quest 1 Tahun", emoji: "🏆", rarity: "mythic", weight: 0.015, color: "#fef08a" },

  // === 🤫 VOUCHER CONFESS ===
  { kind: "confess_voucher" as any, value: 10, label: "🤫 Voucher Confess 10%", emoji: "🤫", rarity: "common", weight: 6.4, color: "#f9a8d4" },
  { kind: "confess_voucher" as any, value: 25, label: "🤫 Voucher Confess 25%", emoji: "🤫", rarity: "rare", weight: 4.16, color: "#f472b6" },
  { kind: "confess_voucher" as any, value: 50, label: "🤫 Voucher Confess 50%", emoji: "🤫", rarity: "epic", weight: 1.92, color: "#ec4899" },
  { kind: "confess_voucher" as any, value: 75, label: "🤫 Voucher Confess 75%", emoji: "🤫", rarity: "legendary", weight: 0.8, color: "#fbbf24" },
  { kind: "confess_voucher" as any, value: 90, label: "🤫 Voucher Confess 90%", emoji: "🤫", rarity: "legendary", weight: 0.48, color: "#fbbf24" },
  { kind: "confess_voucher" as any, value: 100, label: "👑 Voucher Confess GRATIS 100%", emoji: "🤫", rarity: "mythic", weight: 0.144, color: "#fef08a" },

  // === 🔥 FIRE PASS ===
  { kind: "fire_pass_badge" as any, value: 20, label: "🔥 +20 Badge Fire Pass", emoji: "🔥", rarity: "rare", weight: 4.8, color: "#fb923c" },
  { kind: "fire_pass_badge" as any, value: 30, label: "🔥 +30 Badge Fire Pass", emoji: "🔥", rarity: "rare", weight: 3.52, color: "#fb923c" },
  { kind: "fire_pass_badge" as any, value: 50, label: "🔥 +50 Badge Fire Pass", emoji: "🔥", rarity: "epic", weight: 2.24, color: "#f97316" },
  { kind: "fire_pass_badge" as any, value: 100, label: "🔥 +100 Badge Fire Pass", emoji: "🔥", rarity: "legendary", weight: 0.96, color: "#fbbf24" },
  { kind: "fire_pass_badge" as any, value: 200, label: "🔥 +200 Badge Fire Pass", emoji: "🔥", rarity: "mythic", weight: 0.288, color: "#fef08a" },
  { kind: "fire_pass_badge" as any, value: 300, label: "🔥 +300 Badge Fire Pass", emoji: "🔥", rarity: "mythic", weight: 0.112, color: "#fef08a" },
  { kind: "fire_pass_premium" as any, value: 1, label: "🎟️ Fire Pass PREMIUM (1x Season)", emoji: "🎟️", rarity: "mythic", weight: 0.12, color: "#fef08a" },

  // === 📦 STOK BESAR ===
  { kind: "extra_life" as any, value: 20, label: "❤️ +20 Nyawa", emoji: "❤️", rarity: "rare", weight: 12.8, color: "#f43f5e" },
  { kind: "auto_hint" as any, value: 20, label: "💡 +20 Hint", emoji: "💡", rarity: "rare", weight: 12.8, color: "#f43f5e" },
  { kind: "extra_life" as any, value: 30, label: "❤️ +30 Nyawa", emoji: "❤️", rarity: "rare", weight: 9.6, color: "#f43f5e" },
  { kind: "auto_hint" as any, value: 30, label: "💡 +30 Hint", emoji: "💡", rarity: "rare", weight: 9.6, color: "#f43f5e" },
  { kind: "extra_life" as any, value: 50, label: "❤️ +50 Nyawa", emoji: "❤️", rarity: "epic", weight: 4.8, color: "#a855f7" },
  { kind: "auto_hint" as any, value: 50, label: "💡 +50 Hint", emoji: "💡", rarity: "epic", weight: 4.8, color: "#a855f7" },
  { kind: "extra_life" as any, value: 100, label: "❤️ +100 Nyawa", emoji: "❤️", rarity: "legendary", weight: 1.92, color: "#fbbf24" },
  { kind: "auto_hint" as any, value: 100, label: "💡 +100 Hint", emoji: "💡", rarity: "legendary", weight: 1.92, color: "#fbbf24" },
  { kind: "extra_life" as any, value: 300, label: "❤️ +300 Nyawa", emoji: "❤️", rarity: "mythic", weight: 0.32, color: "#f0abfc" },
  { kind: "auto_hint" as any, value: 300, label: "💡 +300 Hint", emoji: "💡", rarity: "mythic", weight: 0.32, color: "#f0abfc" },
  { kind: "streak_coins" as any, value: 2000, label: "🪙 +2.000 Koin Streak", emoji: "🪙", rarity: "rare", weight: 11.2, color: "#f59e0b" },
  { kind: "streak_coins" as any, value: 5000, label: "🪙 +5.000 Koin Streak", emoji: "🪙", rarity: "epic", weight: 6.4, color: "#fb923c" },
  { kind: "streak_coins" as any, value: 10000, label: "🪙 +10.000 Koin Streak", emoji: "🪙", rarity: "epic", weight: 4.0, color: "#fb923c" },
  { kind: "streak_coins" as any, value: 20000, label: "🪙 +20.000 Koin Streak", emoji: "🪙", rarity: "legendary", weight: 1.92, color: "#fbbf24" },
  { kind: "streak_coins" as any, value: 100000, label: "🪙 +100.000 Koin Streak", emoji: "🪙", rarity: "mythic", weight: 0.352, color: "#fef08a" },
  { kind: "streak_coins" as any, value: 200000, label: "🪙 +200.000 Koin Streak", emoji: "🪙", rarity: "mythic", weight: 0.096, color: "#fef08a" },
];
