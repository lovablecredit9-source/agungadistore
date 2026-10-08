CREATE OR REPLACE FUNCTION public.confess_checkout(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_visitor text := NULLIF(trim(p->>'visitor_id'),'');
  v_ub uuid := NULLIF(p->>'user_balance_id','')::uuid;
  v_dry boolean := COALESCE((p->>'dry_run')::boolean, false);
  v_pin_ok boolean := COALESCE((p->>'pin_verified')::boolean, false);
  v_use_free boolean := COALESCE((p->>'use_free_send')::boolean, false);
  v_trx text := NULLIF(trim(p->>'trx_id'),'');
  v_msg text := left(COALESCE(p->>'message',''), 800);
  v_sender text := NULLIF(left(trim(COALESCE(p->>'sender_name','')),40),'');
  v_mood text := NULLIF(left(trim(COALESCE(p->>'mood_tag','')),20),'');
  v_vcode text := NULLIF(upper(left(trim(COALESCE(p->>'voucher_code','')),40)),'');
  v_ip text := NULLIF(p->>'ip_address','');
  v_fp text := NULLIF(p->>'device_fingerprint','');
  v_phones text[];
  v_names text[];
  v_now timestamptz := now();
  v_free_until timestamptz := now() + interval '24 hours';
  v_max int := 10;
  v_sub_until timestamptz;
  v_bal bigint;
  v_paid text[] := '{}';
  v_free text[] := '{}';
  v_free_map jsonb := '{}'::jsonb;
  v_normal int := 0;
  v_charge int := 0;
  v_trial int := 0;
  v_trial_ok boolean := false;
  v_trial_blocked boolean := false;
  v_voucher record;
  v_voucher_err text;
  v_voucher_disc int := 0;
  v_voucher_applied boolean := false;
  v_free_send record;
  v_free_send_used boolean := false;
  v_free_avail int := 0;
  v_conf_id uuid;
  v_existing record;
  v_thread uuid;
  v_target uuid;
  v_name text;
  v_preview text;
  v_paid_total int;
  v_granted int := 0;
  v_ms int[];
  v_repeat int;
  v_days int;
  v_last int;
  m int;
  i int;
  ph text;
BEGIN
  SELECT NULL::uuid AS id, NULL::text AS code, NULL::int AS discount_percent INTO v_voucher;
  IF v_visitor IS NULL OR v_ub IS NULL THEN
    RETURN jsonb_build_object('error','Akun saldo tidak ditemukan','code','need_login');
  END IF;
  SELECT array_agg(x ORDER BY o) INTO v_phones FROM (
    SELECT DISTINCT ON (val) val AS x, o FROM jsonb_array_elements_text(COALESCE(p->'phones','[]'::jsonb)) WITH ORDINALITY AS t(val, o) ORDER BY val, o
  ) s;
  v_phones := COALESCE(v_phones, '{}');
  IF array_length(v_phones,1) IS NULL THEN
    RETURN jsonb_build_object('error','Pilih minimal 1 nomor tujuan','code','no_phone');
  END IF;

  v_names := ARRAY(SELECT NULLIF(left(trim(COALESCE(p->'names'->>x,'')),40),'') FROM unnest(v_phones) AS x);

  IF NOT v_dry AND v_trx IS NOT NULL THEN
    SELECT id, sender_visitor_id, total_price INTO v_existing FROM confessions WHERE trx_id = v_trx;
    IF FOUND THEN
      IF v_existing.sender_visitor_id IS DISTINCT FROM v_visitor THEN
        RETURN jsonb_build_object('error','ID transaksi bentrok, muat ulang halaman','code','trx_conflict');
      END IF;
      RETURN jsonb_build_object('success',true,'duplicate',true,'trx_id',v_trx,'charged',v_existing.total_price,
        'balance_remaining',(SELECT balance FROM user_balances WHERE id=v_ub));
    END IF;
  END IF;

  IF v_dry THEN
    SELECT balance INTO v_bal FROM user_balances WHERE id = v_ub;
  ELSE
    SELECT balance INTO v_bal FROM user_balances WHERE id = v_ub FOR UPDATE;
    IF v_trx IS NOT NULL AND EXISTS (SELECT 1 FROM confessions WHERE trx_id = v_trx) THEN
      RETURN jsonb_build_object('success',true,'duplicate',true,'trx_id',v_trx,
        'charged',(SELECT total_price FROM confessions WHERE trx_id=v_trx),'balance_remaining',v_bal);
    END IF;
  END IF;
  IF v_bal IS NULL THEN RETURN jsonb_build_object('error','Saldo tidak ditemukan','code','need_login'); END IF;

  SELECT max_numbers, expires_at INTO v_max, v_sub_until FROM confess_number_subscriptions
   WHERE (user_balance_id = v_ub OR visitor_id = v_visitor) AND expires_at > v_now
   ORDER BY expires_at DESC LIMIT 1;
  v_max := COALESCE(v_max, 10);
  IF array_length(v_phones,1) > v_max THEN
    RETURN jsonb_build_object('error', CASE WHEN v_max >= 15 THEN 'Maksimal 15 penerima.' ELSE 'Kamu sudah mencapai 10 penerima. Upgrade ke Confess 15 untuk kirim hingga 15 nomor.' END,
      'code','limit','need_subscription', v_max < 15, 'max_numbers', v_max);
  END IF;

  SELECT COALESCE(jsonb_object_agg(target_phone, free_until), '{}'::jsonb) INTO v_free_map
    FROM confess_threads WHERE user_balance_id = v_ub AND target_phone = ANY(v_phones) AND free_until > v_now;
  FOREACH ph IN ARRAY v_phones LOOP
    IF v_free_map ? ph THEN v_free := v_free || ph; ELSE v_paid := v_paid || ph; END IF;
  END LOOP;
  v_normal := confess_price_for(COALESCE(array_length(v_paid,1),0));
  v_charge := v_normal;

  SELECT count(*) INTO v_free_avail FROM confess_free_sends WHERE user_balance_id = v_ub AND used_at IS NULL AND (expires_at IS NULL OR expires_at > v_now);

  IF v_charge > 0 AND v_use_free THEN
    IF v_dry THEN
      IF v_free_avail > 0 THEN v_free_send_used := true; END IF;
    ELSE
      SELECT * INTO v_free_send FROM confess_free_sends
       WHERE user_balance_id = v_ub AND used_at IS NULL AND (expires_at IS NULL OR expires_at > v_now)
       ORDER BY expires_at NULLS LAST, granted_at LIMIT 1 FOR UPDATE SKIP LOCKED;
      IF FOUND THEN v_free_send_used := true; END IF;
    END IF;
    IF NOT v_free_send_used THEN
      RETURN jsonb_build_object('error','Kamu tidak punya jatah gratis kirim','code','no_free_send');
    END IF;
    v_charge := 0;
  END IF;

  IF v_charge > 0 AND NOT EXISTS (SELECT 1 FROM confess_free_trial WHERE user_balance_id = v_ub) THEN
    IF EXISTS (SELECT 1 FROM confess_free_trial WHERE visitor_id = v_visitor
               OR (v_fp IS NOT NULL AND device_fingerprint = v_fp) OR (v_ip IS NOT NULL AND ip_address = v_ip)) THEN
      v_trial_blocked := true;
    ELSE
      v_trial := LEAST(v_charge, 2000);
      v_charge := v_charge - v_trial;
      v_trial_ok := true;
    END IF;
  END IF;

  IF v_vcode IS NOT NULL THEN
    IF v_dry THEN
      SELECT * INTO v_voucher FROM confess_vouchers WHERE code = v_vcode;
    ELSE
      SELECT * INTO v_voucher FROM confess_vouchers WHERE code = v_vcode FOR UPDATE;
    END IF;
    IF NOT FOUND THEN v_voucher_err := 'Kode voucher tidak ditemukan';
    ELSIF NOT v_voucher.is_active THEN v_voucher_err := 'Voucher tidak aktif';
    ELSIF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at <= v_now THEN v_voucher_err := 'Voucher sudah kedaluwarsa';
    ELSIF v_voucher.used_count >= v_voucher.max_uses THEN v_voucher_err := 'Voucher sudah mencapai batas penggunaan';
    END IF;
    IF v_voucher_err IS NOT NULL THEN
      IF v_dry THEN
        v_vcode := NULL;
      ELSE
        RETURN jsonb_build_object('error', v_voucher_err, 'code','voucher');
      END IF;
    ELSIF v_charge > 0 THEN
      v_voucher_disc := (v_charge * v_voucher.discount_percent) / 100;
      v_charge := GREATEST(0, v_charge - v_voucher_disc);
      v_voucher_applied := true;
    END IF;
  END IF;

  IF v_dry THEN
    RETURN jsonb_build_object('quote', true,
      'recipients', array_length(v_phones,1), 'paid_count', COALESCE(array_length(v_paid,1),0), 'free_count', COALESCE(array_length(v_free,1),0),
      'free_until', v_free_map, 'price_normal', v_normal, 'trial_discount', v_trial, 'trial_blocked', v_trial_blocked,
      'voucher_code', CASE WHEN v_voucher_applied THEN v_voucher.code END,
      'voucher_percent', CASE WHEN v_voucher_err IS NULL THEN v_voucher.discount_percent END,
      'voucher_discount', v_voucher_disc, 'voucher_error', v_voucher_err,
      'free_send_used', v_free_send_used, 'free_sends_available', v_free_avail,
      'total', v_charge, 'balance', v_bal, 'balance_after', v_bal - v_charge,
      'max_numbers', v_max, 'subscription_until', v_sub_until, 'need_pin', v_charge > 0);
  END IF;

  IF v_charge > 0 AND NOT v_pin_ok THEN
    RETURN jsonb_build_object('error','Masukkan PIN 6 digit','code','need_pin','need_pin',true,'total',v_charge);
  END IF;
  IF v_bal < v_charge THEN
    RETURN jsonb_build_object('error', format('Saldo kamu Rp%s, sedangkan pembayaran membutuhkan Rp%s.',
      to_char(v_bal,'FM999G999G999G999'), to_char(v_charge,'FM999G999G999G999')), 'code','insufficient','balance',v_bal,'total',v_charge);
  END IF;

  IF v_trx IS NULL OR v_trx NOT LIKE 'CFS-%' THEN
    v_trx := 'CFS-' || (extract(epoch from v_now)*1000)::bigint || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
  END IF;

  IF v_charge > 0 THEN
    PERFORM set_config('app.skip_bonus','true',true);
    UPDATE user_balances SET balance = balance - v_charge, updated_at = v_now WHERE id = v_ub;
    PERFORM set_config('app.skip_bonus','false',true);
    INSERT INTO balance_transactions(visitor_id, type, amount, description, trx_id, purchase_ref)
    VALUES (v_visitor, 'purchase', v_charge, format('Confess ke %s nomor', COALESCE(array_length(v_paid,1),0)), v_trx, 'confess:' || v_trx);
  END IF;

  IF v_trial_ok THEN
    INSERT INTO confess_free_trial(visitor_id, user_balance_id, ip_address, device_fingerprint) VALUES (v_visitor, v_ub, v_ip, v_fp);
  END IF;

  INSERT INTO confessions(trx_id, sender_visitor_id, sender_name, message, num_targets, total_price, status,
    media_url, media_type, media_name, media_mime, media_size, user_balance_id, price_normal, trial_discount,
    voucher_code, voucher_discount, free_send_used, paid_count, free_count)
  VALUES (v_trx, v_visitor, v_sender, v_msg, array_length(v_phones,1), v_charge, 'pending',
    NULLIF(p->>'media_url',''), NULLIF(p->>'media_type',''), NULLIF(p->>'media_name',''), NULLIF(p->>'media_mime',''), NULLIF(p->>'media_size','')::bigint,
    v_ub, v_normal, v_trial, CASE WHEN v_voucher_applied THEN v_voucher.code END, v_voucher_disc, v_free_send_used,
    COALESCE(array_length(v_paid,1),0), COALESCE(array_length(v_free,1),0))
  RETURNING id INTO v_conf_id;

  IF v_voucher_applied THEN
    UPDATE confess_vouchers SET used_count = used_count + 1, updated_at = v_now WHERE id = v_voucher.id;
    INSERT INTO confess_voucher_redemptions(voucher_id, voucher_code, visitor_id, user_balance_id, discount_percent, original_price, final_price)
    VALUES (v_voucher.id, v_voucher.code, v_visitor, v_ub, v_voucher.discount_percent, v_charge + v_voucher_disc, v_charge);
  END IF;

  IF v_free_send_used THEN
    UPDATE confess_free_sends SET used_at = v_now, used_trx_id = v_trx WHERE id = v_free_send.id;
  END IF;

  v_preview := left(COALESCE('[' || v_mood || '] ','') || v_msg, 80);
  FOR i IN 1..array_length(v_phones,1) LOOP
    ph := v_phones[i];
    v_name := v_names[i];
    INSERT INTO confession_targets(confession_id, phone, recipient_name) VALUES (v_conf_id, ph, v_name) RETURNING id INTO v_target;

    SELECT id INTO v_thread FROM confess_threads
     WHERE target_phone = ph AND (user_balance_id = v_ub OR visitor_id = v_visitor)
     ORDER BY (user_balance_id = v_ub) DESC NULLS LAST, last_message_at DESC LIMIT 1;
    IF v_thread IS NULL THEN
      INSERT INTO confess_threads(visitor_id, user_balance_id, target_phone, sender_name, recipient_name, last_paid_at, free_until, last_message_at, last_message_preview)
      VALUES (v_visitor, v_ub, ph, v_sender, v_name, v_now, v_free_until, v_now, v_preview)
      RETURNING id INTO v_thread;
    ELSE
      UPDATE confess_threads SET
        last_message_at = v_now, last_message_preview = v_preview, sender_name = v_sender,
        user_balance_id = v_ub, chat_stopped = false,
        recipient_name = COALESCE(v_name, recipient_name),
        last_paid_at = CASE WHEN v_free_map ? ph THEN last_paid_at ELSE v_now END,
        free_until = CASE WHEN v_free_map ? ph THEN free_until ELSE v_free_until END
      WHERE id = v_thread;
    END IF;

    INSERT INTO confess_thread_messages(thread_id, direction, text, status, trx_id, is_free, target_id, mood_tag, is_voice,
      media_url, media_type, media_name, media_mime, media_size)
    VALUES (v_thread, 'out', v_msg, 'pending', v_trx, v_free_map ? ph, v_target, v_mood, COALESCE((p->>'is_voice')::boolean,false),
      NULLIF(p->>'media_url',''), NULLIF(p->>'media_type',''), NULLIF(p->>'media_name',''), NULLIF(p->>'media_mime',''), NULLIF(p->>'media_size','')::bigint);
    v_thread := NULL;
  END LOOP;

  IF COALESCE((p->>'share_to_wall')::boolean,false) THEN
    INSERT INTO confess_public_wall(confession_id, visitor_id, sender_name, masked_phone, message, mood_tag)
    VALUES (v_conf_id, v_visitor, v_sender,
      (SELECT string_agg(CASE WHEN length(l) < 6 THEN l ELSE left(l,4) || '****' || right(l,4) END, ', ')
         FROM (SELECT CASE WHEN x LIKE '62%' THEN '0' || substr(x,3) ELSE x END AS l FROM unnest(v_phones) x) z),
      v_msg, v_mood);
  END IF;

  IF v_charge > 0 AND COALESCE((SELECT setting_value FROM admin_settings WHERE setting_key='confess_promo_enabled'),'on') = 'on' THEN
    SELECT count(*) INTO v_paid_total FROM confessions WHERE user_balance_id = v_ub AND total_price > 0;
    SELECT COALESCE(array_agg(DISTINCT n ORDER BY n), '{}') INTO v_ms FROM (
      SELECT NULLIF(regexp_replace(x,'\D','','g'),'')::int AS n
      FROM unnest(string_to_array(COALESCE((SELECT setting_value FROM admin_settings WHERE setting_key='confess_promo_milestones'),'5,10'), ',')) x
    ) s WHERE n > 0;
    v_repeat := COALESCE(NULLIF(regexp_replace(COALESCE((SELECT setting_value FROM admin_settings WHERE setting_key='confess_promo_repeat'),'0'),'\D','','g'),'')::int, 0);
    v_days := COALESCE(NULLIF(regexp_replace(COALESCE((SELECT setting_value FROM admin_settings WHERE setting_key='confess_free_send_days'),'30'),'\D','','g'),'')::int, 0);
    v_last := COALESCE(v_ms[array_length(v_ms,1)], 0);
    IF v_repeat > 0 AND v_last > 0 THEN
      m := v_last + v_repeat;
      WHILE m <= v_paid_total LOOP v_ms := v_ms || m; m := m + v_repeat; END LOOP;
    END IF;
    FOREACH m IN ARRAY v_ms LOOP
      IF m <= v_paid_total THEN
        INSERT INTO confess_free_sends(user_balance_id, milestone, expires_at)
        VALUES (v_ub, m, CASE WHEN v_days > 0 THEN v_now + make_interval(days => v_days) END)
        ON CONFLICT (user_balance_id, milestone) DO NOTHING;
        IF FOUND THEN v_granted := v_granted + 1; END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success',true,'trx_id',v_trx,'confession_id',v_conf_id,
    'charged',v_charge,'price_normal',v_normal,'balance_remaining',v_bal - v_charge,
    'paid_count',COALESCE(array_length(v_paid,1),0),'free_count',COALESCE(array_length(v_free,1),0),
    'trial_discount',v_trial,'trial_granted',v_trial_ok,'voucher_discount',v_voucher_disc,
    'voucher_code',CASE WHEN v_voucher_applied THEN v_voucher.code END,
    'free_send_used',v_free_send_used,'free_sends_granted',v_granted,'free_until',v_free_until,
    'recipients',array_length(v_phones,1),'status','pending');
END $$;

REVOKE ALL ON FUNCTION public.confess_checkout(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confess_checkout(jsonb) TO service_role;