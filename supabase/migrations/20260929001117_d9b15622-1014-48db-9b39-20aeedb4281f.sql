ALTER TABLE public.seller_stores
  ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reply_text text,
  ADD COLUMN IF NOT EXISTS hours jsonb,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz;
UPDATE public.seller_stores SET verification_status='verified' WHERE is_verified AND verification_status='unverified';

CREATE OR REPLACE FUNCTION public.seller_stores_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND NOT public.is_admin_user() THEN
    IF NEW.balance IS DISTINCT FROM OLD.balance OR NEW.rating IS DISTINCT FROM OLD.rating OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
       OR NEW.total_sales IS DISTINCT FROM OLD.total_sales OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.fee_percent IS DISTINCT FROM OLD.fee_percent OR NEW.visitor_id IS DISTINCT FROM OLD.visitor_id
       OR NEW.verification_status IS DISTINCT FROM OLD.verification_status OR NEW.verification_note IS DISTINCT FROM OLD.verification_note THEN
      RAISE EXCEPTION 'ACCESS DENIED';
    END IF;
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    NEW.is_verified := NEW.verification_status = 'verified';
    IF NEW.verification_status IN ('verified','rejected') THEN
      INSERT INTO notifications(visitor_id, title, message, type, related_id)
      VALUES (NEW.visitor_id, CASE WHEN NEW.verification_status='verified' THEN '✓ Toko terverifikasi' ELSE 'Verifikasi toko ditolak' END,
        CASE WHEN NEW.verification_status='verified' THEN 'Toko ' || NEW.store_name || ' kini punya badge Terverifikasi.' ELSE coalesce(NEW.verification_note,'Silakan lengkapi data lalu ajukan lagi.') END,
        'seller_verification', NEW.id::text);
    END IF;
  ELSIF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    NEW.verification_status := CASE WHEN NEW.is_verified THEN 'verified' ELSE 'unverified' END;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.seller_store_settings(p_visitor_id text, p jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id);
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  UPDATE seller_stores SET
    auto_reply_enabled = coalesce((p->>'auto_reply_enabled')::boolean, auto_reply_enabled),
    auto_reply_text = CASE WHEN p ? 'auto_reply_text' THEN left(p->>'auto_reply_text', 500) ELSE auto_reply_text END,
    hours = CASE WHEN p ? 'hours' THEN p->'hours' ELSE hours END,
    is_open = coalesce((p->>'is_open')::boolean, is_open),
    closed_note = CASE WHEN p ? 'closed_note' THEN left(p->>'closed_note', 200) ELSE closed_note END,
    updated_at = now()
  WHERE id = sid;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.seller_request_verification(p_visitor_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM seller_stores WHERE id = public.seller_store_of(p_visitor_id);
  IF s.id IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF s.verification_status IN ('pending','verified') THEN RAISE EXCEPTION 'Status verifikasi sudah %', s.verification_status; END IF;
  UPDATE seller_stores SET verification_status='pending', verification_requested_at=now(), verification_note=NULL WHERE id=s.id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.seller_store_is_open(p_store_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; t timestamp := now() AT TIME ZONE 'Asia/Jakarta'; d jsonb;
BEGIN
  SELECT is_open, is_active, hours INTO s FROM seller_stores WHERE id=p_store_id;
  IF s IS NULL OR NOT s.is_active OR s.is_open = false THEN RETURN false; END IF;
  IF s.hours IS NULL THEN RETURN true; END IF;
  d := s.hours -> extract(dow FROM t)::int::text;
  IF d IS NULL THEN RETURN true; END IF;
  IF NOT coalesce((d->>'open')::boolean, false) THEN RETURN false; END IF;
  RETURN t::time >= coalesce(d->>'start','00:00')::time AND t::time < coalesce(nullif(d->>'end','00:00'),'23:59:59')::time;
END $$;

CREATE OR REPLACE FUNCTION public.seller_chat_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE th record; s record; first_msg boolean; open_now boolean; offline boolean; txt text;
BEGIN
  IF NEW.sender <> 'buyer' THEN RETURN NEW; END IF;
  SELECT * INTO th FROM seller_chat_threads WHERE id = NEW.thread_id;
  IF th.id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM seller_stores WHERE id = th.store_id;
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE visitor_id=th.seller_visitor_id AND type='seller_chat' AND related_id=th.id::text AND created_at > now() - interval '10 minutes') THEN
    INSERT INTO notifications(visitor_id,title,message,type,related_id) VALUES (th.seller_visitor_id, '💬 Chat baru', coalesce(th.buyer_name,'Pembeli') || ': ' || left(coalesce(NEW.message,'[gambar]'),80), 'seller_chat', th.id::text);
  END IF;
  IF s.id IS NULL OR NOT s.auto_reply_enabled THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM seller_chat_messages WHERE thread_id=th.id AND kind='auto' AND created_at > now() - interval '30 minutes') THEN RETURN NEW; END IF;
  first_msg := NOT EXISTS (SELECT 1 FROM seller_chat_messages WHERE thread_id=th.id AND sender='buyer' AND id <> NEW.id);
  open_now := public.seller_store_is_open(s.id);
  offline := coalesce((SELECT max(last_seen_at) FROM user_balances WHERE visitor_id=s.visitor_id) < now() - interval '5 minutes', true);
  IF NOT (first_msg OR NOT open_now OR offline) THEN RETURN NEW; END IF;
  txt := coalesce(nullif(trim(s.auto_reply_text),''), 'Terima kasih sudah menghubungi toko kami. Pesan kamu akan segera kami balas.');
  IF NOT open_now THEN txt := txt || E'\n\n○ Toko sedang tutup' || coalesce(' — ' || nullif(s.closed_note,''), '') || '. Pesanmu akan dibalas saat toko buka.'; END IF;
  INSERT INTO seller_chat_messages(thread_id, sender, visitor_id, message, kind) VALUES (th.id, 'seller', s.visitor_id, txt, 'auto');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_seller_chat_after_insert ON public.seller_chat_messages;
