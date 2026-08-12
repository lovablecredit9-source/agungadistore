CREATE TABLE public.lucky_royale_prize_vouchers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  category text NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  value integer NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'days',
  max_uses integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'lucky_royale',
  expires_at timestamp with time zone,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_lrpv_visitor ON public.lucky_royale_prize_vouchers (visitor_id, created_at DESC);
GRANT SELECT ON public.lucky_royale_prize_vouchers TO anon, authenticated;
GRANT ALL ON public.lucky_royale_prize_vouchers TO service_role;
ALTER TABLE public.lucky_royale_prize_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prize vouchers readable" ON public.lucky_royale_prize_vouchers FOR SELECT USING (true);