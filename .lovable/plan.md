# Rencana Perbaikan Confess + Bot Galau

Karena permintaannya banyak, dipecah jadi **5 tahap**. Setiap tahap akan dideploy & bisa diuji sebelum lanjut tahap berikutnya.

---

## Tahap 1 — Bug Fixes Confess (PRIORITAS)

**A. Voice note tidak terkirim**
- Audit `confess-chat-send` & WA bot: cek upload audio (mime `audio/webm`/`ogg`), pastikan dikonversi ke PTT (`ptt: true`) saat dikirim Baileys.
- Tambahkan log error ke client (toast) jika upload storage gagal.

**B. Auto-balas WA tanpa prefix `.balas`/`!balas`**
- Bot WA: saat menerima pesan dari nomor yang punya thread `confess_threads` aktif (free_until > now), otomatis treat sebagai balasan masuk → insert ke `confess_thread_messages` direction `in`, tanpa perlu command apapun.
- Command `.balas`/`!balas` tetap diterima sebagai fallback, tapi opsional.

**C. PP berubah ikut thread lama**
- Saat ini `wa_profile_pic_url` disimpan di kolom `confess_threads` jadi semua pesan thread ambil dari satu sumber yang terus diupdate.
- Fix: pindah `wa_profile_pic_url` ke kolom snapshot per pesan (`confess_thread_messages.wa_profile_pic_url`) ATAU buat thread baru otomatis jika PP berubah signifikan. Pilih opsi snapshot per pesan — lebih akurat.

**D. "Reveal" bug**
- Audit endpoint `confess-reveal` (atau sejenis): pastikan tombol reveal hanya muncul kalau user yang berhak, dan setelah klik benar-benar membuka identitas. Cari & perbaiki race condition.

**E. "Terakhir dilihat" tampilkan jam**
- Format `wa_last_seen_at` di header chat: kalau hari ini → `terakhir dilihat hari ini pukul 14.32`, kalau kemarin → `kemarin pukul ...`, lainnya tanggal + jam.

---

## Tahap 2 — Voucher Diskon Confess (Admin Manual)

- Migrasi tabel baru `confess_vouchers` (code `CON-XXXX`, discount_percent 1-100, max_uses, used_count, expires_at, is_active, created_by).
- Admin UI di `AdminConfessTab`: generate/list/delete voucher (mirip `AdminStreakVoucherTab`).
- User input kode di form pembelian Confess. Server hitung harga akhir:
  - Diskon 100% → bypass PIN (gratis).
  - Diskon < 100% → tetap minta PIN 6 digit untuk potong saldo.
- Edge function `confess-redeem-voucher` validasi atomic + increment used_count.

---

## Tahap 3 — Mode Template AI Confess

- Tambah dropdown "Gaya AI" di form Confess (Romantis / Sedih / Lucu / Marah / Formal / Custom).
- Kirim parameter `style` ke endpoint AI generation; system prompt disesuaikan per gaya.

---

## Tahap 4 — Tab Baru "Bot Galau"

Posisi: di samping nav Admin/User (tab horizontal bawah).

- Route baru `/bot-galau` di `App.tsx` + tab di `Index.tsx`.
- Konsep: **anonim ke user lain** (mirip Anon Chat tapi tema curhat/galau).
- Komponen baru `BotGalauTab.tsx`:
  - Pairing queue terpisah (`galau_chat_queue`, `galau_chat_sessions`, `galau_chat_messages`) supaya tidak campur Anon Chat.
  - Support kirim **teks + foto + voice note** (storage bucket `galau-media`).
  - Tag mood saat masuk antrian: "sedih", "marah", "patah hati", "cemas", "butuh teman".
  - Pairing prioritaskan mood yang sama atau komplementer.
  - Realtime via Supabase channel.
  - Moderasi pakai `chat-moderation.ts` yang sudah ada.

---

## Tahap 5 — Sync ke WA bot template

- Update `tmp/wa-bot-index.js` & `src/lib/wa-bot-template.js`: auto-balas tanpa prefix, PTT audio, snapshot PP per pesan.

---

## Catatan teknis

```text
DB perubahan:
  confess_thread_messages: + wa_profile_pic_url (snapshot)
  confess_vouchers (baru)
  confess_voucher_redemptions (baru)
  galau_chat_queue / galau_chat_sessions / galau_chat_messages / galau_chat_profiles (baru)
  storage bucket "galau-media" (public read, authenticated write via edge function)

Edge functions baru:
  confess-redeem-voucher
  galau-chat-match
  galau-chat-send
  galau-chat-end

Komponen baru: BotGalauTab.tsx, AdminConfessVoucherSection (di dalam AdminConfessTab)
```

---

**Aku akan mulai dari Tahap 1 dulu** (bug fix paling kritis), deploy, kamu test. Kalau OK lanjut Tahap 2 dst. Setuju?
