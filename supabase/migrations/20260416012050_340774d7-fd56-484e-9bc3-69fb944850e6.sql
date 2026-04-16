
-- Table for WA bot pricing packages
CREATE TABLE public.wa_bot_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  duration_hours integer NOT NULL DEFAULT 1,
  price bigint NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_bot_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WA bot packages viewable by everyone" ON public.wa_bot_packages FOR SELECT USING (true);
CREATE POLICY "Admin can insert wa bot packages" ON public.wa_bot_packages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update wa bot packages" ON public.wa_bot_packages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete wa bot packages" ON public.wa_bot_packages FOR DELETE TO authenticated USING (true);

-- Table for WA bot subscriptions
CREATE TABLE public.wa_bot_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  package_id uuid REFERENCES public.wa_bot_packages(id) ON DELETE SET NULL,
  bot_name text NOT NULL DEFAULT 'My Bot',
  status text NOT NULL DEFAULT 'pending',
  price_paid bigint NOT NULL DEFAULT 0,
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  qr_code_url text,
  session_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_bot_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WA bot subscriptions viewable by everyone" ON public.wa_bot_subscriptions FOR SELECT USING (true);
CREATE POLICY "Anyone can create wa bot subscriptions" ON public.wa_bot_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own wa bot subscriptions" ON public.wa_bot_subscriptions FOR UPDATE USING (true);
CREATE POLICY "Admin can delete wa bot subscriptions" ON public.wa_bot_subscriptions FOR DELETE TO authenticated USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_wa_bot_packages_updated_at BEFORE UPDATE ON public.wa_bot_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wa_bot_subscriptions_updated_at BEFORE UPDATE ON public.wa_bot_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
