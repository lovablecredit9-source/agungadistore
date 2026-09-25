create extension if not exists pgcrypto;

create or replace function public.seller_checkout(
  p_visitor_id text,
  p_pin text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  ub record;
  item jsonb;
  p record;
  q integer;
  total numeric := 0;
  oid uuid;
  thread uuid;
  order_ids jsonb := '[]'::jsonb;
  fields jsonb;
begin
  if p_visitor_id is null or p_visitor_id = '' then raise exception 'visitor_id wajib'; end if;
  if p_pin !~ '^[0-9]{6}$' then raise exception 'PIN harus 6 digit'; end if;
  select * into ub from user_balances where visitor_id=p_visitor_id for update;
  if not found then raise exception 'Akun saldo tidak ditemukan'; end if;
  if not exists (select 1 from user_pins where visitor_id=p_visitor_id and pin_hash=encode(digest(p_pin,'sha256'),'hex')) then
    raise exception 'PIN salah';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_visitor_id,0));

  for item in select * from jsonb_array_elements(p_items) loop
    q := greatest(1, coalesce((item->>'qty')::integer,1));
    select sp.* into p from seller_products sp where sp.id=(item->>'productId')::uuid and sp.status='approved' and sp.is_active=true for update;
    if not found then raise exception 'Produk tidak tersedia'; end if;
    if p.stock < q then raise exception 'Stok % tidak cukup', p.title; end if;
    total := total + (p.price*q);
  end loop;

  if ub.balance < total then raise exception 'Saldo utama tidak cukup'; end if;

  update user_balances set balance=balance-total, updated_at=now() where id=ub.id;
  insert into balance_transactions(visitor_id,amount,type,description)
  values(p_visitor_id,-total,'seller_purchase','Pembelian marketplace seller');

  for item in select * from jsonb_array_elements(p_items) loop
    q := greatest(1, coalesce((item->>'qty')::integer,1));
    select sp.* into p from seller_products sp where sp.id=(item->>'productId')::uuid for update;
    fields := coalesce(item->'orderFields','{}'::jsonb);
    update seller_products set stock=stock-q, sold_count=coalesce(sold_count,0)+q, updated_at=now() where id=p.id;
    insert into seller_orders(
      buyer_visitor_id,buyer_name,seller_visitor_id,store_id,product_id,product_title,qty,price,total,
      order_fields,status,escrow_status,paid_at,thread_id
    ) values(
      p_visitor_id,ub.username,p.visitor_id,p.store_id,p.id,p.title,q,p.price,p.price*q,
      fields,'pending','held',now(),null
    ) returning id into oid;

    insert into seller_chat_threads(buyer_visitor_id,seller_visitor_id,store_id,product_id,product_title,buyer_name)
    values(p_visitor_id,p.visitor_id,p.store_id,p.id,p.title,ub.username)
    returning id into thread;
    update seller_orders set thread_id=thread where id=oid;
    insert into seller_chat_messages(thread_id,visitor_id,sender,message,kind,payload)
    values(thread,p_visitor_id,'buyer','Produk sudah dipesan','order',
      jsonb_build_object('orderId',oid,'orderNumber',(select order_number from seller_orders where id=oid),'title',p.title,'price',p.price,'qty',q));

    order_ids := order_ids || jsonb_build_array(oid);
  end loop;

  delete from seller_cart_items where visitor_id=p_visitor_id;
  return jsonb_build_object('ok',true,'total',total,'orderIds',order_ids);
end;
$$;

