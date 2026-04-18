-- Fungsi: total gem aktif berdasarkan visitor_id device
-- Cara kerja: cari user_balance_id dari visitor ini, lalu jumlahkan gem dari SEMUA visitor (device) yang pernah login pakai akun saldo yang sama
CREATE OR REPLACE FUNCTION public.get_account_gems(p_visitor_id text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_account AS (
    SELECT user_balance_id
    FROM balance_login_history
    WHERE visitor_id = p_visitor_id
    ORDER BY logged_in_at DESC
    LIMIT 1
  ),
  all_device_visitors AS (
    SELECT DISTINCT visitor_id
    FROM balance_login_history
    WHERE user_balance_id = (SELECT user_balance_id FROM active_account)
    UNION
    SELECT p_visitor_id
  )
  SELECT COALESCE(SUM(gp.gems), 0)::int
  FROM game_profiles gp
  WHERE gp.visitor_id IN (SELECT visitor_id FROM all_device_visitors);
$$;

GRANT EXECUTE ON FUNCTION public.get_account_gems(text) TO anon, authenticated;