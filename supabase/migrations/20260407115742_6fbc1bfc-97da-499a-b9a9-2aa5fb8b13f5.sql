
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS wa_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram text DEFAULT '',
  ADD COLUMN IF NOT EXISTS facebook text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tiktok text DEFAULT '',
  ADD COLUMN IF NOT EXISTS twitter text DEFAULT '',
  ADD COLUMN IF NOT EXISTS threads text DEFAULT '';

CREATE TABLE IF NOT EXISTS public.sponsor_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  image_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sponsor images viewable by everyone" ON public.sponsor_images FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert sponsor images" ON public.sponsor_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can delete sponsor images" ON public.sponsor_images FOR DELETE TO authenticated USING (true);
CREATE POLICY "Admin can update sponsor images" ON public.sponsor_images FOR UPDATE TO authenticated USING (true);
