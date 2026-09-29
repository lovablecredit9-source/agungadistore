ALTER TABLE public.seller_chat_threads
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.seller_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_preview text,
  ADD COLUMN IF NOT EXISTS last_sender text,
  ADD COLUMN IF NOT EXISTS buyer_unread int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_unread int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_labels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS seller_manual_unread boolean NOT NULL DEFAULT false;

ALTER TABLE public.seller_chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.seller_chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS order_ref uuid REFERENCES public.seller_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime text;

CREATE INDEX IF NOT EXISTS idx_scm_thread_created ON public.seller_chat_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sct_seller ON public.seller_chat_threads(seller_visitor_id);
CREATE INDEX IF NOT EXISTS idx_sct_buyer ON public.seller_chat_threads(buyer_visitor_id);

UPDATE public.seller_chat_threads t SET
  last_message_at = coalesce(m.created_at, t.updated_at),
  last_message_preview = m.preview, last_sender = m.sender,
  buyer_unread = coalesce(u.bu,0), seller_unread = coalesce(u.su,0),
  order_id = coalesce(t.order_id, (SELECT o.id FROM seller_orders o WHERE o.thread_id = t.id ORDER BY o.created_at DESC LIMIT 1))
FROM (SELECT t2.id tid FROM seller_chat_threads t2) x
LEFT JOIN LATERAL (SELECT created_at, sender, CASE WHEN deleted_at IS NOT NULL THEN 'Pesan dihapus' WHEN coalesce(trim(message),'')<>'' THEN left(message,120) WHEN image_url IS NOT NULL THEN '📷 Foto' ELSE '[' || coalesce(kind,'pesan') || ']' END preview
  FROM seller_chat_messages WHERE thread_id = x.tid ORDER BY created_at DESC LIMIT 1) m ON true
LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE sender='seller' AND read_at IS NULL) bu, count(*) FILTER (WHERE sender='buyer' AND read_at IS NULL) su
  FROM seller_chat_messages WHERE thread_id = x.tid) u ON true
WHERE t.id = x.tid;

CREATE TABLE IF NOT EXISTS public.seller_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_quick_replies TO authenticated;
GRANT ALL ON public.seller_quick_replies TO service_role;
ALTER TABLE public.seller_quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read quick replies" ON public.seller_quick_replies FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.seller_chat_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, name)
);
GRANT SELECT ON public.seller_chat_labels TO authenticated;
GRANT ALL ON public.seller_chat_labels TO service_role;
ALTER TABLE public.seller_chat_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read chat labels" ON public.seller_chat_labels FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.seller_chat_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL UNIQUE REFERENCES public.seller_chat_threads(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_chat_notes TO authenticated;
GRANT ALL ON public.seller_chat_notes TO service_role;
ALTER TABLE public.seller_chat_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read chat notes" ON public.seller_chat_notes FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.seller_auto_reply_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  keyword text NOT NULL CHECK (length(keyword) BETWEEN 2 AND 40),
  reply text NOT NULL CHECK (length(reply) BETWEEN 1 AND 500),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_auto_reply_rules TO authenticated;
