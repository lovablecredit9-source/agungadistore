ALTER TABLE public.luck_discount_vouchers
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS duration_hours integer,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_uses integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.luck_discount_vouchers v
SET duration_hours = COALESCE(v.duration_hours, p.duration_hours)
FROM public.luck_discount_packages p
WHERE v.package_id = p.id AND v.duration_hours IS NULL;

UPDATE public.luck_discount_vouchers
SET duration_hours = 24
WHERE duration_hours IS NULL;

UPDATE public.luck_discount_vouchers
SET code = 'LR-' || upper(substr(replace(id::text, '-', ''), 1, 12))
WHERE code IS NULL;

ALTER TABLE public.luck_discount_vouchers
  ALTER COLUMN code SET NOT NULL,
  ALTER COLUMN duration_hours SET DEFAULT 24,
  ALTER COLUMN duration_hours SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS luck_discount_vouchers_code_unique
  ON public.luck_discount_vouchers (code);
CREATE INDEX IF NOT EXISTS luck_discount_vouchers_active_idx
  ON public.luck_discount_vouchers (visitor_id, active_expires_at DESC);
