
-- Defaults
INSERT INTO public.admin_settings (setting_key, setting_value) VALUES
  ('telegram_testimoni_channel_id', ''),
  ('telegram_admin_visitor_ids', '[]')
ON CONFLICT (setting_key) DO NOTHING;

-- Helper: kirim event ke edge function via pg_net
CREATE OR REPLACE FUNCTION public.tg_testimoni_notify(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- SUPABASE_URL & anon key baked as constants
  v_url := 'https://qhkcohwrforhqjylaapo.supabase.co/functions/v1/telegram-testimoni';
  v_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoa2NvaHdyZm9yaHFqeWxhYXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwOTc2NjUsImV4cCI6MjA5MDY3MzY2NX0.x_gTN4aXNolOF6S6eTJnPkjXl8Wzg8J0-3TnF1gVo_k';
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body := payload
  );
EXCEPTION WHEN OTHERS THEN
  -- swallow to never break the parent txn
  NULL;
END;
$$;

-- Deposits: status berubah ke paid
CREATE OR REPLACE FUNCTION public.trg_testimoni_deposit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    PERFORM public.tg_testimoni_notify(jsonb_build_object(
      'kind','deposit','visitor_id',NEW.visitor_id,'amount',NEW.amount,
      'product', COALESCE(NEW.method,'Deposit')
    ));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_testimoni_deposit ON public.deposits;
CREATE TRIGGER trg_testimoni_deposit AFTER UPDATE ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.trg_testimoni_deposit();

-- balance_transactions type=purchase
CREATE OR REPLACE FUNCTION public.trg_testimoni_balance_tx()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'purchase' THEN
    PERFORM public.tg_testimoni_notify(jsonb_build_object(
      'kind','purchase','visitor_id',NEW.visitor_id,'amount', ABS(COALESCE(NEW.amount,0)),
      'product', COALESCE(NEW.description,'Produk')
    ));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_testimoni_balance_tx ON public.balance_transactions;
CREATE TRIGGER trg_testimoni_balance_tx AFTER INSERT ON public.balance_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_testimoni_balance_tx();

-- gem_transactions (pembelian gem, amount > 0)
CREATE OR REPLACE FUNCTION public.trg_testimoni_gem_tx()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.amount,0) > 0 AND COALESCE(NEW.type,'') IN ('purchase','buy','topup') THEN
    PERFORM public.tg_testimoni_notify(jsonb_build_object(
      'kind','gem','visitor_id',NEW.visitor_id,'amount',0,
      'product', COALESCE(NEW.description, NEW.amount::text||' 💎')
    ));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_testimoni_gem_tx ON public.gem_transactions;
CREATE TRIGGER trg_testimoni_gem_tx AFTER INSERT ON public.gem_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_testimoni_gem_tx();

-- store_premium_subscriptions (aktivasi membership)
CREATE OR REPLACE FUNCTION public.trg_testimoni_premium()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.tg_testimoni_notify(jsonb_build_object(
    'kind','membership','visitor_id',NEW.visitor_id,'amount', COALESCE(NEW.price_paid,0),
    'product','Membership Premium Toko','extra', COALESCE(NEW.plan_code,'')
  ));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_testimoni_premium ON public.store_premium_subscriptions;
CREATE TRIGGER trg_testimoni_premium AFTER INSERT ON public.store_premium_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.trg_testimoni_premium();

-- streak_shop_redemptions
CREATE OR REPLACE FUNCTION public.trg_testimoni_shop()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text;
BEGIN
  SELECT name INTO nm FROM public.streak_shop_items WHERE id = NEW.item_id;
  PERFORM public.tg_testimoni_notify(jsonb_build_object(
    'kind','streak_shop','visitor_id',NEW.visitor_id,'amount',0,
    'product', COALESCE(nm,'Streak Shop Item'),
    'extra', COALESCE(NEW.cost_coins,0)::text || ' 🪙'
  ));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_testimoni_shop ON public.streak_shop_redemptions;
CREATE TRIGGER trg_testimoni_shop AFTER INSERT ON public.streak_shop_redemptions
FOR EACH ROW EXECUTE FUNCTION public.trg_testimoni_shop();

-- streak_voucher_claims
CREATE OR REPLACE FUNCTION public.trg_testimoni_voucher()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.tg_testimoni_notify(jsonb_build_object(
    'kind','voucher','visitor_id',NEW.visitor_id,'amount',0,
    'product','Klaim Voucher Streak'
  ));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_testimoni_voucher ON public.streak_voucher_claims;
CREATE TRIGGER trg_testimoni_voucher AFTER INSERT ON public.streak_voucher_claims
FOR EACH ROW EXECUTE FUNCTION public.trg_testimoni_voucher();
