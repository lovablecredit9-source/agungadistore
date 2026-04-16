
INSERT INTO storage.buckets (id, name, public) VALUES ('social-icons', 'social-icons', true);

CREATE POLICY "Social icons viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-icons');

CREATE POLICY "Admin can upload social icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'social-icons');

CREATE POLICY "Admin can update social icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'social-icons');

CREATE POLICY "Admin can delete social icons"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'social-icons');

-- Add RLS policies for admin to manage social_links table
CREATE POLICY "Admin can insert social links"
ON public.social_links FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admin can update social links"
ON public.social_links FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admin can delete social links"
ON public.social_links FOR DELETE
TO authenticated
USING (true);
