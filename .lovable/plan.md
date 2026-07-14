
# Rencana: Bot Telegram Full-Feature (Belanja + Owner)

Karena scope besar (setara web), kerjakan **bertahap dalam 3 fase** langsung di `supabase/functions/telegram-webhook/index.ts` + `telegram-manage/index.ts`. Semua reuse fungsi DB & RPC yang sudah ada (tidak buat tabel baru).

---

## FASE 1 — Belanja Produk + Keranjang + Voucher (untuk semua user)

### Perubahan alur `/saldo` → daftar produk
Waktu user klik salah satu produk, tampilkan detail (foto pertama, nama, harga, stok) + inline keyboard:

```
[ ➖ ]  [ Qty: 1 ]  [ ➕ ]
[ ✍️ Catatan ]  [ 🎟️ Voucher ]
[ 🛒 Tambah ke Keranjang ]
[ ⚡ Beli Langsung ]
[ ⬅️ Kembali ]
```

- `➖` / `➕`: edit inline `qty` (dibatasi 1..stok). Kalau produk punya `wholesale_prices`, tampilkan harga per unit terupdate.
- **Catatan** (opsional): user ketik, disimpan di state (per produk).
- **Voucher**: user ketik kode → validasi via tabel `discount_vouchers` (aktif, belum expired, cocok visitor/user_balance, `used_count < max_uses`). Tampilkan diskon terhitung.
- **Tambah ke Keranjang**: simpan ke state `cart` (array: {product_id, qty, note, voucher_code}). Bisa lanjut belanja produk lain.
- **Beli Langsung**: skip cart, langsung ke konfirmasi.

### Menu Keranjang baru `/keranjang` + tombol di menu utama
```
🛒 Keranjang (3 item)
1. Diamond ML x2 — Rp 20.000  [❌]
2. ...
Subtotal: Rp XX
Voucher: -Rp XX
Total: Rp XX

[ 🎟️ Pakai Voucher Global ]
[ ✅ Checkout (PIN) ]
[ 🗑️ Kosongkan ]
```

Checkout:
1. Minta PIN 6 digit (validasi via `user_pins` + attempts).
2. Panggil edge function `purchase-with-balance` per item (loop) atau langsung insert `balance_transactions` + `tokens` claim, sinkron dengan cara `purchase-with-balance` bekerja.
3. Kurangi `used_count` voucher.
4. Kirim receipt (TX ID pendek) + list token/kode ke user.

### Voucher Depo/Follow store
Reuse validasi yang sudah dipakai web (`discount_vouchers` + policy `visitor_id` / `user_balance_id`). Tidak perlu tabel baru.

---

## FASE 2 — Menu Owner (khusus `owner_id` di `telegram_bot_config`)

Perintah `/owner` (atau tombol otomatis muncul di `/start` kalau chat_id == owner_id) menampilkan menu:

```
👑 PANEL OWNER
[ 📦 Kelola Produk ]
[ 👥 Kelola User ]
[ 🎟️ Kelola Voucher & Promo ]
[ 📢 Broadcast ]
[ 💰 Transaksi & Deposit ]
[ ⬅️ Tutup ]
```

### 📦 Kelola Produk (CRUD)
- **Lihat**: list produk pakai pagination (10/hal, tombol ⬅️ ➡️).
- **Tambah**: wizard step — nama → harga → stok → kategori → deskripsi → foto (kirim foto ke bot, upload ke storage `product-images`, insert `products` + `product_images`).
- **Edit**: pilih produk → tombol [Ubah Nama] [Ubah Harga] [Ubah Stok] [Ubah Deskripsi] [Tambah Foto] [Hapus Foto].
- **Hapus**: konfirmasi ya/tidak → `DELETE FROM products WHERE id=`.
- **Tambah Token/Stok**: paste bulk kode 16-char (multi-line) → insert ke `tokens`.

### 👥 Kelola User
- **Cari**: ketik username/email/HP → tampilkan hasil (max 10).
- **Detail user**: saldo, kredit game, streak, jumlah transaksi, visitor_id.
- **Aksi**: 
  - [Reset Saldo]  → panggil `admin-reset-user` (action=balance)
  - [Reset Kredit] → `admin-reset-user` (action=credits)
  - [Reset Streak] → `admin-reset-user` (action=streak)
  - [Ban 7 hari]/[Ban Permanen]/[Unban] → `admin-ban-account`
  - [Kirim DM] → owner ketik pesan, bot kirim ke visitor via notif.

### 🎟️ Kelola Voucher & Promo
- **Voucher diskon**: buat baru (nominal, max_uses, expires_at, target visitor opsional), lihat aktif, hapus.
- **Flash Sale produk**: buat (pilih produk → mode diskon% atau harga manual → kuota → durasi jam) → insert `store_flash_sales`.
- **Bundle**: lihat/tambah/hapus di `bundle_packages`.

### 📢 Broadcast
- Owner kirim teks (+ foto opsional) → bot kirim ke semua chat_id di `telegram_chats`. Rate-limit 25/detik.

### 💰 Transaksi & Deposit
- List deposit pending → tombol [✅ Approve] (update `deposits.status='completed'` + tambah saldo user) / [❌ Reject].
- List transaksi terbaru (10) dengan filter tanggal.

---

## FASE 3 — Finishing
- Command list update di `telegram-manage/index.ts`: tambah `/keranjang`, `/owner`.
- State machine baru: `product_qty`, `product_note`, `product_voucher`, `cart_voucher`, `checkout_pin`, `owner_*` prefix.
- Semua callback pakai prefix baru: `p_qty:`, `p_add:`, `p_buy:`, `cart_*`, `own_*`.
- Deploy `telegram-webhook` + `telegram-manage`.

---

## Catatan teknis (untuk dev)
- Reuse edge functions: `purchase-with-balance`, `admin-reset-user`, `admin-ban-account`, `cancel-deposit`, `create-deposit`, `manage-pin`.
- Tabel yg diakses: `products`, `product_images`, `tokens`, `wholesale_prices`, `discount_vouchers`, `store_flash_sales`, `bundle_packages`, `user_balances`, `balance_login_history`, `balance_transactions`, `deposits`, `user_game_credits`, `daily_streaks`, `account_bans`, `notifications`, `telegram_chats`.
- Semua aksi owner dilindungi cek `String(chat_id) === config.owner_id`.
- Estimasi ~1500 baris kode tambahan di `telegram-webhook/index.ts`; dipecah rapi dengan komentar section.

---

**Approve untuk mulai FASE 1** (belanja + qty + catatan + keranjang + voucher). Fase 2 & 3 dikerjakan di iterasi berikutnya biar setiap fase bisa diuji.
