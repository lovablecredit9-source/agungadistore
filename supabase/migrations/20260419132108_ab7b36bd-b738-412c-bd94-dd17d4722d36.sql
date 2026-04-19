
CREATE OR REPLACE FUNCTION public.add_account_gems(p_visitor_id text, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ub_id uuid;
  v_target_id uuid;
  v_current integer;
  v_new integer;
BEGIN
  -- Cari user_balance_id aktif untuk visitor
  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC
  LIMIT 1;

  IF v_ub_id IS NOT NULL THEN
    -- Cari profil utama (paling awal) pada akun balance ini
    SELECT id, COALESCE(gems, 0) INTO v_target_id, v_current
    FROM public.game_profiles
    WHERE user_balance_id = v_ub_id
    ORDER BY created_at ASC
    LIMIT 1;

    -- Jika belum ada profil pada akun ini, buat untuk visitor saat ini
    IF v_target_id IS NULL THEN
      INSERT INTO public.game_profiles (visitor_id, display_name, user_balance_id, gems)
      VALUES (p_visitor_id, 'Anonim', v_ub_id, GREATEST(p_amount, 0))
      RETURNING id, gems INTO v_target_id, v_current;
      RETURN v_current;
    END IF;
  ELSE
    -- Belum login akun: pakai profil visitor sendiri
    SELECT id, COALESCE(gems, 0) INTO v_target_id, v_current
    FROM public.game_profiles
    WHERE visitor_id = p_visitor_id
    LIMIT 1;

    IF v_target_id IS NULL THEN
      INSERT INTO public.game_profiles (visitor_id, display_name, gems)
      VALUES (p_visitor_id, 'Anonim', GREATEST(p_amount, 0))
      RETURNING id, gems INTO v_target_id, v_current;
      RETURN v_current;
    END IF;
  END IF;

  v_new := v_current + p_amount;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_GEMS: have=%, need=%', v_current, -p_amount
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.game_profiles SET gems = v_new WHERE id = v_target_id;
  RETURN v_new;
END;
$$;
