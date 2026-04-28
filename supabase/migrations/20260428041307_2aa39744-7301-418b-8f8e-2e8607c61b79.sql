-- Tambah kolom visitor_id ke discount_vouchers untuk voucher milik user spesifik
ALTER TABLE public.discount_vouchers
  ADD COLUMN IF NOT EXISTS visitor_id text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_discount_vouchers_visitor ON public.discount_vouchers(visitor_id) WHERE visitor_id IS NOT NULL;

-- RLS: izinkan user lihat voucher milik mereka sendiri (selain voucher publik)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='discount_vouchers' AND policyname='Anyone can read active vouchers') THEN
    ALTER TABLE public.discount_vouchers ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Anyone can read active vouchers" ON public.discount_vouchers
      FOR SELECT USING (true);
  END IF;
END $$;

-- Function: generate voucher follow (Rp 1.000, 30 hari, 1x pakai)
CREATE OR REPLACE FUNCTION public.generate_follow_voucher(p_visitor_id text)
RETURNS TABLE(code text, discount_amount bigint, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing record;
  v_code text;
  v_expires timestamptz;
BEGIN
  -- Cek apakah user sudah punya voucher follow yg masih aktif & belum dipakai
  SELECT dv.code, dv.discount_amount, dv.expires_at INTO v_existing
  FROM public.discount_vouchers dv
  WHERE dv.visitor_id = p_visitor_id
    AND dv.source = 'follow_store'
    AND dv.is_active = true
    AND dv.used_count < dv.max_uses
    AND (dv.expires_at IS NULL OR dv.expires_at > now())
  ORDER BY dv.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing.code, v_existing.discount_amount, v_existing.expires_at;
    RETURN;
  END IF;

  -- Generate kode unik FOLLOW-XXXXXX
  LOOP
    v_code := 'FOLLOW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.discount_vouchers WHERE code = v_code);
  END LOOP;

  v_expires := now() + interval '30 days';

  INSERT INTO public.discount_vouchers (code, discount_amount, max_uses, used_count, is_active, expires_at, visitor_id, source)
  VALUES (v_code, 1000, 1, 0, true, v_expires, p_visitor_id, 'follow_store');

  RETURN QUERY SELECT v_code, 1000::bigint, v_expires;
END;
$$;