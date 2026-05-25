INSERT INTO public.admin_settings (setting_key, setting_value) VALUES
  ('confess_title', 'Confess Anonim'),
  ('confess_description', 'Kirim pesan rahasia ke siapa saja via WhatsApp. Identitasmu disembunyikan. Murah & aman.'),
  ('confess_price_1', '2000'),
  ('confess_price_2', '4000'),
  ('confess_price_3', '5000'),
  ('confess_admin_wa', '6285769302532'),
  ('confess_notify_purchase', 'on'),
  ('confess_notify_cancel', 'on')
ON CONFLICT (setting_key) DO NOTHING;