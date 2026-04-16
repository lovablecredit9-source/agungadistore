
CREATE TABLE public.social_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT,
  color_from TEXT NOT NULL DEFAULT '#3b82f6',
  color_to TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active social links"
ON public.social_links
FOR SELECT
USING (true);

INSERT INTO public.social_links (platform, label, url, icon_url, color_from, color_to, sort_order) VALUES
('whatsapp', 'WA: 085769302532', 'https://wa.me/6285769302532', 'https://cdn.jsdelivr.net/gh/nicehash/icons@latest/whatsapp.svg', '#22c55e', '#10b981', 1),
('youtube', 'channel mod agung adi', 'https://youtube.com/@channelmodagungadi', 'https://cdn.jsdelivr.net/gh/nicehash/icons@latest/youtube.svg', '#ef4444', '#e11d48', 2),
('twitter', '@agungadi981', 'https://twitter.com/agungadi981', 'https://cdn.jsdelivr.net/gh/nicehash/icons@latest/twitter.svg', '#38bdf8', '#06b6d4', 3),
('instagram', '@agungadi57', 'https://instagram.com/agungadi57', 'https://cdn.jsdelivr.net/gh/nicehash/icons@latest/instagram.svg', '#ec4899', '#d946ef', 4),
('tiktok', '@pphitampro9', 'https://tiktok.com/@pphitampro9', 'https://cdn.jsdelivr.net/gh/nicehash/icons@latest/tiktok.svg', '#374151', '#111827', 5);
