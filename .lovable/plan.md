## Tujuan
Memperbaiki 3 hal berurutan (per pilihanmu "kerjakan bertahap"):
1. WA tidak terkirim saat deposit diterima / transaksi sukses
2. Multi-nomor WA: 2 gratis, slot ke-3–5 berbayar Rp 5.000/nomor/bulan
3. Format pesan WA disederhanakan jadi gaya TAGIHAN PEMBAYARAN / PEMBAYARAN BERHASIL

---

## Tahap 1 — Fix notifikasi WA tidak terkirim

**Root cause yang sudah saya verifikasi:**
- Edge function `send-wa-notification` sudah ada, tapi **tidak pernah dipanggil dari mana pun** (`rg` 0 hasil di seluruh project).
- Akibatnya: setelah deposit di-approve / pembelian saldo sukses, tidak ada pesan masuk ke nomor WA user maupun admin.

**Yang akan dikerjakan:**
- Pasang panggilan `supabase.functions.invoke('send-wa-notification', …)` di titik-titik berikut:
  - `create-deposit` → event `deposit` (kirim tagihan QRIS ke nomor user + admin)
  - Endpoint approve deposit (cari di `cancel-deposit`/admin tab) → event `deposit` sukses
  - `purchase-with-balance` / `flash-deal-purchase` / `purchase-bundle` → event `purchase` (kirim "PEMBAYARAN BERHASIL + kode voucher")
- Pastikan `notify_visitor_id` & `vars` (invoice, produk, total, qris_url, voucher_code, expired) diteruskan dengan benar.
- Tambahkan logging error sehingga gagal kirim WA tidak menggagalkan transaksi inti.

**Verifikasi:** lakukan test invoke ke `send-wa-notification` dengan payload dummy, cek `confess_thread_messages` muncul status pending → bot kirim.

---

## Tahap 2 — Multi-nomor WA (2 gratis, max 5 berbayar)

**Skema DB baru:**
- Tabel `user_wa_notif_numbers` (visitor_id, wa_number, label, notify_purchase, notify_login, notify_deposit, is_paid, paid_until, slot_index, created_at).
- Tabel `wa_slot_payments` (visitor_id, wa_number, amount, paid_at, expires_at, method ['saldo'|'qris'], trx_id, status).
- Migrasi data lama dari `user_wa_notif_prefs` → slot pertama gratis.

**Aturan:**
- Slot 1 & 2: gratis, langsung aktif.
- Slot 3–5: harus bayar Rp 5.000, masa aktif 30 hari per nomor.
- Saat masa aktif habis: nomor TETAP tersimpan & masih bisa terima notif, tapi user **tidak bisa menambah** nomor baru lagi sampai bayar (atau hapus salah satu nomor berbayar) — sesuai permintaan "kalau hapus tidak bisa nambah kecuali bayar".

**UI** (`PlusHub` → "Notifikasi WA"):
- List slot 1–5, badge GRATIS / BERBAYAR (sisa hari).
- Tombol "Tambah Nomor" → jika slot ≥3: modal pilih metode bayar:
  - **Saldo** (dengan PIN 6 digit) → pakai `consume_balance_with_bonus` + buat row aktif.
  - **QRIS via WA bot** → buat row di `wa_slot_payments` status pending, kirim invoice QRIS lewat `create-deposit`-style.
- Toggle jenis notifikasi per nomor (purchase / login / deposit) — sesuai jawabanmu, default ketiganya ON.

**Pengiriman:** `send-wa-notification` di-update agar loop ke semua nomor aktif user, kirim ke masing-masing yang punya toggle event tsb. ON.

---

## Tahap 3 — Template pesan WA baru

Update tabel `wa_notification_configs` (template default) jadi:

**deposit_invoice:**
```
TAGIHAN PEMBAYARAN

Invoice: {invoice}
Produk: Deposit Saldo
Total: Rp {total}

Mohon lakukan pembayaran via QRIS sebelum {expired}.

Scan QRIS: {qris_url}

Simpan Invoice ini untuk pengecekan status pesanan Anda.

Terima Kasih!
```

**purchase_success:**
```
PEMBAYARAN BERHASIL

Invoice: {invoice}
Status: LUNAS

Kode Voucher Anda:

🎫 {voucher_code}

({product_name})

Terima kasih telah berbelanja!
```

Hilangkan emoji & banner berlebih ("kere" sesuai katamu). Template tersimpan di DB → bisa diedit admin di tab Konfigurasi WA Notif.

---

## Detail teknis

```text
Edge functions yang disentuh:
  send-wa-notification   (loop multi-nomor, baca user_wa_notif_numbers)
  create-deposit         (invoke event=deposit_invoice)
  approve-deposit (baru, atau di admin RPC) (invoke event=deposit_success)
  purchase-with-balance  (invoke event=purchase_success per voucher)
  flash-deal-purchase    (invoke event=purchase_success)
  purchase-bundle        (invoke event=purchase_success)
  wa-slot-purchase (baru) (bayar slot saldo/qris)

Migrasi DB:
  CREATE TABLE public.user_wa_notif_numbers (...)
  CREATE TABLE public.wa_slot_payments (...)
  Backfill dari user_wa_notif_prefs
  RLS: user hanya bisa CRUD baris miliknya (via visitor_id)
  Update template wa_notification_configs (UPSERT 2 row)
```

---

## Urutan eksekusi
1. Tahap 1 saya kerjakan dulu & verifikasi (kamu test 1 deposit / 1 pembelian dari WA).
2. Setelah Tahap 1 OK, lanjut Tahap 2 (DB + UI + pembayaran slot).
3. Setelah Tahap 2 OK, finalisasi Tahap 3 (template rapi).

Mau saya langsung mulai Tahap 1?
