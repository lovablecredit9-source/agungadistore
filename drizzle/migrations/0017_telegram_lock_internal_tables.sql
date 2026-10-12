REVOKE ALL ON public.telegram_delivery_log FROM anon, authenticated;
REVOKE ALL ON public.telegram_internal_secret FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notification_to_telegram() FROM anon, authenticated, public;