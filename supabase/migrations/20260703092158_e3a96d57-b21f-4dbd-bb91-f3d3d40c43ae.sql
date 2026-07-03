CREATE TABLE public.balance_name_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  old_username TEXT,
  new_username TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_balance_name_changes_visitor ON public.balance_name_changes (visitor_id, changed_at);
GRANT SELECT ON public.balance_name_changes TO authenticated;
GRANT ALL ON public.balance_name_changes TO service_role;
ALTER TABLE public.balance_name_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages name changes" ON public.balance_name_changes FOR ALL USING (false) WITH CHECK (false);