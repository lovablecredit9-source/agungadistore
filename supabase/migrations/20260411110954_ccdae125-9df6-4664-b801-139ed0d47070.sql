
DROP POLICY IF EXISTS "Authenticated can manage settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Authenticated can update settings" ON public.admin_settings;

CREATE POLICY "Anyone can insert settings" ON public.admin_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update settings" ON public.admin_settings FOR UPDATE TO anon, authenticated USING (true);
