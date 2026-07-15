Kerjaan ini besar & menyentuh 3 area: edge function `telegram-webhook`, tabel baru untuk config, dan trigger auto-post ke channel testimoni. Saya kerjakan bertahap dalam 4 fase supaya bisa dites per bagian.

## Fase 1 — Welcome /start upgrade
Kartu welcome saat user klik /start akan berisi:
- Foto welcome (bisa diupdate admin lewat tabel `admin_settings` key `telegram_welcome_photo_url`)
- Foto profil user (dari `getUserProfilePhotos` Telegram)
- Nama, username, ID Telegram user
- Nama & foto bot (dari `getMe`)
- Jam, tanggal, hari (WIB)
- Total Pengguna (unique `chat_id` di `telegram_chats`, exclude admin)
- Total Deposit (SUM `deposits.amount` status=paid, exclude admin visitor_id)
- Total Transaksi (SUM balance_transactions type=purchase, exclude admin)
- Link Website (agungadistore.lovable.app), Telegram, WA — sebagai inline button
- Tombol sosmed: 💚 WA, 📸 IG, 🎵 TikTok, ▶️ YouTube, 🐦 Twitter (dari `SOCIAL_LINKS`) — 1 baris, hanya sekali (fix duplikat)
- Sponsor aktif: hanya tampilkan yang belum expired, dengan sisa hari; expired tidak muncul sama sekali (tidak fallback ke web/telegram admin)

## Fase 2 — Quest/Mission via bot
Callback button `menu_quest` → sub-menu:
- Harian, Mingguan, Bulanan, Event (Coming Soon)

Tiap kategori tampilkan list quest dengan tombol "No 1", "No 2", "No 3" ...
Klik nomor → detail + tombol "🎁 Klaim" & "🎁 Klaim Semua"
- Kalau `is_completed=false` → alert callback "⚠️ Belum selesai, silakan selesaikan dulu"
- Kalau sudah selesai & belum diklaim → panggil edge function `weekly-quest`/`monthly-quest`/`daily-mission` action=claim
- "Klaim Semua" → loop semua quest completed yang belum diklaim

## Fase 3 — Streak Shop via bot
Callback `menu_shop` → list item dari `streak_shop_items` (is_active=true), format:
```
1. 🔥 Streak Freeze — 50 coins
2. ⏱ Time Freeze — 30 coins
3. 💎 Extra Life — 100 coins
```
Tombol No 1/2/3 → detail item + tombol `➖`, jumlah, `➕`, `Beli`
State qty disimpan sementara di `telegram_chats.meta_json` (jsonb) per user.
Beli → deduct coins via akun saldo terhubung (visitor_id lookup dari `telegram_chats.linked_visitor_id`).

## Fase 4 — Sponsor filter + Channel Testimoni auto-post
### Sponsor
Sudah dijelaskan di Fase 1 — filter `expires_at > now()`, tampilkan sisa hari, hilangkan fallback web/telegram waktu expired.

### Channel Testimoni
Config baru: `admin_settings.telegram_testimoni_channel_id` (string, contoh `@testimoniagungadistore` atau `-100xxx`).

Auto-post ke channel saat:
- `balance_transactions` type=purchase (produk) — via trigger DB → panggil edge function `telegram-testimoni`
- `deposits` status berubah ke paid
- `gem_transactions` type=purchase
- `store_premium_subscriptions` insert
- `streak_shop_redemptions` insert
- `streak_voucher_claims` insert (voucher admin 2k)

Format post:
```
🛒 Transaksi Baru
👤 User: agu***di (0857****532)
💰 Jumlah: Rp 15.000
📦 Produk: [nama produk]
🕒 15 Jul 2026, 14:32 WIB
```
Username & no HP disensor pakai `maskUsername` + mask 4 digit tengah HP. Admin (visitor_id admin) di-skip.

Implementasi: 1 edge function baru `telegram-testimoni` yang dipanggil dari trigger via `pg_net`, atau dari sisi frontend edge functions yang sudah ada (lebih simpel — tambahkan call ke helper dari webhook / purchase / deposit flows).

## Catatan teknis
- Kolom baru di `telegram_chats`: `linked_visitor_id text`, `meta_json jsonb`
- Kolom baru di `admin_settings`: rows `telegram_welcome_photo_url`, `telegram_testimoni_channel_id`, `telegram_admin_visitor_ids` (jsonb array)
- Semua callback pakai `answerCallbackQuery` + `editMessageText`
- Total pengguna = `SELECT count(distinct chat_id) FROM telegram_chats WHERE chat_id NOT IN (admin ids)`
- Total deposit = `SELECT coalesce(sum(amount),0) FROM deposits WHERE status='paid' AND visitor_id NOT IN (admin visitors)`

## Urutan eksekusi
Saya jalankan Fase 1 dulu (paling terlihat hasilnya di /start), tes, lalu lanjut Fase 2, 3, 4 di turn berikutnya. Setuju?