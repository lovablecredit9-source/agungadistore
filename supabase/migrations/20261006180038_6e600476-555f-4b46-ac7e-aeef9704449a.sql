-- 1) add_account_gems: row lock + deduction across all profiles of the account
CREATE OR REPLACE FUNCTION public.add_account_gems(p_visitor_id text, p_amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_ub_id uuid;
  v_target_id uuid;
  v_current integer;
  v_total integer;
  v_need integer;
  r record;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RETURN public.get_account_gems(p_visitor_id);
  END IF;

  SELECT user_balance_id INTO v_ub_id FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id ORDER BY logged_in_at DESC LIMIT 1;

  IF p_amount > 0 THEN
    IF v_ub_id IS NOT NULL THEN
      SELECT id, COALESCE(gems,0) INTO v_target_id, v_current FROM public.game_profiles
      WHERE user_balance_id = v_ub_id ORDER BY created_at ASC LIMIT 1 FOR UPDATE;
      IF v_target_id IS NULL THEN
        INSERT INTO public.game_profiles (visitor_id, display_name, user_balance_id, gems)
        VALUES (p_visitor_id, 'Anonim', v_ub_id, p_amount) RETURNING gems INTO v_current;
        RETURN v_current;
      END IF;
    ELSE
      SELECT id, COALESCE(gems,0) INTO v_target_id, v_current FROM public.game_profiles
      WHERE visitor_id = p_visitor_id LIMIT 1 FOR UPDATE;
      IF v_target_id IS NULL THEN
        INSERT INTO public.game_profiles (visitor_id, display_name, gems)
        VALUES (p_visitor_id, 'Anonim', p_amount) RETURNING gems INTO v_current;
        RETURN v_current;
      END IF;
    END IF;
    UPDATE public.game_profiles SET gems = v_current + p_amount WHERE id = v_target_id;
    RETURN v_current + p_amount;
  END IF;

  -- Deduction: resolve the same account that get_account_gems reports
  IF v_ub_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.game_profiles WHERE user_balance_id = v_ub_id AND COALESCE(gems,0) > 0) THEN
    v_ub_id := COALESCE((SELECT user_balance_id FROM public.game_profiles WHERE visitor_id = p_visitor_id AND user_balance_id IS NOT NULL LIMIT 1), v_ub_id);
  END IF;

  v_need := -p_amount;
  IF v_ub_id IS NOT NULL THEN
    PERFORM 1 FROM public.game_profiles WHERE user_balance_id = v_ub_id FOR UPDATE;
    SELECT COALESCE(SUM(gems),0)::int INTO v_total FROM public.game_profiles WHERE user_balance_id = v_ub_id;
    IF v_total < v_need THEN
      RAISE EXCEPTION 'INSUFFICIENT_GEMS: have=%, need=%', v_total, v_need USING ERRCODE = 'P0001';
    END IF;
    FOR r IN SELECT id, COALESCE(gems,0) AS g FROM public.game_profiles
             WHERE user_balance_id = v_ub_id AND COALESCE(gems,0) > 0 ORDER BY created_at ASC LOOP
      EXIT WHEN v_need <= 0;
      UPDATE public.game_profiles SET gems = r.g - LEAST(r.g, v_need) WHERE id = r.id;
      v_need := v_need - LEAST(r.g, v_need);
    END LOOP;
    RETURN v_total + p_amount;
  END IF;

  SELECT id, COALESCE(gems,0) INTO v_target_id, v_current FROM public.game_profiles
  WHERE visitor_id = p_visitor_id LIMIT 1 FOR UPDATE;
  IF v_target_id IS NULL OR v_current < v_need THEN
    RAISE EXCEPTION 'INSUFFICIENT_GEMS: have=%, need=%', COALESCE(v_current,0), v_need USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.game_profiles SET gems = v_current - v_need WHERE id = v_target_id;
  RETURN v_current - v_need;
END;
$function$;

-- 2) Currency mutators: server (service role) only
REVOKE EXECUTE ON FUNCTION public.add_account_gems(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_account_credits(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_bonus_balance(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_balance_with_bonus(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_main_balance_only(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_main_balance_only(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_account_gems(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_account_credits(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_bonus_balance(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_balance_with_bonus(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_main_balance_only(uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_main_balance_only(uuid, bigint) TO service_role;

-- 3) Top-up bonus: admins or server only
CREATE OR REPLACE FUNCTION public.add_topup_bonus_to_saldo_in(p_visitor_id text, p_amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_new integer;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN 0; END IF;
  INSERT INTO public.game_balance (visitor_id, amount, total_earned)
  VALUES (p_visitor_id, p_amount, p_amount)
  ON CONFLICT (visitor_id) DO UPDATE
    SET amount = public.game_balance.amount + EXCLUDED.amount,
        total_earned = public.game_balance.total_earned + EXCLUDED.total_earned,
        updated_at = now()
  RETURNING amount INTO v_new;
  INSERT INTO public.game_balance_transactions (visitor_id, type, amount, description)
  VALUES (p_visitor_id, 'bonus', p_amount, '🎁 Bonus 10% top-up saldo');
  RETURN v_new;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.add_topup_bonus_to_saldo_in(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_topup_bonus_to_saldo_in(text, integer) TO authenticated, service_role;

-- 4) Deduct-only gem spend (client booster purchase)
CREATE OR REPLACE FUNCTION public.spend_account_gems(p_visitor_id text, p_amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = '22023';
  END IF;
  RETURN public.add_account_gems(p_visitor_id, -p_amount);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.spend_account_gems(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_account_gems(text, integer) TO anon, authenticated, service_role;

-- 5) Reward inbox: single atomic claim, no client-side "unclaim"
DROP POLICY IF EXISTS "Anyone can update reward inbox" ON public.profile_reward_inbox;
CREATE UNIQUE INDEX IF NOT EXISTS profile_reward_inbox_once ON public.profile_reward_inbox (visitor_id, source, title);

CREATE OR REPLACE FUNCTION public.claim_profile_reward(p_reward_id uuid, p_visitor_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE r record; v_amount integer;
BEGIN
  UPDATE public.profile_reward_inbox SET claimed = true, claimed_at = now()
  WHERE id = p_reward_id AND visitor_id = p_visitor_id AND claimed = false
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hadiah tidak tersedia atau sudah diklaim');
  END IF;
  IF r.source NOT IN ('level', 'achievement') THEN
    RAISE EXCEPTION 'INVALID_REWARD_SOURCE';
  END IF;
  IF r.reward_type = 'gem' THEN
    v_amount := LEAST(GREATEST(COALESCE(r.reward_amount,0),0), 600)::int;
    PERFORM public.add_account_gems(p_visitor_id, v_amount);
  ELSE
    v_amount := LEAST(GREATEST(COALESCE(r.reward_amount,0),0), 15000)::int;
    PERFORM public.add_account_credits(p_visitor_id, v_amount);
  END IF;
  RETURN jsonb_build_object('ok', true, 'amount', v_amount, 'type', r.reward_type);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.claim_profile_reward(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_profile_reward(uuid, text) TO anon, authenticated, service_role;