DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.purchase_game_credits(text,uuid,text,text,text)'::regprocedure);
  d := replace(d, E'SELECT * INTO prev FROM balance_transactions WHERE purchase_ref = p_ref;\n  IF prev IS NOT NULL THEN', E'SELECT * INTO prev FROM balance_transactions WHERE purchase_ref = p_ref;\n  IF FOUND THEN');
  d := replace(d, 'IF ub IS NULL THEN', 'IF ub.id IS NULL THEN');
  EXECUTE d;
  d := pg_get_functiondef('public.purchase_music_storage(text,uuid,text,text,text)'::regprocedure);
  d := replace(d, 'IF existing IS NOT NULL THEN', 'IF existing.id IS NOT NULL THEN');
  d := replace(d, 'IF gb IS NULL AND ub IS NULL THEN', 'IF gb.id IS NULL AND ub.id IS NULL THEN');
  EXECUTE d;
END $$;
REVOKE ALL ON FUNCTION public.purchase_game_credits(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_game_credits(text, uuid, text, text, text) TO service_role;