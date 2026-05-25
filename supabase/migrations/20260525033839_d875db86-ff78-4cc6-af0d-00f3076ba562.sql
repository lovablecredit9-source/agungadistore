
CREATE TABLE IF NOT EXISTS public.wa_notification_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE,
  wa_number text NOT NULL DEFAULT '6285769302532',
  enabled boolean NOT NULL DEFAULT true,
  template text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_notification_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_notif_admin_read"
ON public.wa_notification_configs FOR SELECT
USING (public.is_admin_user());

CREATE POLICY "wa_notif_admin_write"
ON public.wa_notification_configs FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE TRIGGER wa_notif_updated_at
BEFORE UPDATE ON public.wa_notification_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.wa_notification_configs (event_type, wa_number, enabled, template) VALUES
  ('purchase', '6285769302532', true,
   '🛒 *Pembelian Baru*%0ATRX: {trx_id}%0AUser: {user}%0AProduk: {produk}%0AJumlah: {qty}%0AHarga: Rp{harga}%0AWaktu: {waktu}'),
  ('product_edit', '6285769302532', true,
   '📦 *Produk {action}*%0AID: {produk_id}%0ANama: {produk}%0AHarga: Rp{harga}%0AStok: {stok}%0AAdmin: {user}%0AWaktu: {waktu}'),
  ('login', '6285769302532', false,
   '🔐 *Login User*%0AUser: {user}%0AHP: {hp}%0ADevice: {device}%0AWaktu: {waktu}'),
  ('deposit', '6285769302532', true,
   '💰 *Deposit {action}*%0ATRX: {trx_id}%0AUser: {user}%0AJumlah: Rp{harga}%0AMetode: {metode}%0AWaktu: {waktu}')
ON CONFLICT (event_type) DO NOTHING;
