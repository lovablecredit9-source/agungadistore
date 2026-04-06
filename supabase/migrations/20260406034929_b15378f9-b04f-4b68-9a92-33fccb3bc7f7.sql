
-- Discount vouchers table
CREATE TABLE public.discount_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Discount vouchers viewable by everyone" ON public.discount_vouchers FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert discount vouchers" ON public.discount_vouchers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update discount vouchers" ON public.discount_vouchers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete discount vouchers" ON public.discount_vouchers FOR DELETE TO authenticated USING (true);

-- User PINs table
CREATE TABLE public.user_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pins viewable by everyone" ON public.user_pins FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create pin" ON public.user_pins FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update own pin" ON public.user_pins FOR UPDATE TO public USING (true);

-- PIN reset tokens table
CREATE TABLE public.pin_reset_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.pin_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reset tokens viewable by everyone" ON public.pin_reset_tokens FOR SELECT TO public USING (true);
CREATE POLICY "Admin can create reset tokens" ON public.pin_reset_tokens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update reset tokens" ON public.pin_reset_tokens FOR UPDATE TO public USING (true);
CREATE POLICY "Admin can delete reset tokens" ON public.pin_reset_tokens FOR DELETE TO authenticated USING (true);
