
CREATE TABLE public.seller_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 1,
  order_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_cart_items TO anon, authenticated;
GRANT ALL ON public.seller_cart_items TO service_role;
ALTER TABLE public.seller_cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart open" ON public.seller_cart_items FOR ALL USING (true) WITH CHECK (qty BETWEEN 1 AND 999);

ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS order_form jsonb,
  ADD COLUMN IF NOT EXISTS rating_avg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.seller_stores ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.seller_orders
  ADD COLUMN IF NOT EXISTS order_fields jsonb,
  ADD COLUMN IF NOT EXISTS delivery_data text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_confirm_at timestamptz,
  ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS thread_id uuid;

ALTER TABLE public.seller_chat_messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.seller_chat_delete_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF OLD.created_at < now() - interval '5 minutes' THEN
      RAISE EXCEPTION 'Pesan hanya bisa dihapus maksimal 5 menit setelah dikirim';
    END IF;
    NEW.message := ''; NEW.image_url := NULL; NEW.payload := NULL;
  END IF;
  IF OLD.deleted_at IS NOT NULL THEN NEW.deleted_at := OLD.deleted_at; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seller_chat_delete_guard BEFORE UPDATE ON public.seller_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.seller_chat_delete_guard();

-- Lindungi kolom pesanan sensitif dari perubahan langsung browser
CREATE OR REPLACE FUNCTION public.seller_orders_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IN ('anon','authenticated')
     OR coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') IN ('anon','authenticated') THEN
    IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'Pesanan hanya dapat dibuat lewat checkout'; END IF;
    NEW.status := OLD.status; NEW.escrow_status := OLD.escrow_status; NEW.total := OLD.total;
    NEW.price := OLD.price; NEW.qty := OLD.qty; NEW.auto_confirm_at := OLD.auto_confirm_at;
    NEW.completed_at := OLD.completed_at; NEW.buyer_visitor_id := OLD.buyer_visitor_id;
    NEW.seller_visitor_id := OLD.seller_visitor_id; NEW.store_id := OLD.store_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seller_orders_guard BEFORE INSERT OR UPDATE ON public.seller_orders
FOR EACH ROW EXECUTE FUNCTION public.seller_orders_guard();

CREATE TABLE public.seller_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.seller_orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  product_id uuid,
  buyer_visitor_id text NOT NULL,
  buyer_name text,
  product_rating integer NOT NULL CHECK (product_rating BETWEEN 1 AND 5),
  store_rating integer NOT NULL CHECK (store_rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.seller_reviews TO anon, authenticated;
GRANT ALL ON public.seller_reviews TO service_role;
ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews read" ON public.seller_reviews FOR SELECT USING (true);
CREATE POLICY "reviews insert" ON public.seller_reviews FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.seller_orders o WHERE o.id = order_id AND o.status = 'selesai'
          AND o.buyer_visitor_id = seller_reviews.buyer_visitor_id AND o.store_id = seller_reviews.store_id)
);

CREATE OR REPLACE FUNCTION public.seller_reviews_recalc() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.seller_products p SET
    rating_avg = coalesce((SELECT round(avg(product_rating)::numeric,1) FROM public.seller_reviews WHERE product_id = NEW.product_id),0),
    rating_count = (SELECT count(*) FROM public.seller_reviews WHERE product_id = NEW.product_id)
  WHERE p.id = NEW.product_id;
  UPDATE public.seller_stores s SET
    rating = coalesce((SELECT round(avg(store_rating)::numeric,1) FROM public.seller_reviews WHERE store_id = NEW.store_id),0),
    rating_count = (SELECT count(*) FROM public.seller_reviews WHERE store_id = NEW.store_id)
  WHERE s.id = NEW.store_id;
  RETURN NEW;
END $$;
CREATE TRIGGER seller_reviews_recalc AFTER INSERT ON public.seller_reviews
FOR EACH ROW EXECUTE FUNCTION public.seller_reviews_recalc();

