
-- Create payment-images storage bucket for QRIS uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-images', 'payment-images', true);

-- Allow anyone to view payment images
CREATE POLICY "Payment images viewable by everyone" ON storage.objects FOR SELECT TO public USING (bucket_id = 'payment-images');

-- Allow authenticated users to upload payment images
CREATE POLICY "Authenticated can upload payment images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-images');

-- Allow authenticated users to update payment images
CREATE POLICY "Authenticated can update payment images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'payment-images');

-- Allow authenticated users to delete payment images
CREATE POLICY "Authenticated can delete payment images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-images');

-- Add ewallets setting (JSON array) - insert only if not exists
INSERT INTO public.admin_settings (setting_key, setting_value)
VALUES ('ewallets', '[{"name":"DANA","number":"08123456789"}]')
ON CONFLICT (setting_key) DO NOTHING;
