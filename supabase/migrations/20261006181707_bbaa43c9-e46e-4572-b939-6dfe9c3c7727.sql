CREATE OR REPLACE FUNCTION public.trg_testimoni_premium()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.tg_testimoni_notify(jsonb_build_object(
    'kind','membership','visitor_id',NEW.visitor_id,'amount', COALESCE(NEW.price_paid,0),
    'product','Membership Premium Toko','extra', COALESCE(NEW.plan_name,'')
  ));
  RETURN NEW;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.trg_testimoni_premium() FROM PUBLIC, anon, authenticated;