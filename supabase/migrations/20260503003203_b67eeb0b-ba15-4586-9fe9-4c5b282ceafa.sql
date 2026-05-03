-- Tracking diskon harian per paket spin Normal (Luck Royale Nyawa)
CREATE TABLE IF NOT EXISTS public.luck_normal_pack_discount_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  visitor_id text,
  user_balance_id uuid,
  day_wib date NOT NULL,
  pack_count integer NOT NULL,
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_key, day_wib, pack_count)
);

ALTER TABLE public.luck_normal_pack_discount_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read pack discount usage"
ON public.luck_normal_pack_discount_usage FOR SELECT USING (true);

CREATE POLICY "service role manages pack discount usage"
ON public.luck_normal_pack_discount_usage FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_luck_normal_pack_discount_account_day
  ON public.luck_normal_pack_discount_usage (account_key, day_wib);