CREATE SEQUENCE IF NOT EXISTS public.seller_dispute_number_seq START 41000;
CREATE TABLE public.seller_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_number bigint NOT NULL DEFAULT nextval('public.seller_dispute_number_seq'),
  order_id uuid NOT NULL REFERENCES public.seller_orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  buyer_visitor_id text NOT NULL,
  seller_visitor_id text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT ON public.seller_disputes TO anon, authenticated;
GRANT ALL ON public.seller_disputes TO service_role;
ALTER TABLE public.seller_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disputes read" ON public.seller_disputes FOR SELECT USING (true);

CREATE TABLE public.seller_dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.seller_disputes(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('buyer','seller','admin')),
  visitor_id text,
  message text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.seller_dispute_messages TO anon, authenticated;
GRANT ALL ON public.seller_dispute_messages TO service_role;
ALTER TABLE public.seller_dispute_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dispute msgs read" ON public.seller_dispute_messages FOR SELECT USING (true);
CREATE POLICY "dispute msgs insert" ON public.seller_dispute_messages FOR INSERT WITH CHECK (
  (sender = 'admin' AND public.is_admin_user()) OR
  EXISTS (SELECT 1 FROM public.seller_disputes d WHERE d.id = dispute_id AND d.status = 'open' AND
    ((sender = 'buyer' AND d.buyer_visitor_id = visitor_id) OR (sender = 'seller' AND d.seller_visitor_id = visitor_id)))
);

-- Lepas dana ke penjual (sekali)
CREATE OR REPLACE FUNCTION public.seller_release_order(p_order_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; s record; v_fee bigint; v_net bigint;
BEGIN
  SELECT * INTO o FROM public.seller_orders WHERE id = p_order_id FOR UPDATE;
  IF o IS NULL OR o.escrow_status NOT IN ('held','frozen') THEN RETURN false; END IF;
  SELECT * INTO s FROM public.seller_stores WHERE id = o.store_id FOR UPDATE;
  v_fee := round(o.total * coalesce(s.fee_percent,0) / 100);
  v_net := greatest(0, o.total - v_fee);
  UPDATE public.seller_orders SET status='selesai', escrow_status='released', completed_at=now(), updated_at=now() WHERE id=o.id;
  IF NOT EXISTS (SELECT 1 FROM public.seller_earnings WHERE order_id = o.id) THEN
    INSERT INTO public.seller_earnings(store_id, order_id, gross, fee, net, note)
    VALUES (o.store_id, o.id, o.total, v_fee, v_net, 'Pesanan #'||o.order_number||' · '||o.product_title);
    UPDATE public.seller_stores SET balance = coalesce(balance,0)+v_net, total_sales = coalesce(total_sales,0)+1, updated_at=now() WHERE id=o.store_id;
  END IF;
  RETURN true;
END $$;

-- Kembalikan dana ke pembeli
CREATE OR REPLACE FUNCTION public.seller_refund_order(p_order_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; v_bid uuid;
BEGIN
  SELECT * INTO o FROM public.seller_orders WHERE id = p_order_id FOR UPDATE;
  IF o IS NULL OR o.escrow_status NOT IN ('held','frozen') THEN RETURN false; END IF;
  v_bid := public.get_active_user_balance_id(o.buyer_visitor_id);
  IF v_bid IS NULL THEN RAISE EXCEPTION 'Akun saldo pembeli tidak ditemukan'; END IF;
  PERFORM public.refund_main_balance_only(v_bid, o.total);
  INSERT INTO public.balance_transactions(visitor_id, type, amount, description)
  VALUES (o.buyer_visitor_id, 'seller_refund', o.total, 'Refund pesanan toko #'||o.order_number);
  UPDATE public.seller_orders SET status='batal', escrow_status='refunded', updated_at=now() WHERE id=o.id;
  UPDATE public.seller_products SET stock = stock + o.qty, sold_count = greatest(0, coalesce(sold_count,0) - o.qty) WHERE id = o.product_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.seller_auto_release() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT id FROM public.seller_orders WHERE status='dikirim' AND escrow_status='held' AND auto_confirm_at < now() LOOP
    IF public.seller_release_order(r.id) THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.seller_release_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seller_refund_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seller_auto_release() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_release_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.seller_refund_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.seller_auto_release() TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_dispute_messages;
