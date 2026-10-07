ALTER TABLE public.balance_transactions ADD COLUMN IF NOT EXISTS purchase_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS balance_transactions_purchase_ref_key ON public.balance_transactions (purchase_ref) WHERE purchase_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.game_credit_quote(p_visitor_id text, p_package_id uuid, p_voucher text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pkg record; fs_end text; fs_pct int := 0; after_flash bigint; member_amt bigint := 0; member_pct int := 0;
  cfg jsonb; after_member bigint; v record; v_amt bigint := 0; v_err text; code text := upper(trim(coalesce(p_voucher,'')));
BEGIN
  SELECT * INTO pkg FROM credit_packages WHERE id = p_package_id AND is_active;
  IF pkg IS NULL THEN RETURN jsonb_build_object('error','Paket tidak ditemukan atau tidak aktif'); END IF;
  SELECT setting_value INTO fs_end FROM admin_settings WHERE setting_key = 'flash_sale_end';
  BEGIN
    IF coalesce(fs_end,'') <> '' AND fs_end::timestamptz > now() THEN
      SELECT least(100, greatest(0, coalesce(nullif(regexp_replace(setting_value,'[^0-9-]','','g'),'')::int,0))) INTO fs_pct
        FROM admin_settings WHERE setting_key = 'promo_credit_discount';
    END IF;
  EXCEPTION WHEN others THEN fs_pct := 0; END;
  fs_pct := coalesce(fs_pct,0);
  after_flash := CASE WHEN fs_pct > 0 THEN greatest(0, round(pkg.price * (100 - fs_pct) / 100.0)::bigint) ELSE pkg.price END;
  IF coalesce(p_visitor_id,'') <> '' AND is_store_premium(p_visitor_id) THEN
    cfg := get_store_premium_benefits();
    IF coalesce((cfg->>'game_credit_discount_enabled')::boolean, false) THEN
      member_pct := greatest(0, least(90, coalesce((cfg->>'game_credit_discount_pct')::numeric,0)::int));
      member_amt := floor(after_flash * member_pct / 100.0)::bigint;
    END IF;
  END IF;
  after_member := after_flash - member_amt;
  IF code <> '' THEN
    SELECT * INTO v FROM game_discount_vouchers WHERE code = upper(trim(p_voucher)) AND is_active;
    IF v IS NULL THEN v_err := 'Voucher tidak valid atau sudah tidak berlaku.';
    ELSIF v.used_count >= v.max_uses THEN v_err := 'Voucher sudah habis dipakai.';
    ELSIF v.expires_at IS NOT NULL AND v.expires_at < now() THEN v_err := 'Voucher sudah kedaluwarsa.';
    ELSE v_amt := least(v.discount_amount, after_member); END IF;
  END IF;
  RETURN jsonb_build_object('package_id', pkg.id, 'label', pkg.label, 'credits', pkg.credits, 'is_unlimited', pkg.is_unlimited,
    'unlimited_days', pkg.unlimited_days, 'price', pkg.price, 'flash_pct', fs_pct, 'flash_discount', pkg.price - after_flash,
    'member_pct', member_pct, 'member_discount', member_amt, 'voucher_discount', v_amt, 'voucher_error', v_err,
    'final_price', greatest(0, after_member - v_amt));
END $$;

CREATE OR REPLACE FUNCTION public.purchase_game_credits(p_visitor_id text, p_package_id uuid, p_voucher text, p_source text, p_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE q jsonb; prev record; gb record; ub record; g_amt bigint := 0; m_amt bigint := 0; pay_g bigint := 0; pay_m bigint := 0;
  final bigint; label text := 'Gratis'; trx text; new_until timestamptz; total int; disc bigint; days int;
  fmt text := 'FM999,999,999,999';
BEGIN
  IF coalesce(p_visitor_id,'') = '' OR coalesce(p_ref,'') = '' OR p_package_id IS NULL THEN RETURN jsonb_build_object('error','Data tidak lengkap'); END IF;
  IF p_source NOT IN ('auto','game','main') THEN RETURN jsonb_build_object('error','Sumber pembayaran tidak valid'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('game_credits:' || p_visitor_id));

  SELECT * INTO prev FROM balance_transactions WHERE purchase_ref = p_ref;
  IF prev IS NOT NULL THEN
    IF prev.visitor_id <> p_visitor_id THEN RETURN jsonb_build_object('error','Referensi tidak valid'); END IF;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'trx_id', prev.trx_id,
      'credits', get_account_credits(p_visitor_id));
  END IF;
  IF EXISTS (SELECT 1 FROM balance_transactions WHERE visitor_id = p_visitor_id AND purchase_ref LIKE 'gc:%' AND created_at > now() - interval '3 seconds') THEN
    RETURN jsonb_build_object('error','Pembelian sebelumnya masih diproses. Tunggu beberapa detik.');
  END IF;

  q := game_credit_quote(p_visitor_id, p_package_id, p_voucher);
  IF q ? 'error' THEN RETURN q; END IF;
  IF q->>'voucher_error' IS NOT NULL THEN RETURN jsonb_build_object('error', q->>'voucher_error'); END IF;
  final := (q->>'final_price')::bigint;
  disc := (q->>'flash_discount')::bigint + (q->>'member_discount')::bigint + (q->>'voucher_discount')::bigint;

  SELECT id, amount, total_spent INTO gb FROM game_balance WHERE visitor_id = p_visitor_id FOR UPDATE;
  SELECT id, balance INTO ub FROM user_balances WHERE visitor_id = p_visitor_id FOR UPDATE;
  IF ub IS NULL THEN RETURN jsonb_build_object('error','Silakan login ke akun saldo terlebih dahulu.'); END IF;
  g_amt := coalesce(gb.amount,0); m_amt := coalesce(ub.balance,0);

  IF final > 0 THEN
    IF p_source = 'game' THEN
      IF g_amt < final THEN RETURN jsonb_build_object('error', format('Saldo IN tidak cukup. Butuh Rp%s, Saldo IN Rp%s.', replace(to_char(final,fmt),',','.'), replace(to_char(g_amt,fmt),',','.'))); END IF;
      pay_g := final;
    ELSIF p_source = 'main' THEN
      IF m_amt < final THEN RETURN jsonb_build_object('error', format('Saldo Utama tidak cukup. Butuh Rp%s, Saldo Utama Rp%s.', replace(to_char(final,fmt),',','.'), replace(to_char(m_amt,fmt),',','.'))); END IF;
      pay_m := final;
    ELSE
      pay_g := least(g_amt, final); pay_m := final - pay_g;
      IF m_amt < pay_m THEN RETURN jsonb_build_object('error', format('Saldo tidak cukup. Butuh Rp%s. Saldo IN Rp%s, Saldo Utama Rp%s.', replace(to_char(final,fmt),',','.'), replace(to_char(g_amt,fmt),',','.'), replace(to_char(m_amt,fmt),',','.'))); END IF;
    END IF;
    label := CASE WHEN pay_g > 0 AND pay_m > 0 THEN 'Saldo IN + Saldo Utama' WHEN pay_g > 0 THEN 'Saldo IN' ELSE 'Saldo Utama' END;
  END IF;

  trx := 'GC' || to_char(now(),'YYMMDD') || lpad((floor(random()*100000))::int::text, 5, '0');
  IF pay_g > 0 THEN
    UPDATE game_balance SET amount = amount - pay_g, total_spent = coalesce(total_spent,0) + pay_g WHERE id = gb.id;
    INSERT INTO game_balance_transactions (visitor_id, type, amount, description, reference_id)
      VALUES (p_visitor_id, 'spend', -pay_g, 'Beli ' || (q->>'label'), trx);
  END IF;
  IF pay_m > 0 THEN
    UPDATE user_balances SET balance = balance - pay_m, updated_at = now() WHERE id = ub.id;
  END IF;
  IF (q->>'voucher_discount')::bigint > 0 THEN
    UPDATE game_discount_vouchers SET used_count = used_count + 1
      WHERE code = upper(trim(p_voucher)) AND used_count < max_uses;
    IF NOT FOUND THEN RAISE EXCEPTION 'Voucher sudah habis dipakai.'; END IF;
  END IF;

  IF (q->>'is_unlimited')::boolean THEN
    days := greatest(1, coalesce(nullif((q->>'unlimited_days')::int,0),30));
    INSERT INTO user_game_credits (visitor_id, credits, unlimited_until)
      VALUES (p_visitor_id, 0, now() + make_interval(days => days))
    ON CONFLICT (visitor_id) DO UPDATE SET
      unlimited_until = greatest(coalesce(user_game_credits.unlimited_until, now()), now()) + make_interval(days => days),
      updated_at = now()
    RETURNING unlimited_until INTO new_until;
  ELSE
    INSERT INTO user_game_credits (visitor_id, credits) VALUES (p_visitor_id, (q->>'credits')::int)
    ON CONFLICT (visitor_id) DO UPDATE SET credits = user_game_credits.credits + excluded.credits, updated_at = now();
  END IF;

  INSERT INTO balance_transactions (visitor_id, type, amount, description, trx_id, purchase_ref)
    VALUES (p_visitor_id, 'purchase', pay_m, format('Beli %s (Kredit Jawaban Game) [%s]%s', q->>'label', label,
      CASE WHEN disc > 0 THEN format(' diskon Rp%s', replace(to_char(disc,fmt),',','.')) ELSE '' END), trx, p_ref);

  total := get_account_credits(p_visitor_id);
  RETURN jsonb_build_object('success', true, 'duplicate', false, 'trx_id', trx, 'package', jsonb_build_object(
      'id', q->>'package_id', 'label', q->>'label', 'credits', (q->>'credits')::int, 'is_unlimited', (q->>'is_unlimited')::boolean, 'unlimited_days', (q->>'unlimited_days')::int),
    'credits', total, 'unlimited_until', new_until, 'price', (q->>'price')::bigint, 'final_price', final,
    'discount_amount', disc, 'flash_discount_amount', (q->>'flash_discount')::bigint, 'member_discount_amount', (q->>'member_discount')::bigint,
    'voucher_discount_amount', (q->>'voucher_discount')::bigint, 'paid_from_game', pay_g, 'paid_from_main', pay_m,
    'source_label', label, 'balance_remaining', m_amt - pay_m, 'game_balance_remaining', g_amt - pay_g);
END $$;

REVOKE ALL ON FUNCTION public.game_credit_quote(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_game_credits(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.game_credit_quote(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_game_credits(text, uuid, text, text, text) TO service_role;