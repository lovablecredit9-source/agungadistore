CREATE OR REPLACE FUNCTION public.get_account_gems(p_visitor_id text)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ub_id uuid;
  v_total integer;
BEGIN
  -- 1) Coba ambil akun aktif terakhir dari balance_login_history
  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC
  LIMIT 1;

  -- Jika ada akun aktif, jumlahkan gem dari semua profile dalam akun itu
  IF v_ub_id IS NOT NULL THEN
    SELECT COALESCE(SUM(gems), 0)::int INTO v_total
    FROM public.game_profiles
    WHERE user_balance_id = v_ub_id;

    -- Jika akun tersebut punya gem, kembalikan
    IF COALESCE(v_total, 0) > 0 THEN
      RETURN v_total;
    END IF;
  END IF;

  -- 2) Fallback: cek profil game milik visitor; jika terhubung ke user_balance lain yang punya gem, pakai itu
  SELECT user_balance_id INTO v_ub_id
  FROM public.game_profiles
  WHERE visitor_id = p_visitor_id
  LIMIT 1;

  IF v_ub_id IS NOT NULL THEN
    SELECT COALESCE(SUM(gems), 0)::int INTO v_total
    FROM public.game_profiles
    WHERE user_balance_id = v_ub_id;
    RETURN COALESCE(v_total, 0);
  END IF;

  -- 3) Fallback final: hanya gem profil visitor sendiri
  SELECT COALESCE(gems, 0) INTO v_total
  FROM public.game_profiles
  WHERE visitor_id = p_visitor_id
  LIMIT 1;

  RETURN COALESCE(v_total, 0);
END;
$function$;