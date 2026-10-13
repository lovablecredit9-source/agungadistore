-- lovable-cron-fallback-reviewed: rental expiry is time-based (1-hour plans) with no row change at expiry; 5-minute cadence bounds freeze delay, reads also expire on demand
CREATE TABLE public.bot_rental_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  duration_seconds bigint NOT NULL CHECK (duration_seconds > 0),
  duration_label text NOT NULL,
  price bigint NOT NULL CHECK (price >= 0),
  popular boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bot_rental_plans TO anon, authenticated;
GRANT ALL ON public.bot_rental_plans TO service_role;
ALTER TABLE public.bot_rental_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active plans readable" ON public.bot_rental_plans FOR SELECT TO anon, authenticated USING (active);

INSERT INTO public.bot_rental_plans (code,name,duration_seconds,duration_label,price,popular,sort_order) VALUES
 ('1h','1 Jam',3600,'1 Jam',1000,false,1),
 ('1d','1 Hari',86400,'1 Hari',2000,false,2),
 ('7d','7 Hari',604800,'7 Hari',5000,true,3),
 ('1m','1 Bulan',2592000,'1 Bulan',10000,true,4),
 ('2m','2 Bulan',5184000,'2 Bulan',20000,false,5),
 ('6m','6 Bulan',15552000,'6 Bulan',50000,false,6),
 ('1y','1 Tahun',31536000,'1 Tahun',100000,false,7);

CREATE TABLE public.bot_rental_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  slot_price bigint NOT NULL DEFAULT 5000 CHECK (slot_price >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.bot_rental_settings (id) VALUES (1);
GRANT SELECT ON public.bot_rental_settings TO anon, authenticated;
GRANT ALL ON public.bot_rental_settings TO service_role;
ALTER TABLE public.bot_rental_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.bot_rental_settings FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.bot_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_balance_id uuid NOT NULL UNIQUE REFERENCES public.user_balances(id),
  visitor_id text NOT NULL,
  plan_id uuid REFERENCES public.bot_rental_plans(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING','ACTIVE','EXPIRED','FROZEN')),
  slots int NOT NULL DEFAULT 1 CHECK (slots >= 1),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_transaction_id text,
  expiry_period int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_rentals_expiry_idx ON public.bot_rentals (status, expires_at);

CREATE TABLE public.bot_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.bot_rentals(id),
  user_balance_id uuid NOT NULL REFERENCES public.user_balances(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  telegram_username text,
  owner_telegram_id text,
  bot_token text,
  status text NOT NULL DEFAULT 'STOPPED' CHECK (status IN ('PENDING','ACTIVE','STOPPED','EXPIRED','FROZEN','DEPLOYING','FAILED','DELETED')),
  runtime text NOT NULL DEFAULT 'nodejs',
  current_version int,
  total_users bigint,
  total_messages bigint,
  total_commands bigint,
  last_activity_at timestamptz,
  started_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_instances_owner_idx ON public.bot_instances (user_balance_id) WHERE deleted_at IS NULL;

CREATE TABLE public.bot_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bot_instances(id),
  version int NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  status text NOT NULL DEFAULT 'STORED' CHECK (status IN ('STORED','DEPLOYED','FAILED','SUPERSEDED')),
  deployment_status text NOT NULL DEFAULT 'NOT_DEPLOYED',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, version)
);

CREATE TABLE public.bot_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value bigint NOT NULL CHECK (discount_value > 0),
  applies_to text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all','plan','slot')),
  min_purchase bigint NOT NULL DEFAULT 0,
  max_uses int,
  used_count int NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_type <> 'percent' OR discount_value <= 100)
);

CREATE TABLE public.bot_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  user_balance_id uuid NOT NULL REFERENCES public.user_balances(id),
  visitor_id text NOT NULL,
  rental_id uuid REFERENCES public.bot_rentals(id),
  bot_id uuid REFERENCES public.bot_instances(id),
  plan_id uuid REFERENCES public.bot_rental_plans(id),
  kind text NOT NULL CHECK (kind IN ('NEW','EXTEND','SLOT','ADMIN_EXTEND')),
  duration_seconds bigint,
  duration_label text,
  slots_added int NOT NULL DEFAULT 0,
  base_amount bigint NOT NULL DEFAULT 0,
  discount bigint NOT NULL DEFAULT 0,
  amount bigint NOT NULL DEFAULT 0,
  voucher_id uuid REFERENCES public.bot_vouchers(id),
  previous_expires_at timestamptz,
  new_expires_at timestamptz,
  payment_source text,
  balance_before bigint,
  balance_after bigint,
  status text NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('PENDING','SUCCESS','FAILED','CANCELLED')),
  admin_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_tx_owner_idx ON public.bot_transactions (user_balance_id, created_at DESC);

