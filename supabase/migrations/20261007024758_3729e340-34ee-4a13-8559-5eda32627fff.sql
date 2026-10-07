DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.purchase_music_storage(text,uuid,text,text,text)'::regprocedure);
  d := replace(d, '''FM999G999G999''', '''FM999,999,999''');
  d := regexp_replace(d, 'to_char\(([a-z_]+),''FM999,999,999''\)', 'replace(to_char(\1,''FM999,999,999''),'','',''.'')', 'g');
  EXECUTE d;
END $$;