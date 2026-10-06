-- lovable-cron-fallback-reviewed: product publish/unpublish/featured schedules are time-based (no row change at the scheduled moment); 5-minute delivery window needed
ALTER TABLE public.seller_cart_items ADD COLUMN IF NOT EXISTS saved_for_later boolean NOT NULL DEFAULT false;
ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS unpublish_at timestamptz,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz,
  ADD COLUMN IF NOT EXISTS low_stock_alerted_at timestamptz;

CREATE OR REPLACE FUNCTION public.buyer_cart_save_later(p_visitor_id text, p_cart_id uuid, p_saved boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(p_visitor_id,'')='' THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  UPDATE seller_cart_items SET saved_for_later=coalesce(p_saved,false) WHERE id=p_cart_id AND visitor_id=p_visitor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item keranjang tidak ditemukan'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.buyer_cart_save_later(text,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_cart_save_later(text,uuid,boolean) TO service_role;

-- Peringatan stok menipis/habis saat stok berubah
CREATE OR REPLACE FUNCTION public.seller_products_low_stock()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.stock > coalesce(NEW.min_stock,0) AND NEW.stock > 0 THEN
    NEW.low_stock_alerted_at := NULL;
  ELSIF NEW.low_stock_alerted_at IS NULL AND NEW.status='approved' AND NEW.archived_at IS NULL
        AND (NEW.stock = 0 OR NEW.stock <= coalesce(NEW.min_stock,0)) THEN
    INSERT INTO notifications(visitor_id,title,message,type,related_id)
      VALUES(NEW.visitor_id, CASE WHEN NEW.stock=0 THEN '🔴 Stok habis' ELSE '🟡 Stok menipis' END,
             NEW.title||' tersisa '||NEW.stock||' stok.', 'seller_low_stock', NEW.id::text);
    NEW.low_stock_alerted_at := now();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.seller_products_low_stock() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_seller_products_low_stock ON public.seller_products;
CREATE TRIGGER trg_seller_products_low_stock BEFORE UPDATE OF stock, min_stock ON public.seller_products
  FOR EACH ROW EXECUTE FUNCTION public.seller_products_low_stock();

-- Jadwal publish/unpublish/featured
CREATE OR REPLACE FUNCTION public.seller_products_tick()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE seller_products SET is_active=true, publish_at=NULL, updated_at=now() WHERE publish_at IS NOT NULL AND publish_at<=now();
  UPDATE seller_products SET is_active=false, unpublish_at=NULL, updated_at=now() WHERE unpublish_at IS NOT NULL AND unpublish_at<=now();
  UPDATE seller_products SET is_featured=false, featured_until=NULL WHERE featured_until IS NOT NULL AND featured_until<=now();
END $$;
REVOKE ALL ON FUNCTION public.seller_products_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_products_tick() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname='seller-products-tick';
SELECT cron.schedule('seller-products-tick','*/5 * * * *', $$SELECT public.seller_products_tick();$$);

CREATE OR REPLACE FUNCTION public.admin_product_analytics()
 RETURNS TABLE(product_id uuid, views bigint, wishlist bigint, cart_added bigint, purchases bigint, revenue bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  RETURN QUERY
  SELECT sp.id,
    greatest(coalesce(sp.views,0)::bigint, (SELECT count(*) FROM seller_product_events e WHERE e.product_id=sp.id AND e.kind IN ('view','detail'))),
    (SELECT count(*) FROM seller_product_wishlist w WHERE w.product_id=sp.id),
    greatest(coalesce(sp.cart_count,0)::bigint, (SELECT count(*) FROM seller_product_events e WHERE e.product_id=sp.id AND e.kind='cart')),
    coalesce((SELECT sum(o.qty) FROM seller_orders o WHERE o.product_id=sp.id AND o.status<>'batal'),0)::bigint,
    coalesce((SELECT sum(o.total) FROM seller_orders o WHERE o.product_id=sp.id AND o.status<>'batal'),0)::bigint
  FROM seller_products sp WHERE sp.archived_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.admin_product_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_product_analytics() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_order_stats()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE res jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  SELECT jsonb_build_object(
    'total', count(*),
    'completed', count(*) FILTER (WHERE status='selesai'),
    'pending', count(*) FILTER (WHERE status IN ('dibayar','proses','dikirim')),
    'cancelled', count(*) FILTER (WHERE status='batal'),
    'revenue', coalesce(sum(total) FILTER (WHERE status<>'batal'),0),
    'aov', coalesce(round(avg(total) FILTER (WHERE status<>'batal')),0),
    'top', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT product_title AS title, sum(qty) AS qty, sum(total) AS revenue FROM seller_orders WHERE status<>'batal' GROUP BY product_title ORDER BY sum(qty) DESC LIMIT 5) t)
  ) INTO res FROM seller_orders;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.admin_order_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_order_stats() TO authenticated, service_role;