GRANT ALL ON public.seller_auto_reply_rules TO service_role;
ALTER TABLE public.seller_auto_reply_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read auto rules" ON public.seller_auto_reply_rules FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.seller_chat_signals (
  thread_id uuid PRIMARY KEY REFERENCES public.seller_chat_threads(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_chat_signals TO anon, authenticated;
GRANT ALL ON public.seller_chat_signals TO service_role;
ALTER TABLE public.seller_chat_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads chat signals" ON public.seller_chat_signals FOR SELECT TO anon, authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_chat_signals;

DROP POLICY IF EXISTS "Mark seller enquiry messages read" ON public.seller_chat_messages;
DROP POLICY IF EXISTS "Read seller enquiry messages" ON public.seller_chat_messages;
DROP POLICY IF EXISTS "Send seller enquiry messages" ON public.seller_chat_messages;
DROP POLICY IF EXISTS "Read seller enquiry threads" ON public.seller_chat_threads;
DROP POLICY IF EXISTS "Start seller enquiry threads" ON public.seller_chat_threads;
DROP POLICY IF EXISTS "Update seller enquiry threads" ON public.seller_chat_threads;
DROP POLICY IF EXISTS "admin read chat threads" ON public.seller_chat_threads;
DROP POLICY IF EXISTS "admin read chat messages" ON public.seller_chat_messages;
CREATE POLICY "admin read chat threads" ON public.seller_chat_threads FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin read chat messages" ON public.seller_chat_messages FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.sc_after_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pv text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    pv := CASE WHEN coalesce(trim(NEW.message),'') <> '' AND NEW.message <> '📷 Foto' THEN left(NEW.message,120)
               WHEN NEW.image_url IS NOT NULL THEN '📷 Foto'
               WHEN NEW.attachment_path IS NOT NULL THEN '📎 ' || coalesce(NEW.attachment_name,'File')
               WHEN NEW.kind = 'product' THEN '🛍️ Produk' WHEN NEW.kind='order' THEN '🧾 Pesanan' ELSE coalesce(NEW.message,'') END;
    UPDATE seller_chat_threads SET last_message_at = NEW.created_at, last_message_preview = pv, last_sender = NEW.sender, updated_at = now(),
      buyer_unread = buyer_unread + CASE WHEN NEW.sender='seller' THEN 1 ELSE 0 END,
      seller_unread = seller_unread + CASE WHEN NEW.sender='buyer' THEN 1 ELSE 0 END,
      seller_archived = CASE WHEN NEW.sender='buyer' THEN false ELSE seller_archived END
    WHERE id = NEW.thread_id;
  ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE seller_chat_threads SET last_message_preview = 'Pesan dihapus' WHERE id = NEW.thread_id AND last_message_at = NEW.created_at;
  END IF;
  INSERT INTO seller_chat_signals(thread_id, at) VALUES (NEW.thread_id, now())
    ON CONFLICT (thread_id) DO UPDATE SET at = now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sc_after_message ON public.seller_chat_messages;
CREATE TRIGGER trg_sc_after_message AFTER INSERT OR UPDATE ON public.seller_chat_messages FOR EACH ROW EXECUTE FUNCTION public.sc_after_message();

CREATE OR REPLACE FUNCTION public.sc_keyword_reply() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE th record; r record;
BEGIN
  IF NEW.sender <> 'buyer' OR coalesce(NEW.message,'') = '' THEN RETURN NEW; END IF;
  SELECT t.*, s.auto_reply_enabled INTO th FROM seller_chat_threads t JOIN seller_stores s ON s.id = t.store_id WHERE t.id = NEW.thread_id;
  IF th.id IS NULL OR NOT coalesce(th.auto_reply_enabled,false) THEN RETURN NEW; END IF;
  SELECT * INTO r FROM seller_auto_reply_rules WHERE store_id = th.store_id AND is_active
    AND position(lower(keyword) in lower(NEW.message)) > 0 ORDER BY length(keyword) DESC LIMIT 1;
  IF r.id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM seller_chat_messages WHERE thread_id = th.id AND kind='auto' AND payload->>'rule' = r.id::text AND created_at > now() - interval '10 minutes') THEN RETURN NEW; END IF;
  INSERT INTO seller_chat_messages(thread_id, sender, visitor_id, message, kind, payload)
  VALUES (th.id, 'seller', th.seller_visitor_id, r.reply, 'auto', jsonb_build_object('rule', r.id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sc_keyword_reply ON public.seller_chat_messages;
CREATE TRIGGER trg_sc_keyword_reply AFTER INSERT ON public.seller_chat_messages FOR EACH ROW EXECUTE FUNCTION public.sc_keyword_reply();

CREATE OR REPLACE FUNCTION public.sc_role(p_visitor_id text, p_thread_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN coalesce(p_visitor_id,'') = '' THEN NULL
    WHEN t.seller_visitor_id = p_visitor_id AND s.visitor_id = p_visitor_id THEN 'seller'
    WHEN t.buyer_visitor_id = p_visitor_id THEN 'buyer' END
  FROM seller_chat_threads t JOIN seller_stores s ON s.id = t.store_id WHERE t.id = p_thread_id
$$;

CREATE OR REPLACE FUNCTION public.sc_require_seller(p_visitor_id text, p_thread_id uuid) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  IF public.sc_role(p_visitor_id, p_thread_id) IS DISTINCT FROM 'seller' THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  SELECT store_id INTO sid FROM seller_chat_threads WHERE id = p_thread_id;
  RETURN sid;
END $$;

CREATE OR REPLACE FUNCTION public.sc_list(p_visitor_id text, p_role text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(p_visitor_id,'') = '' THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.seller_pinned DESC, x.last_message_at DESC NULLS LAST) FROM (
    SELECT t.id, t.store_id, t.product_id, t.product_title, t.buyer_name, t.buyer_visitor_id, t.seller_visitor_id, t.order_id,
      coalesce(t.last_message_at, t.updated_at) last_message_at, t.last_message_preview, t.last_sender,
      CASE WHEN p_role='seller' THEN t.seller_unread + CASE WHEN t.seller_manual_unread AND t.seller_unread=0 THEN 1 ELSE 0 END ELSE t.buyer_unread END unread,
      CASE WHEN p_role='seller' THEN t.seller_pinned ELSE false END seller_pinned,
      CASE WHEN p_role='seller' THEN t.seller_favorite ELSE false END seller_favorite,
      CASE WHEN p_role='seller' THEN t.seller_archived ELSE false END seller_archived,
      CASE WHEN p_role='seller' THEN t.seller_labels ELSE '{}'::text[] END seller_labels,
      s.store_name, CASE WHEN s.avatar_url LIKE 'data:%' AND length(s.avatar_url) > 200000 THEN NULL ELSE s.avatar_url END store_avatar,
      (SELECT ub.avatar_url FROM user_balances ub WHERE ub.visitor_id = t.buyer_visitor_id AND coalesce(length(ub.avatar_url),0) < 200000 ORDER BY ub.last_seen_at DESC NULLS LAST LIMIT 1) buyer_avatar,
      (SELECT max(ub.last_seen_at) FROM user_balances ub WHERE ub.visitor_id = CASE WHEN p_role='seller' THEN t.buyer_visitor_id ELSE s.visitor_id END) partner_last_seen,
      (SELECT o.order_number FROM seller_orders o WHERE o.id = t.order_id) order_number
    FROM seller_chat_threads t JOIN seller_stores s ON s.id = t.store_id
    WHERE (p_role = 'seller' AND t.seller_visitor_id = p_visitor_id AND s.visitor_id = p_visitor_id)
       OR (p_role = 'buyer' AND t.buyer_visitor_id = p_visitor_id)
  ) x), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.sc_messages(p_visitor_id text, p_thread_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text;
BEGIN
  r := public.sc_role(p_visitor_id, p_thread_id);
  IF r IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  UPDATE seller_chat_messages SET read_at = now(), delivered_at = coalesce(delivered_at, now())
    WHERE thread_id = p_thread_id AND sender <> r AND read_at IS NULL;
  IF r = 'seller' THEN UPDATE seller_chat_threads SET seller_unread = 0, seller_manual_unread = false WHERE id = p_thread_id;
  ELSE UPDATE seller_chat_threads SET buyer_unread = 0 WHERE id = p_thread_id; END IF;
  RETURN jsonb_build_object('role', r, 'messages', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', m.id, 'sender', m.sender, 'visitor_id', m.visitor_id, 'message', m.message, 'image_url', m.image_url, 'kind', m.kind,
      'payload', m.payload, 'read_at', m.read_at, 'delivered_at', m.delivered_at, 'created_at', m.created_at, 'deleted_at', m.deleted_at,
      'reply_to_id', m.reply_to_id, 'edited_at', m.edited_at, 'order_ref', m.order_ref,
      'order_ref_number', (SELECT o.order_number FROM seller_orders o WHERE o.id = m.order_ref),
      'attachment_path', m.attachment_path, 'attachment_name', m.attachment_name, 'attachment_mime', m.attachment_mime
    ) ORDER BY m.created_at) FROM seller_chat_messages m WHERE m.thread_id = p_thread_id), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.sc_send(p_visitor_id text, p_thread_id uuid, p_message text, p_kind text DEFAULT 'text', p_payload jsonb DEFAULT NULL,
  p_image_url text DEFAULT NULL, p_reply_to uuid DEFAULT NULL, p_order_ref uuid DEFAULT NULL,
  p_attachment_path text DEFAULT NULL, p_attachment_name text DEFAULT NULL, p_attachment_mime text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text; th record; nid uuid; k text := coalesce(p_kind,'text');
BEGIN
  r := public.sc_role(p_visitor_id, p_thread_id);
  IF r IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF k NOT IN ('text','image','product','order','file') THEN RAISE EXCEPTION 'Jenis pesan tidak valid'; END IF;
  IF length(coalesce(p_message,'')) > 2000 THEN RAISE EXCEPTION 'Pesan terlalu panjang'; END IF;
  IF p_image_url IS NOT NULL AND (p_image_url NOT LIKE 'data:image/%' OR length(p_image_url) > 1500000) THEN RAISE EXCEPTION 'Gambar tidak valid'; END IF;
  IF coalesce(trim(p_message),'') = '' AND p_image_url IS NULL AND p_payload IS NULL AND p_attachment_path IS NULL THEN RAISE EXCEPTION 'Pesan kosong'; END IF;
  SELECT * INTO th FROM seller_chat_threads WHERE id = p_thread_id;
  IF p_attachment_path IS NOT NULL AND p_attachment_path NOT LIKE p_thread_id::text || '/%' THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF p_reply_to IS NOT NULL AND NOT EXISTS (SELECT 1 FROM seller_chat_messages WHERE id = p_reply_to AND thread_id = p_thread_id) THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF p_order_ref IS NOT NULL AND NOT EXISTS (SELECT 1 FROM seller_orders WHERE id = p_order_ref AND store_id = th.store_id AND buyer_visitor_id = th.buyer_visitor_id) THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF k = 'product' AND NOT EXISTS (SELECT 1 FROM seller_products WHERE id = (p_payload->>'id')::uuid AND store_id = th.store_id) THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  INSERT INTO seller_chat_messages(thread_id, sender, visitor_id, message, kind, payload, image_url, reply_to_id, order_ref, attachment_path, attachment_name, attachment_mime)
  VALUES (p_thread_id, r, p_visitor_id, coalesce(p_message,''), k, p_payload, p_image_url, p_reply_to, p_order_ref, p_attachment_path, left(p_attachment_name,120), p_attachment_mime)
  RETURNING id INTO nid;
  IF r = 'seller' THEN UPDATE seller_chat_threads SET seller_manual_unread = false WHERE id = p_thread_id; END IF;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.sc_edit(p_visitor_id text, p_message_id uuid, p_message text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record;
BEGIN
  SELECT * INTO m FROM seller_chat_messages WHERE id = p_message_id;
  IF m.id IS NULL OR m.visitor_id <> p_visitor_id OR public.sc_role(p_visitor_id, m.thread_id) IS NULL OR m.kind NOT IN ('text') THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF m.deleted_at IS NOT NULL OR m.created_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'Pesan hanya bisa diedit maksimal 15 menit'; END IF;
  IF coalesce(trim(p_message),'') = '' OR length(p_message) > 2000 THEN RAISE EXCEPTION 'Pesan tidak valid'; END IF;
  UPDATE seller_chat_messages SET message = p_message, edited_at = now() WHERE id = p_message_id;
END $$;

CREATE OR REPLACE FUNCTION public.sc_delete(p_visitor_id text, p_message_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record;
BEGIN
  SELECT * INTO m FROM seller_chat_messages WHERE id = p_message_id;
  IF m.id IS NULL OR m.visitor_id <> p_visitor_id OR public.sc_role(p_visitor_id, m.thread_id) IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  UPDATE seller_chat_messages SET deleted_at = now(), attachment_path = NULL, attachment_name = NULL WHERE id = p_message_id;
END $$;

CREATE OR REPLACE FUNCTION public.sc_start(p_visitor_id text, p_store_id uuid, p_product_id uuid DEFAULT NULL, p_buyer_name text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; p record; tid uuid;
BEGIN
  IF coalesce(p_visitor_id,'') = '' THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  SELECT * INTO s FROM seller_stores WHERE id = p_store_id AND is_active;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Toko tidak ditemukan'; END IF;
  IF s.visitor_id = p_visitor_id THEN RAISE EXCEPTION 'Tidak bisa chat dengan toko sendiri'; END IF;
  IF p_product_id IS NOT NULL THEN SELECT * INTO p FROM seller_products WHERE id = p_product_id AND store_id = s.id; IF p.id IS NULL THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF; END IF;
  SELECT id INTO tid FROM seller_chat_threads WHERE store_id = s.id AND buyer_visitor_id = p_visitor_id AND product_id IS NOT DISTINCT FROM p_product_id LIMIT 1;
  IF tid IS NOT NULL THEN
    IF p_buyer_name IS NOT NULL THEN UPDATE seller_chat_threads SET buyer_name = left(p_buyer_name,60) WHERE id = tid; END IF;
    RETURN tid;
  END IF;
  INSERT INTO seller_chat_threads(store_id, product_id, buyer_visitor_id, seller_visitor_id, product_title, buyer_name, last_message_at)
  VALUES (s.id, p_product_id, p_visitor_id, s.visitor_id, coalesce(p.title, s.store_name), left(coalesce(p_buyer_name,'Pembeli'),60), now()) RETURNING id INTO tid;
  RETURN tid;
END $$;

CREATE OR REPLACE FUNCTION public.sc_thread_update(p_visitor_id text, p_thread_id uuid, p_field text, p_value jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid; oid uuid;
BEGIN
  sid := public.sc_require_seller(p_visitor_id, p_thread_id);
  IF p_field = 'pinned' THEN UPDATE seller_chat_threads SET seller_pinned = (p_value#>>'{}')::boolean WHERE id = p_thread_id;
  ELSIF p_field = 'favorite' THEN UPDATE seller_chat_threads SET seller_favorite = (p_value#>>'{}')::boolean WHERE id = p_thread_id;
  ELSIF p_field = 'archived' THEN UPDATE seller_chat_threads SET seller_archived = (p_value#>>'{}')::boolean WHERE id = p_thread_id;
  ELSIF p_field = 'unread' THEN UPDATE seller_chat_threads SET seller_manual_unread = (p_value#>>'{}')::boolean WHERE id = p_thread_id;
  ELSIF p_field = 'labels' THEN
    UPDATE seller_chat_threads SET seller_labels = (SELECT coalesce(array_agg(DISTINCT left(v,30)), '{}') FROM jsonb_array_elements_text(p_value) v) WHERE id = p_thread_id;
  ELSIF p_field = 'order' THEN
    oid := nullif(p_value#>>'{}','')::uuid;
    IF oid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM seller_orders o JOIN seller_chat_threads t ON t.id = p_thread_id WHERE o.id = oid AND o.store_id = sid AND o.buyer_visitor_id = t.buyer_visitor_id) THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
    UPDATE seller_chat_threads SET order_id = oid WHERE id = p_thread_id;
  ELSE RAISE EXCEPTION 'Aksi tidak dikenal'; END IF;
  INSERT INTO seller_chat_signals(thread_id, at) VALUES (p_thread_id, now()) ON CONFLICT (thread_id) DO UPDATE SET at = now();
END $$;

CREATE OR REPLACE FUNCTION public.sc_context(p_visitor_id text, p_thread_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r text; t record;
BEGIN
  r := public.sc_role(p_visitor_id, p_thread_id);
  IF r IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  SELECT * INTO t FROM seller_chat_threads WHERE id = p_thread_id;
  RETURN jsonb_build_object(
    'role', r,
    'orders', coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'product_title',o.product_title,'product_id',o.product_id,'qty',o.qty,'total',o.total,
        'status',o.status,'escrow_status',o.escrow_status,'paid_at',o.paid_at,'created_at',o.created_at) ORDER BY o.created_at DESC)
      FROM seller_orders o WHERE o.store_id = t.store_id AND o.buyer_visitor_id = t.buyer_visitor_id), '[]'::jsonb),
    'stats', (SELECT jsonb_build_object('total_orders', count(*), 'active_orders', count(*) FILTER (WHERE o.status NOT IN ('selesai','dibatalkan','refund','completed','cancelled')),
        'total_spent', coalesce(sum(o.total) FILTER (WHERE o.paid_at IS NOT NULL AND o.escrow_status <> 'refunded'),0))
      FROM seller_orders o WHERE o.store_id = t.store_id AND o.buyer_visitor_id = t.buyer_visitor_id),
    'product', (SELECT jsonb_build_object('id',p.id,'title',p.title,'price',p.price,'promo_price',p.promo_price,'stock',p.stock,'image_url',p.image_url) FROM seller_products p WHERE p.id = t.product_id),
    'note', CASE WHEN r = 'seller' THEN (SELECT note FROM seller_chat_notes WHERE thread_id = p_thread_id) END,
    'buyer_since', CASE WHEN r = 'seller' THEN (SELECT min(created_at) FROM user_balances WHERE visitor_id = t.buyer_visitor_id) END
  );
END $$;

CREATE OR REPLACE FUNCTION public.sc_note_save(p_visitor_id text, p_thread_id uuid, p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  sid := public.sc_require_seller(p_visitor_id, p_thread_id);
  IF length(coalesce(p_note,'')) > 2000 THEN RAISE EXCEPTION 'Catatan terlalu panjang'; END IF;
  INSERT INTO seller_chat_notes(thread_id, store_id, note) VALUES (p_thread_id, sid, coalesce(p_note,''))
  ON CONFLICT (thread_id) DO UPDATE SET note = EXCLUDED.note, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.sc_store_tools(p_visitor_id text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  sid := public.seller_store_of(p_visitor_id);
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  RETURN jsonb_build_object(
    'quick', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'text',text) ORDER BY created_at) FROM seller_quick_replies WHERE store_id = sid), '[]'::jsonb),
    'labels', coalesce((SELECT jsonb_agg(name ORDER BY created_at) FROM seller_chat_labels WHERE store_id = sid), '[]'::jsonb),
    'rules', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'keyword',keyword,'reply',reply,'is_active',is_active) ORDER BY created_at) FROM seller_auto_reply_rules WHERE store_id = sid), '[]'::jsonb),
    'products', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title,'price',price,'promo_price',promo_price,'stock',stock,'image_url',image_url) ORDER BY created_at DESC)
       FROM seller_products WHERE store_id = sid AND archived_at IS NULL), '[]'::jsonb),
    'auto_reply_enabled', (SELECT auto_reply_enabled FROM seller_stores WHERE id = sid)
  );
