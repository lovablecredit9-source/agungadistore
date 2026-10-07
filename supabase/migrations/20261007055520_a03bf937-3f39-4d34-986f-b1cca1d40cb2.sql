DO $$ DECLARE d text; f text; BEGIN
  FOREACH f IN ARRAY ARRAY['public.purchase_bundle_atomic(text,uuid,text,text)', 'public.purchase_streak_plan_atomic(text,uuid,text,text,text)'] LOOP
    d := pg_get_functiondef(f::regprocedure);
    IF position('RETURNING trx_id INTO trx' in d) = 0 THEN
      d := replace(d, '), trx, p_ref);', '), trx, p_ref) RETURNING trx_id INTO trx;');
      EXECUTE d;
    END IF;
  END LOOP;
END $$;