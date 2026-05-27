UPDATE public.wa_notification_configs SET template = 'AGUNG ADI STORE
----------------
Login User
User: {user}
HP: {hp}
Device: {device}
Waktu: {waktu}' WHERE event_type = 'login';

UPDATE public.wa_notification_configs SET template = 'AGUNG ADI STORE
----------------
Produk {action}
ID: {produk_id}
Nama: {produk}
Harga: Rp{harga}
Stok: {stok}
Admin: {user}
Waktu: {waktu}' WHERE event_type = 'product_edit';