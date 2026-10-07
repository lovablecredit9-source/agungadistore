-- Storage musik: hanya backend yang boleh menambah kuota
DROP POLICY IF EXISTS "Anyone can insert user music storage" ON public.user_music_storage;

-- Kode voucher diskon tidak boleh bisa dibaca publik; admin tetap bisa melihat
DROP POLICY IF EXISTS "Music discount vouchers viewable by everyone" ON public.music_discount_vouchers;
CREATE POLICY "Admin can view music discount vouchers" ON public.music_discount_vouchers
  FOR SELECT TO authenticated USING (public.is_admin_user());

ALTER TABLE public.user_music_storage ADD COLUMN IF NOT EXISTS purchase_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS user_music_storage_purchase_ref_key ON public.user_music_storage (purchase_ref) WHERE purchase_ref IS NOT NULL;

-- Hitung harga final (dipakai preview & pembelian) — sepenuhnya dari data database
CREATE OR REPLACE FUNCTION public.music_storage_quote(p_package_id uuid, p_voucher text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pkg record; v record; disc bigint := 0; verr text := null;
BEGIN
  SELECT id, name, price, storage_mb, is_active INTO pkg FROM storage_packages WHERE id = p_package_id;
  IF pkg IS NULL OR NOT pkg.is_active THEN RETURN jsonb_build_object('error','Paket storage tidak ditemukan atau sudah tidak aktif'); END IF;
  IF coalesce(trim(p_voucher),'') <> '' THEN
    SELECT * INTO v FROM music_discount_vouchers WHERE code = upper(trim(p_voucher));
    IF v IS NULL OR NOT v.is_active THEN verr := 'Kode diskon tidak valid';
    ELSIF v.expires_at IS NOT NULL AND v.expires_at < now() THEN verr := 'Kode diskon sudah expired';
    ELSIF v.used_count >= v.max_uses THEN verr := 'Kode diskon sudah habis';
    ELSE disc := least(pkg.price, greatest(0, v.discount_amount)); END IF;
  END IF;
  RETURN jsonb_build_object('package_id', pkg.id, 'name', pkg.name, 'price', pkg.price, 'storage_mb', pkg.storage_mb,
    'discount', disc, 'final_price', pkg.price - disc, 'voucher_error', verr, 'duration_days', 30);
END $$;

CREATE OR REPLACE FUNCTION public.purchase_music_storage(p_visitor_id text, p_package_id uuid, p_voucher text, p_source text, p_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q jsonb; existing record; price bigint; disc bigint; final bigint; gb record; ub record;
  g_amt bigint := 0; m_amt bigint := 0; pay_g bigint := 0; pay_m bigint := 0; label text := 'Gratis';
  exp timestamptz := now() + interval '30 days'; new_id uuid; trx text;
BEGIN
  IF coalesce(p_visitor_id,'') = '' OR coalesce(p_ref,'') = '' THEN RETURN jsonb_build_object('error','Data tidak lengkap'); END IF;
  IF p_source NOT IN ('auto','game','main') THEN RETURN jsonb_build_object('error','Sumber pembayaran tidak valid'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('music_storage:' || p_visitor_id));

  SELECT * INTO existing FROM user_music_storage WHERE purchase_ref = p_ref;
  IF existing IS NOT NULL THEN
    IF existing.visitor_id <> p_visitor_id THEN RETURN jsonb_build_object('error','Referensi tidak valid'); END IF;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'storage_id', existing.id, 'storage_mb', existing.storage_mb, 'expires_at', existing.expires_at);
  END IF;
  -- cegah klik ganda dengan referensi berbeda
  IF EXISTS (SELECT 1 FROM user_music_storage WHERE visitor_id = p_visitor_id AND purchase_ref IS NOT NULL AND redeemed_at > now() - interval '5 seconds') THEN
    RETURN jsonb_build_object('error','Pembelian sebelumnya masih diproses. Tunggu beberapa detik.');
  END IF;

  q := music_storage_quote(p_package_id, p_voucher);
  IF q ? 'error' THEN RETURN q; END IF;
  IF q->>'voucher_error' IS NOT NULL THEN RETURN jsonb_build_object('error', q->>'voucher_error'); END IF;
  price := (q->>'price')::bigint; disc := (q->>'discount')::bigint; final := (q->>'final_price')::bigint;

  SELECT id, amount, total_spent INTO gb FROM game_balance WHERE visitor_id = p_visitor_id FOR UPDATE;
  SELECT id, balance INTO ub FROM user_balances WHERE visitor_id = p_visitor_id FOR UPDATE;
  IF gb IS NULL AND ub IS NULL THEN RETURN jsonb_build_object('error','Akun saldo tidak ditemukan'); END IF;
  g_amt := coalesce(gb.amount,0); m_amt := coalesce(ub.balance,0);

  IF final > 0 THEN
    IF p_source = 'game' THEN
      IF g_amt < final THEN RETURN jsonb_build_object('error', format('Saldo IN tidak cukup. Butuh Rp%s, saldo IN Rp%s.', to_char(final,'FM999G999G999'), to_char(g_amt,'FM999G999G999'))); END IF;
      pay_g := final;
    ELSIF p_source = 'main' THEN
      IF m_amt < final THEN RETURN jsonb_build_object('error', format('Saldo Utama tidak cukup. Butuh Rp%s, saldo Rp%s.', to_char(final,'FM999G999G999'), to_char(m_amt,'FM999G999G999'))); END IF;
      pay_m := final;
    ELSE
      pay_g := least(g_amt, final); pay_m := final - pay_g;
      IF m_amt < pay_m THEN RETURN jsonb_build_object('error', format('Saldo tidak cukup. Butuh Rp%s. Saldo IN Rp%s, saldo utama Rp%s.', to_char(final,'FM999G999G999'), to_char(g_amt,'FM999G999G999'), to_char(m_amt,'FM999G999G999'))); END IF;
    END IF;
    label := CASE WHEN pay_g > 0 AND pay_m > 0 THEN 'Saldo IN + Saldo Utama' WHEN pay_g > 0 THEN 'Saldo IN' ELSE 'Saldo Utama' END;
  END IF;

  trx := 'MS' || to_char(now(),'YYMMDD') || lpad((floor(random()*100000))::int::text, 5, '0');
  IF pay_g > 0 THEN
    UPDATE game_balance SET amount = amount - pay_g, total_spent = coalesce(total_spent,0) + pay_g, updated_at = now() WHERE id = gb.id;
    INSERT INTO game_balance_transactions (visitor_id, type, amount, description, reference_id)
      VALUES (p_visitor_id, 'spend', -pay_g, 'Upgrade storage ' || (q->>'name'), p_ref);
  END IF;
  IF pay_m > 0 THEN
    UPDATE user_balances SET balance = balance - pay_m, updated_at = now() WHERE id = ub.id;
  END IF;
  INSERT INTO balance_transactions (visitor_id, type, amount, description, trx_id)
    VALUES (p_visitor_id, 'purchase', pay_m, format('Upgrade penyimpanan musik ke %s (+%s MB, 30 hari) [%s]%s', q->>'name', q->>'storage_mb', label,
      CASE WHEN disc > 0 THEN format(' diskon Rp%s', to_char(disc,'FM999G999G999')) ELSE '' END), trx);
  IF disc > 0 THEN
    UPDATE music_discount_vouchers SET used_count = used_count + 1 WHERE code = upper(trim(p_voucher));
  END IF;
  INSERT INTO user_music_storage (visitor_id, storage_mb, voucher_code, expires_at, purchase_ref)
    VALUES (p_visitor_id, (q->>'storage_mb')::bigint, 'STORAGE-' || trx, exp, p_ref) RETURNING id INTO new_id;

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'storage_id', new_id, 'trx_id', trx,
    'tier_name', q->>'name', 'storage_mb', (q->>'storage_mb')::bigint, 'price', price, 'discount', disc, 'final_price', final,
    'paid_from_game', pay_g, 'paid_from_main', pay_m, 'source_label', label, 'expires_at', exp,
    'balance_remaining', m_amt - pay_m, 'game_balance_remaining', g_amt - pay_g);
END $$;

REVOKE ALL ON FUNCTION public.purchase_music_storage(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_music_storage(text, uuid, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.music_storage_quote(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.music_storage_quote(uuid, text) TO service_role;