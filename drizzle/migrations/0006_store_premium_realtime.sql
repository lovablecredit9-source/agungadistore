DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='store_premium_subscriptions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.store_premium_subscriptions;
  END IF;
END $$;