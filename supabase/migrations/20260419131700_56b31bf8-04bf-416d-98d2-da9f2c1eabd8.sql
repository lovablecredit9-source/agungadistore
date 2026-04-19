
-- 1. Tambahkan kolom user_balance_id ke game_profiles untuk mengikat gem ke akun balance
ALTER TABLE public.game_profiles
  ADD COLUMN IF NOT EXISTS user_balance_id uuid REFERENCES public.user_balances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_game_profiles_user_balance_id
  ON public.game_profiles(user_balance_id);

-- 2. Isi user_balance_id berdasarkan login pertama setiap visitor_id
UPDATE public.game_profiles gp
SET user_balance_id = sub.user_balance_id
FROM (
  SELECT DISTINCT ON (visitor_id) visitor_id, user_balance_id
  FROM public.balance_login_history
  ORDER BY visitor_id, logged_in_at ASC
) sub
WHERE gp.visitor_id = sub.visitor_id
  AND gp.user_balance_id IS NULL;

-- 3. Konsolidasi: pindahkan semua gem ke 1 game_profile per user_balance_id (yang paling awal dibuat)
WITH primary_profiles AS (
  SELECT DISTINCT ON (user_balance_id) id AS primary_id, user_balance_id
  FROM public.game_profiles
  WHERE user_balance_id IS NOT NULL
  ORDER BY user_balance_id, created_at ASC
),
totals AS (
  SELECT gp.user_balance_id, SUM(gp.gems)::int AS total_gems
  FROM public.game_profiles gp
  WHERE gp.user_balance_id IS NOT NULL
  GROUP BY gp.user_balance_id
)
UPDATE public.game_profiles gp
SET gems = CASE
  WHEN gp.id = pp.primary_id THEN t.total_gems
  ELSE 0
END
FROM primary_profiles pp
JOIN totals t ON t.user_balance_id = pp.user_balance_id
WHERE gp.user_balance_id = pp.user_balance_id;

-- 4. Ganti fungsi get_account_gems agar hanya menjumlah gem dari game_profiles
--    yang terikat ke user_balance_id dari akun yang sedang aktif login pada visitor_id ini.
--    Jika visitor_id belum pernah login ke akun balance manapun, fallback ke gem visitor_id sendiri.
CREATE OR REPLACE FUNCTION public.get_account_gems(p_visitor_id text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH active_account AS (
    SELECT user_balance_id
    FROM public.balance_login_history
    WHERE visitor_id = p_visitor_id
    ORDER BY logged_in_at DESC
    LIMIT 1
  )
  SELECT CASE
    WHEN (SELECT user_balance_id FROM active_account) IS NOT NULL THEN
      COALESCE((
        SELECT SUM(gp.gems)::int
        FROM public.game_profiles gp
        WHERE gp.user_balance_id = (SELECT user_balance_id FROM active_account)
      ), 0)
    ELSE
      COALESCE((
        SELECT gems FROM public.game_profiles WHERE visitor_id = p_visitor_id LIMIT 1
      ), 0)
  END;
$function$;

-- 5. Helper: dapatkan user_balance_id aktif untuk visitor
CREATE OR REPLACE FUNCTION public.get_active_user_balance_id(p_visitor_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT user_balance_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC
  LIMIT 1;
$function$;

-- 6. Trigger: setiap kali balance_login_history baru dimasukkan, set user_balance_id
--    pada game_profile visitor tersebut agar gem-nya mengikuti akun yang baru login.
CREATE OR REPLACE FUNCTION public.sync_game_profile_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.game_profiles
  SET user_balance_id = NEW.user_balance_id
  WHERE visitor_id = NEW.visitor_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_game_profile_balance ON public.balance_login_history;
CREATE TRIGGER trg_sync_game_profile_balance
AFTER INSERT ON public.balance_login_history
FOR EACH ROW
EXECUTE FUNCTION public.sync_game_profile_balance();
