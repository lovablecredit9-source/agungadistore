## Tab Misi PRO Fire Pass

Tambahkan tab ke-4 "PRO" di Misi Fire Pass. Berisi misi 1 bulan (mirip Bulanan) tapi hadiah lebih besar. Wajib beli akses PRO 500 gem atau Rp 30.000 saldo IN — aktif 30 hari.

### 1. Database (migration)

- Tambah kolom `pro_active_until timestamptz` di `fire_pass_progress`.
- Tambah kolom `pro_price_saldo_in int default 30000` dan `pro_price_gems int default 500` di `fire_pass_seasons` (admin bisa ubah).
- Isi 8-10 misi awal `mission_type = 'pro'` di `fire_pass_missions` untuk season aktif (target 30 hari, badge reward besar).

### 2. Edge function `fire-pass`

- `action: "buy_pro_missions"` `{ method: "saldo"|"gems", pin? }`
  - Validasi PIN untuk saldo (via `verify_pin` RPC seperti aksi lain).
  - Kurangi saldo/gem, set `pro_active_until = greatest(now, existing) + 30 days`.
  - Catat `balance_transactions` / `gem_transactions`, kirim notifikasi.
- `computeMissions`: dukung `mission_type = 'pro'` (window 30 hari, sama seperti monthly).
- `claim_mission`: jika misi bertipe `pro`, tolak kalau `pro_active_until` null/expired.
- `status`: kembalikan `pro_active_until` dan harga (`price_saldo_pro`, `price_gems_pro`) ke client.
- `admin_upsert_season`: terima 2 field harga PRO baru.

### 3. Web UI `src/components/FirePassTab.tsx`

- Grid tab jadi `grid-cols-4`: Harian · Mingguan · Bulanan · **PRO** (ikon `Zap` / crown ungu).
- Filter `proMissions = missions.filter(m => m.mission_type === "pro")`.
- TabsContent "pro":
  - Kalau `pro_active_until > now`: tampilkan badge "PRO aktif · sisa N hari" + daftar misi (pakai `renderMission`).
  - Kalau belum: kartu paywall dengan 2 tombol beli (💰 Rp30.000 & 💎 500), dialog PIN saat pilih saldo, panggil `buy_pro_missions`.

### 4. Admin `src/components/AdminFirePassTab.tsx`

- Tambah 2 input harga PRO di form season.
- Tambah opsi `mission_type = 'pro'` di form misi (bila ada) — kalau saat ini misi dikelola via SQL, cukup dokumentasikan.

### 5. Bot Telegram `supabase/functions/telegram-webhook/index.ts`

- Tambah tombol "🔮 Misi PRO" di menu Fire Pass, panggil `fire-pass` action baru, tampilkan status aktif + tombol beli (saldo pakai flow PIN yang sudah ada, gem langsung).

### Catatan

- Tidak mengubah tab Harian/Mingguan/Bulanan yang sudah ada.
- Reward mengikuti kolom `badge_reward` yang sudah ada (nilai lebih besar untuk misi PRO).
