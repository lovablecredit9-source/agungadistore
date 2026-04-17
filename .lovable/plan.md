
Saya akan mengembalikan isi tab Update agar tidak cuma 1 entri lagi.

Rencana:
1. Cek bagian `Update Web` di `src/pages/Index.tsx` yang sekarang hanya berisi `v2.6 / 17 April 2026`.
2. Pulihkan daftar changelog lama berdasarkan riwayat chat proyek, lalu gabungkan dengan entri `17 April 2026` di urutan paling atas.
3. Pastikan versi lama yang muncul lagi minimal:
   - `v2.5 — 12 April 2026`
   - `v2.4 — 8 April 2026`
   - `v2.3 — 4 April 2026`
   - `v2.2 / v2.1 — 1 April 2026` sesuai struktur yang sebelumnya dipakai
4. Biarkan header tetap menampilkan update terbaru 17 April, tapi isi timeline menampilkan semua versi sebelumnya juga.
5. Verifikasi footer copyright `© 2026 Agung Adi Store` dan link sosial tetap ada.

Catatan teknis:
- Dari kode yang saya baca, data update sekarang memang hardcoded inline di blok `tab === "update"` dan hanya punya satu object.
- Dari riwayat chat, memang sebelumnya pernah ada versi lengkap sampai April awal, jadi implementasinya cukup dengan membangun ulang array update di blok itu, bukan mengubah arsitektur lain.
- Begitu Anda setujui, saya akan langsung restore isi versi sebelumnya dan tambahkan 17 April di atas tanpa menghapus yang lama.
