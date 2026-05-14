# Anon Chat — Tambahan Fitur Besar

Permintaan kamu terdiri dari beberapa fitur. Aku rangkum dulu biar jelas, lalu kerjakan bertahap.

## 1. Riwayat Panggilan (Call History)
- Tab/section baru "Riwayat Panggilan" di Anon Chat.
- Catat tiap panggilan: partner (nickname), tipe (suara), status (aktif/terjawab/terputus/ditolak/missed), waktu mulai, durasi (mm:ss) — gaya WhatsApp.
- Tabel baru `anon_chat_call_logs` (visitor_id, partner_visitor, partner_nickname, session_id, status, started_at, ended_at, duration_seconds).
- Update otomatis saat panggilan dimulai, diterima, ditolak, atau berakhir.

## 2. Aturan Match Partner Setelah Akhiri Chat
- Saat chat diakhiri, partner masuk **history match** (`anon_chat_match_history`).
- Jika sudah teman → kalau salah satu mengakhiri, partner tetap masuk history tapi pertemanan tetap ada.
- Saat random match: partner di history **tetap bisa ketemu lagi**, tapi tombol **Skip** akan muncul walau teman.
- Hanya kalau user **klik "Hapus dari History"** → partner itu di-blacklist dan tidak akan ketemu lagi di random match.
- RPC `anon_chat_find_or_queue` ditambah filter blacklist (`anon_chat_blocked_matches`).

## 3. Fix Navigasi Hilang
- Bug: saat pindah dari tab Anon Chat ke tab lain, bottom nav hilang.
- Cari penyebab di `AnonChatTab.tsx` (kemungkinan fixed overlay / state fullscreen tidak di-reset saat unmount). Pastikan nav tetap render kecuali sedang di dalam chat aktif.

## 4. Voice Note (Pesan Suara)
- Tombol mic di chat → rekam audio (MediaRecorder, pakai helper `requestMicrophoneStream` yang sudah ada).
- Upload ke Supabase Storage bucket `anon-chat-media`.
- Tampil sebagai bubble audio dengan tombol play + durasi.

## 5. Foto Sekali Lihat (View Once)
- Tombol lampiran foto → pilih dari galeri/kamera.
- Toggle "Sekali Lihat" (view once) seperti WhatsApp.
- Foto view-once: setelah penerima buka, otomatis dihapus dari storage & ditandai "telah dilihat".
- Foto biasa: tetap tersimpan di chat.

## 6. Kirim Foto + Caption
- Saat kirim foto, ada input caption.
- Kalau caption kosong → cuma foto yang dikirim.
- Kalau ada teks → foto + caption muncul dalam satu bubble.

## Teknis Singkat
- **DB baru**: `anon_chat_call_logs`, `anon_chat_match_history`, `anon_chat_blocked_matches`, kolom baru `media_url`, `media_type`, `caption`, `view_once`, `viewed_at` di `anon_chat_messages`.
- **Storage**: bucket publik `anon-chat-media` (image+audio), policy upload bebas, hapus by visitor_id.
- **Realtime**: subscribe ke call_logs & messages baru.
- **Frontend**: update `AnonChatTab.tsx` (record voice, attach photo, view-once viewer modal, call history panel, fix nav).

## Urutan Eksekusi
1. Migrasi DB + storage bucket
2. Edge logic untuk call status & blacklist
3. UI: voice + foto + caption + view-once
4. UI: call history panel
5. Fix navigasi

Setuju lanjut semua sekaligus, atau mau aku pecah per fitur biar lebih cepat ditest?