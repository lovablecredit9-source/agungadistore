
CREATE TABLE public.password_reset_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  token TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can create password reset tokens" ON public.password_reset_tokens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can delete password reset tokens" ON public.password_reset_tokens FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anyone can update password reset tokens" ON public.password_reset_tokens FOR UPDATE TO public USING (true);
CREATE POLICY "Password reset tokens viewable by everyone" ON public.password_reset_tokens FOR SELECT TO public USING (true);
