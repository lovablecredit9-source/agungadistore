CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin');
$$;

CREATE OR REPLACE VIEW public.user_balances_public AS
SELECT id, visitor_id, username, phone, email, balance, bonus_balance, created_at, updated_at, avatar_url
FROM public.user_balances;
GRANT SELECT ON public.user_balances_public TO anon, authenticated;
GRANT ALL ON public.user_balances_public TO service_role;

ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS promo_price bigint,
  ADD COLUMN IF NOT EXISTS min_stock integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS cart_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_seller_products_store ON public.seller_products(store_id);
CREATE INDEX IF NOT EXISTS idx_seller_orders_store_created ON public.seller_orders(store_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.seller_store_of(p_visitor_id text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM public.seller_stores WHERE visitor_id = p_visitor_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.seller_reserve_stock(p_product_id uuid, p_qty int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int;
BEGIN
  IF p_qty < 1 THEN RETURN false; END IF;
  UPDATE public.seller_products SET stock = stock - p_qty, sold_count = coalesce(sold_count,0) + p_qty, updated_at = now()
   WHERE id = p_product_id AND stock >= p_qty;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

CREATE OR REPLACE FUNCTION public.seller_release_stock(p_product_id uuid, p_qty int)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.seller_products SET stock = stock + p_qty, sold_count = greatest(coalesce(sold_count,0) - p_qty, 0) WHERE id = p_product_id $$;
REVOKE EXECUTE ON FUNCTION public.seller_reserve_stock(uuid,int) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.seller_release_stock(uuid,int) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.seller_product_bulk(p_visitor_id text, p_ids uuid[], p_action text, p_category text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id); n int;
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF EXISTS (SELECT 1 FROM public.seller_products WHERE id = ANY(p_ids) AND store_id <> sid) THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF p_action = 'activate' THEN
    UPDATE seller_products SET is_active = true, archived_at = NULL, updated_at = now() WHERE id = ANY(p_ids) AND store_id = sid;
  ELSIF p_action = 'deactivate' THEN
    UPDATE seller_products SET is_active = false, updated_at = now() WHERE id = ANY(p_ids) AND store_id = sid;
  ELSIF p_action = 'archive' THEN
    UPDATE seller_products SET is_active = false, archived_at = now(), updated_at = now() WHERE id = ANY(p_ids) AND store_id = sid;
  ELSIF p_action = 'delete' THEN
    UPDATE seller_products SET is_active = false, archived_at = now(), updated_at = now()
      WHERE id = ANY(p_ids) AND store_id = sid AND EXISTS (SELECT 1 FROM seller_orders o WHERE o.product_id = seller_products.id);
    DELETE FROM seller_products WHERE id = ANY(p_ids) AND store_id = sid AND NOT EXISTS (SELECT 1 FROM seller_orders o WHERE o.product_id = seller_products.id);
  ELSIF p_action = 'category' THEN
    UPDATE seller_products SET category = left(coalesce(p_category,''),60), updated_at = now() WHERE id = ANY(p_ids) AND store_id = sid;
  ELSE RAISE EXCEPTION 'Aksi tidak dikenal'; END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.seller_product_duplicate(p_visitor_id text, p_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id); nid uuid;
BEGIN
  IF sid IS NULL OR NOT EXISTS (SELECT 1 FROM seller_products WHERE id = p_id AND store_id = sid) THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  INSERT INTO seller_products (store_id, visitor_id, title, description, price, promo_price, stock, min_stock, category, image_url, images, wa_number, status, is_active, has_warranty, warranty_duration_value, warranty_duration_unit, order_form)
  SELECT store_id, visitor_id, left(title || ' (Salinan)', 200), description, price, promo_price, stock, min_stock, category, image_url, images, wa_number, 'pending', false, has_warranty, warranty_duration_value, warranty_duration_unit, order_form
  FROM seller_products WHERE id = p_id RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.seller_dashboard_stats(p_visitor_id text, p_days int DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id); r jsonb; d int := least(greatest(p_days,1),366);
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  SELECT jsonb_build_object(
    'today', coalesce((SELECT sum(total) FROM seller_orders WHERE store_id=sid AND status NOT IN ('batal','pending') AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'),0),
    'month', coalesce((SELECT sum(total) FROM seller_orders WHERE store_id=sid AND status NOT IN ('batal','pending') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'),0),
    'total_orders', (SELECT count(*) FROM seller_orders WHERE store_id=sid),
    'new_orders', (SELECT count(*) FROM seller_orders WHERE store_id=sid AND status IN ('dibayar','proses')),
    'active_products', (SELECT count(*) FROM seller_products WHERE store_id=sid AND is_active AND status='approved' AND archived_at IS NULL),
    'low_stock', (SELECT count(*) FROM seller_products WHERE store_id=sid AND archived_at IS NULL AND stock <= min_stock),
    'balance', (SELECT balance FROM seller_stores WHERE id=sid),
    'held', coalesce((SELECT sum(total) FROM seller_orders WHERE store_id=sid AND escrow_status IN ('held','frozen')),0),
    'rating', (SELECT rating FROM seller_stores WHERE id=sid),
    'rating_count', (SELECT rating_count FROM seller_stores WHERE id=sid),
    'sold', coalesce((SELECT sum(qty) FROM seller_orders WHERE store_id=sid AND status='selesai'),0),
    'series', coalesce((SELECT jsonb_agg(x ORDER BY x->>'day') FROM (
        SELECT jsonb_build_object('day', to_char(g,'YYYY-MM-DD'),
          'omzet', coalesce(sum(o.total),0), 'trx', count(o.id), 'qty', coalesce(sum(o.qty),0)) x
        FROM generate_series((now() AT TIME ZONE 'Asia/Jakarta')::date - (d-1), (now() AT TIME ZONE 'Asia/Jakarta')::date, interval '1 day') g
        LEFT JOIN seller_orders o ON o.store_id=sid AND o.status NOT IN ('batal','pending') AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date = g::date
        GROUP BY g) s),'[]'::jsonb),
    'top', coalesce((SELECT jsonb_agg(t) FROM (
        SELECT product_id, max(product_title) title, sum(qty) qty, sum(total) omzet FROM seller_orders
        WHERE store_id=sid AND status NOT IN ('batal','pending') GROUP BY product_id ORDER BY sum(qty) DESC LIMIT 5) t),'[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.seller_cart_count_bump() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN UPDATE seller_products SET cart_count = cart_count + 1 WHERE id = NEW.product_id; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_seller_cart_count ON public.seller_cart_items;
CREATE TRIGGER trg_seller_cart_count AFTER INSERT ON public.seller_cart_items FOR EACH ROW EXECUTE FUNCTION public.seller_cart_count_bump();
REVOKE EXECUTE ON FUNCTION public.seller_cart_count_bump() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.seller_store_of(text) FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS public.seller_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trx_number bigserial,
  store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.seller_orders(id) ON DELETE SET NULL,
  product_title text,
  kind text NOT NULL,
  gross bigint NOT NULL DEFAULT 0,
  fee bigint NOT NULL DEFAULT 0,
  amount bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'selesai',
  balance_before bigint,
  balance_after bigint,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seller_ledger_store ON public.seller_ledger(store_id, created_at DESC);
GRANT ALL ON public.seller_ledger TO service_role;
GRANT SELECT ON public.seller_ledger TO authenticated;
ALTER TABLE public.seller_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read ledger" ON public.seller_ledger FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.seller_ledger_on_balance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; w record;
BEGIN
  IF coalesce(NEW.balance,0) = coalesce(OLD.balance,0) THEN RETURN NEW; END IF;
  SELECT er.*, o.product_title AS pt INTO e FROM seller_earnings er LEFT JOIN seller_orders o ON o.id = er.order_id
   WHERE er.store_id = NEW.id AND er.created_at = now() ORDER BY er.created_at DESC LIMIT 1;
  IF e.id IS NOT NULL AND NEW.balance > OLD.balance THEN
    INSERT INTO seller_ledger(store_id, order_id, product_title, kind, gross, fee, amount, balance_before, balance_after, note)
    VALUES (NEW.id, e.order_id, e.pt, 'dana_masuk', e.gross, e.fee, NEW.balance - OLD.balance, OLD.balance, NEW.balance, e.note);
  ELSE
    SELECT * INTO w FROM seller_withdrawals WHERE store_id = NEW.id ORDER BY coalesce(processed_at, created_at) DESC LIMIT 1;
    INSERT INTO seller_ledger(store_id, kind, amount, balance_before, balance_after, note)
    VALUES (NEW.id, CASE WHEN NEW.balance < OLD.balance THEN 'penarikan' ELSE 'penyesuaian' END,
      NEW.balance - OLD.balance, OLD.balance, NEW.balance,
      CASE WHEN NEW.balance < OLD.balance AND w.id IS NOT NULL THEN 'Penarikan '||coalesce(w.method,'') ELSE 'Penyesuaian admin' END);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_seller_ledger_balance ON public.seller_stores;
CREATE TRIGGER trg_seller_ledger_balance AFTER UPDATE OF balance ON public.seller_stores FOR EACH ROW EXECUTE FUNCTION public.seller_ledger_on_balance();

CREATE OR REPLACE FUNCTION public.seller_ledger_on_refund() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b bigint;
BEGIN
  IF NEW.escrow_status = 'refunded' AND coalesce(OLD.escrow_status,'') <> 'refunded' THEN
    SELECT balance INTO b FROM seller_stores WHERE id = NEW.store_id;
    INSERT INTO seller_ledger(store_id, order_id, product_title, kind, gross, amount, status, balance_before, balance_after, note)
    VALUES (NEW.store_id, NEW.id, NEW.product_title, 'refund', NEW.total, 0, 'refund', b, b, 'Refund ke pembeli #'||NEW.order_number);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_seller_ledger_refund ON public.seller_orders;
CREATE TRIGGER trg_seller_ledger_refund AFTER UPDATE OF escrow_status ON public.seller_orders FOR EACH ROW EXECUTE FUNCTION public.seller_ledger_on_refund();

INSERT INTO public.seller_ledger(store_id, order_id, product_title, kind, gross, fee, amount, balance_before, balance_after, note, created_at)
SELECT er.store_id, er.order_id, o.product_title, 'dana_masuk', er.gross, er.fee, er.net,
  sum(er.net) OVER w - er.net, sum(er.net) OVER w, coalesce(er.note,'')||' (riwayat lama)', er.created_at
FROM public.seller_earnings er LEFT JOIN public.seller_orders o ON o.id = er.order_id
WHERE NOT EXISTS (SELECT 1 FROM public.seller_ledger l WHERE l.order_id = er.order_id AND l.kind='dana_masuk')
WINDOW w AS (PARTITION BY er.store_id ORDER BY er.created_at ROWS UNBOUNDED PRECEDING);

CREATE OR REPLACE FUNCTION public.seller_stores_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND NOT public.is_admin_user() THEN
    IF NEW.balance IS DISTINCT FROM OLD.balance OR NEW.rating IS DISTINCT FROM OLD.rating OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
       OR NEW.total_sales IS DISTINCT FROM OLD.total_sales OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.fee_percent IS DISTINCT FROM OLD.fee_percent OR NEW.visitor_id IS DISTINCT FROM OLD.visitor_id THEN
      RAISE EXCEPTION 'ACCESS DENIED';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_seller_stores_guard ON public.seller_stores;
CREATE TRIGGER trg_seller_stores_guard BEFORE UPDATE ON public.seller_stores FOR EACH ROW EXECUTE FUNCTION public.seller_stores_guard();

ALTER TABLE public.seller_reviews ADD COLUMN IF NOT EXISTS seller_reply text, ADD COLUMN IF NOT EXISTS replied_at timestamptz;

CREATE OR REPLACE FUNCTION public.seller_review_reply(p_visitor_id text, p_review_id uuid, p_reply text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id);
BEGIN
  IF sid IS NULL OR NOT EXISTS (SELECT 1 FROM seller_reviews WHERE id = p_review_id AND store_id = sid) THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  UPDATE seller_reviews SET seller_reply = nullif(left(trim(p_reply),500),''), replied_at = now() WHERE id = p_review_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.seller_finance(p_visitor_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id);
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  RETURN jsonb_build_object(
    'balance', (SELECT coalesce(balance,0) FROM seller_stores WHERE id=sid),
    'held', coalesce((SELECT sum(total) FROM seller_orders WHERE store_id=sid AND escrow_status IN ('held','frozen')),0),
    'gross', coalesce((SELECT sum(gross) FROM seller_earnings WHERE store_id=sid),0),
    'fee', coalesce((SELECT sum(fee) FROM seller_earnings WHERE store_id=sid),0),
    'net', coalesce((SELECT sum(net) FROM seller_earnings WHERE store_id=sid),0),
    'refund', coalesce((SELECT sum(total) FROM seller_orders WHERE store_id=sid AND escrow_status='refunded'),0),
    'ledger', coalesce((SELECT jsonb_agg(l ORDER BY l.created_at DESC) FROM (SELECT * FROM seller_ledger WHERE store_id=sid ORDER BY created_at DESC LIMIT 200) l),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.seller_performance(p_visitor_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id);
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  RETURN jsonb_build_object(
    'sales', coalesce((SELECT sum(total) FROM seller_orders WHERE store_id=sid AND status='selesai'),0),
    'orders', (SELECT count(*) FROM seller_orders WHERE store_id=sid),
    'rating', (SELECT rating FROM seller_stores WHERE id=sid),
    'rating_count', (SELECT rating_count FROM seller_stores WHERE id=sid),
    'active_products', (SELECT count(*) FROM seller_products WHERE store_id=sid AND is_active AND status='approved' AND archived_at IS NULL),
    'chat_threads', (SELECT count(*) FROM seller_chat_threads WHERE store_id=sid),
    'chat_replied', (SELECT count(*) FROM seller_chat_threads t WHERE t.store_id=sid AND EXISTS (SELECT 1 FROM seller_chat_messages m WHERE m.thread_id=t.id AND m.sender='seller')),
    'ship_hours', (SELECT round(avg(extract(epoch FROM shipped_at - coalesce(paid_at, created_at))/3600)::numeric,1) FROM seller_orders WHERE store_id=sid AND shipped_at IS NOT NULL),
    'top', coalesce((SELECT jsonb_agg(t) FROM (SELECT max(product_title) title, sum(qty) qty FROM seller_orders WHERE store_id=sid AND status='selesai' GROUP BY product_id ORDER BY sum(qty) DESC LIMIT 3) t),'[]'::jsonb));
END $$;

REVOKE EXECUTE ON FUNCTION public.seller_ledger_on_balance() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.seller_ledger_on_refund() FROM anon, authenticated, public;

CREATE TABLE public.seller_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','amount')),
  discount_value bigint NOT NULL CHECK (discount_value > 0),
  min_purchase bigint NOT NULL DEFAULT 0,
  max_discount bigint,
  usage_limit integer,
  per_buyer_limit integer NOT NULL DEFAULT 1,
  product_ids uuid[],
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE UNIQUE INDEX seller_vouchers_code_uq ON public.seller_vouchers (upper(code));
CREATE INDEX ON public.seller_vouchers(store_id);
GRANT SELECT ON public.seller_vouchers TO authenticated;
GRANT ALL ON public.seller_vouchers TO service_role;
ALTER TABLE public.seller_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read seller vouchers" ON public.seller_vouchers FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE TABLE public.seller_voucher_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.seller_vouchers(id) ON DELETE CASCADE,
  buyer_visitor_id text NOT NULL,
  order_ids uuid[],
  discount bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.seller_voucher_uses(voucher_id, buyer_visitor_id);
GRANT SELECT ON public.seller_voucher_uses TO authenticated;
GRANT ALL ON public.seller_voucher_uses TO service_role;
ALTER TABLE public.seller_voucher_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read voucher uses" ON public.seller_voucher_uses FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE TABLE public.seller_flash_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  flash_price bigint NOT NULL CHECK (flash_price > 0),
  flash_stock integer NOT NULL CHECK (flash_stock > 0),
  sold integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX ON public.seller_flash_sales(product_id, ends_at);
GRANT SELECT ON public.seller_flash_sales TO anon, authenticated;
GRANT ALL ON public.seller_flash_sales TO service_role;
ALTER TABLE public.seller_flash_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read flash sales" ON public.seller_flash_sales FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.seller_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price bigint NOT NULL CHECK (price > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.seller_bundle_items (
  bundle_id uuid NOT NULL REFERENCES public.seller_bundles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, product_id)
);
GRANT SELECT ON public.seller_bundles, public.seller_bundle_items TO anon, authenticated;
GRANT ALL ON public.seller_bundles, public.seller_bundle_items TO service_role;
ALTER TABLE public.seller_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read bundles" ON public.seller_bundles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read bundle items" ON public.seller_bundle_items FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.seller_cart_items ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES public.seller_bundles(id) ON DELETE CASCADE;
ALTER TABLE public.seller_orders
  ADD COLUMN IF NOT EXISTS discount bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_code text,
  ADD COLUMN IF NOT EXISTS flash_sale_id uuid,
  ADD COLUMN IF NOT EXISTS bundle_id uuid;

CREATE OR REPLACE FUNCTION public.seller_voucher_save(p_visitor_id text, p jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id); vid uuid := nullif(p->>'id','')::uuid; ids uuid[];
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF vid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM seller_vouchers WHERE id=vid AND store_id=sid) THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF coalesce(p->>'code','') !~ '^[A-Za-z0-9]{3,20}$' THEN RAISE EXCEPTION 'Kode voucher 3-20 huruf/angka'; END IF;
  IF p->>'discount_type' = 'percent' AND ((p->>'discount_value')::bigint > 100) THEN RAISE EXCEPTION 'Diskon persen maksimal 100'; END IF;
  IF jsonb_typeof(p->'product_ids') = 'array' AND jsonb_array_length(p->'product_ids') > 0 THEN
    SELECT array_agg(x::uuid) INTO ids FROM jsonb_array_elements_text(p->'product_ids') x;
    IF EXISTS (SELECT 1 FROM unnest(ids) i WHERE NOT EXISTS (SELECT 1 FROM seller_products WHERE id=i AND store_id=sid)) THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  END IF;
  IF vid IS NULL THEN
    INSERT INTO seller_vouchers(store_id, code, name, discount_type, discount_value, min_purchase, max_discount, usage_limit, per_buyer_limit, product_ids, starts_at, ends_at, is_active)
    VALUES (sid, upper(p->>'code'), left(p->>'name',80), p->>'discount_type', (p->>'discount_value')::bigint, coalesce((p->>'min_purchase')::bigint,0),
      nullif(p->>'max_discount','')::bigint, nullif(p->>'usage_limit','')::int, coalesce(nullif(p->>'per_buyer_limit','')::int,1), ids,
      coalesce(nullif(p->>'starts_at','')::timestamptz, now()), (p->>'ends_at')::timestamptz, coalesce((p->>'is_active')::boolean, true))
    RETURNING id INTO vid;
  ELSE
    UPDATE seller_vouchers SET code=upper(p->>'code'), name=left(p->>'name',80), discount_type=p->>'discount_type', discount_value=(p->>'discount_value')::bigint,
      min_purchase=coalesce((p->>'min_purchase')::bigint,0), max_discount=nullif(p->>'max_discount','')::bigint, usage_limit=nullif(p->>'usage_limit','')::int,
      per_buyer_limit=coalesce(nullif(p->>'per_buyer_limit','')::int,1), product_ids=ids, starts_at=(p->>'starts_at')::timestamptz, ends_at=(p->>'ends_at')::timestamptz,
      is_active=coalesce((p->>'is_active')::boolean,true), updated_at=now() WHERE id=vid;
  END IF;
  RETURN vid;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Kode voucher sudah dipakai';
END $$;

CREATE OR REPLACE FUNCTION public.seller_voucher_list(p_visitor_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id);
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  RETURN coalesce((SELECT jsonb_agg(v ORDER BY v.created_at DESC) FROM seller_vouchers v WHERE store_id=sid),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.seller_promo_delete(p_visitor_id text, p_kind text, p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id); n int;
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF p_kind='voucher' THEN
    IF EXISTS (SELECT 1 FROM seller_voucher_uses WHERE voucher_id=p_id) THEN UPDATE seller_vouchers SET is_active=false WHERE id=p_id AND store_id=sid;
    ELSE DELETE FROM seller_vouchers WHERE id=p_id AND store_id=sid; END IF;
  ELSIF p_kind='flash' THEN UPDATE seller_flash_sales SET is_active=false WHERE id=p_id AND store_id=sid;
  ELSIF p_kind='bundle' THEN UPDATE seller_bundles SET is_active=false, updated_at=now() WHERE id=p_id AND store_id=sid;
  ELSE RAISE EXCEPTION 'Jenis tidak dikenal'; END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.seller_flash_save(p_visitor_id text, p jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id); pr record; fid uuid;
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  SELECT * INTO pr FROM seller_products WHERE id=(p->>'product_id')::uuid AND store_id=sid;
  IF pr.id IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF (p->>'flash_price')::bigint >= pr.price THEN RAISE EXCEPTION 'Harga flash harus lebih murah dari harga normal'; END IF;
  IF (p->>'flash_stock')::int > pr.stock THEN RAISE EXCEPTION 'Stok flash melebihi stok produk (%)', pr.stock; END IF;
  IF EXISTS (SELECT 1 FROM seller_flash_sales WHERE product_id=pr.id AND is_active AND ends_at > now()
     AND tstzrange(starts_at, ends_at) && tstzrange((p->>'starts_at')::timestamptz, (p->>'ends_at')::timestamptz)) THEN
    RAISE EXCEPTION 'Produk sudah punya flash sale di waktu itu'; END IF;
  INSERT INTO seller_flash_sales(store_id, product_id, flash_price, flash_stock, starts_at, ends_at)
  VALUES (sid, pr.id, (p->>'flash_price')::bigint, (p->>'flash_stock')::int, (p->>'starts_at')::timestamptz, (p->>'ends_at')::timestamptz) RETURNING id INTO fid;
  RETURN fid;
END $$;

CREATE OR REPLACE FUNCTION public.seller_bundle_save(p_visitor_id text, p jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id); ids uuid[]; bid uuid; normal bigint;
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  SELECT array_agg(DISTINCT x::uuid) INTO ids FROM jsonb_array_elements_text(p->'product_ids') x;
  IF coalesce(array_length(ids,1),0) < 2 THEN RAISE EXCEPTION 'Paket minimal 2 produk'; END IF;
  IF (SELECT count(*) FROM seller_products WHERE id = ANY(ids) AND store_id=sid) <> array_length(ids,1) THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  SELECT sum(price) INTO normal FROM seller_products WHERE id = ANY(ids);
  IF (p->>'price')::bigint >= normal THEN RAISE EXCEPTION 'Harga paket harus lebih murah dari total normal (Rp %)', normal; END IF;
  INSERT INTO seller_bundles(store_id, name, description, price) VALUES (sid, left(p->>'name',80), left(p->>'description',300), (p->>'price')::bigint) RETURNING id INTO bid;
  INSERT INTO seller_bundle_items(bundle_id, product_id) SELECT bid, unnest(ids);
  RETURN bid;
END $$;

CREATE OR REPLACE FUNCTION public.seller_cart_quote(p_visitor_id text, p_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  r record; b record; v record; items jsonb := '[]'::jsonb; it jsonb;
  unit bigint; fid uuid; sub bigint := 0; eligible bigint := 0; disc bigint := 0; verr text; used int;
  bsum bigint; bn int; bcnt int; bqty int; alloc bigint; i int; rest bigint; out jsonb := '[]'::jsonb;
BEGIN
  FOR r IN SELECT c.id cid, c.qty, c.bundle_id, p.* FROM seller_cart_items c JOIN seller_products p ON p.id=c.product_id
           WHERE c.visitor_id=p_visitor_id AND c.bundle_id IS NULL ORDER BY c.created_at LOOP
    fid := NULL; unit := r.price;
    SELECT f.id, f.flash_price INTO fid, unit FROM seller_flash_sales f
      WHERE f.product_id=r.id AND f.is_active AND now() >= f.starts_at AND now() < f.ends_at AND f.sold + r.qty <= f.flash_stock LIMIT 1;
    IF fid IS NULL THEN unit := CASE WHEN r.promo_price > 0 AND r.promo_price < r.price THEN r.promo_price ELSE r.price END; END IF;
    items := items || jsonb_build_object('cart_id', r.cid, 'product_id', r.id, 'store_id', r.store_id, 'qty', r.qty, 'unit', unit, 'line', unit*r.qty, 'flash_id', fid, 'bundle_id', NULL);
  END LOOP;
  FOR b IN SELECT DISTINCT bu.* FROM seller_cart_items c JOIN seller_bundles bu ON bu.id=c.bundle_id WHERE c.visitor_id=p_visitor_id LOOP
    SELECT count(*), min(c.qty), max(c.qty), sum(p.price) INTO bcnt, bqty, bn, bsum
      FROM seller_cart_items c JOIN seller_products p ON p.id=c.product_id WHERE c.visitor_id=p_visitor_id AND c.bundle_id=b.id;
    IF NOT b.is_active OR bcnt <> (SELECT count(*) FROM seller_bundle_items WHERE bundle_id=b.id) OR bqty <> bn
       OR EXISTS (SELECT 1 FROM seller_cart_items c WHERE c.visitor_id=p_visitor_id AND c.bundle_id=b.id AND NOT EXISTS (SELECT 1 FROM seller_bundle_items bi WHERE bi.bundle_id=b.id AND bi.product_id=c.product_id)) THEN
      RAISE EXCEPTION 'Paket "%" tidak lengkap / sudah tidak berlaku, hapus lalu tambahkan lagi', b.name;
    END IF;
    rest := b.price * bqty; i := 0;
    FOR r IN SELECT c.id cid, c.qty, p.* FROM seller_cart_items c JOIN seller_products p ON p.id=c.product_id
             WHERE c.visitor_id=p_visitor_id AND c.bundle_id=b.id ORDER BY p.id LOOP
      i := i + 1;
      alloc := CASE WHEN i = bcnt THEN rest ELSE (b.price * bqty * r.price / nullif(bsum,0)) END;
      rest := rest - alloc;
      items := items || jsonb_build_object('cart_id', r.cid, 'product_id', r.id, 'store_id', r.store_id, 'qty', r.qty, 'unit', alloc / r.qty, 'line', alloc, 'flash_id', NULL, 'bundle_id', b.id, 'bundle_name', b.name);
    END LOOP;
  END LOOP;
  SELECT coalesce(sum((x->>'line')::bigint),0) INTO sub FROM jsonb_array_elements(items) x;
  IF nullif(trim(coalesce(p_code,'')),'') IS NOT NULL THEN
    SELECT * INTO v FROM seller_vouchers WHERE upper(code)=upper(trim(p_code));
    IF v.id IS NULL OR NOT v.is_active THEN verr := 'Voucher tidak ditemukan / tidak aktif';
    ELSIF now() < v.starts_at THEN verr := 'Voucher belum berlaku';
    ELSIF now() >= v.ends_at THEN verr := 'Voucher sudah berakhir';
    ELSIF v.usage_limit IS NOT NULL AND v.used_count >= v.usage_limit THEN verr := 'Kuota voucher habis';
    ELSE
      SELECT count(*) INTO used FROM seller_voucher_uses WHERE voucher_id=v.id AND buyer_visitor_id=p_visitor_id;
      IF used >= v.per_buyer_limit THEN verr := 'Kamu sudah memakai voucher ini';
      ELSE
        SELECT coalesce(sum((x->>'line')::bigint),0) INTO eligible FROM jsonb_array_elements(items) x
          WHERE (x->>'store_id')::uuid = v.store_id AND (v.product_ids IS NULL OR (x->>'product_id')::uuid = ANY(v.product_ids));
        IF eligible = 0 THEN verr := 'Voucher tidak berlaku untuk produk di keranjang';
        ELSIF eligible < v.min_purchase THEN verr := 'Minimum belanja Rp ' || v.min_purchase;
        ELSE
          disc := CASE WHEN v.discount_type='percent' THEN eligible * v.discount_value / 100 ELSE v.discount_value END;
          IF v.max_discount IS NOT NULL THEN disc := least(disc, v.max_discount); END IF;
          disc := least(disc, eligible);
        END IF;
      END IF;
    END IF;
  END IF;
  rest := disc;
  SELECT count(*) INTO bcnt FROM jsonb_array_elements(items) x WHERE disc > 0 AND (x->>'store_id')::uuid = v.store_id AND (v.product_ids IS NULL OR (x->>'product_id')::uuid = ANY(v.product_ids));
  i := 0;
  FOR it IN SELECT * FROM jsonb_array_elements(items) LOOP
    alloc := 0;
    IF disc > 0 AND (it->>'store_id')::uuid = v.store_id AND (v.product_ids IS NULL OR (it->>'product_id')::uuid = ANY(v.product_ids)) THEN
      i := i + 1;
      alloc := CASE WHEN i = bcnt THEN rest ELSE disc * (it->>'line')::bigint / eligible END;
      rest := rest - alloc;
    END IF;
    out := out || (it || jsonb_build_object('discount', alloc, 'final', (it->>'line')::bigint - alloc));
  END LOOP;
  RETURN jsonb_build_object('items', out, 'subtotal', sub, 'discount', disc, 'total', sub - disc,
    'voucher', CASE WHEN disc > 0 THEN jsonb_build_object('id', v.id, 'code', v.code, 'name', v.name) END, 'voucher_error', verr);
END $$;

CREATE OR REPLACE FUNCTION public.seller_voucher_redeem(p_voucher_id uuid, p_buyer text, p_discount bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v record; uid uuid;
BEGIN
  SELECT * INTO v FROM seller_vouchers WHERE id=p_voucher_id FOR UPDATE;
  IF v.id IS NULL OR NOT v.is_active OR now() < v.starts_at OR now() >= v.ends_at THEN RAISE EXCEPTION 'Voucher tidak berlaku'; END IF;
  IF v.usage_limit IS NOT NULL AND v.used_count >= v.usage_limit THEN RAISE EXCEPTION 'Kuota voucher habis'; END IF;
  IF (SELECT count(*) FROM seller_voucher_uses WHERE voucher_id=v.id AND buyer_visitor_id=p_buyer) >= v.per_buyer_limit THEN RAISE EXCEPTION 'Kamu sudah memakai voucher ini'; END IF;
  UPDATE seller_vouchers SET used_count = used_count + 1 WHERE id=v.id;
  INSERT INTO seller_voucher_uses(voucher_id, buyer_visitor_id, discount) VALUES (v.id, p_buyer, p_discount) RETURNING id INTO uid;
  RETURN uid;
END $$;
CREATE OR REPLACE FUNCTION public.seller_voucher_release(p_use_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE vid uuid;
BEGIN
  DELETE FROM seller_voucher_uses WHERE id=p_use_id RETURNING voucher_id INTO vid;
  IF vid IS NOT NULL THEN UPDATE seller_vouchers SET used_count = greatest(used_count-1,0) WHERE id=vid; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.seller_flash_reserve(p_flash_id uuid, p_qty int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int;
BEGIN
  UPDATE seller_flash_sales SET sold = sold + p_qty WHERE id=p_flash_id AND is_active AND now() >= starts_at AND now() < ends_at AND sold + p_qty <= flash_stock;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n = 1;
END $$;
CREATE OR REPLACE FUNCTION public.seller_flash_release(p_flash_id uuid, p_qty int)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE seller_flash_sales SET sold = greatest(sold - p_qty, 0) WHERE id=p_flash_id $$;
REVOKE EXECUTE ON FUNCTION public.seller_voucher_redeem(uuid,text,bigint), public.seller_voucher_release(uuid),
  public.seller_flash_reserve(uuid,int), public.seller_flash_release(uuid,int) FROM anon, authenticated, public;