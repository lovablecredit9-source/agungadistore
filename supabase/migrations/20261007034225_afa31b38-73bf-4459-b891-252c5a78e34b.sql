DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.purchase_game_credits(text,uuid,text,text,text)'::regprocedure);
  d := replace(d, E'END), trx, p_ref);', E'END), trx, p_ref) RETURNING trx_id INTO trx;');
  EXECUTE d;
END $$;
REVOKE ALL ON FUNCTION public.purchase_game_credits(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_game_credits(text, uuid, text, text, text) TO service_role;