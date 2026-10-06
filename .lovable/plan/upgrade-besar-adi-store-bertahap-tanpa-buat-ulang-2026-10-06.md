Semua tahap jangan dikit gini semua sekaligus kerjakan jangan bertahap

&nbsp;

# Upgrade Besar ADI Store (bertahap, tanpa buat ulang)

Permintaan ini sangat besar (25 bagian). Agar fitur lama tidak rusak dan semua benar-benar tersambung ke database, pekerjaan dibagi menjadi 4 tahap. Setiap tahap selesai = diuji di HP & desktop + build lulus, baru lanjut tahap berikutnya.

Prinsip: pakai tabel, fungsi server, dan komponen yang sudah ada (tiket, musik, Royale, notifikasi). Tidak ada sistem musik/chat/Royale kedua. Tidak ada data palsu/mock. Pengaturan penting disimpan di database dan bisa diubah admin.

## Tahap 1 — Live Support Center (tiket + chat)

Dasar yang sudah ada: tabel tiket, pesan tiket (balasan, gambar, sudah dibaca, hapus), status mengetik, reaksi, `TicketCategoryNav`, `TicketEnhancer`, `TicketTemplatePicker`.

Pengguna:

- Halaman "Bagaimana kami bisa membantu?": cari tiket, filter Semua/Aktif/Pending/Selesai, kartu tiket (nomor, kategori, judul, status, prioritas, pesan terakhir, waktu, jumlah belum dibaca).
- Buat tiket: 18 kategori sesuai daftar, prioritas, deskripsi, lampiran gambar.
- Chat modern: header Customer Support + Online/Offline + indikator mengetik, gelembung kanan/kiri, waktu, centang baca, balas, emoji, salin, hapus (sesuai aturan yang ada), gulir otomatis.
- Tutup / buka kembali tiket, beri rating 1–5 setelah selesai.
- Notifikasi saat admin membalas (pakai sistem notifikasi yang ada).

Admin (halaman "Live Support" di dashboard admin):

- Ringkasan: tiket baru, belum dibalas, prioritas tinggi, chat aktif, rata-rata waktu respon.
- Balas realtime, ambil tiket (assign), ubah status & prioritas, catatan internal (tidak terlihat user), minta info, tutup/buka, riwayat, lampiran.
- Quick Reply yang bisa ditambah/diubah admin (4 contoh dari permintaan sebagai awal).
- Status admin Online/Offline diatur dari aktivitas admin, bukan jam tetap.

## Tahap 2 — Lucky Royale Hub

Satu pintu "Lucky Royale" yang membungkus sistem yang sudah ada (Royale Nyawa, Diamond Royale, Lucky Wheel, Premium Spin, Tier Spin, Mega Arena, Spin Ticket Shop, Lucky Draw):

- Hero 👑 LUCKY ROYALE + saldo Gems, Koin, Tiket Spin, Streak, level, jackpot dari database.
- Tab: Normal, Diamond, Lucky Spin, Premium, Daily (hitung mundur free spin), Shop, Leaderboard (Top 3 + peringkat sendiri, nama disamarkan), History.
- Animasi hasil per kelangkaan (Common → Mythic), "LEGENDARY WIN" & "JACKPOT", ringan di Android.
- Semua hasil tetap ditentukan server (sudah begitu); dicek ulang bahwa tiap spin tercatat.
- Profil: kartu "My Royale" + badge (Lucky Beginner, Spin Master, Jackpot Hunter, Legendary Hunter, Royale Champion) dihitung dari riwayat.

## Tahap 3 — Music Hub Premium

- Beranda musik: Featured, Trending, Terbaru, Populer Minggu Ini, Rekomendasi, Baru Diputar, Playlist Saya, Artist Populer, Upload Terbaru, 13 Mood — carousel geser, skeleton loading, empty state.
- Pemutar penuh diperkuat: antrean, next/prev, favorit, tambah playlist, share, lirik, info artist — tetap memakai satu pemutar yang ada (tidak ada suara dobel).
- Music Feed realtime: upload baru, like, rilis artist yang diikuti.
- Admin: pilih lagu Featured/Trending.

## Tahap 4 — Beranda, Notifikasi, Penyempurnaan

- Pintasan beranda: Music, Live Support, My Tickets, Lucky Royale, Games.
- Pusat notifikasi dengan badge realtime (chat, tiket, lagu baru, artist diikuti, hadiah Royale, event).
- Audit performa (pembersihan listener/timer), uji semua route HP & desktop, build produksi.

## Detail teknis

- Tahap 1 migrasi: tambah kolom pada `support_tickets` (`priority`, `assigned_admin`, `rating`, `rating_note`, `closed_at`, `reopened_count`, `last_message_at`, `visitor_id` bila belum ada); tabel baru `ticket_internal_notes`, `ticket_quick_replies`, `admin_presence` (dengan GRANT + RLS; tulis hanya lewat admin/fungsi server). Pastikan `ticket_messages` & `ticket_typing` ada di publikasi realtime.
- Tahap 2: leaderboard/history dibaca dari tabel spin yang ada (`streak_wheel_spins`, `luck_royale_nyawa_history`, `diamond_royale_history`, `lucky_draw_history`) lewat satu fungsi DB agregat; tidak ada backend spin baru.
- Tahap 3: kolom `is_featured`/`play_count` pada tabel lagu bila belum ada; feed dari tabel lagu publik, like, dan follow yang ada.
- Komponen baru ditaruh di `src/components/support/`, `src/components/royale/`, `src/components/music/`; `Index.tsx` hanya diberi titik pasang agar tidak makin berat.
- Setiap tahap: typecheck, build, uji Playwright HP 360px & desktop, uji fungsi server dengan akun uji sementara lalu dihapus.

Setelah disetujui, saya mulai dari Tahap 1 dan melaporkan hasil uji sebelum lanjut ke Tahap 2.