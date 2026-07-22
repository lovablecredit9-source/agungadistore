
-- Tabel koneksi Telegram ↔ akun saldo (per visitor_id) dengan preferensi notifikasi
CREATE TABLE public.telegram_user_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL UNIQUE,
  telegram_chat_id TEXT NOT NULL,
  telegram_username TEXT NOT NULL DEFAULT '',
  telegram_first_name TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notif_deposit BOOLEAN NOT NULL DEFAULT TRUE,
  notif_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  notif_login BOOLEAN NOT NULL DEFAULT TRUE,
  notif_admin_message BOOLEAN NOT NULL DEFAULT TRUE,
  notif_balance_change BOOLEAN NOT NULL DEFAULT FALSE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_telegram_user_links_chat_id ON public.telegram_user_links(telegram_chat_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_user_links TO anon, authenticated;
GRANT ALL ON public.telegram_user_links TO service_role;

ALTER TABLE public.telegram_user_links ENABLE ROW LEVEL SECURITY;

-- Akses publik via visitor_id (sama pola dengan tabel akun saldo lain)
CREATE POLICY "Public can manage own link by visitor_id"
  ON public.telegram_user_links FOR ALL
  USING (true) WITH CHECK (true);

-- Kode koneksi sementara: user generate di web, ketik di bot untuk link
CREATE TABLE public.telegram_link_codes (
  code TEXT NOT NULL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_telegram_link_codes_visitor ON public.telegram_link_codes(visitor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_link_codes TO anon, authenticated;
GRANT ALL ON public.telegram_link_codes TO service_role;

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public link codes access"
  ON public.telegram_link_codes FOR ALL
  USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_telegram_user_links()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_telegram_user_links_updated
  BEFORE UPDATE ON public.telegram_user_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_telegram_user_links();
