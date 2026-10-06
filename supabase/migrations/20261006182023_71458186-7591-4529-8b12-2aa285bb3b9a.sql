CREATE OR REPLACE FUNCTION public.trg_testimoni_deposit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status IN ('paid', 'approved') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.tg_testimoni_notify(jsonb_build_object(
      'kind','deposit','visitor_id',NEW.visitor_id,'amount',NEW.amount,
      'product', COALESCE(NEW.payment_method,'Deposit')
    ));
  END IF;
  RETURN NEW;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.trg_testimoni_deposit() FROM PUBLIC, anon, authenticated;