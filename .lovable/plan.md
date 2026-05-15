# Anon Chat — Paket Perbaikan Besar

Permintaan kamu cukup banyak, aku rangkum dulu jadi 6 fitur biar jelas. Setelah kamu setuju, aku eksekusi semua sekaligus (atau pecah per fitur kalau mau lebih cepat ditest).

## 1. Pesan Call Muncul di Chat (real-time, bukan setelah call mati)
- Saat panggilan **dimulai** → bot system message langsung dikirim ke chat: "📞 Memulai panggilan suara…" dengan status live (mendering / berlangsung 00:12 / berakhir 02:34).
- Saat panggilan **berakhir / ditolak / missed** → message yang sama di-update jadi versi final (ikon merah/hijau, durasi). Jadi tidak nunggu call tutup baru muncul.
- Pakai `anon_chat_messages` dengan `message_type = 'call'` + kolom JSON `call_meta` (status, started_at, ended_at, duration).

## 2. Centang Status Pesan (WhatsApp style)
- ✓ abu-abu: terkirim (di server)
- ✓✓ abu-abu: sampai ke partner (partner online / window terbuka)
- ✓✓ biru: sudah dibaca (partner buka chat)
- Realtime via Supabase: kolom `delivered_at`, `read_at` di `anon_chat_messages`.
- Berlaku juga untuk message tipe call.

## 3. Match Random: Filter Gender & Ketertarikan KETAT
- Sekarang masih longgar (any). Akan dibuat:
  - Kalau pilih "Cari perempuan" → **hanya** ketemu perempuan, tidak akan ketemu laki.
  - Kalau pilih "Cari laki" → hanya laki.
  - Pilih "Bebas" → bebas (tetap acak).
- Ketertarikan (interest):
  - "Coding" hanya ketemu yang juga "Coding".
  - "Catur" hanya ketemu "Catur".
  - "Bebas/Random" baru ketemu siapa saja.
- Update `anon_chat_find_or_queue`: filter strict, tidak fallback ke any.

## 4. Last Seen Akurat & Konsisten
- Bug: di tab Publik / Teman kadang muncul "online" padahal partner offline; "terakhir aktif" tidak update.
- Fix:
  - Heartbeat tiap 30 detik update `anon_chat_profiles.last_seen_at` saat tab aktif.
  - Status online = `last_seen_at` dalam 60 detik terakhir.
  - Hormati toggle `show_last_seen` (kalau partner mematikan, tampilkan "Terakhir dilihat: disembunyikan").
  - Sinkronkan tampilan di: header chat, daftar teman, daftar publik, modal profil.

## 5. Kirim File di Anon Chat
- Tombol lampiran → bisa kirim:
  - Foto (jpg/png/webp, max 5MB)
  - Video pendek (max 15MB, max 30 detik) — opsional kalau mau
  - File dokumen (pdf/doc/zip, max 10MB)
- Upload ke Supabase Storage bucket `anon-chat-media` (public read, write bebas).
- Bubble chat: foto preview, video player, file card (nama + size + tombol download).
- Tetap kompatibel dengan voice note (rencana sebelumnya).

## 6. Tampilan Premium — Elegan, Mantap, Keren Parah
- Refresh visual seluruh AnonChatTab biar terasa "premium app":
  - Header chat: glassmorphism gradient, avatar dengan ring online (pulse hijau), nickname + status live ("mengetik…", "online", "terakhir dilihat 5m lalu").
  - Bubble chat: rounded-2xl, gradient halus untuk pesan saya (biru→ungu), netral untuk partner, shadow lembut, animasi slide-in.
  - Bar input: floating pill, tombol attach/voice/emoji dengan haptic-look.
  - Lobby: card kategori (Random / Teman / Publik) dengan ilustrasi & micro-interaction.
  - Konsisten dengan design token global (no warna mentah).

## Teknis Singkat
- **DB**: tambah kolom `delivered_at`, `read_at`, `message_type`, `call_meta`, `media_url`, `media_type`, `media_size`, `media_name` di `anon_chat_messages`. Update RPC `anon_chat_find_or_queue` (strict). Tambah RPC `anon_chat_mark_read`, `anon_chat_mark_delivered`, `anon_chat_heartbeat`.
- **Storage**: bucket `anon-chat-media` public.
- **Realtime**: subscribe `anon_chat_messages` & `anon_chat_profiles`.
- **Frontend**: refactor `AnonChatTab.tsx` jadi sub-komponen (Header, MessageBubble, InputBar, CallMessage, Lobby) supaya rapi.

```text
Urutan eksekusi
1. Migrasi DB + storage bucket
2. RPC matchmaking strict + heartbeat + read receipts
3. Rebuild MessageBubble (centang, call live, media)
4. Input bar baru (attach file, voice)
5. Polish UI premium (header, lobby, animasi)
```

## Pertanyaan Singkat
- OK aku kerjakan **semua sekaligus**, atau mau **dipecah** (misal: 1+2+3 dulu, lalu 4+5+6)?
- Untuk file: cukup **foto + dokumen**, atau perlu **video** juga?
