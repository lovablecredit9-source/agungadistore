# Notifikasi WA Otomatis via Bot

Menambahkan sistem notifikasi WA otomatis terkirim ke nomor admin (bisa diatur per fitur dari Admin Dashboard) untuk 4 jenis event.

## Event yang dikirim

1. **Pembelian produk** (saldo / token claim) — kirim notif berisi: ID transaksi, nama user, produk, jumlah, harga, saldo terpotong.
2. **Edit/Tambah/Hapus produk admin** — kirim notif: aksi (CREATE/UPDATE/DELETE), ID produk, nama, harga lama→baru.
3. **Login user akun saldo** — kirim notif: username, nomor HP, waktu, device info.
4. **Deposit & pembatalan** — kirim notif saat deposit baru masuk, dikonfirmasi, atau dibatalkan.

## Konfigurasi Admin

Di **Admin Dashboard → tab baru "WA Notifikasi"**:
- Field nomor WA admin untuk tiap event (default: 085769302532, bisa beda-beda atau sama).
- Toggle ON/OFF per event.
- Editor template pesan dengan variabel `{user}`, `{produk}`, `{harga}`, `{trx_id}`, `{waktu}`, dll. Tombol "Reset ke default".
- Tombol "Test kirim" untuk uji per event.
- Bisa **edit/hapus** baris konfigurasi.

## Implementasi teknis

### Database (migration)
- Tabel `wa_notification_configs`:
  - `event_type` (purchase/product_edit/login/deposit) unique
  - `wa_number` (text)
  - `enabled` (bool)
  - `template` (text, dengan placeholder)
  - `updated_at`

- Tabel `wa_notification_queue` (sudah ada `system_admin_notif` thread di bot — reuse) untuk antrian outgoing.

### Edge Functions
- **`send-wa-notification`** (baru): helper internal terima `{event_type, vars}`, render template, push ke thread `system_admin_notif` agar bot baileys mengirim ke `wa_number`.
- Hook ke flow yang sudah ada:
  - `process-balance-purchase` / token claim → call helper.
  - `admin-product` (CREATE/UPDATE/DELETE) → call helper.
  - `balance-auth` (login success) → call helper.
  - `public-api` (deposit create/cancel) → call helper.

### Bot Baileys
- Update handler `system_admin_notif`: baca `wa_number` per pesan (bukan hardcode), kirim ke nomor itu.

### Frontend
- `src/components/AdminWaNotifTab.tsx` baru.
- Daftarkan di `AdminDashboard.tsx`.

## Catatan
- Nomor WA divalidasi format internasional (628xxx).
- Template fallback default jika kosong.
- Semua aksi log ke `notifications` admin agar bisa di-trace.
