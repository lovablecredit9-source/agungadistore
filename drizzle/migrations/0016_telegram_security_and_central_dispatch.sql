-- 1) Lock Telegram tables: only edge functions (service role) touch them.
DROP POLICY IF EXISTS "Admin can view telegram config" ON public.telegram_bot_config;
DROP POLICY IF EXISTS "Admin can insert telegram config" ON public.telegram_bot_config;
DROP POLICY IF EXISTS "Admin can update telegram config" ON public.telegram_bot_config;
DROP POLICY IF EXISTS "Admin can delete telegram config" ON public.telegram_bot_config;
DROP POLICY IF EXISTS "Public can manage own link by visitor_id" ON public.telegram_user_links;
DROP POLICY IF EXISTS "read own test log" ON public.telegram_test_log;
REVOKE ALL ON public.telegram_bot_config FROM anon, authenticated;
REVOKE ALL ON public.telegram_user_links FROM anon, authenticated;
REVOKE ALL ON public.telegram_test_log FROM anon, authenticated;
GRANT ALL ON public.telegram_bot_config, public.telegram_user_links, public.telegram_test_log TO service_role;

-- 2) Connection health columns (real results only).
ALTER TABLE public.telegram_user_links
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_ok boolean;
ALTER TABLE public.telegram_test_log
  ADD COLUMN IF NOT EXISTS ok boolean,
  ADD COLUMN IF NOT EXISTS message_id bigint,
  ADD COLUMN IF NOT EXISTS error text;

-- 3) Delivery log: one row per event_key => idempotent sends.
CREATE TABLE IF NOT EXISTS public.telegram_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  visitor_id text,
  category text NOT NULL,
  source text,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  error_code integer,
  message_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT ALL ON public.telegram_delivery_log TO service_role;
ALTER TABLE public.telegram_delivery_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tg_delivery_visitor ON public.telegram_delivery_log(visitor_id, created_at DESC);

-- 4) Internal token so DB triggers can call telegram-notify without the service key.
CREATE TABLE IF NOT EXISTS public.telegram_internal_secret (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex')
);
GRANT ALL ON public.telegram_internal_secret TO service_role;
ALTER TABLE public.telegram_internal_secret ENABLE ROW LEVEL SECURITY;
INSERT INTO public.telegram_internal_secret(id) VALUES (true) ON CONFLICT DO NOTHING;

-- 5) Map an in-app notification to a Telegram category (NULL = not forwarded).
CREATE OR REPLACE FUNCTION public.tg_category_for_notification(p_type text, p_title text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_type IN ('password_reset','pin_reset') THEN NULL
    WHEN p_type LIKE 'deposit%' THEN 'deposit'
    WHEN p_type IN ('topup','balance','balance_change','refund') THEN 'balance_change'
    WHEN p_type IN ('ticket_reply','chat_reply','seller_chat','ticket') THEN 'ticket'
    WHEN p_type IN ('seller','seller_order','seller_stock','seller_review','order') THEN 'order'
    WHEN p_type IN ('broadcast','info','announcement') THEN 'announcement'
    WHEN p_type IN ('warning','admin_message') THEN 'admin_message'
    WHEN p_type IN ('flash_sale') THEN 'flash_sale'
    WHEN p_type ILIKE '%membership%' OR coalesce(p_title,'') ILIKE '%membership%' THEN 'membership'
    WHEN p_type IN ('purchase','claim','flash_deal','streak_shop','event_shop') THEN 'purchase'
    WHEN p_type ILIKE '%quest%' OR coalesce(p_title,'') ILIKE '%quest%' THEN 'quest'
    WHEN p_type ILIKE '%streak%' OR coalesce(p_title,'') ILIKE '%streak%' THEN 'streak'
    WHEN p_type IN ('gem','gift_box','mystery_box','spin_wheel','lucky_wheel','diamond_royale','faded_wheel',
                    'luck_royale_nyawa','success','booster','battle','achievement','reward')
      OR p_type LIKE '%voucher_code' THEN 'reward'
    ELSE NULL
  END
$$;

-- 6) Forward new notifications to telegram-notify (only for enabled links).
CREATE OR REPLACE FUNCTION public.trg_notification_to_telegram()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat text; v_tok text;
BEGIN
  v_cat := public.tg_category_for_notification(NEW.type, NEW.title);
  IF v_cat IS NULL OR NEW.visitor_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.telegram_user_links WHERE visitor_id = NEW.visitor_id AND enabled) THEN RETURN NEW; END IF;
  SELECT token INTO v_tok FROM public.telegram_internal_secret LIMIT 1;
  PERFORM net.http_post(
    url := 'https://qhkcohwrforhqjylaapo.supabase.co/functions/v1/telegram-notify',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoa2NvaHdyZm9yaHFqeWxhYXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwOTc2NjUsImV4cCI6MjA5MDY3MzY2NX0.x_gTN4aXNolOF6S6eTJnPkjXl8Wzg8J0-3TnF1gVo_k',
      'x-tg-internal', v_tok),
    body := jsonb_build_object('visitor_id', NEW.visitor_id, 'type', v_cat,
      'title', NEW.title, 'message', NEW.message, 'event_key', 'notif:' || NEW.id::text, 'source', 'notifications:' || NEW.type)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notification_to_telegram ON public.notifications;
CREATE TRIGGER trg_notification_to_telegram AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trg_notification_to_telegram();