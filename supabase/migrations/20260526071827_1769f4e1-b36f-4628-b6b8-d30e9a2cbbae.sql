
UPDATE public.wa_notification_configs
SET template = 'AGUNG ADI STORE
----------------
TRX: {trx_id}
User: {user}
Produk: {produk}
Jumlah: {qty}
Total: Rp{harga}
Waktu: {waktu}'
WHERE event_type = 'purchase';

UPDATE public.wa_notification_configs
SET template = 'AGUNG ADI STORE
----------------
TRX: {trx_id}
User: {user}
Jumlah: Rp{harga}
Metode: {metode}
Status: {action}
Waktu: {waktu}'
WHERE event_type = 'deposit';
