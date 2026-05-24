## Ringkasan
Menambahkan 4 fitur baru pada tab **Confess** secara bertahap dalam satu rilis.

## Fitur 1 — Wall Publik + Reaction + Leaderboard
- Toggle "Bagikan ke Wall Publik" saat compose (opsional, no HP target disensor ke `0812****1234`).
- Tab baru di header Confess: **"Wall"** menampilkan feed publik (terbaru / terpanas / leaderboard mingguan).
- Tombol reaction ❤️ 🔥 😂 😢 di tiap kartu (sekali per visitor per confess).
- Pengirim dapat notif tiap kali confess-nya dapat reaction baru.
- Leaderboard: Top 10 confess minggu ini (reaction terbanyak) — anonim, hanya menampilkan reaction count + preview.

## Fitur 2 — Confess Berjadwal + Template Mood
- Saat compose, opsi **"Kirim sekarang"** vs **"Jadwalkan"** (date+time picker, min 5 menit dari sekarang, max 30 hari).
- Saldo dipotong saat scheduling; pesan masuk queue.
- Edge function cron berjalan tiap menit untuk eksekusi confess yang `scheduled_at <= now()`.
- Bisa cancel sebelum waktu eksekusi → refund saldo penuh.
- 6 Template Mood Pack: 💌 Romantis, 😂 Lucu, 😢 Galau, 🔥 Pedas, 🙏 Maaf, 🎂 Ucapan. Klik template = isi otomatis + emoji prefix.

## Fitur 3 — Voice Note & Media Confess
- Tombol mic 🎤 di compose: rekam audio (max 60 detik) → upload ke bucket `confess-media` (sudah ada) → kirim sebagai pesan media.
- Tombol foto 📷: pilih gambar (max 5MB).
- Receiver di WA dapat link media (dikirim via WA bot template existing yang sudah support media).
- Harga voice/media = sama dengan confess teks reguler.

## Fitur 4 — Reveal Identitas Berbayar
- Di header tiap thread chat, tombol **"Minta Reveal Identitas"** (hanya untuk target via WA bot).
- Target bayar Rp 5.000 via balance → kirim request reveal ke pengirim.
- Pengirim dapat notif & dialog: **Setuju Reveal** / **Tolak**.
  - Setuju → nama + visitor pengirim ditampilkan ke target, saldo Rp 5.000 dari target dibayarkan ke pengirim (atau hangus jika ditolak).
  - Tolak → saldo target di-refund 100%.

## Database
Tabel baru:
- `confess_public_wall` (confession_id, visitor_id, masked_phone, message_preview, mood_tag, reaction_counts jsonb, created_at)
- `confess_wall_reactions` (wall_id, visitor_id, emoji, created_at) UNIQUE(wall_id, visitor_id)
- `confess_scheduled` (id, visitor_id, user_balance_id, target_phone, message_text, mood_tag, scheduled_at, status, price_charged, voucher_code, created_at) — status: pending/sent/cancelled
- `confess_reveal_requests` (id, thread_id, requester_visitor, sender_visitor, status, amount, created_at, responded_at) — status: pending/approved/rejected/refunded

Kolom tambahan:
- `confess_thread_messages`: `mood_tag text`, `is_voice boolean`
- `confess_threads`: kolom sudah cukup

## Edge functions
- `send-confession`: terima `share_to_wall`, `mood_tag`, `media_url`, `scheduled_at`. Jika `scheduled_at` → insert ke `confess_scheduled` saja.
- `public-api`: endpoint baru `confess_wall_list`, `confess_wall_react`, `confess_leaderboard`, `confess_scheduled_list`, `confess_scheduled_cancel`, `confess_reveal_request`, `confess_reveal_respond`.
- `cron-scheduled-confess` (baru): dipanggil pg_cron tiap menit, jalankan confess yang waktunya tiba.

## UI
- `src/components/ConfessTab.tsx` ditambah views: `wall`, `scheduled`, dialog reveal, template mood picker, voice recorder, schedule picker.
- Komponen baru kecil: `MoodTemplatePicker`, `VoiceRecorderButton`, `WallFeed`, `ScheduledList`.

## Eksekusi
1. Migration database + cron job.
2. Update edge function `send-confession` + endpoint baru di `public-api`.
3. Buat edge function `cron-scheduled-confess`.
4. Update `ConfessTab.tsx` dengan UI baru (mood, schedule, voice, wall, reveal).
5. Update `wa-bot-template.js` agar handle keyword reveal & forward voice/media.
6. Verifikasi: compose + send (teks/voice/wall/scheduled), reaction wall, leaderboard, cancel scheduled, reveal flow.