
-- Tabel pengikut toko (single store: Agung Adi Store)
CREATE TABLE IF NOT EXISTS public.store_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_balance_id UUID NOT NULL,
  visitor_id TEXT,
  username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_balance_id)
);

ALTER TABLE public.store_followers ENABLE ROW LEVEL SECURITY;

-- Semua orang bisa lihat daftar pengikut (untuk hitung total & nama)
CREATE POLICY "Anyone can view followers"
ON public.store_followers FOR SELECT
USING (true);

-- Insert/delete diizinkan publik (kontrol dilakukan via aplikasi: wajib login saldo)
CREATE POLICY "Anyone can follow"
ON public.store_followers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can unfollow own"
ON public.store_followers FOR DELETE
USING (true);

CREATE INDEX IF NOT EXISTS idx_store_followers_balance ON public.store_followers(user_balance_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_followers;
