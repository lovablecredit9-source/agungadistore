# Rencana Upgrade Toko Penjual (Chat, Keranjang, Pesanan, Rating, Dana Ditahan, Laporan Admin)

## Yang akan dilihat pengguna

### 1. Navigasi tab toko jadi 5
Produk | Chat | Keranjang | Pesanan | Pengaturan (Pengaturan hanya untuk penjual).

### 2. Chat (lebar seperti chat admin)
- Chat tampil lebar/penuh, bukan kotak kecil di bawah.
- Dipisah jadi 2 sub-tab: **Sebagai Pembeli** dan **Sebagai Penjual**.
- Nama pembeli otomatis dari nama akun saldo, foto profil akun ikut tampil.
- Header chat menampilkan No. Pesanan (bila terkait pesanan) + tombol salin.
- Kirim foto, kirim **kartu produk** (foto, judul, harga, stok) + tombol salin tautan produk.
- Kartu otomatis "Produk sudah dipesan" masuk ke chat saat pembeli checkout.
- Centang 1 / 2 abu / 2 biru tetap ada; "terakhir dilihat" hanya di chat.
- Hapus pesan maksimal 5 menit setelah dikirim; lewat 5 menit tombol hapus hilang. Tombol salin pesan.

### 3. Keranjang
- Tambah produk dari toko mana saja, atur jumlah +/-, hapus item, batas mengikuti stok.
- Checkout pakai **saldo utama saja** (bukan Saldo IN), wajib PIN 6 digit. Jika saldo kurang, tombol bayar dikunci.
- Stok produk langsung berkurang setelah bayar.

### 4. Form pesanan (tanpa alamat/resi)
- Penjual membuat **kategori data** per produk, contoh: Top Up Game (ID + Server), Akun (Email/Username), Voucher.
- Pembeli memilih dari dropdown dan mengisi data sesuai kategori itu. Tidak ada kolom alamat, resi, atau nama pengirim.

### 5. Status pesanan pembeli
Sub-tab: **Dibayar (menunggu dikirim)** | **Dikirim** | **Selesai** | **Kendala**.
Penjual mengirim data produk (misal akun/kode voucher) lewat tombol "Kirim Pesanan".

### 6. Dana ditahan + konfirmasi otomatis
- Uang pembeli ditahan, belum bisa ditarik penjual.
- Pembeli tekan "Konfirmasi Diterima", atau otomatis terkonfirmasi 5 jam setelah dikirim.
- Selama 5 jam itu pembeli bisa "Ajukan Kendala".

### 7. Rating
Setelah selesai, pembeli memberi bintang + ulasan untuk **produk** dan **toko**. Rata-rata tampil di kartu produk dan profil toko.

### 8. Laporan penipuan + admin
- Banner: "Kena tipu? Segera laporkan, admin akan meninjau."
- Saat ada laporan, dibuat **chat bertiga** (pembeli, penjual, admin).
- Di panel admin: daftar laporan, lihat chat, lalu pilih **Kembalikan saldo ke pembeli** atau **Teruskan ke penjual**. Dana ditahan otomatis dibekukan selama laporan dibuka.

## Detail teknis
- Tabel baru: `seller_cart_items`, `seller_product_forms` (kategori + field JSON), `seller_reviews` (product/store, rating 1-5), `seller_disputes` + `seller_dispute_messages`.
- Kolom baru: `seller_orders.order_fields jsonb`, `delivery_data`, `paid_at`, `auto_confirm_at`, `escrow_status (held/released/refunded/frozen)`; pesan chat: `kind (text/image/product/order)`, `payload jsonb`, `deleted_at`.
- Edge function `seller-checkout`: validasi PIN, stok, saldo utama secara atomik (pakai `consume_main_balance_only`), buat pesanan + kurangi stok + kartu pesanan di chat.
- Edge function `seller-escrow`: konfirmasi, auto-release (cron tiap 10 menit untuk `auto_confirm_at` lewat), refund/release oleh admin (`refund_main_balance_only`).
- `settleOrder.ts` dialihkan ke fungsi server agar saldo penjual tidak bisa dimanipulasi dari browser.
- Hapus pesan 5 menit dicek di server lewat trigger.
- Tombol beli langsung lama digantikan alur keranjang (fitur lain tidak dihapus).

## Catatan
Pekerjaan ini besar (beberapa tabel, 2 fungsi server, ~8 layar). Akan dikerjakan bertahap dan diuji di tampilan HP.
