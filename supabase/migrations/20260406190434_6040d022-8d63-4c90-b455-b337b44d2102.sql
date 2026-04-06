
-- Music storage vouchers (admin creates, user redeems for storage)
CREATE TABLE public.music_storage_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  storage_mb BIGINT NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.music_storage_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Storage vouchers viewable by everyone" ON public.music_storage_vouchers FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert storage vouchers" ON public.music_storage_vouchers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update storage vouchers" ON public.music_storage_vouchers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete storage vouchers" ON public.music_storage_vouchers FOR DELETE TO authenticated USING (true);

-- Music discount vouchers (separate from product discount vouchers)
CREATE TABLE public.music_discount_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.music_discount_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Music discount vouchers viewable by everyone" ON public.music_discount_vouchers FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert music discount vouchers" ON public.music_discount_vouchers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update music discount vouchers" ON public.music_discount_vouchers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete music discount vouchers" ON public.music_discount_vouchers FOR DELETE TO authenticated USING (true);

-- Track redeemed storage vouchers per user
CREATE TABLE public.user_music_storage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  storage_mb BIGINT NOT NULL DEFAULT 0,
  voucher_code TEXT NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.user_music_storage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User music storage viewable by everyone" ON public.user_music_storage FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert user music storage" ON public.user_music_storage FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admin can delete user music storage" ON public.user_music_storage FOR DELETE TO authenticated USING (true);
