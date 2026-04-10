CREATE TABLE public.admin_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  image_url TEXT,
  link_url TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  instagram TEXT DEFAULT '',
  tiktok TEXT DEFAULT '',
  youtube TEXT DEFAULT '',
  twitter TEXT DEFAULT '',
  facebook TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts viewable by everyone"
ON public.admin_posts FOR SELECT
TO public
USING (true);

CREATE POLICY "Admin can insert posts"
ON public.admin_posts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admin can update posts"
ON public.admin_posts FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admin can delete posts"
ON public.admin_posts FOR DELETE
TO authenticated
USING (true);