END $$;

CREATE OR REPLACE FUNCTION public.sc_store_tool_save(p_visitor_id text, p_kind text, p_action text, p_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  sid := public.seller_store_of(p_visitor_id);
  IF sid IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF p_kind = 'quick' THEN
    IF p_action = 'add' THEN
      IF (SELECT count(*) FROM seller_quick_replies WHERE store_id = sid) >= 30 THEN RAISE EXCEPTION 'Maksimal 30 template'; END IF;
      INSERT INTO seller_quick_replies(store_id, text) VALUES (sid, trim(p_data->>'text'));
    ELSE DELETE FROM seller_quick_replies WHERE id = (p_data->>'id')::uuid AND store_id = sid; END IF;
  ELSIF p_kind = 'label' THEN
    IF p_action = 'add' THEN INSERT INTO seller_chat_labels(store_id, name) VALUES (sid, trim(p_data->>'name')) ON CONFLICT DO NOTHING;
    ELSE DELETE FROM seller_chat_labels WHERE store_id = sid AND name = p_data->>'name'; END IF;
  ELSIF p_kind = 'rule' THEN
    IF p_action = 'add' THEN INSERT INTO seller_auto_reply_rules(store_id, keyword, reply) VALUES (sid, lower(trim(p_data->>'keyword')), trim(p_data->>'reply'));
    ELSIF p_action = 'toggle' THEN UPDATE seller_auto_reply_rules SET is_active = NOT is_active WHERE id = (p_data->>'id')::uuid AND store_id = sid;
    ELSE DELETE FROM seller_auto_reply_rules WHERE id = (p_data->>'id')::uuid AND store_id = sid; END IF;
  ELSE RAISE EXCEPTION 'Aksi tidak dikenal'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sc_report(p_visitor_id text, p_thread_id uuid, p_order_id uuid, p_description text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text; t record; snip text; num bigint;
BEGIN
  r := public.sc_role(p_visitor_id, p_thread_id);
  IF r IS NULL THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  SELECT * INTO t FROM seller_chat_threads WHERE id = p_thread_id;
  IF p_order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM seller_orders WHERE id = p_order_id AND store_id = t.store_id AND buyer_visitor_id = t.buyer_visitor_id) THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF coalesce(trim(p_description),'') = '' THEN RAISE EXCEPTION 'Deskripsi wajib diisi'; END IF;
  SELECT string_agg(to_char(created_at AT TIME ZONE 'Asia/Jakarta','DD/MM HH24:MI') || ' ' || sender || ': ' || left(coalesce(nullif(message,''),'[lampiran]'),200), E'\n' ORDER BY created_at)
    INTO snip FROM (SELECT * FROM seller_chat_messages WHERE thread_id = p_thread_id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20) z;
  INSERT INTO seller_reports(product_id, order_id, store_id, visitor_id, reason, detail)
  VALUES (t.product_id, p_order_id, t.store_id, p_visitor_id, CASE WHEN r='seller' THEN 'Laporan chat dari penjual' ELSE 'Laporan chat dari pembeli' END,
    left(trim(p_description),1000) || E'\n\n— Percakapan #' || p_thread_id || E' —\n' || coalesce(snip,''))
  RETURNING report_number INTO num;
  RETURN num;
END $$;

REVOKE ALL ON FUNCTION public.sc_role(text,uuid), public.sc_require_seller(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sc_role(text,uuid), public.sc_require_seller(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sc_list(text,text), public.sc_messages(text,uuid), public.sc_send(text,uuid,text,text,jsonb,text,uuid,uuid,text,text,text),
  public.sc_edit(text,uuid,text), public.sc_delete(text,uuid), public.sc_start(text,uuid,uuid,text), public.sc_thread_update(text,uuid,text,jsonb),
  public.sc_context(text,uuid), public.sc_note_save(text,uuid,text), public.sc_store_tools(text), public.sc_store_tool_save(text,text,text,jsonb),
  public.sc_report(text,uuid,uuid,text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.sc_after_message(), public.sc_keyword_reply() FROM PUBLIC, anon, authenticated;