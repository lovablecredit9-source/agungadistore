
-- Admin settings table for payment config
CREATE TABLE public.admin_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings viewable by everyone" ON public.admin_settings FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can manage settings" ON public.admin_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update settings" ON public.admin_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete settings" ON public.admin_settings FOR DELETE TO authenticated USING (true);

-- Deposits table
CREATE TABLE public.deposits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  username text NOT NULL DEFAULT '',
  amount bigint NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'qris',
  trx_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deposits viewable by everyone" ON public.deposits FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create deposits" ON public.deposits FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated can update deposits" ON public.deposits FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete deposits" ON public.deposits FOR DELETE TO authenticated USING (true);

-- Enable realtime for deposits
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposits;

-- Insert default settings
INSERT INTO public.admin_settings (setting_key, setting_value) VALUES
  ('qris_url', ''),
  ('ewallet_name', 'DANA'),
  ('ewallet_number', '08123456789');