create or replace function public.seller_escrow_action(
  p_action text,
  p_order_id uuid,
  p_visitor_id text,
  p_delivery_data text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  o record;
  fee numeric;
  net numeric;
begin
  select * into o from seller_orders where id=p_order_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;

  if p_action='ship' then
    if o.seller_visitor_id <> p_visitor_id then raise exception 'Bukan penjual pesanan'; end if;
    if o.status <> 'pending' or o.escrow_status <> 'held' then raise exception 'Pesanan tidak dapat dikirim'; end if;
    if coalesce(trim(p_delivery_data),'') = '' then raise exception 'Isi data pesanan terlebih dahulu'; end if;
    update seller_orders
      set delivery_data=p_delivery_data,status='dikirim',shipped_at=now(),
          auto_confirm_at=now()+interval '5 hours',updated_at=now()
      where id=o.id;
    return jsonb_build_object('ok',true,'status','dikirim','autoConfirmAt',now()+interval '5 hours');

  elsif p_action='confirm' then
    if o.buyer_visitor_id <> p_visitor_id then raise exception 'Bukan pembeli pesanan'; end if;
    if o.status <> 'dikirim' or o.escrow_status <> 'held' then raise exception 'Pesanan belum siap dikonfirmasi'; end if;

  elsif p_action='dispute' then
    if o.buyer_visitor_id <> p_visitor_id then raise exception 'Bukan pembeli pesanan'; end if;
    if o.status <> 'dikirim' or o.escrow_status <> 'held' then raise exception 'Pesanan tidak dapat disengketakan'; end if;
    update seller_orders
      set status='kendala',escrow_status='frozen',updated_at=now()
      where id=o.id;
    return jsonb_build_object('ok',true,'status','kendala','escrowStatus','frozen');

  elsif p_action='auto_release' then
    if o.status='dikirim' and o.escrow_status='held'
       and o.auto_confirm_at is not null and o.auto_confirm_at <= now() then
      fee := round(o.total * coalesce((select fee_percent from seller_stores where id=o.store_id),5) / 100.0,2);
      net := o.total-fee;
      update seller_stores
        set balance=balance+net,total_sales=coalesce(total_sales,0)+1,updated_at=now()
        where id=o.store_id;
      insert into seller_earnings(store_id,order_id,gross,fee,net,note)
        values(o.store_id,o.id,o.total,fee,net,'Auto-konfirmasi marketplace');
      update seller_orders
        set status='selesai',escrow_status='released',completed_at=now(),updated_at=now()
        where id=o.id;
    end if;
    return jsonb_build_object('ok',true);

  elsif p_action='refund' then
    if coalesce(p_visitor_id,'') <> 'admin' then raise exception 'Aksi admin tidak diizinkan'; end if;
    if o.escrow_status <> 'frozen' then raise exception 'Dana belum dibekukan'; end if;
    update user_balances
      set balance=balance+o.total,updated_at=now()
      where visitor_id=o.buyer_visitor_id;
    insert into balance_transactions(visitor_id,amount,type,description)
      values(o.buyer_visitor_id,o.total,'seller_refund','Refund pesanan marketplace');
    update seller_orders
      set status='kendala',escrow_status='refunded',updated_at=now()
      where id=o.id;
    return jsonb_build_object('ok',true,'status','kendala','escrowStatus','refunded');

  elsif p_action='release' then
    if coalesce(p_visitor_id,'') <> 'admin' then raise exception 'Aksi admin tidak diizinkan'; end if;
    if o.escrow_status <> 'frozen' then raise exception 'Dana belum dibekukan'; end if;

  else
    raise exception 'Aksi escrow tidak dikenal';
  end if;

  fee := round(o.total * coalesce((select fee_percent from seller_stores where id=o.store_id),5) / 100.0,2);
  net := o.total-fee;
  update seller_stores
    set balance=balance+net,total_sales=coalesce(total_sales,0)+1,updated_at=now()
    where id=o.store_id;
  insert into seller_earnings(store_id,order_id,gross,fee,net,note)
    values(o.store_id,o.id,o.total,fee,net,
      case when p_action='release' then 'Penyelesaian admin' else 'Penyelesaian marketplace' end);
  update seller_orders
    set status='selesai',escrow_status='released',completed_at=now(),updated_at=now()
    where id=o.id;
  return jsonb_build_object('ok',true,'status','selesai','escrowStatus','released');
end;
$$;

create or replace function public.seller_auto_confirm_due()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare o record; n integer:=0;
begin
  for o in select id from seller_orders where status='dikirim' and escrow_status='held' and auto_confirm_at is not null and auto_confirm_at <= now() loop
    perform public.seller_escrow_action('auto_release',o.id,null,null);
    n:=n+1;
  end loop;
  return n;
end;
$$;

create extension if not exists pg_cron;
select cron.schedule('seller-escrow-auto-confirm','*/10 * * * *','select public.seller_auto_confirm_due();')
where not exists (select 1 from cron.job where jobname='seller-escrow-auto-confirm');

create or replace function public.seller_refresh_ratings()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_store uuid;
  v_product uuid;
begin
  v_store := coalesce(new.store_id, old.store_id);
  v_product := coalesce(new.product_id, old.product_id);

  if v_product is not null then
    update seller_products sp
    set rating_avg = coalesce((select round(avg(r.product_rating)::numeric,2) from seller_reviews r where r.product_id=sp.id),0),
        rating_count = coalesce((select count(*) from seller_reviews r where r.product_id=sp.id),0),
        updated_at = now()
    where sp.id=v_product;
  end if;

  update seller_stores st
  set rating = coalesce((select round(avg(r.store_rating)::numeric,2) from seller_reviews r where r.store_id=st.id),0),
      rating_count = coalesce((select count(*) from seller_reviews r where r.store_id=st.id),0),
      updated_at = now()
  where st.id=v_store;

  return coalesce(new, old);
end;
$$;

drop trigger if exists seller_reviews_refresh_ratings on public.seller_reviews;
create trigger seller_reviews_refresh_ratings
after insert or update or delete on public.seller_reviews
for each row execute function public.seller_refresh_ratings();
