
# Tambah Fitur Keren ke Streak Shop

Aku akan menambahkan **3 fitur baru yang seru** ke Scratch-Off Lottery & Streak Shop, biar makin variatif dan bikin user balik lagi tiap hari.

## Fitur 1: 🎰 Combo Multiplier Bar
Tiap kali user beli kartu scratch berturut-turut **tanpa jeda > 2 menit**, multiplier hadiah naik:
- 1x → 1.0x (normal)
- 2x → 1.2x
- 3x → 1.5x
- 5x → 2.0x (MAX 🔥)

Bar progress combo ditampilkan di atas grid kartu dengan animasi neon. Reset otomatis kalau idle.

## Fitur 2: 🎁 Daily Free Scratch
Tiap hari user dapat **1 kartu Bronze GRATIS** (auto-reset jam 00:00 WIB). Tombol khusus berkilau emas dengan badge "FREE TODAY". Disimpan per visitor di tabel `daily_streaks` (kolom baru `free_scratch_date`).

## Fitur 3: 🏆 Lucky Streak Achievements
Sistem milestone untuk pemain scratch:
- 🎯 **First Win** (menang pertama kali) → +50 koin bonus
- 💰 **High Roller** (beli 10 kartu total) → +200 koin
- 👑 **Jackpot Hunter** (dapat 1x JACKPOT) → +500 koin
- 💎 **Diamond Master** (beli 5 Diamond Scratch) → +2000 koin

Tracking pakai kolom JSON `scratch_stats` di `daily_streaks`. Badge muncul dengan animasi celebration saat unlock.

## Bonus: 📊 Mini Stats Display
Header lottery menampilkan stats kecil: total kartu dibuka, win rate %, jackpot count.

---

## Detail Teknis

**File yang diubah:**
- `src/components/streak/ScratchOffShop.tsx` — tambah combo bar, free scratch button, achievements, stats display

**Migrasi DB:**
```sql
ALTER TABLE daily_streaks 
  ADD COLUMN IF NOT EXISTS free_scratch_date date,
  ADD COLUMN IF NOT EXISTS scratch_stats jsonb DEFAULT '{
    "total_buys": 0,
    "total_wins": 0,
    "jackpots": 0,
    "diamond_buys": 0,
    "achievements": []
  }'::jsonb;
```

**Logika combo:**
- State `comboCount` + `lastBuyAt` (timestamp)
- Saat `buyCard`: cek `Date.now() - lastBuyAt < 120000` → increment, else reset ke 1
- Multiplier diterapkan ke `prizeValue` saat menang

**Logika free scratch:**
- Saat mount, cek `streak.free_scratch_date` vs hari ini WIB
- Tombol "🎁 KARTU GRATIS HARI INI" muncul kalau belum klaim
- Setelah klaim → update `free_scratch_date = today`

**Achievement check:**
- Setiap kemenangan → update `scratch_stats` JSON
- Bandingkan dengan threshold → kalau unlock baru, push ke `achievements[]` + tambah bonus koin + tampilkan toast celebration

**UI baru:**
- Combo bar: gradient progress bar fuchsia→pink dengan label "COMBO x1.5"
- Free button: card khusus full-width di atas grid, animasi shimmer emas
- Stats: 3 angka kecil (📦 buys · 🎯 wins · 👑 jackpots) di bawah header
- Achievement unlock: modal popup dengan confetti + suara (opsional)

Setelah selesai aku akan langsung deploy & user bisa langsung test di tab Streak.
