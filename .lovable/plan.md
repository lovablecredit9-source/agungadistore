# Perbaikan Tebak Gambar 402

## Tujuan
- Cegah respons 402 dari AI membuat permainan kosong.
- Pertahankan generasi AI saat tersedia dan gunakan ronde gambar cadangan saat kredit/provider gagal.

## Implementasi
- Tambahkan pembuat gambar cadangan mandiri di fungsi `tebak-gambar`.
- Ubah semua jalur kegagalan gambar AI menjadi respons ronde valid berstatus 200.
- Perkuat UI agar kegagalan endpoint menampilkan keadaan pulih, bukan layar kosong.
- Deploy dan uji fungsi dengan permintaan `new_image` nyata.