CREATE TABLE public.bot_voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.bot_vouchers(id),
  user_balance_id uuid NOT NULL REFERENCES public.user_balances(id),
  transaction_id text NOT NULL REFERENCES public.bot_transactions(transaction_id),
  discount bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (voucher_id, user_balance_id)
);

CREATE TABLE public.bot_runtime_logs (
  id bigserial PRIMARY KEY,
  bot_id uuid NOT NULL REFERENCES public.bot_instances(id),
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_logs_idx ON public.bot_runtime_logs (bot_id, created_at DESC);

CREATE TABLE public.bot_notifications (
  id bigserial PRIMARY KEY,
  rental_id uuid NOT NULL REFERENCES public.bot_rentals(id),
  bot_id uuid REFERENCES public.bot_instances(id),
  event_key text NOT NULL UNIQUE,
  kind text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bot_audit_logs (
  id bigserial PRIMARY KEY,
  admin_id uuid,
  actor text NOT NULL DEFAULT 'admin',
  action text NOT NULL,
  rental_id uuid,
  bot_id uuid,
  old_expiry timestamptz,
  new_expiry timestamptz,
  reason text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['bot_rentals','bot_instances','bot_versions','bot_vouchers','bot_transactions','bot_voucher_redemptions','bot_runtime_logs','bot_notifications','bot_audit_logs'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
GRANT USAGE, SELECT ON SEQUENCE public.bot_runtime_logs_id_seq, public.bot_notifications_id_seq, public.bot_audit_logs_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.bot_rental_purchase(p_wallet uuid, p_kind text, p_plan_code text, p_slots int, p_voucher text, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ub record; pl record; r record; v record; ex record; pay jsonb;
  v_base bigint; v_disc bigint := 0; v_total bigint; v_key text; v_tx text;
  v_prev timestamptz; v_new timestamptz; v_kind text; v_slot_price bigint; v_rental uuid;
BEGIN
  IF p_request_id IS NULL OR length(p_request_id) < 8 OR length(p_request_id) > 80 THEN RETURN jsonb_build_object('error','Permintaan tidak valid'); END IF;
  v_key := 'botrent:' || p_wallet || ':' || p_request_id;
  PERFORM pg_advisory_xact_lock(hashtext('botrent-wallet:' || p_wallet));
  SELECT * INTO ex FROM bot_transactions WHERE idempotency_key = v_key;
  IF ex.id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'transaction_id', ex.transaction_id, 'amount', ex.amount, 'new_expires_at', ex.new_expires_at);
  END IF;
  SELECT id, visitor_id INTO ub FROM user_balances WHERE id = p_wallet;
  IF ub.id IS NULL THEN RETURN jsonb_build_object('error','Akun saldo tidak ditemukan'); END IF;
  SELECT * INTO r FROM bot_rentals WHERE user_balance_id = p_wallet FOR UPDATE;

  IF p_kind = 'plan' THEN
    SELECT * INTO pl FROM bot_rental_plans WHERE code = p_plan_code AND active;
    IF pl.id IS NULL THEN RETURN jsonb_build_object('error','Paket tidak tersedia'); END IF;
    v_base := pl.price;
  ELSIF p_kind = 'slot' THEN
    IF r.id IS NULL THEN RETURN jsonb_build_object('error','Anda belum memiliki paket sewa aktif. Silakan pilih paket sewa terlebih dahulu.', 'code','no_rental'); END IF;
    IF r.status <> 'ACTIVE' OR r.expires_at <= now() THEN RETURN jsonb_build_object('error','Masa sewa habis. Perpanjang sewa dulu sebelum menambah bot.', 'code','expired'); END IF;
    IF p_slots IS NULL OR p_slots < 1 OR p_slots > 20 THEN RETURN jsonb_build_object('error','Jumlah slot tidak valid (1-20)'); END IF;
    SELECT slot_price INTO v_slot_price FROM bot_rental_settings WHERE id = 1;
    v_base := v_slot_price * p_slots;
  ELSE RETURN jsonb_build_object('error','Jenis pembelian tidak valid'); END IF;

  IF coalesce(trim(p_voucher),'') <> '' THEN
    SELECT * INTO v FROM bot_vouchers WHERE code = upper(trim(p_voucher)) FOR UPDATE;
    IF v.id IS NULL THEN RETURN jsonb_build_object('error','Voucher tidak ditemukan','code','voucher'); END IF;
    IF NOT v.active THEN RETURN jsonb_build_object('error','Voucher tidak aktif','code','voucher'); END IF;
    IF v.starts_at IS NOT NULL AND v.starts_at > now() THEN RETURN jsonb_build_object('error','Voucher belum berlaku','code','voucher'); END IF;
    IF v.ends_at IS NOT NULL AND v.ends_at <= now() THEN RETURN jsonb_build_object('error','Voucher sudah kedaluwarsa','code','voucher'); END IF;
    IF v.applies_to <> 'all' AND v.applies_to <> p_kind THEN RETURN jsonb_build_object('error','Voucher tidak berlaku untuk pembelian ini','code','voucher'); END IF;
    IF v.max_uses IS NOT NULL AND v.used_count >= v.max_uses THEN RETURN jsonb_build_object('error','Kuota voucher habis','code','voucher'); END IF;
    IF v_base < v.min_purchase THEN RETURN jsonb_build_object('error', 'Minimal transaksi voucher Rp' || v.min_purchase,'code','voucher'); END IF;
    IF EXISTS (SELECT 1 FROM bot_voucher_redemptions WHERE voucher_id = v.id AND user_balance_id = p_wallet) THEN RETURN jsonb_build_object('error','Voucher sudah pernah Anda gunakan','code','voucher'); END IF;
    v_disc := CASE WHEN v.discount_type = 'percent' THEN (v_base * v.discount_value) / 100 ELSE v.discount_value END;
    v_disc := least(v_disc, v_base);
  END IF;
  v_total := v_base - v_disc;

  v_tx := 'BOT-' || to_char(now() AT TIME ZONE 'Asia/Jakarta','YYYYMMDD') || '-' || upper(substr(md5(v_key || clock_timestamp()::text),1,6));
  pay := public._account_pay(ub.visitor_id, v_total, 'main', 'Sewa Bot Telegram', v_tx);
  IF pay ? 'error' THEN RETURN pay || jsonb_build_object('code','insufficient'); END IF;

  IF p_kind = 'plan' THEN
    IF r.id IS NULL THEN
      v_kind := 'NEW'; v_prev := NULL; v_new := now() + make_interval(secs => pl.duration_seconds);
      INSERT INTO bot_rentals (user_balance_id, visitor_id, plan_id, status, slots, started_at, expires_at, last_transaction_id)
      VALUES (p_wallet, ub.visitor_id, pl.id, 'ACTIVE', 1, now(), v_new, v_tx) RETURNING id INTO v_rental;
    ELSE
      v_kind := 'EXTEND'; v_prev := r.expires_at; v_rental := r.id;
      IF r.status = 'ACTIVE' AND r.expires_at > now() THEN
        v_new := r.expires_at + make_interval(secs => pl.duration_seconds);
        UPDATE bot_rentals SET plan_id = pl.id, expires_at = v_new, last_transaction_id = v_tx, updated_at = now() WHERE id = r.id;
      ELSE
        v_new := now() + make_interval(secs => pl.duration_seconds);
        UPDATE bot_rentals SET plan_id = pl.id, status = 'ACTIVE', started_at = now(), expires_at = v_new, last_transaction_id = v_tx,
          expiry_period = expiry_period + 1, updated_at = now() WHERE id = r.id;
        UPDATE bot_instances SET status = 'STOPPED', updated_at = now() WHERE rental_id = r.id AND status IN ('EXPIRED','FROZEN') AND deleted_at IS NULL;
      END IF;
    END IF;
  ELSE
    v_kind := 'SLOT'; v_rental := r.id; v_prev := r.expires_at; v_new := r.expires_at;
    UPDATE bot_rentals SET slots = slots + p_slots, updated_at = now() WHERE id = r.id;
  END IF;

  INSERT INTO bot_transactions (transaction_id, idempotency_key, user_balance_id, visitor_id, rental_id, plan_id, kind, duration_seconds, duration_label,
    slots_added, base_amount, discount, amount, voucher_id, previous_expires_at, new_expires_at, payment_source, balance_before, balance_after, status)
  VALUES (v_tx, v_key, p_wallet, ub.visitor_id, v_rental, pl.id, v_kind, pl.duration_seconds, pl.duration_label,
    CASE WHEN p_kind='slot' THEN p_slots ELSE 0 END, v_base, v_disc, v_total, v.id, v_prev, v_new, 'Saldo Utama',
    (pay->>'balance_before')::bigint, (pay->>'balance_after')::bigint, 'SUCCESS');

  IF v.id IS NOT NULL THEN
    INSERT INTO bot_voucher_redemptions (voucher_id, user_balance_id, transaction_id, discount) VALUES (v.id, p_wallet, v_tx, v_disc);
    UPDATE bot_vouchers SET used_count = used_count + 1, updated_at = now() WHERE id = v.id;
  END IF;

  INSERT INTO balance_transactions (visitor_id, type, amount, description, purchase_ref, trx_id)
  VALUES (ub.visitor_id, 'purchase', v_total,
    CASE v_kind WHEN 'NEW' THEN 'Sewa Bot Telegram · Paket ' || pl.duration_label
                WHEN 'EXTEND' THEN 'Perpanjang Sewa Bot Telegram · ' || pl.duration_label
                ELSE 'Tambah ' || p_slots || ' Slot Bot Telegram' END
    || CASE WHEN v_disc > 0 THEN ' · Voucher -Rp' || v_disc ELSE '' END || ' · ID ' || v_tx,
    v_key, v_tx);

  INSERT INTO notifications (visitor_id, title, message, type, related_id)
  VALUES (ub.visitor_id,
    CASE v_kind WHEN 'SLOT' THEN '🤖 Slot bot bertambah' ELSE '🤖 Sewa Bot Telegram berhasil' END,
    CASE v_kind WHEN 'SLOT' THEN '+' || p_slots || ' slot bot. ID ' || v_tx
      ELSE 'Paket ' || pl.duration_label || ' aktif sampai ' || to_char(v_new AT TIME ZONE 'Asia/Jakarta','DD Mon YYYY HH24:MI') || ' WIB. ID ' || v_tx END,
    'purchase', v_tx);

  RETURN jsonb_build_object('success', true, 'transaction_id', v_tx, 'kind', v_kind, 'base', v_base, 'discount', v_disc, 'amount', v_total,
    'previous_expires_at', v_prev, 'new_expires_at', v_new, 'balance_before', pay->'balance_before', 'balance_after', pay->'balance_after');
END $$;

CREATE OR REPLACE FUNCTION public.bot_rental_quote(p_wallet uuid, p_kind text, p_plan_code text, p_slots int, p_voucher text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pl record; v record; v_base bigint; v_disc bigint := 0; v_err text; v_bal bigint;
BEGIN
  SELECT balance INTO v_bal FROM user_balances WHERE id = p_wallet;
  IF p_kind = 'plan' THEN
    SELECT * INTO pl FROM bot_rental_plans WHERE code = p_plan_code AND active;
    IF pl.id IS NULL THEN RETURN jsonb_build_object('error','Paket tidak tersedia'); END IF;
    v_base := pl.price;
  ELSE
    IF p_slots IS NULL OR p_slots < 1 OR p_slots > 20 THEN RETURN jsonb_build_object('error','Jumlah slot tidak valid'); END IF;
    SELECT slot_price * p_slots INTO v_base FROM bot_rental_settings WHERE id = 1;
  END IF;
  IF coalesce(trim(p_voucher),'') <> '' THEN
    SELECT * INTO v FROM bot_vouchers WHERE code = upper(trim(p_voucher));
    v_err := CASE
      WHEN v.id IS NULL THEN 'Voucher tidak ditemukan'
      WHEN NOT v.active THEN 'Voucher tidak aktif'
      WHEN v.starts_at IS NOT NULL AND v.starts_at > now() THEN 'Voucher belum berlaku'
      WHEN v.ends_at IS NOT NULL AND v.ends_at <= now() THEN 'Voucher sudah kedaluwarsa'
      WHEN v.applies_to <> 'all' AND v.applies_to <> p_kind THEN 'Voucher tidak berlaku untuk pembelian ini'
      WHEN v.max_uses IS NOT NULL AND v.used_count >= v.max_uses THEN 'Kuota voucher habis'
      WHEN v_base < v.min_purchase THEN 'Minimal transaksi voucher Rp' || v.min_purchase
      WHEN EXISTS (SELECT 1 FROM bot_voucher_redemptions WHERE voucher_id = v.id AND user_balance_id = p_wallet) THEN 'Voucher sudah pernah Anda gunakan'
      ELSE NULL END;
    IF v_err IS NULL THEN
      v_disc := least(v_base, CASE WHEN v.discount_type = 'percent' THEN (v_base * v.discount_value) / 100 ELSE v.discount_value END);
    END IF;
  END IF;
  RETURN jsonb_build_object('base', v_base, 'discount', v_disc, 'total', v_base - v_disc, 'voucher_error', v_err, 'balance', v_bal,
    'balance_after', coalesce(v_bal,0) - (v_base - v_disc));
END $$;

CREATE OR REPLACE FUNCTION public.bot_rental_admin_extend(p_admin uuid, p_rental uuid, p_seconds bigint, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v_new timestamptz; v_tx text;
BEGIN
  IF p_seconds IS NULL OR p_seconds <= 0 OR p_seconds > 315360000 THEN RETURN jsonb_build_object('error','Durasi tidak valid'); END IF;
  IF coalesce(trim(p_reason),'') = '' THEN RETURN jsonb_build_object('error','Alasan wajib diisi'); END IF;
  SELECT * INTO r FROM bot_rentals WHERE id = p_rental FOR UPDATE;
  IF r.id IS NULL THEN RETURN jsonb_build_object('error','Rental tidak ditemukan'); END IF;
  IF r.status = 'ACTIVE' AND r.expires_at > now() THEN v_new := r.expires_at + make_interval(secs => p_seconds);
  ELSE v_new := now() + make_interval(secs => p_seconds); END IF;
  v_tx := 'BOT-ADM-' || to_char(now() AT TIME ZONE 'Asia/Jakarta','YYYYMMDD') || '-' || upper(substr(md5(p_rental::text || clock_timestamp()::text),1,6));
  UPDATE bot_rentals SET status = 'ACTIVE', expires_at = v_new, last_transaction_id = v_tx,
    expiry_period = CASE WHEN r.status = 'ACTIVE' AND r.expires_at > now() THEN expiry_period ELSE expiry_period + 1 END,
    started_at = CASE WHEN r.status = 'ACTIVE' AND r.expires_at > now() THEN started_at ELSE now() END, updated_at = now() WHERE id = r.id;
  UPDATE bot_instances SET status = 'STOPPED', updated_at = now() WHERE rental_id = r.id AND status IN ('EXPIRED','FROZEN') AND deleted_at IS NULL;
  INSERT INTO bot_transactions (transaction_id, idempotency_key, user_balance_id, visitor_id, rental_id, kind, duration_seconds, duration_label, amount,
    previous_expires_at, new_expires_at, payment_source, status, admin_id, note)
  VALUES (v_tx, 'admin:' || v_tx, r.user_balance_id, r.visitor_id, r.id, 'ADMIN_EXTEND', p_seconds, (p_seconds/3600) || ' jam (admin)', 0,
    r.expires_at, v_new, 'Admin', 'SUCCESS', p_admin, p_reason);
  INSERT INTO bot_audit_logs (admin_id, action, rental_id, old_expiry, new_expiry, reason)
  VALUES (p_admin, 'extend', r.id, r.expires_at, v_new, p_reason);
  INSERT INTO notifications (visitor_id, title, message, type, related_id)
  VALUES (r.visitor_id, '🤖 Masa sewa bot ditambah admin', 'Aktif sampai ' || to_char(v_new AT TIME ZONE 'Asia/Jakarta','DD Mon YYYY HH24:MI') || ' WIB. ID ' || v_tx, 'system', v_tx);
  RETURN jsonb_build_object('success', true, 'transaction_id', v_tx, 'old_expiry', r.expires_at, 'new_expiry', v_new);
END $$;

CREATE OR REPLACE FUNCTION public.bot_rental_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; b record; n_exp int := 0; n_rem int := 0; v_key text; v_hours int; v_lbl text; v_text text;
BEGIN
  FOR r IN SELECT * FROM bot_rentals WHERE status = 'ACTIVE' AND expires_at <= now() FOR UPDATE SKIP LOCKED LOOP
    UPDATE bot_rentals SET status = 'EXPIRED', updated_at = now() WHERE id = r.id;
    UPDATE bot_instances SET status = 'FROZEN', updated_at = now() WHERE rental_id = r.id AND deleted_at IS NULL AND status <> 'DELETED';
    INSERT INTO bot_runtime_logs (bot_id, level, message)
      SELECT id, 'warn', 'Masa sewa habis: bot dibekukan (FROZEN). ID ' || coalesce(r.last_transaction_id,'-') FROM bot_instances WHERE rental_id = r.id AND deleted_at IS NULL;
    v_key := 'expired:' || r.id || ':' || r.expiry_period;
    INSERT INTO bot_notifications (rental_id, event_key, kind, channel, status) VALUES (r.id, v_key, 'expired', 'app', 'sent') ON CONFLICT (event_key) DO NOTHING;
    IF FOUND THEN
      INSERT INTO notifications (visitor_id, title, message, type, related_id)
      VALUES (r.visitor_id, '🔴 Masa sewa Bot Telegram berakhir', 'Bot dibekukan. Perpanjang sewa untuk mengaktifkan kembali. ID ' || coalesce(r.last_transaction_id,'-'), 'system', r.last_transaction_id);
      FOR b IN SELECT * FROM bot_instances WHERE rental_id = r.id AND deleted_at IS NULL AND bot_token IS NOT NULL AND owner_telegram_id ~ '^-?[0-9]{3,20}$' LOOP
        v_text := E'⚠️ Masa sewa bot Anda telah berakhir.\n\nBot sementara dibekukan.\n\nSilakan perpanjang masa sewa di AGUNG ADI STORE untuk mengaktifkan bot kembali.\n\nID Transaksi: '
          || coalesce(r.last_transaction_id,'-') || E'\n\nStatus: EXPIRED';
        BEGIN
          PERFORM net.http_post(url := 'https://api.telegram.org/bot' || b.bot_token || '/sendMessage',
            body := jsonb_build_object('chat_id', b.owner_telegram_id, 'text', v_text), headers := '{"Content-Type":"application/json"}'::jsonb);
          INSERT INTO bot_notifications (rental_id, bot_id, event_key, kind, channel, status) VALUES (r.id, b.id, v_key || ':tg:' || b.id, 'expired', 'owner_telegram', 'queued') ON CONFLICT DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO bot_notifications (rental_id, bot_id, event_key, kind, channel, status, detail) VALUES (r.id, b.id, v_key || ':tg:' || b.id, 'expired', 'owner_telegram', 'failed', left(SQLERRM, 200)) ON CONFLICT DO NOTHING;
        END;
      END LOOP;
    END IF;
    n_exp := n_exp + 1;
  END LOOP;

  FOR r IN SELECT * FROM bot_rentals WHERE status = 'ACTIVE' AND expires_at > now() AND expires_at <= now() + interval '3 days' LOOP
    v_hours := ceil(extract(epoch FROM (r.expires_at - now())) / 3600);
    v_lbl := CASE WHEN v_hours <= 1 THEN '1h' WHEN v_hours <= 24 THEN '1d' ELSE '3d' END;
    IF v_lbl = '3d' AND r.expires_at - r.started_at <= interval '3 days' THEN CONTINUE; END IF;
    IF v_lbl = '1d' AND r.expires_at - r.started_at <= interval '1 day' THEN CONTINUE; END IF;
    v_key := 'remind:' || v_lbl || ':' || r.id || ':' || r.expiry_period || ':' || extract(epoch FROM r.expires_at)::bigint;
    INSERT INTO bot_notifications (rental_id, event_key, kind, channel, status) VALUES (r.id, v_key, 'reminder_' || v_lbl, 'app', 'sent') ON CONFLICT (event_key) DO NOTHING;
    IF FOUND THEN
      INSERT INTO notifications (visitor_id, title, message, type, related_id)
      VALUES (r.visitor_id, '⏰ Sewa Bot Telegram hampir habis',
        'Masa sewa bot Anda akan berakhir dalam ' || CASE v_lbl WHEN '1h' THEN '1 jam' WHEN '1d' THEN '1 hari' ELSE '3 hari' END || '. Perpanjang di menu Sewa Bot.', 'system', r.last_transaction_id);
      n_rem := n_rem + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('expired', n_exp, 'reminders', n_rem);
END $$;

REVOKE ALL ON FUNCTION public.bot_rental_purchase(uuid,text,text,int,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_rental_quote(uuid,text,text,int,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_rental_admin_extend(uuid,uuid,bigint,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_rental_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_rental_purchase(uuid,text,text,int,text,text), public.bot_rental_quote(uuid,text,text,int,text),
  public.bot_rental_admin_extend(uuid,uuid,bigint,text), public.bot_rental_tick() TO service_role;

SELECT cron.schedule('bot-rental-tick', '*/5 * * * *', 'SELECT public.bot_rental_tick();');
