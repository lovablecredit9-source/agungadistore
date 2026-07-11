# Rencana Penambahan Fitur (hanya yang belum ada)

Permintaan sangat banyak. Saya kelompokkan jadi beberapa tahap. Yang **sudah ada** tidak diubah. Konfirmasi urutan prioritas, lalu saya kerjakan bertahap.

## Cek status: sebagian LOGIKA sudah ada
- **Nyawa bertingkat** (10x=1, 11-50=2, 51-100=3, 100+=5, reset balik 1) — logika `getReviveCost()` sudah ada di `gameStore.ts`. Perlu **dipastikan terpasang** di `RevivePrompt` (kemungkinan belum dipakai).
- **Booster x2 poin** (5j=200, 10j=300, 1hari=500 gem) — `BOOSTER_TIERS` sudah ada, tapi **tombol beli + perpanjang** belum ada UI-nya.

## Tahap A — Perbaikan bug (prioritas tinggi)
1. **Bug level profil**: kadang level 6 balik ke 3 / poin tidak sesuai — perbaiki sinkronisasi poin↔level (server vs lokal ambil nilai tertinggi).
2. **Musik mati saat klik Lucky Royale** — cegah unmount/stop player global saat navigasi.
3. **Total menit musik selalu 0 di web** (jalan di preview, tidak di web) — perbaiki tracker `useMusicListenTracker`.
4. **Pengguna aktif / status online** salah (banyak offline padahal online) — perbaiki heartbeat presence; hanya hitung saat benar-benar online di web.
5. **Saldo top aktif** — hanya terhitung selama online di web.

## Tahap B — Nyawa & Booster (lengkapi yang setengah jadi)
6. Pasang `getReviveCost()` + `incrementReviveCount/reset` ke alur revive nyata.
7. Tombol **Beli Booster x2 Poin** (bayar gem, kalau aktif → perpanjang).

## Tahap C — Login gating akun saldo
8. Wajib login akun saldo untuk: **Confess, Riwayat Klaim, Tiket, Suka, Voucher, Plus, Roda Diskon** — tampilkan layar "terkunci → login" seragam seperti navigasi lain.

## Tahap D — Profil & Komentar
9. **Foto profil akun saldo** (upload) + tampil di komentar & peringkat; kalau kosong → placeholder.
10. **Komentar lagu pakai nama user** (bukan anonim), bisa **like, reaction, edit**, terlihat user lain.
11. **Moderasi komentar**: larang share sosmed/no HP → popup pelanggaran; jika tetap → dibatasi 3 jam (berulang tiap pelanggaran).

## Tahap E — Status akun & banned
12. **Status akun**: hijau (belum pernah langgar), kuning (pernah langgar + info), merah (banned). Tampilkan riwayat: nama sebelumnya + alasan (1 melanggar, 2 penipuan, 3 mencurigakan) untuk user lain.

## Tahap F — Peringkat
13. **Filter/dropdown peringkat**: Total, Online, Tanggal bergabung (lama/baru).
14. **Top Premium** dengan tanggal beli s/d exp, terlihat user lain.

## Tahap G — Notifikasi Bot WA
15. Tambah notif: **pembelian Confess**, **pembelian Gem**, peringatan **ubah email/sandi**, **aktifkan 2FA**, **reset PIN** (kirim otomatis ke no terdaftar).

## Tahap H — Admin & Konten
16. Admin: toggle **mode gelap/terang** + **ganti bahasa** (samakan dgn user).
17. **Daily Quest** lebih banyak jenis.
18. **Pusat Bantuan** & **Update (v3.3)** & **Dokumentasi** — isi lebih lengkap.

## Tahap I — Player musik
19. Tombol **X** untuk sembunyikan player; pengaturan **slot musik on/off** di navigasi (on = tetap tampil di bawah semua nav; off = tidak muncul walau musik nyala).

---
**Konfirmasi**: mulai dari Tahap A (bug) dulu ya? Atau ada tahap yang mau didahulukan?