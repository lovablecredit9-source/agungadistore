

# Rencana Perubahan Sponsor & Pusat Bantuan

## Ringkasan
Tiga perubahan utama: (1) Hapus label "Admin Sponsor" dan perbaiki tombol Rekber WA agar mengirim pesan lengkap dengan detail produk, (2) Perlengkap Syarat & Ketentuan Sponsor, (3) Tambah konten Pusat Bantuan user.

---

## 1. Tombol "Mohon Rekber Admin WA" — Kirim Detail Produk Lengkap
**File:** `src/components/SponsorBanner.tsx`

- Ubah link WA pada overlay peringatan DAN di dalam Syarat & Ketentuan agar pesan otomatis mencakup:
  - Link produk: `{origin}/?sponsor={sponsor_number}`
  - Judul produk
  - Harga (formatted IDR)
  - Deskripsi produk
  - Nama penjual
  - Stok & garansi
- Contoh format pesan WA:
  ```
  Halo admin, saya mau rekber untuk produk sponsor:
  
  🔗 Link: https://.../?sponsor=12345
  📦 Judul: Netflix Premium
  💰 Harga: Rp50.000
  📝 Deskripsi: Akun Netflix 1 bulan...
  🏪 Penjual: TokoABC
  📊 Stok: 5 | Garansi: 7 Hari
  
  Mohon bantu proses rekber. Terima kasih!
  ```

## 2. Hapus Label "Admin Sponsor"
**File:** `src/components/SponsorBanner.tsx`

- Pada poin ke-6 di peringatan, ubah dari "Admin sponsor, pembeli dan penjual harus amanah" menjadi "Pembeli dan penjual harus amanah"
- Hapus kata "Admin sponsor" di semua tempat yang tidak perlu

## 3. Syarat & Ketentuan Sponsor — Lebih Lengkap
**File:** `src/components/SponsorBanner.tsx`

Tambahkan poin-poin baru pada bagian S&K collapsible:
- Produk sponsor bukan milik/tanggung jawab admin platform
- Penjual wajib memberikan produk sesuai deskripsi
- Pembeli wajib cek deskripsi, garansi, dan stok sebelum membeli
- Garansi hanya berlaku jika tertulis di detail produk
- Penipuan akan dilaporkan dan akun penjual diblokir
- Transaksi tanpa rekber = risiko ditanggung pembeli
- Dilarang menjual produk ilegal, SARA, atau melanggar hukum
- Admin berhak menghapus sponsor yang melanggar ketentuan
- Harga dan stok bisa berubah sewaktu-waktu oleh penjual
- Komplain hanya dilayani maksimal 1x24 jam setelah transaksi
- Bukti transaksi (screenshot) wajib disimpan sebagai perlindungan

## 4. Pusat Bantuan — Tambah Konten Lengkap
**File:** `src/pages/Index.tsx`

Tambahkan section baru di Help Center modal:

**🏪 Sponsor / Iklan Produk:**
- Apa itu sponsor dan cara kerjanya
- Cara membeli produk sponsor dengan aman
- Pentingnya rekber dan cara menggunakan rekber
- Cara melaporkan penjual bermasalah
- Perbedaan produk admin vs produk sponsor

**🔄 Cara Rekber (Rekening Bersama):**
- Penjelasan lengkap alur rekber
- Langkah 1-5 proses rekber via admin WA
- Kapan harus pakai rekber
- Biaya rekber (jika ada)

**⚠️ Keamanan Transaksi Sponsor:**
- Tips agar tidak tertipu
- Ciri-ciri penjual terpercaya
- Apa yang harus dilakukan jika tertipu
- Hak pembeli dan penjual

Tambah FAQ baru:
- Q: Apa itu rekber? A: Penjelasan lengkap
- Q: Apakah produk sponsor dijamin admin? A: Tidak, admin hanya menyediakan platform
- Q: Bagaimana jika penjual menipu? A: Langkah pelaporan

---

## Detail Teknis
- Semua perubahan hanya di 2 file: `SponsorBanner.tsx` dan `Index.tsx`
- Tidak ada perubahan database
- Pesan WA menggunakan `encodeURIComponent` untuk format URL yang benar
- Sponsor data (title, price, description, seller_name, dll) sudah tersedia di state `sponsor`

