CREATE TABLE public.lucky_draw_promo_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  promo_code TEXT NOT NULL,
  claim_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, promo_code, claim_date)
);
GRANT ALL ON public.lucky_draw_promo_claims TO service_role;
ALTER TABLE public.lucky_draw_promo_claims ENABLE ROW LEVEL SECURITY;