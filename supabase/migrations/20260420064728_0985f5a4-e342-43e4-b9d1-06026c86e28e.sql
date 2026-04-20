-- Function to get total game credits across all visitor IDs linked to the same active balance account
CREATE OR REPLACE FUNCTION public.get_account_credits(p_visitor_id text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH active_account AS (
    SELECT user_balance_id
    FROM public.balance_login_history
    WHERE visitor_id = p_visitor_id
    ORDER BY logged_in_at DESC
    LIMIT 1
  ),
  account_visitors AS (
    SELECT DISTINCT visitor_id
    FROM public.balance_login_history
    WHERE user_balance_id = (SELECT user_balance_id FROM active_account)
      AND (SELECT user_balance_id FROM active_account) IS NOT NULL
  )
  SELECT CASE
    WHEN (SELECT user_balance_id FROM active_account) IS NOT NULL THEN
      COALESCE((
        SELECT SUM(ugc.credits)::int
        FROM public.user_game_credits ugc
        WHERE ugc.visitor_id IN (SELECT visitor_id FROM account_visitors)
      ), 0)
    ELSE
      COALESCE((
        SELECT credits FROM public.user_game_credits WHERE visitor_id = p_visitor_id LIMIT 1
      ), 0)
  END;
$$;

-- Function to add/deduct credits at account level (uses earliest visitor_id row in account, or the current visitor)
CREATE OR REPLACE FUNCTION public.add_account_credits(p_visitor_id text, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ub_id uuid;
  v_target_visitor text;
  v_current integer;
  v_new integer;
  v_total integer;
BEGIN
  SELECT user_balance_id INTO v_ub_id
  FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id
  ORDER BY logged_in_at DESC
  LIMIT 1;

  IF v_ub_id IS NOT NULL THEN
    -- Deduct: pull from existing rows in account that have credits
    IF p_amount < 0 THEN
      SELECT COALESCE(SUM(credits), 0) INTO v_total
      FROM public.user_game_credits
      WHERE visitor_id IN (
        SELECT DISTINCT visitor_id FROM public.balance_login_history WHERE user_balance_id = v_ub_id
      );
      IF v_total + p_amount < 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_CREDITS: have=%, need=%', v_total, -p_amount USING ERRCODE = 'P0001';
      END IF;
      -- Deduct from the row with most credits (simple approach: deduct from first available)
      SELECT visitor_id, credits INTO v_target_visitor, v_current
      FROM public.user_game_credits
      WHERE visitor_id IN (
        SELECT DISTINCT visitor_id FROM public.balance_login_history WHERE user_balance_id = v_ub_id
      ) AND credits >= -p_amount
      ORDER BY credits DESC
      LIMIT 1;
      
      IF v_target_visitor IS NULL THEN
        -- Fallback: deduct from current visitor row (may need to create)
        v_target_visitor := p_visitor_id;
      END IF;
    ELSE
      -- Add: prefer current visitor row, else earliest in account
      SELECT visitor_id, credits INTO v_target_visitor, v_current
      FROM public.user_game_credits
      WHERE visitor_id = p_visitor_id
      LIMIT 1;
      IF v_target_visitor IS NULL THEN
        SELECT ugc.visitor_id, ugc.credits INTO v_target_visitor, v_current
        FROM public.user_game_credits ugc
        WHERE ugc.visitor_id IN (
          SELECT DISTINCT visitor_id FROM public.balance_login_history WHERE user_balance_id = v_ub_id
        )
        ORDER BY ugc.created_at ASC
        LIMIT 1;
      END IF;
      IF v_target_visitor IS NULL THEN
        v_target_visitor := p_visitor_id;
      END IF;
    END IF;
  ELSE
    v_target_visitor := p_visitor_id;
    SELECT credits INTO v_current
    FROM public.user_game_credits WHERE visitor_id = p_visitor_id LIMIT 1;
    IF p_amount < 0 AND COALESCE(v_current, 0) + p_amount < 0 THEN
      RAISE EXCEPTION 'INSUFFICIENT_CREDITS: have=%, need=%', COALESCE(v_current, 0), -p_amount USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Upsert the target row
  SELECT credits INTO v_current FROM public.user_game_credits WHERE visitor_id = v_target_visitor LIMIT 1;
  IF v_current IS NULL THEN
    INSERT INTO public.user_game_credits (visitor_id, credits)
    VALUES (v_target_visitor, GREATEST(p_amount, 0));
    v_new := GREATEST(p_amount, 0);
  ELSE
    v_new := GREATEST(v_current + p_amount, 0);
    UPDATE public.user_game_credits SET credits = v_new, updated_at = now() WHERE visitor_id = v_target_visitor;
  END IF;

  -- Return total account credits
  IF v_ub_id IS NOT NULL THEN
    SELECT COALESCE(SUM(credits), 0)::int INTO v_total
    FROM public.user_game_credits
    WHERE visitor_id IN (
      SELECT DISTINCT visitor_id FROM public.balance_login_history WHERE user_balance_id = v_ub_id
    );
    RETURN v_total;
  ELSE
    RETURN v_new;
  END IF;
END;
$$;