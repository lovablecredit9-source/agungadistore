# Perbaikan Sinkronisasi Confess Web ↔ WA Bot

## Masalah saat ini
1. Foto profil WA pengirim/penerima tidak muncul di tampilan web confess.
2. "Terakhir dilihat" + info kontak WA (nama, status) tidak ditarik dari WA.
3. Saat user WA balas pakai **pesan suara (voice note)**, di web kosong (tidak ada audio playernya).
4. Saat user WA balas dengan teks biasa (mis. "hay") **tanpa** `!balas`, pesan hilang — bot tidak meneruskan ke pengirim confess.
5. Hapus pesan di WA tidak ikut hapus di web (dan sebaliknya).

## Rencana implementasi

### 1. Schema database (migrasi)
Tambah kolom di `confess_threads` & `confess_thread_messages`:
- `confess_threads`: `wa_profile_pic_url text`, `wa_display_name text`, `wa_last_seen_at timestamptz`, `wa_presence text` (online/typing/recording/offline).
- `confess_thread_messages`: `media_type text` (text/audio/image), `media_url text`, `media_mime text`, `media_duration_seconds int`, `wa_message_id text` (untuk tracking delete), `deleted_at timestamptz`, `deleted_by text` (web/wa).
- Storage bucket baru `confess-media` (public-read, auth-write) untuk simpan voice note.

### 2. Bot WA (`tmp/wa-bot-index.js` + `src/lib/wa-bot-template.js`)
**a. Sync profil & presence**
- Saat polling `confess_outbox`, untuk tiap thread baru: ambil `client.profilePictureUrl(jid, 'image')` + `client.fetchStatus(jid)` + presence subscribe → POST ke endpoint baru `confess_update_contact` (simpan ke `confess_threads`).
- Listen `presence.update` event Baileys → update `wa_presence` + `wa_last_seen_at`.

**b. Auto-balas tanpa `!balas`**
- Tambah cache `_lastConfessByPhone[phone] = { trx_id, expires_at }` (TTL 30 menit) yang di-set setiap kali kita kirim confess outbox ke nomor itu.
- Di handler pesan masuk: kalau pesan **tidak mulai `!`** DAN nomor itu punya entry confess aktif (≤30 menit) DAN user tidak sedang dalam `chatFlows`/login session → otomatis perlakukan sebagai reply confess (panggil `confess_reply`). Kirim balasan konfirmasi singkat.

**c. Voice note + media masuk dari WA**
- Saat terima pesan dengan `audioMessage`/`imageMessage` dari nomor yang sedang punya thread confess aktif: download via `downloadMediaMessage`, upload ke Supabase Storage `confess-media/<uuid>.ogg`, lalu kirim `confess_reply` dengan field tambahan `media_url`, `media_type`, `media_duration_seconds`.

**d. Hapus pesan dua arah**
- Listen `messages.update` (protocolMessage type 0 = revoke) → kalau `wa_message_id` cocok dengan pesan yang ada di DB → mark `deleted_at` via endpoint `confess_delete_message`.
- Saat user di web hapus → flag `deleted_by='web'`; bot poller deteksi flag baru → panggil `client.sendMessage(jid, { delete: messageKey })`.
- Saat kirim outbox, simpan `messageKey` (id + remoteJid + fromMe) yang dikembalikan Baileys ke `wa_message_id` agar bisa di-revoke nanti.

### 3. Edge function `public-api` — endpoint baru
- `confess_update_contact` (POST): {target_phone, profile_pic_url, display_name, last_seen_at, presence} → upsert ke `confess_threads`.
- `confess_reply` (extend): terima opsional `media_url`, `media_type`, `media_duration_seconds`, `wa_message_id` → simpan ke `confess_thread_messages`.
- `confess_delete_message` (POST): {wa_message_id atau id, deleted_by} → soft delete.
- `confess_pending_deletes` (GET): list pesan dengan `deleted_by='web'` AND `wa_message_id IS NOT NULL` belum di-revoke (tambah flag `wa_revoked_at`).

### 4. UI Web (komponen confess thread)
- Header thread: tampilkan `wa_profile_pic_url` (Avatar fallback inisial), `wa_display_name`, dan teks "Terakhir dilihat {relative time}" / "online" / "merekam suara…" berdasarkan `wa_presence` + `wa_last_seen_at` (realtime via Supabase Realtime di `confess_threads`).
- Render pesan:
  - `media_type='audio'` → `<audio controls src={media_url}>` dengan badge durasi.
  - `deleted_at!=null` → tampilkan "🚫 Pesan ini dihapus" (mute style), sembunyikan konten.
- Tombol hapus: panggil endpoint baru, optimistic update.

### 5. Realtime sync
- Aktifkan Realtime untuk `confess_threads` & `confess_thread_messages` (sudah ada).
- Web subscribe `presence.update` & message changes agar UI hidup tanpa refresh.

## File yang akan diubah/dibuat
- **Migrasi baru**: kolom + bucket storage.
- `supabase/functions/public-api/index.ts` — 3 endpoint baru.
- `tmp/wa-bot-index.js` + `src/lib/wa-bot-template.js` — handler presence, media masuk, auto-balas, delete sync.
- Komponen confess thread di web (lokasi akan saya cek saat implementasi — kemungkinan `src/components/ConfessThread*.tsx`).

## Catatan
- Foto profil & last seen WA hanya tersedia kalau privasi kontak target mengizinkan; kalau tidak, fallback ke inisial + "terakhir dilihat tidak tersedia".
- Revoke pesan via Baileys hanya berhasil dalam **batas waktu WhatsApp** (biasanya 2 hari sejak kirim).
- Saya tidak mengubah file `client.ts`/`types.ts` Supabase.
