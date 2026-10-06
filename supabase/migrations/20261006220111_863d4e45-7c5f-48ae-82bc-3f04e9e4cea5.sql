CREATE OR REPLACE FUNCTION public.buyer_checkout(p_visitor_id text, p_pin text, p_store_id uuid, p_cart_ids uuid[], p_voucher_code text DEFAULT NULL::text, p_buyer_note text DEFAULT NULL::text, p_checkout_ref uuid DEFAULT gen_random_uuid())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- v bertipe ROWTYPE (bukan record) agar checkout tanpa voucher tidak error "record v is not assigned yet".
DECLARE bal record; st record; c record; p record; f record; v public.seller_vouchers%ROWTYPE; line bigint; unit bigint; subtotal bigint:=0; discount bigint:=0; total bigint; eligible bigint:=0; used int; thread uuid; o record; orders jsonb:='[]'::jsonb; item_count int:=0; share bigint; pin_err text;
BEGIN
 IF coalesce(p_visitor_id,'')='' OR p_pin !~ '^\d{6}$' OR coalesce(array_length(p_cart_ids,1),0)=0 THEN RAISE EXCEPTION 'Data checkout tidak lengkap'; END IF;
 IF EXISTS(SELECT 1 FROM seller_orders WHERE checkout_ref=p_checkout_ref) THEN RETURN jsonb_build_object('ok',true,'orders',(SELECT jsonb_agg(jsonb_build_object('id',id,'order_number',order_number)) FROM seller_orders WHERE checkout_ref=p_checkout_ref),'total',(SELECT sum(total) FROM seller_orders WHERE checkout_ref=p_checkout_ref)); END IF;
 SELECT * INTO st FROM seller_stores WHERE id=p_store_id FOR UPDATE;
 IF st.id IS NULL OR NOT st.is_active OR NOT seller_store_is_open(st.id) THEN RAISE EXCEPTION 'Toko sedang tutup atau tidak tersedia'; END IF;
 IF st.visitor_id=p_visitor_id THEN RAISE EXCEPTION 'Tidak bisa membeli produk toko sendiri'; END IF;
 SELECT ub.* INTO bal FROM user_balances ub WHERE ub.id=get_active_user_balance_id(p_visitor_id) FOR UPDATE;
 IF bal.id IS NULL THEN RAISE EXCEPTION 'Akun saldo belum terdaftar'; END IF;
 pin_err := public.verify_account_pin(p_visitor_id,p_pin);
 IF pin_err IS NOT NULL THEN RAISE EXCEPTION '%', pin_err; END IF;
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
END $function$;