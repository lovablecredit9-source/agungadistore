# Seller Center roadmap
- [x] Popup pengumuman Seller dan pilihan sembunyikan tersimpan per akun
- [x] Tahap 1: Dashboard, Quick Action, Produk (promo, kategori, duplikat, arsip, bulk), Stok atomik
- [x] Tahap 2: Pesanan (filter, bulk, export/cetak), Keuangan ledger, Rating + balasan, Performa
- [x] Tahap 3: Voucher seller, Flash Sale, Bundling (lalu aktifkan tombol cepat Voucher/Flash Sale)
- [x] Tahap 4: Auto-reply, jam operasional, analytics funnel, notifikasi, link toko/produk, verifikasi, admin control
- [ ] Buyer 1: Detail produk dan halaman toko publik, wishlist, share, laporan, chat berkonteks produk
- [ ] Buyer 2: Keranjang per toko, quantity aman, checkout, catatan penjual, konfirmasi pembayaran
- [ ] Buyer 3: Pesanan dan detail timeline digital, beli lagi, rating, notifikasi status
- [ ] Buyer 4: Uji transaksi, stok/saldo/voucher, akses lintas akun, realtime chat, HP, dan produksi
- [ ] Keamanan: tabel seller lama masih bisa diubah siapa saja dari browser (identitas berbasis perangkat) — perlu diperketat
- [x] Upgrade marketplace: detail produk/toko dan ulasan terfilter; detail pesanan dengan ID stabil, data seller, dan kronologi
- [ ] Laporan kendala: bukti, percakapan kasus buyer–seller–admin, panel admin dan pengujian ponsel (tampilan ponsel diuji; pengujian laporan dengan akun pembeli asli menunggu akses sesi pembeli)
- [x] Marketplace aturan lengkap: fee 5%+1%, Informasi Pesanan, PIN popup, popup berhasil, batal 1 jam, lapor 1x, grup kendala + batas respon 1 hari, keputusan admin (perbaiki/refund/teruskan/tutup), rating edit 1x/7 hari + foto, realtime sinyal
- [x] Pendaftaran seller profesional (logo/banner/preview/draft) dan UI permintaan ganti nama toko untuk seller & admin (server sudah siap)
- [x] Tahap 5 realtime: pendaftaran seller, ganti nama, dashboard seller, panel admin ikut update otomatis
- [x] Tahap 6 pengujian: PIN, stok, bayar dobel (diperbaiki), batal+refund, rating 1-5/edit 1x, akses akun lain
- [x] Marketplace: centang biru hanya toko terverifikasi di enam lokasi, rating produk, biaya layanan buyer 1% dan fee seller 5%; uji transaksi dan ponsel (toko belum terverifikasi tidak tersedia untuk pengujian layar)

- [x] Tampilan profil toko pembeli disesuaikan dengan referensi: banner, avatar, statistik, rating, produk dan ulasan tanpa mengubah transaksi.
- [x] Banner toko beracuan 1600 × 400 px; tombol Follow memakai tanda + dan jumlah pengikut tampil dari data toko.
- [x] Bot WA Admin Center: role/permission, konfirmasi, audit log, maintenance, health, Fire Pass/Anon/AI/Galau/Confess/Ticket/Order/Broadcast admin
- [ ] Bot WA: uji langsung di WhatsApp (butuh bot versi baru dijalankan oleh pemilik)
- [x] Bot WA Super Bot v12: Fire Pass, Anon Chat, Store AI, Bot Galau, !pesanan, router teks bebas, statistik aman, rate limit, !botmaintenance
- [ ] Super Bot: uji langsung di WhatsApp dengan akun asli (butuh bot v12 dijalankan pemilik; data akun lama belum dipindah)

## Upgrade Premium V6 (bertahap)
- [x] Tahap 1: Navigasi (bottom nav HP, sidebar desktop) + Beranda premium
- [x] Tahap 2: Wallet Center (sembunyikan saldo, transaksi terbaru dengan filter + cari)
- [ ] Tahap 3: Reward Hub (Lucky Royale, Streak, Membership, Voucher)
- [ ] Tahap 4: Support Center (tiket, FAQ, notifikasi)
- [x] Live Ticket: hanya admin ubah status, pesan tidak bisa diedit/dipalsukan, rating & hapus pesan dicek pemilik, chat layar penuh
- [ ] Keamanan: seller_orders bisa diubah/dihapus siapa saja; data tiket & pesan masih bisa dibaca publik (dipakai pembaruan langsung) — perlu dikunci
- [ ] Live Ticket: uji tampilan chat dengan akun saldo asli di HP (butuh login akun saldo)

