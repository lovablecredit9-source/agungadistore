## Masalah
Di daftar produk Telegram (`/start` → Produk), tiap produk hanya punya satu tombol `👁️ Nama Produk`. Belum ada tombol Suka (❤️) di list — seperti yang kamu tunjukkan di screenshot.

## Perubahan
Edit `supabase/functions/telegram-webhook/index.ts` bagian render list produk (sekitar baris 1196):

- Ubah tiap baris jadi **2 kolom**:
  - Kolom 1: `👁️ Nama Produk` (buka detail) — dipendekkan agar muat
  - Kolom 2: `❤️` atau `🤍` (toggle like langsung dari list)
- Tambahkan callback baru `plike_<id>` yang:
  - Cek login akun saldo via `tg_visitor_id` (kalau belum login → answerCallback "Login akun saldo dulu")
  - Toggle row di `liked_products` (insert/delete)
  - Refresh list produk supaya emoji hati ter-update
- Ambil daftar `liked_products` user sekali di awal render list untuk tentukan `❤️` vs `🤍` per produk

## Catatan
- Hanya ubah file `supabase/functions/telegram-webhook/index.ts`, lalu deploy edge function `telegram-webhook`.
- Tombol detail (`pv_<id>`) & tombol Suka di halaman detail produk tetap seperti sekarang.