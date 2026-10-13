DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.bot_rental_purchase'::regproc);
  d := replace(d, 'DECLARE ub record; pl record; r record; v record; ex record;', 'DECLARE ub record; pl public.bot_rental_plans%ROWTYPE; r public.bot_rentals%ROWTYPE; v public.bot_vouchers%ROWTYPE; ex record;');
  EXECUTE d;
  d := pg_get_functiondef('public.bot_rental_quote'::regproc);
  d := replace(d, 'DECLARE pl record; v record;', 'DECLARE pl public.bot_rental_plans%ROWTYPE; v public.bot_vouchers%ROWTYPE;');
  EXECUTE d;
END $$;
REVOKE ALL ON FUNCTION public.bot_rental_purchase(uuid,text,text,int,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_rental_quote(uuid,text,text,int,text) FROM PUBLIC, anon, authenticated;