## Upgrade Besar (Support, Royale, Musik, Beranda)
- [x] Live Support: prioritas, tutup/buka kembali, rating server, status admin dari heartbeat, notifikasi balasan/selesai
- [x] Admin Live Support: ringkasan, filter, ambil tiket, status/prioritas, catatan internal, quick reply kelola
- [x] Lucky Royale Hub /lucky-royale: hero saldo, 8 tab, leaderboard & history dari riwayat spin, My Royale + badge
- [x] Music Home: Featured/Trending/Terbaru/Populer/Rekomendasi/Artist/Upload/Feed realtime, 13 mood, admin ⭐/🔥
- [x] Beranda: pintasan Music, Live Support, My Tickets, Lucky Royale, Games
- [ ] Notifikasi "artist yang diikuti upload": belum ada data follow artist per akun untuk dikirimi

## Full QA & Regression (Okt 2026)
- [x] Tutup celah: saldo/membership/Saldo IN/tiket/booster/voucher Confess bisa dibuat siapa saja; riwayat login bisa dipalsukan & terbaca publik
- [x] Deposit admin atomik (anti saldo basi & dobel); topup/reset/koreksi saldo admin atomik
- [x] Checkout marketplace tanpa voucher gagal di server; request ulang error; tombol Pesan di profil toko selalu gagal; foto profil tidak tersimpan
- [ ] Keamanan lanjutan: `daily_streaks` (koin streak) masih bisa diubah langsung dari browser — perlu dipindah ke fungsi server (banyak layar streak memakainya)
- [ ] Keamanan lanjutan: `seller_products`, `seller_product_variants`, `seller_applications` masih bisa diubah perangkat lain (identitas seller berbasis perangkat)
- [ ] Uji tampilan admin & alur admin di browser dengan sesi admin asli; uji tiap game satu per satu sampai game over
- [x] Admin QA: 38 menu admin dibuka (desktop & HP); deposit approve/reject dari UI; ban/unban; izin simpan admin
- [x] Admin QA fix: 9 fungsi server tanpa cek admin (ban, voucher PQ, quest laga, flash sale streak, Fire Pass grant, PIN invalidate, tes AI, lirik); grant Premium Quest selalu gagal (ID admin hardcode); kode reset password lama tidak batal
- [ ] Admin QA lanjutan: uji CRUD tiap menu satu per satu (buat/ubah/hapus) dan cek hasilnya di sisi pengguna

## Paket Toko + Voucher + Ticket (brief besar 7 Okt)
- [x] Live Ticket: admin terakhir dilihat (heartbeat), info "ditutup oleh Admin" + tanggal, tanpa tombol tutup user
- [x] Centang biru toko: ketuk/hover menjelaskan "Toko ini telah diverifikasi oleh admin."
- [x] Shop Kredit: harga per kredit, label Best Value / Paling Populer
- [ ] Store Management Center seller (header lengkap, statistik, quick action, filter produk)
- [ ] Popup voucher follow dengan countdown + pesan sudah diklaim / kedaluwarsa
- [ ] Countdown masa berlaku di semua voucher
- [ ] Popup konfirmasi voucher + PIN untuk Premium/Membership (Kredit sudah)
- [ ] Desktop ticket: daftar tiket di samping percakapan
- [ ] Analytics toko dari data asli
- [ ] Kunci baca publik tiket/pesan + audit RLS seller/orders
- [ ] Uji E2E dengan akun pembeli/seller/admin asli

## Paket Kredit/Streak/Storage/Bundel (7 Okt)
- [x] Streak & Bundel: transaksi utuh di server (rollback semua), anti klik ganda, saldo & benefit sebelum→sesudah
- [x] Plus Hub: popup konfirmasi → PIN → popup berhasil yang sama untuk Streak, Storage, Bundel
- [x] Perbaikan harga Streak tanpa voucher diterapkan dan diuji
- [x] Data uji dihapus
- [ ] Uji Bundel, Storage (sebelum→sesudah) dan alur lengkap di browser dengan akun saldo asli
- [x] Live Ticket: status aktif/terakhir dilihat user & admin dari server (heartbeat), admin melihat status user
- [ ] Uji presence di browser dengan akun saldo asli + admin login

## Lucky Royale full audit (Okt 2026)
- [x] Pesan error server terbaca di seluruh app (installFunctionErrorUnwrap)
- [x] Voucher spin dibatasi maks 50% (eksploit -90% dihapus); Diamond/Mystery pakai crypto RNG
- [x] Diamond: uji live saldo 59/60, pity 80 & 10, 5 spin paralel, 100 spin (akun QA, dihapus)
- [ ] Simulasi Mega/Tier/Mystery
- [ ] Uji voucher E2E (expired/double-use) dengan akun login
- [ ] Anonymous Chat / Premium Anonymous / Partner Chat audit
- [ ] Redesign tab Lucky Royale; uji login adimuy (butuh izin memakai Gem akun asli)
