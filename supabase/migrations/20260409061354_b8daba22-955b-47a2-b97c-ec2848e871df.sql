
-- Add email and password_hash to user_balances
ALTER TABLE public.user_balances 
ADD COLUMN IF NOT EXISTS email text DEFAULT '',
ADD COLUMN IF NOT EXISTS password_hash text DEFAULT '';

-- Create balance login history table
CREATE TABLE public.balance_login_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_balance_id uuid REFERENCES public.user_balances(id) ON DELETE CASCADE NOT NULL,
  visitor_id text NOT NULL,
  device_info text,
  browser text,
  ip_address text,
  logged_in_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.balance_login_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Login history viewable by everyone"
ON public.balance_login_history FOR SELECT
TO public USING (true);

CREATE POLICY "Anyone can insert login history"
ON public.balance_login_history FOR INSERT
TO public WITH CHECK (true);

CREATE POLICY "Admin can delete login history"
ON public.balance_login_history FOR DELETE
TO authenticated USING (true);