CREATE TRIGGER trg_seller_chat_after_insert AFTER INSERT ON public.seller_chat_messages FOR EACH ROW EXECUTE FUNCTION public.seller_chat_after_insert();

CREATE OR REPLACE FUNCTION public.seller_stock_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.stock < OLD.stock THEN
    IF NEW.stock <= 0 AND OLD.stock > 0 THEN
      INSERT INTO notifications(visitor_id,title,message,type,related_id) VALUES (NEW.visitor_id,'⛔ Stok habis', NEW.title || ' sudah habis. Tambah stok agar tetap bisa dibeli.','seller_stock',NEW.id::text);
    ELSIF NEW.stock <= coalesce(NEW.min_stock,5) AND OLD.stock > coalesce(NEW.min_stock,5) THEN
      INSERT INTO notifications(visitor_id,title,message,type,related_id) VALUES (NEW.visitor_id,'⚠ Stok hampir habis', NEW.title || ' tinggal ' || NEW.stock || '.','seller_stock',NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_seller_stock_notify ON public.seller_products;
CREATE TRIGGER trg_seller_stock_notify AFTER UPDATE OF stock ON public.seller_products FOR EACH ROW EXECUTE FUNCTION public.seller_stock_notify();

CREATE OR REPLACE FUNCTION public.seller_review_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sv text;
BEGIN
  SELECT visitor_id INTO sv FROM seller_stores WHERE id = NEW.store_id;
  IF sv IS NOT NULL THEN
    INSERT INTO notifications(visitor_id,title,message,type,related_id) VALUES (sv, '⭐ Ulasan baru', 'Rating ' || NEW.rating || ' bintang' || coalesce(': ' || left(nullif(NEW.comment,''),80), ''), 'seller_review', NEW.id::text);
  END IF;
  RETURN NEW;
EXCEPTION WHEN undefined_column THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_seller_review_notify ON public.seller_reviews;
CREATE TRIGGER trg_seller_review_notify AFTER INSERT ON public.seller_reviews FOR EACH ROW EXECUTE FUNCTION public.seller_review_notify();

CREATE TABLE IF NOT EXISTS public.seller_product_events (
  id bigserial PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.seller_products(id) ON DELETE SET NULL,
  visitor_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('store_view','view','detail','cart','checkout','purchase')),
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS seller_product_events_dedupe ON public.seller_product_events (store_id, coalesce(product_id,'00000000-0000-0000-0000-000000000000'::uuid), visitor_id, kind, day) WHERE kind IN ('store_view','view','detail','cart','checkout');
CREATE INDEX IF NOT EXISTS seller_product_events_store_created ON public.seller_product_events (store_id, created_at);
GRANT SELECT ON public.seller_product_events TO authenticated;
GRANT ALL ON public.seller_product_events TO service_role;
ALTER TABLE public.seller_product_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read product events" ON public.seller_product_events;
CREATE POLICY "Admin read product events" ON public.seller_product_events FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.seller_track(p_visitor_id text, p_kind text, p_product_id uuid DEFAULT NULL, p_store_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := p_store_id; owner text;
BEGIN
  IF p_kind NOT IN ('store_view','view','detail','checkout') OR coalesce(p_visitor_id,'') = '' THEN RETURN; END IF;
  IF p_product_id IS NOT NULL THEN SELECT store_id INTO sid FROM seller_products WHERE id=p_product_id; END IF;
  IF sid IS NULL THEN RETURN; END IF;
  SELECT visitor_id INTO owner FROM seller_stores WHERE id=sid;
  IF owner = p_visitor_id THEN RETURN; END IF;
  INSERT INTO seller_product_events(store_id, product_id, visitor_id, kind) VALUES (sid, p_product_id, p_visitor_id, p_kind) ON CONFLICT DO NOTHING;
  IF p_kind = 'detail' AND FOUND THEN UPDATE seller_products SET views = coalesce(views,0) + 1 WHERE id = p_product_id; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.seller_events_from_tables()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid;
BEGIN
  IF TG_TABLE_NAME = 'seller_cart_items' THEN
    SELECT store_id INTO sid FROM seller_products WHERE id=NEW.product_id;
    IF sid IS NOT NULL THEN INSERT INTO seller_product_events(store_id, product_id, visitor_id, kind) VALUES (sid, NEW.product_id, NEW.visitor_id, 'cart') ON CONFLICT DO NOTHING; END IF;
  ELSE
    INSERT INTO seller_product_events(store_id, product_id, visitor_id, kind) VALUES (NEW.store_id, NEW.product_id, NEW.buyer_visitor_id, 'purchase');
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_seller_evt_cart ON public.seller_cart_items;
CREATE TRIGGER trg_seller_evt_cart AFTER INSERT ON public.seller_cart_items FOR EACH ROW EXECUTE FUNCTION public.seller_events_from_tables();
DROP TRIGGER IF EXISTS trg_seller_evt_order ON public.seller_orders;
CREATE TRIGGER trg_seller_evt_order AFTER INSERT ON public.seller_orders FOR EACH ROW EXECUTE FUNCTION public.seller_events_from_tables();

CREATE OR REPLACE FUNCTION public.seller_analytics(p_visitor_id text, p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid := public.seller_store_of(p_visitor_id); since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  RETURN jsonb_build_object(
    'funnel', (SELECT jsonb_build_object(
        'store_view', count(DISTINCT visitor_id) FILTER (WHERE kind='store_view'),
        'view', count(*) FILTER (WHERE kind='view'),
        'detail', count(*) FILTER (WHERE kind='detail'),
        'cart', count(*) FILTER (WHERE kind='cart'),
        'checkout', count(*) FILTER (WHERE kind='checkout'),
        'purchase', count(*) FILTER (WHERE kind='purchase'),
        'visitors', count(DISTINCT visitor_id))
      FROM seller_product_events WHERE store_id=sid AND created_at >= since),
    'products', coalesce((SELECT jsonb_agg(x ORDER BY x.purchase DESC, x.detail DESC) FROM (
        SELECT p.id, p.title, p.stock,
          count(e.*) FILTER (WHERE e.kind='view') AS view, count(e.*) FILTER (WHERE e.kind='detail') AS detail,
          count(e.*) FILTER (WHERE e.kind='cart') AS cart, count(e.*) FILTER (WHERE e.kind='purchase') AS purchase
        FROM seller_products p LEFT JOIN seller_product_events e ON e.product_id=p.id AND e.created_at >= since
        WHERE p.store_id=sid AND p.archived_at IS NULL GROUP BY p.id) x), '[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.seller_mark_notifications(p_visitor_id text, p_ids uuid[] DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE notifications SET is_read = true WHERE visitor_id = p_visitor_id AND (p_ids IS NULL OR id = ANY(p_ids)) $$;

REVOKE EXECUTE ON FUNCTION public.seller_chat_after_insert(), public.seller_stock_notify(), public.seller_review_notify(), public.seller_events_from_tables() FROM anon, authenticated, public;