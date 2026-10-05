ALTER TABLE public.seller_orders
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS product_image_url text,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'saldo',
  ADD COLUMN IF NOT EXISTS subtotal bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkout_ref uuid;
CREATE UNIQUE INDEX IF NOT EXISTS seller_orders_checkout_item_uq ON public.seller_orders(checkout_ref, product_id) WHERE checkout_ref IS NOT NULL;
ALTER TABLE public.seller_reviews ADD COLUMN IF NOT EXISTS photo_url text;

CREATE TABLE IF NOT EXISTS public.seller_product_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, product_id)
);
GRANT ALL ON public.seller_product_wishlist TO service_role;
ALTER TABLE public.seller_product_wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct wishlist access" ON public.seller_product_wishlist FOR ALL TO anon,authenticated USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.seller_store_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, store_id)
);
GRANT ALL ON public.seller_store_follows TO service_role;
ALTER TABLE public.seller_store_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct follow access" ON public.seller_store_follows FOR ALL TO anon,authenticated USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.seller_recent_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, product_id)
);
GRANT ALL ON public.seller_recent_views TO service_role;
ALTER TABLE public.seller_recent_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct recent view access" ON public.seller_recent_views FOR ALL TO anon,authenticated USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.seller_reminder_preferences (
  visitor_id text PRIMARY KEY,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.seller_reminder_preferences TO service_role;
ALTER TABLE public.seller_reminder_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_reminder_preferences_no_direct_access" ON public.seller_reminder_preferences FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE OR REPLACE FUNCTION public.set_seller_reminder_preferences_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS set_seller_reminder_preferences_updated_at ON public.seller_reminder_preferences;
CREATE TRIGGER set_seller_reminder_preferences_updated_at BEFORE UPDATE ON public.seller_reminder_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_seller_reminder_preferences_updated_at();

CREATE OR REPLACE FUNCTION public.buyer_catalog(p_visitor_id text, p_product_id uuid DEFAULT NULL, p_store_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF coalesce(p_visitor_id,'') = '' THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF p_product_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM seller_products WHERE id=p_product_id AND status='approved' AND is_active AND archived_at IS NULL) THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;
    INSERT INTO seller_recent_views(visitor_id,product_id,viewed_at) VALUES(p_visitor_id,p_product_id,now())
      ON CONFLICT(visitor_id,product_id) DO UPDATE SET viewed_at=now();
  END IF;
  RETURN jsonb_build_object(
    'wishlist', coalesce((SELECT jsonb_agg(product_id) FROM seller_product_wishlist WHERE visitor_id=p_visitor_id),'[]'::jsonb),
    'followed', coalesce((SELECT jsonb_agg(store_id) FROM seller_store_follows WHERE visitor_id=p_visitor_id),'[]'::jsonb),
    'recent', coalesce((SELECT jsonb_agg(product_id ORDER BY viewed_at DESC) FROM (SELECT product_id,viewed_at FROM seller_recent_views WHERE visitor_id=p_visitor_id ORDER BY viewed_at DESC LIMIT 12) r),'[]'::jsonb),
    'reviews', CASE WHEN p_product_id IS NULL THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'buyer_name',coalesce(buyer_name,'Pembeli'),'product_rating',product_rating,'comment',comment,'photo_url',photo_url,'seller_reply',seller_reply,'created_at',created_at) ORDER BY created_at DESC) FROM seller_reviews WHERE product_id=p_product_id),'[]'::jsonb) END,
    'vouchers', CASE WHEN p_store_id IS NULL THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'name',name,'discount_type',discount_type,'discount_value',discount_value,'min_purchase',min_purchase,'max_discount',max_discount,'ends_at',ends_at)) FROM seller_vouchers WHERE store_id=p_store_id AND is_active AND now()>=starts_at AND now()<ends_at AND (usage_limit IS NULL OR used_count<usage_limit)),'[]'::jsonb) END,
    'followers', CASE WHEN p_store_id IS NULL THEN 0 ELSE (SELECT count(*) FROM seller_store_follows WHERE store_id=p_store_id) END
  );
END $$;

