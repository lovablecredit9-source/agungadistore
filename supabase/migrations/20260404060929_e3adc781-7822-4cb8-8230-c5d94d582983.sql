
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  related_id TEXT
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications viewable by everyone" ON public.notifications FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create notifications" ON public.notifications FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update own notifications" ON public.notifications FOR UPDATE TO public USING (true);
CREATE POLICY "Admin can delete notifications" ON public.notifications FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
