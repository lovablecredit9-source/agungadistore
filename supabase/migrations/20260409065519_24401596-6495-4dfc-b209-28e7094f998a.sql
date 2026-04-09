
ALTER TABLE public.support_tickets 
ADD COLUMN category text NOT NULL DEFAULT 'lainnya',
ADD COLUMN screenshot_url text DEFAULT NULL;