CREATE OR REPLACE FUNCTION public.buyer_toggle_saved(p_visitor_id text, p_kind text, p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE removed int;
BEGIN
  IF coalesce(p_visitor_id,'')='' THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF p_kind='product' THEN
    DELETE FROM seller_product_wishlist WHERE visitor_id=p_visitor_id AND product_id=p_id; GET DIAGNOSTICS removed=ROW_COUNT;
    IF removed=0 THEN
      IF NOT EXISTS(SELECT 1 FROM seller_products WHERE id=p_id AND status='approved' AND is_active AND archived_at IS NULL) THEN RAISE EXCEPTION 'Produk tidak tersedia'; END IF;
      INSERT INTO seller_product_wishlist(visitor_id,product_id) VALUES(p_visitor_id,p_id); RETURN true;
    END IF;
  ELSIF p_kind='store' THEN
    DELETE FROM seller_store_follows WHERE visitor_id=p_visitor_id AND store_id=p_id; GET DIAGNOSTICS removed=ROW_COUNT;
    IF removed=0 THEN
      IF NOT EXISTS(SELECT 1 FROM seller_stores WHERE id=p_id AND is_active) THEN RAISE EXCEPTION 'Toko tidak tersedia'; END IF;
      INSERT INTO seller_store_follows(visitor_id,store_id) VALUES(p_visitor_id,p_id); RETURN true;
    END IF;
  ELSE RAISE EXCEPTION 'Aksi tidak valid'; END IF;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.buyer_cart_update(p_visitor_id text, p_product_id uuid, p_qty int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p record;
BEGIN
  IF coalesce(p_visitor_id,'')='' THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF p_qty<=0 THEN DELETE FROM seller_cart_items WHERE visitor_id=p_visitor_id AND product_id=p_product_id AND bundle_id IS NULL; RETURN; END IF;
  SELECT * INTO p FROM seller_products WHERE id=p_product_id AND status='approved' AND is_active AND archived_at IS NULL;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Produk tidak tersedia'; END IF;
  IF p.visitor_id=p_visitor_id THEN RAISE EXCEPTION 'Tidak bisa membeli produk toko sendiri'; END IF;
  IF p_qty>p.stock THEN RAISE EXCEPTION 'Stok hanya tersedia %',p.stock; END IF;
  INSERT INTO seller_cart_items(visitor_id,product_id,qty,order_fields) VALUES(p_visitor_id,p_product_id,p_qty,'{}')
  ON CONFLICT(visitor_id,product_id) DO UPDATE SET qty=excluded.qty;
END $$;

CREATE OR REPLACE FUNCTION public.buyer_report_product(p_visitor_id text,p_product_id uuid,p_reason text,p_detail text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p record; n bigint;
BEGIN
 IF coalesce(p_visitor_id,'')='' THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
 IF p_reason NOT IN ('Produk tidak sesuai','Informasi menyesatkan','Penipuan','Produk dilarang','Spam','Pelanggaran lainnya') THEN RAISE EXCEPTION 'Alasan tidak valid'; END IF;
 IF length(coalesce(p_detail,''))>1000 THEN RAISE EXCEPTION 'Keterangan terlalu panjang'; END IF;
 IF EXISTS(SELECT 1 FROM seller_reports WHERE visitor_id=p_visitor_id AND product_id=p_product_id AND created_at>now()-interval '10 minutes') THEN RAISE EXCEPTION 'Laporan sudah dikirim, tunggu sebelum mengirim lagi'; END IF;
 SELECT id,store_id INTO p FROM seller_products WHERE id=p_product_id;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;
 INSERT INTO seller_reports(product_id,store_id,visitor_id,reason,detail) VALUES(p.id,p.store_id,p_visitor_id,p_reason,nullif(trim(p_detail),'')) RETURNING report_number INTO n;
 RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.buyer_review_order_v2(p_visitor_id text,p_order_id uuid,p_rating int,p_comment text DEFAULT NULL,p_photo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o record; rid uuid;
BEGIN
 IF p_rating<1 OR p_rating>5 THEN RAISE EXCEPTION 'Rating harus 1-5'; END IF;
 IF p_photo IS NOT NULL AND (p_photo NOT LIKE 'data:image/%' OR length(p_photo) > 1500000) THEN RAISE EXCEPTION 'Foto tidak valid'; END IF;
 SELECT * INTO o FROM seller_orders WHERE id=p_order_id FOR UPDATE;
 IF o.id IS NULL OR o.buyer_visitor_id<>p_visitor_id THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
 IF o.status NOT IN ('selesai','completed') THEN RAISE EXCEPTION 'Rating tersedia setelah pesanan selesai'; END IF;
 IF EXISTS (SELECT 1 FROM seller_reviews WHERE order_id=o.id) THEN RAISE EXCEPTION 'Pesanan ini sudah diberi rating'; END IF;
 INSERT INTO seller_reviews(order_id,store_id,product_id,buyer_visitor_id,buyer_name,product_rating,store_rating,comment,photo_url)
 VALUES(o.id,o.store_id,o.product_id,o.buyer_visitor_id,o.buyer_name,p_rating,p_rating,left(nullif(trim(p_comment),''),1000),p_photo) RETURNING id INTO rid;
 RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.buyer_review_order(p_visitor_id text,p_order_id uuid,p_rating int,p_comment text DEFAULT NULL)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT public.buyer_review_order_v2(p_visitor_id, p_order_id, p_rating, p_comment, NULL) $$;

CREATE OR REPLACE FUNCTION public.buyer_checkout(
 p_visitor_id text,p_pin text,p_store_id uuid,p_cart_ids uuid[],p_voucher_code text DEFAULT NULL,p_buyer_note text DEFAULT NULL,p_checkout_ref uuid DEFAULT gen_random_uuid()
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bal record; st record; c record; p record; f record; v record; line bigint; unit bigint; subtotal bigint:=0; discount bigint:=0; total bigint; eligible bigint:=0; used int; thread uuid; o record; orders jsonb:='[]'::jsonb; item_count int:=0; share bigint;
BEGIN
 IF coalesce(p_visitor_id,'')='' OR p_pin !~ '^\d{6}$' OR coalesce(array_length(p_cart_ids,1),0)=0 THEN RAISE EXCEPTION 'Data checkout tidak lengkap'; END IF;
 IF EXISTS(SELECT 1 FROM seller_orders WHERE checkout_ref=p_checkout_ref) THEN RETURN jsonb_build_object('ok',true,'orders',(SELECT jsonb_agg(jsonb_build_object('id',id,'order_number',order_number)) FROM seller_orders WHERE checkout_ref=p_checkout_ref),'total',(SELECT sum(total) FROM seller_orders WHERE checkout_ref=p_checkout_ref)); END IF;
 SELECT * INTO st FROM seller_stores WHERE id=p_store_id FOR UPDATE;
 IF st.id IS NULL OR NOT st.is_active OR NOT seller_store_is_open(st.id) THEN RAISE EXCEPTION 'Toko sedang tutup atau tidak tersedia'; END IF;
 IF st.visitor_id=p_visitor_id THEN RAISE EXCEPTION 'Tidak bisa membeli produk toko sendiri'; END IF;
 SELECT ub.* INTO bal FROM user_balances ub WHERE ub.id=get_active_user_balance_id(p_visitor_id) FOR UPDATE;
 IF bal.id IS NULL THEN RAISE EXCEPTION 'Akun saldo belum terdaftar'; END IF;
 IF NOT EXISTS(SELECT 1 FROM user_pins WHERE visitor_id=p_visitor_id AND pin_hash=encode(extensions.digest(p_pin,'sha256'),'hex')) THEN RAISE EXCEPTION 'PIN salah'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_cart_ids) x LEFT JOIN seller_cart_items ci ON ci.id=x AND ci.visitor_id=p_visitor_id WHERE ci.id IS NULL) THEN RAISE EXCEPTION 'Keranjang berubah, muat ulang'; END IF;
 IF EXISTS(SELECT 1 FROM seller_cart_items ci JOIN seller_products sp ON sp.id=ci.product_id WHERE ci.id=ANY(p_cart_ids) AND sp.store_id<>p_store_id) THEN RAISE EXCEPTION 'Checkout hanya dapat memproses satu toko'; END IF;
 FOR c IN SELECT ci.* FROM seller_cart_items ci WHERE ci.visitor_id=p_visitor_id AND ci.id=ANY(p_cart_ids) ORDER BY ci.created_at FOR UPDATE LOOP
   SELECT * INTO p FROM seller_products WHERE id=c.product_id FOR UPDATE;
   IF p.id IS NULL OR p.status<>'approved' OR NOT p.is_active OR p.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Produk tidak tersedia'; END IF;
   IF c.qty<1 OR c.qty>p.stock THEN RAISE EXCEPTION 'Stok % hanya tersedia %',p.title,p.stock; END IF;
   IF c.bundle_id IS NOT NULL THEN RAISE EXCEPTION 'Checkout paket hemat tetap gunakan keranjang paket lengkap'; END IF;
   unit:=CASE WHEN coalesce(p.promo_price,0)>0 AND p.promo_price<p.price THEN p.promo_price ELSE p.price END;
   SELECT * INTO f FROM seller_flash_sales WHERE product_id=p.id AND is_active AND now()>=starts_at AND now()<ends_at AND sold+c.qty<=flash_stock LIMIT 1 FOR UPDATE;
   IF f.id IS NOT NULL THEN unit:=f.flash_price; END IF;
   line:=unit*c.qty; subtotal:=subtotal+line; item_count:=item_count+1;
 END LOOP;
 IF item_count=0 THEN RAISE EXCEPTION 'Keranjang kosong'; END IF;
 IF nullif(trim(coalesce(p_voucher_code,'')),'') IS NOT NULL THEN
   SELECT * INTO v FROM seller_vouchers WHERE upper(code)=upper(trim(p_voucher_code)) AND store_id=p_store_id FOR UPDATE;
   IF v.id IS NULL OR NOT v.is_active OR now()<v.starts_at OR now()>=v.ends_at OR (v.usage_limit IS NOT NULL AND v.used_count>=v.usage_limit) THEN RAISE EXCEPTION 'Voucher tidak berlaku'; END IF;
   SELECT count(*) INTO used FROM seller_voucher_uses WHERE voucher_id=v.id AND buyer_visitor_id=p_visitor_id;
   IF used>=v.per_buyer_limit THEN RAISE EXCEPTION 'Kamu sudah memakai voucher ini'; END IF;
   SELECT coalesce(sum((CASE WHEN coalesce(sp.promo_price,0)>0 AND sp.promo_price<sp.price THEN sp.promo_price ELSE sp.price END)*ci.qty),0) INTO eligible FROM seller_cart_items ci JOIN seller_products sp ON sp.id=ci.product_id WHERE ci.id=ANY(p_cart_ids) AND (v.product_ids IS NULL OR ci.product_id=ANY(v.product_ids));
   IF eligible<v.min_purchase THEN RAISE EXCEPTION 'Minimum belanja voucher Rp %',v.min_purchase; END IF;
   discount:=CASE WHEN v.discount_type='percent' THEN eligible*v.discount_value/100 ELSE v.discount_value END;
   IF v.max_discount IS NOT NULL THEN discount:=least(discount,v.max_discount); END IF; discount:=least(discount,subtotal);
 END IF;
 total:=subtotal-discount;
 IF bal.balance<total THEN RAISE EXCEPTION 'Saldo tidak mencukupi'; END IF;
 UPDATE user_balances SET balance=balance-total,updated_at=now() WHERE id=bal.id;
 INSERT INTO balance_transactions(visitor_id,type,amount,description) VALUES(p_visitor_id,'seller_purchase',-total,'Belanja di '||st.store_name);
 IF v.id IS NOT NULL THEN UPDATE seller_vouchers SET used_count=used_count+1 WHERE id=v.id; END IF;
 FOR c IN SELECT ci.* FROM seller_cart_items ci WHERE ci.visitor_id=p_visitor_id AND ci.id=ANY(p_cart_ids) ORDER BY ci.created_at LOOP
   SELECT * INTO p FROM seller_products WHERE id=c.product_id;
   unit:=CASE WHEN coalesce(p.promo_price,0)>0 AND p.promo_price<p.price THEN p.promo_price ELSE p.price END;
   SELECT * INTO f FROM seller_flash_sales WHERE product_id=p.id AND is_active AND now()>=starts_at AND now()<ends_at AND sold+c.qty<=flash_stock LIMIT 1 FOR UPDATE;
   IF f.id IS NOT NULL THEN unit:=f.flash_price; UPDATE seller_flash_sales SET sold=sold+c.qty WHERE id=f.id; END IF;
   line:=unit*c.qty;
   share:=CASE WHEN subtotal>0 THEN discount*line/subtotal ELSE 0 END;
   UPDATE seller_products SET stock=stock-c.qty,sold_count=coalesce(sold_count,0)+c.qty WHERE id=p.id AND stock>=c.qty;
   IF NOT FOUND THEN RAISE EXCEPTION 'Stok % baru saja berubah',p.title; END IF;
   SELECT id INTO thread FROM seller_chat_threads WHERE store_id=st.id AND product_id=p.id AND buyer_visitor_id=p_visitor_id LIMIT 1;
   IF thread IS NULL THEN INSERT INTO seller_chat_threads(store_id,product_id,buyer_visitor_id,seller_visitor_id,product_title,buyer_name,last_message_at) VALUES(st.id,p.id,p_visitor_id,st.visitor_id,p.title,coalesce(bal.username,'Pembeli'),now()) RETURNING id INTO thread; END IF;
   INSERT INTO seller_orders(store_id,product_id,seller_visitor_id,buyer_visitor_id,product_title,qty,price,subtotal,total,discount,voucher_code,flash_sale_id,buyer_name,buyer_phone,buyer_note,order_fields,status,escrow_status,paid_at,thread_id,store_name,product_image_url,payment_method,checkout_ref)
   VALUES(st.id,p.id,st.visitor_id,p_visitor_id,p.title,c.qty,unit,line,line-share,share,v.code,f.id,coalesce(bal.username,'Pembeli'),'-',left(nullif(trim(p_buyer_note),''),500),c.order_fields,'dibayar','held',now(),thread,st.store_name,p.image_url,'saldo',p_checkout_ref) RETURNING * INTO o;
   orders:=orders||jsonb_build_object('id',o.id,'order_number',o.order_number);
   INSERT INTO seller_chat_messages(thread_id,sender,visitor_id,message,kind,payload,order_ref) VALUES(thread,'buyer',p_visitor_id,'🛒 Produk sudah dipesan: '||p.title||' ×'||c.qty,'order',jsonb_build_object('order_number',o.order_number,'title',p.title,'qty',c.qty,'total',o.total,'status','dibayar'),o.id);
   INSERT INTO notifications(visitor_id,title,message,type,related_id) VALUES(st.visitor_id,'📦 Pesanan baru','#'||o.order_number||' '||p.title||' ×'||c.qty||' sudah dibayar.','seller_order',o.id::text);
 END LOOP;
 IF v.id IS NOT NULL THEN INSERT INTO seller_voucher_uses(voucher_id,buyer_visitor_id,order_ids,discount) VALUES(v.id,p_visitor_id,ARRAY(SELECT (x->>'id')::uuid FROM jsonb_array_elements(orders)x),discount); END IF;
 DELETE FROM seller_cart_items WHERE visitor_id=p_visitor_id AND id=ANY(p_cart_ids);
 RETURN jsonb_build_object('ok',true,'orders',orders,'subtotal',subtotal,'discount',discount,'total',total,'balance_after',bal.balance-total);
END $$;

REVOKE ALL ON FUNCTION public.buyer_catalog(text,uuid,uuid), public.buyer_toggle_saved(text,text,uuid), public.buyer_cart_update(text,uuid,int), public.buyer_report_product(text,uuid,text,text), public.buyer_review_order(text,uuid,int,text), public.buyer_review_order_v2(text,uuid,int,text,text), public.buyer_checkout(text,text,uuid,uuid[],text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_catalog(text,uuid,uuid), public.buyer_toggle_saved(text,text,uuid), public.buyer_cart_update(text,uuid,int), public.buyer_report_product(text,uuid,text,text), public.buyer_review_order(text,uuid,int,text), public.buyer_review_order_v2(text,uuid,int,text,text), public.buyer_checkout(text,text,uuid,uuid[],text,text,uuid) TO service_role;