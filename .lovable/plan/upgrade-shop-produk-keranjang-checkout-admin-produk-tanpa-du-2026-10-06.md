# Upgrade Shop, Produk, Keranjang, Checkout & Admin Produk (tanpa duplikasi)

Semua fitur dipasang ke halaman yang sudah ada (Shop, detail produk, Keranjang toko, Checkout saldo+PIN, Pesanan, Admin Produk, Seller Dashboard). Tidak ada navigasi, halaman, route, cart, checkout, atau sistem pembayaran baru. Tidak ada data dummy — jika data kosong, tampil keadaan kosong yang rapi.

## Shop
- Trending Produk: dari jumlah terjual + like + dilihat 7 hari terakhir.
- Flash Sale (sistem lama): countdown lebih menarik, bar stok, persen terjual, badge "Hampir Habis", animasi denyut saat aktif.
- Rekomendasi Untukmu: dari terakhir dilihat, riwayat beli, kategori sering dilihat, wishlist; kalau kurang, isi produk populer.
- Badge otomatis di kartu produk: Terlaris, Rating Tinggi, Baru, Flash Sale, Premium, Populer, Stok Tersedia, Habis.
- Bandingkan Produk: pilih maksimal 3, tabel Harga/Rating/Terjual/Stok/Garansi/Kategori (bottom sheet di HP).

## Detail Produk
- Wishlist dengan animasi hati + toast + update langsung (wishlist lama).
- Tombol Share: Salin Link, WhatsApp, Telegram, Share lainnya (link produk asli).
- Statistik untuk pemilik/admin: Dilihat, Wishlist, Masuk Keranjang, Terjual, Konversi.

## Keranjang (yang sudah ada)
- Simpan untuk Nanti: pindah Keranjang <-> Disimpan.
- Smart Cart: "Produk yang berhubungan" berdasarkan kategori/penjual isi keranjang.
- Promo Keranjang: info voucher yang bisa dipakai dan "Tambah RpX lagi" berdasarkan minimum voucher yang ada.

## Checkout (yang sudah ada)
- Ringkasan jelas: produk, qty, harga satuan, subtotal, diskon, voucher, total + dialog konfirmasi sebelum PIN.
- Perlindungan: server cek ulang harga, stok, voucher, saldo utama, qty, status produk. Jika harga berubah: "Harga produk telah berubah. Silakan periksa kembali pesanan." dan transaksi dibatalkan.

## Sukses Pembelian (popup lama)
- Pembelian Berhasil: Order ID, produk, total, waktu, status + tombol Lihat Pesanan, Download Produk (jika ada file), Chat Seller, Beli Lagi.

## Admin Produk & Pesanan (halaman lama)
- Analitik per produk: dilihat, wishlist, masuk keranjang, terjual, pendapatan, konversi.
- Pilih banyak produk -> ubah kategori/status/featured/stok/harga/aktif, dengan konfirmasi.
- Duplikat Produk (tanpa terjual/dilihat/wishlist/ulasan).
- Jadwal publish/unpublish/featured (+ flash sale lama), dijalankan otomatis berdasarkan waktu server.
- Stok Menipis / Habis + notifikasi admin lewat sistem notifikasi lama (batas minimum per produk).
- Moderasi produk seller: filter Pending/Approved/Rejected, Approve atau Tolak + alasan.
- Ringkasan pesanan: total, selesai, pending, batal, pendapatan, rata-rata nilai pesanan, produk terlaris.

## UI
- Skeleton saat memuat, animasi halus, keadaan kosong/error lebih jelas, bottom sheet di HP, tetap mengikuti tema.

## Catatan teknis
- Reuse: `products`, `seller_products`, `seller_cart_items`, `buyer_checkout`, wishlist & recently viewed lama, `flash_sales`, `notifications`, `ProductRecommendations`, `SellerProductManager`, `AdminDashboard`.
- Tambahan database minimal (jika belum ada): kolom `is_saved_for_later` di item keranjang, tabel event produk (view/cart) untuk statistik, kolom jadwal + `min_stock` + `is_featured` di produk, fungsi cron jadwal & alert stok, fungsi analitik admin. Semua dengan RLS dan grant.
- Validasi harga dilakukan di fungsi checkout server yang lama (menerima harga yang dilihat pembeli, tolak jika beda).
- Selesai: typecheck, build, tes aturan harga berubah & batas 3 produk, uji tampilan HP/desktop.
