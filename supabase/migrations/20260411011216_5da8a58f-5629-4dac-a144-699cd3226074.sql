
-- Streak discount vouchers (separate from product vouchers)
CREATE TABLE public.streak_discount_vouchers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_amount bigint NOT NULL DEFAULT 0,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_discount_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Streak discount vouchers viewable by everyone" ON public.streak_discount_vouchers FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert streak discount vouchers" ON public.streak_discount_vouchers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update streak discount vouchers" ON public.streak_discount_vouchers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete streak discount vouchers" ON public.streak_discount_vouchers FOR DELETE TO authenticated USING (true);

-- Game discount vouchers (separate from product vouchers)
CREATE TABLE public.game_discount_vouchers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_amount bigint NOT NULL DEFAULT 0,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.game_discount_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game discount vouchers viewable by everyone" ON public.game_discount_vouchers FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert game discount vouchers" ON public.game_discount_vouchers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update game discount vouchers" ON public.game_discount_vouchers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete game discount vouchers" ON public.game_discount_vouchers FOR DELETE TO authenticated USING (true);
