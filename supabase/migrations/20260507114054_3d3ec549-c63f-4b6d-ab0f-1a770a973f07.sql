
DROP TRIGGER IF EXISTS trg_auto_use_bonus_balance ON public.user_balances;
DROP FUNCTION IF EXISTS public.auto_use_bonus_balance();

CREATE OR REPLACE FUNCTION public.add_topup_bonus_to_saldo_in(
  p_visitor_id text,
  p_amount integer
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.game_balance (visitor_id, amount, total_earned)
  VALUES (p_visitor_id, p_amount, p_amount)
  ON CONFLICT (visitor_id) DO UPDATE
    SET amount = public.game_balance.amount + EXCLUDED.amount,
        total_earned = public.game_balance.total_earned + EXCLUDED.total_earned,
        updated_at = now()
  RETURNING amount INTO v_new;

  -- Catat transaksi game_balance
  INSERT INTO public.game_balance_transactions (visitor_id, type, amount, description)
  VALUES (p_visitor_id, 'bonus', p_amount, '🎁 Bonus 10% top-up saldo');

  RETURN v_new;
END;
$$;
