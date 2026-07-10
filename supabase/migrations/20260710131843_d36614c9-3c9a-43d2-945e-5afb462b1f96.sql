-- Antrian pesan WhatsApp keluar (dibaca & dikirim oleh bot)
CREATE TABLE public.wa_outbox (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'manual',
  related_id UUID,
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_outbox TO authenticated;
GRANT ALL ON public.wa_outbox TO service_role;

ALTER TABLE public.wa_outbox ENABLE ROW LEVEL SECURITY;

-- Admin (login authenticated) bisa kelola antrian dari web
CREATE POLICY "Admin manage wa_outbox" ON public.wa_outbox
  FOR ALL TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE INDEX idx_wa_outbox_status ON public.wa_outbox (status, created_at) WHERE status = 'pending';

CREATE TRIGGER update_wa_outbox_updated_at
  BEFORE UPDATE ON public.wa_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Setelan bot default (dibaca bot dari admin_settings)
INSERT INTO public.admin_settings (setting_key, setting_value) VALUES
  ('bot_enabled', 'true'),
  ('bot_offline_message', 'Halo! Bot sedang offline sementara. Admin akan membalas secepatnya. Terima kasih 🙏'),
  ('bot_ticket_reply_prefix', '💬 *Balasan Admin untuk Tiket #{ticket}*')
ON CONFLICT (setting_key) DO NOTHING;