-- Konsolidasi subscription power pack yang stack: gabungkan jadi 1 row per (visitor, pack)
-- Ambil sub paling awal (created_at ASC) sebagai "primary", set expires_at = expires_at terjauh, nonaktifkan sisanya
WITH active_subs AS (
  SELECT id, visitor_id, pack_id, expires_at, created_at, starts_at,
    ROW_NUMBER() OVER (PARTITION BY visitor_id, pack_id ORDER BY created_at ASC) AS rn,
    MAX(expires_at) OVER (PARTITION BY visitor_id, pack_id) AS max_expires
  FROM public.streak_power_pack_subscriptions
  WHERE is_active = true AND expires_at > now()
),
primaries AS (
  SELECT id, max_expires FROM active_subs WHERE rn = 1
),
duplicates AS (
  SELECT id FROM active_subs WHERE rn > 1
)
UPDATE public.streak_power_pack_subscriptions s
SET expires_at = p.max_expires
FROM primaries p
WHERE s.id = p.id AND s.expires_at <> p.max_expires;

-- Nonaktifkan sub duplikat
UPDATE public.streak_power_pack_subscriptions
SET is_active = false
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY visitor_id, pack_id ORDER BY created_at ASC) AS rn
    FROM public.streak_power_pack_subscriptions
    WHERE is_active = true AND expires_at > now()
  ) t WHERE rn > 1
);