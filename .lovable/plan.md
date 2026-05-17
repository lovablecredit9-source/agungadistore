# Confess Chat Thread + Free 24-Hour Window

## Tujuan
Setelah user pertama kali bayar confess ke 1 nomor, pengirim & penerima nomor itu bisa **balas-balasan gratis selama 24 jam**. Riwayat ditampilkan sebagai **chat thread** per nomor (bukan per transaksi). Lewat 24 jam → bayar lagi.

## Aturan
- **Bayar pertama** (Rp 2.000 / nomor) → buka window 24 jam untuk nomor itu.
- **Selama window aktif**:
  - Pengirim bisa kirim pesan tambahan dari aplikasi **tanpa bayar & tanpa PIN**.
  - Balasan penerima (`!balas` di WA) masuk ke thread yang sama, gratis.
- **Window habis** (24 jam sejak bayar terakhir):
  - Tombol "Kirim Gratis" diganti "Bayar Rp 2.000 untuk Lanjut".
  - Bayar lagi → reset window 24 jam.
- **Status pesan**:
  - `pending` = belum dikirim bot
  - `sent` = sudah terkirim ke WA
  - `failed` = gagal
  - Pesan masuk dari penerima selalu `delivered`.

## UI Baru (ConfessTab)
1. **Form kirim baru** (seperti sekarang) — untuk nomor yang belum pernah / window habis.
2. **Daftar Thread Aktif** — tiap nomor jadi satu kartu dengan:
   - Nomor WA + nama (kalau ada)
   - Preview pesan terakhir + waktu
   - Badge "🟢 Gratis 23:45" (countdown) atau "⏰ Bayar lagi"
   - Jumlah balasan belum dibaca
3. **Detail Thread = WhatsApp-style chat**:
   - Bubble kanan (kita) / kiri (penerima)
   - Status checkmark (pending/sent/delivered)
   - Input bar di bawah: "Ketik pesan…" + tombol kirim
   - Header countdown window
   - Kalau expired: input diganti banner "Window habis — Bayar Rp 2.000 untuk lanjut"

## Skema Database

```text
confess_threads
  id uuid PK
  visitor_id text
  user_balance_id uuid (account scope)
  target_phone text (normalized 62xxx)
  sender_name text
  last_paid_at timestamptz
  free_until timestamptz       -- last_paid_at + 24h
  last_message_at timestamptz
  unread_count int default 0
  created_at, updated_at
  UNIQUE(visitor_id, target_phone)

confess_thread_messages
  id uuid PK
  thread_id uuid FK
  direction text ('out' | 'in')
  text text
  status text ('pending'|'sent'|'failed'|'delivered')
  trx_id text NULL              -- mengikat ke transaksi bayar bila ada
  is_free bool                  -- true kalau pakai window gratis
  sent_at timestamptz
  created_at
```

RLS: read/write hanya untuk visitor_id pemilik thread (atau akun saldo yang sama).

## Edge Function

**`send-confession` (edit)**:
- Tetap charge per nomor baru. Setelah sukses:
  - Upsert `confess_threads` → set `last_paid_at = now()`, `free_until = now() + 24h`.
  - Insert `confess_thread_messages` direction `out`, `is_free=false`, status `pending`.
- Backward-compat: tetap isi `confess_targets` agar bot existing jalan.

**`confess-chat-send` (baru)**:
- Body: `{ visitorId, threadId, text, pin? }`
- Validasi thread milik visitor + `free_until > now()`.
- Insert message `direction=out, is_free=true, status=pending`. **Tidak potong saldo, tidak butuh PIN.**
- Push ke `confess_outbox` agar bot kirim ke nomor target.

**`confess-receive-reply` (edit/baru)**:
- Dipanggil bot saat `!balas`. Mencari thread aktif berdasarkan `from_phone` + `visitor_id` (target_phone match).
- Insert message `direction=in, status=delivered, is_free=true`.
- Window tetap aktif sampai `free_until` original (balas TIDAK extend window — sesuai aturan "1 hari berlaku habis itu gratis dan setelah itu bayar lagi").
- Increment `unread_count`.

## Perubahan Bot WA
- Polling `confess_outbox` sudah ada → tambah dukungan pesan tanpa CFS code (follow-up): kirim sebagai pesan biasa ke target dengan format:
  ```
  💌 [Lanjutan dari pengirim sebelumnya]
  {text}
  
  Balas: !balas (pesan)
  ```
- Handler `!balas`: panggil endpoint baru `confess_reply_inbound` yang routing ke thread yang `free_until > now()`.

## File yang Berubah
- `supabase/migrations/...` — 2 tabel baru + RLS + indexes
- `supabase/functions/send-confession/index.ts` — upsert thread
- `supabase/functions/confess-chat-send/index.ts` — **NEW**
- `supabase/functions/public-api/index.ts` — endpoint `confess_threads`, `confess_thread_messages`, `confess_reply_inbound`
- `src/components/ConfessTab.tsx` — split jadi: form, ThreadList, ChatView
- `src/lib/wa-bot-template.js` — handler `!balas` cek thread + dukung follow-up tanpa CFS, naik versi ke v13.8.0

## Catatan
- Nomor yang ditolak penerima (block bot) tetap dihitung "pending/failed" — tidak buka window.
- Maks 30 pesan/hari per thread (anti-spam window gratis).
- Notifikasi realtime saat balasan masuk via Supabase channel.

Setelah kamu setuju, saya jalankan migrasi DB dulu, baru update bot + edge function + UI.