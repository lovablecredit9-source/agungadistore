# Rencana Fitur Baru

Aku bagi jadi 3 modul besar. Semua tersambung ke sistem Premium Quest / Streak / Saldo yang sudah ada.

---

## 1. Voucher Premium Quest (Redeem Code)

**Tab baru:** `Voucher Quest` di dalam menu Premium Quest (atau tab navigasi tersendiri di hub Plus).

**Untuk User:**
- Input kotak kode (contoh: `PQ-XXXXXX`)
- Tombol "Tukar Kode"
- Jika valid → popup "Penukaran berhasil, Premium Quest aktif X hari"
- Notifikasi in-app + entri di riwayat voucher
- Kalau invalid/expired/kuota habis → pesan error jelas

**Untuk Admin (tab baru `Voucher Quest` di AdminDashboard):**
- Buat voucher: kode (auto/random atau manual), durasi premium (hari), tanggal kadaluarsa voucher, kuota total pakai (mis. 100×), kuota per akun (mis. 1×)
- List voucher aktif, edit, nonaktifkan, lihat siapa yang sudah redeem
- Kode acak generator seperti sistem voucher lain

**Tabel baru:**
- `premium_quest_vouchers` — code, duration_days, max_uses, used_count, expires_at, is_active, created_by
- `premium_quest_voucher_redemptions` — voucher_id, visitor_id, user_balance_id, redeemed_at

**Edge function:** `premium-quest-voucher` (action: redeem, admin_create, admin_list, admin_toggle)

---

## 2. Quest Laga (Weekly Random Hard Quest)

**Konsep:**
- 1× per minggu (Senin–Minggu) muncul quest baru yang **susah** dengan hadiah besar
- Hari aktivasinya **random** dalam minggu itu (auto-schedule)
- Berlaku 24 jam sejak aktif, kalau lewat hilang
- Contoh quest laga: "Beli 5 produk berbeda dalam 24 jam", "Dengar 3 jam musik non-stop", "Menang 10 game AI streak"

**Plus:** Tambah banyak quest premium reguler (harian/mingguan) supaya list quest lebih ramai.

**Tabel baru:**
- `laga_quests` — title, description, requirement_type, target, reward_saldo_in, reward_gems, reward_coins, difficulty, week_start, active_date (random), duration_hours
- `laga_quest_progress` — quest_id, visitor_id, current_value, is_completed, is_claimed

**Cron/edge function:** `laga-quest-scheduler` — jalan setiap Senin 00:00 WIB, generate quest laga minggu itu + pilih tanggal aktif random.

**UI:** Card khusus di tab Premium Quest dengan badge "⚡ QUEST LAGA MINGGU INI" + countdown.

---

## 3. Fire Pass (Season Pass ala Free Fire)

**Tab navigasi baru:** `🔥 Fire Pass`

**Konsep:**
- **Season bulanan** — reset tiap awal bulan (Season 1, 2, dst)
- Kumpulkan **badge/poin** dari aktivitas (streak, quest, belanja, dengar musik, game, dsb)
- 2 track: **Free** & **Premium**
- 30–50 tier per season, tiap tier unlock reward

**Reward yang bisa di-config admin per tier:**
- Saldo IN, Koin Streak, Gem, Hint, Nyawa
- Membership Premium Quest (durasi hari)
- Voucher kredit game, storage musik, tiket lucky draw
- Server Luck booster (durasi jam)
- Level Poin XP x2 / x5 (durasi jam)
- Voucher premium diskon Rp 2.000
- Auto-durasi berapa hari untuk item durasional

**Aktivasi Premium:**
- Harga: **Rp 25.000 saldo IN** atau **100 Gem**
- Ada juga **Free Premium** yang bisa admin aktifkan (event/promo) — user dapat premium gratis

**Admin panel (`AdminFirePassTab`):**
- CRUD Season (nama, start/end, active)
- CRUD Tier (level, badge required, free reward, premium reward)
- Toggle Free Premium global
- Aktifkan premium manual untuk user tertentu

**Tabel baru:**
- `fire_pass_seasons` — season_number, name, start_at, end_at, is_active, free_premium_enabled, price_saldo, price_gems
- `fire_pass_tiers` — season_id, tier_level, badge_required, free_reward_type, free_reward_value, premium_reward_type, premium_reward_value
- `fire_pass_progress` — visitor_id, season_id, badges, is_premium, premium_activated_at, claimed_free_tiers[], claimed_premium_tiers[]
- `fire_pass_badge_log` — visitor_id, season_id, source, amount, created_at (audit)

**Edge function:** `fire-pass` — actions: status, claim_tier, buy_premium, admin_grant_premium, admin_toggle_free

**Sumber badge otomatis (trigger/edge integration):**
- +1 per hari streak claim
- +2 per quest premium selesai
- +5 per quest laga selesai
- +3 per Rp 10.000 belanja
- +1 per 30 menit dengar musik

---

## Urutan Implementasi

1. Migration: buat 8 tabel baru + GRANT + RLS + trigger updated_at
2. Edge function `premium-quest-voucher` + tab admin + tab user redeem
3. Edge function `laga-quest-scheduler` + integrasi di UI Premium Quest
4. Edge function `fire-pass` + tab `FirePass.tsx` + tab admin
5. Update memory index

## Catatan Teknis

- Semua premium activation reuse `premium_quest_subscriptions` yang sudah ada (tinggal insert row baru saat voucher/tier di-claim)
- Fire Pass premium purchase: potong saldo `user_balances.balance` atau `game_profiles.gems` via RPC yang sudah ada (`consume_main_balance_only`) + PIN check
- Notifikasi pakai `public.notifications` yang sudah ada
- Badge earning: mulai dengan hook manual di titik-titik kunci (streak claim, quest claim, purchase, music listen). Bisa diperluas nanti.

Kalau setuju, aku mulai eksekusi. Karena skopnya besar, aku akan kirim di beberapa langkah supaya tiap migration & function bisa direview.
