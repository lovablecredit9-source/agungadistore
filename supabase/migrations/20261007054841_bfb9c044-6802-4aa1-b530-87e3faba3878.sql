-- Pembayaran bersama (internal): kunci saldo, hitung split, potong, catat Saldo IN.
CREATE OR REPLACE FUNCTION public._account_pay(p_visitor_id text, p_final bigint, p_source text, p_desc text, p_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gb record; ub record; g bigint; m bigint; pg bigint := 0; pm bigint := 0; lbl text := 'Gratis';
  fmt text := 'FM999,999,999,999';
BEGIN
  IF p_source NOT IN ('auto','game','main') THEN RETURN jsonb_build_object('error','Sumber pembayaran tidak valid'); END IF;
  SELECT id, amount INTO gb FROM game_balance WHERE visitor_id = p_visitor_id FOR UPDATE;
  SELECT id, balance INTO ub FROM user_balances WHERE visitor_id = p_visitor_id FOR UPDATE;
  IF ub.id IS NULL THEN RETURN jsonb_build_object('error','Silakan login ke akun saldo terlebih dahulu.'); END IF;
  g := coalesce(gb.amount,0); m := coalesce(ub.balance,0);
  IF p_final > 0 THEN
    IF p_source = 'game' THEN
      IF g < p_final THEN RETURN jsonb_build_object('error', format('Saldo IN tidak cukup. Butuh Rp%s, Saldo IN Rp%s.', replace(to_char(p_final,fmt),',','.'), replace(to_char(g,fmt),',','.'))); END IF;
      pg := p_final;
    ELSIF p_source = 'main' THEN
      IF m < p_final THEN RETURN jsonb_build_object('error', format('Saldo Utama tidak cukup. Butuh Rp%s, Saldo Utama Rp%s.', replace(to_char(p_final,fmt),',','.'), replace(to_char(m,fmt),',','.'))); END IF;
      pm := p_final;
    ELSE
      pg := least(g, p_final); pm := p_final - pg;
      IF m < pm THEN RETURN jsonb_build_object('error', format('Saldo tidak cukup. Butuh Rp%s. Saldo IN Rp%s, Saldo Utama Rp%s.', replace(to_char(p_final,fmt),',','.'), replace(to_char(g,fmt),',','.'), replace(to_char(m,fmt),',','.'))); END IF;
    END IF;
    lbl := CASE WHEN pg > 0 AND pm > 0 THEN 'Saldo IN + Saldo Utama' WHEN pg > 0 THEN 'Saldo IN' ELSE 'Saldo Utama' END;
  END IF;
  IF pg > 0 THEN
    UPDATE game_balance SET amount = amount - pg, total_spent = coalesce(total_spent,0) + pg WHERE id = gb.id;
    INSERT INTO game_balance_transactions (visitor_id, type, amount, description, reference_id) VALUES (p_visitor_id, 'spend', -pg, p_desc, p_ref);
  END IF;
  IF pm > 0 THEN UPDATE user_balances SET balance = balance - pm, updated_at = now() WHERE id = ub.id; END IF;
  RETURN jsonb_build_object('paid_from_game', pg, 'paid_from_main', pm, 'source_label', lbl,
    'balance_before', m, 'balance_after', m - pm, 'game_balance_before', g, 'game_balance_after', g - pg);
END $$;

-- Klaim streak hari ini (WIB) setelah beli paket streak, sama seperti alur lama.
CREATE OR REPLACE FUNCTION public._streak_autoclaim(p_visitor_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE today date := (now() AT TIME ZONE 'Asia/Jakarta')::date; s record; ns int;
BEGIN
  SELECT * INTO s FROM daily_streaks WHERE visitor_id = p_visitor_id FOR UPDATE;
  IF s.id IS NULL THEN
    INSERT INTO daily_streaks (visitor_id, last_claim_date, current_streak, longest_streak, total_claims) VALUES (p_visitor_id, today, 1, 1, 1)
    ON CONFLICT (visitor_id) DO NOTHING;
  ELSIF s.last_claim_date IS DISTINCT FROM today THEN
    ns := CASE WHEN s.last_claim_date = today - 1 THEN coalesce(s.current_streak,0) + 1 ELSE 1 END;
    UPDATE daily_streaks SET last_claim_date = today, current_streak = ns, longest_streak = greatest(coalesce(longest_streak,0), ns),
      total_claims = coalesce(total_claims,0) + 1, updated_at = now() WHERE id = s.id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._streak_active_until(p_visitor_id text)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT max(expires_at) FROM streak_subscriptions WHERE visitor_id = p_visitor_id AND is_active AND expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public._music_storage_active_mb(p_visitor_id text)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(storage_mb),0)::bigint FROM user_music_storage WHERE visitor_id = p_visitor_id AND (expires_at IS NULL OR expires_at > now());
$$;

-- Perkiraan harga streak (aman untuk browser: hanya membaca paket/voucher).
CREATE OR REPLACE FUNCTION public.streak_plan_quote(p_package_id uuid, p_voucher text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; fs_end text; pct int := 0; after_flash bigint; vdisc bigint := 0; v record; verr text; code text := upper(trim(coalesce(p_voucher,'')));
BEGIN
  SELECT * INTO p FROM streak_packages WHERE id = p_package_id;
  IF p.id IS NULL THEN RETURN jsonb_build_object('error','Paket tidak ditemukan'); END IF;
  IF NOT p.is_active THEN RETURN jsonb_build_object('error','Paket sedang tidak aktif'); END IF;
  SELECT setting_value INTO fs_end FROM admin_settings WHERE setting_key = 'flash_sale_end';
  BEGIN
    IF coalesce(fs_end,'') <> '' AND fs_end::timestamptz > now() THEN
      SELECT least(100, greatest(0, coalesce(nullif(regexp_replace(setting_value,'\D','','g'),'')::int,0))) INTO pct FROM admin_settings WHERE setting_key = 'promo_streak_discount';
    END IF;
  EXCEPTION WHEN others THEN pct := 0; END;
  pct := coalesce(pct,0);
  after_flash := greatest(0, round(p.price * (1 - pct / 100.0)))::bigint;
  IF code <> '' THEN
    SELECT * INTO v FROM streak_discount_vouchers WHERE code = upper(trim(p_voucher));
    IF v.id IS NULL OR NOT v.is_active THEN verr := 'Voucher tidak valid';
    ELSIF v.expires_at IS NOT NULL AND v.expires_at <= now() THEN verr := 'Voucher sudah kedaluwarsa';
    ELSIF v.used_count >= v.max_uses THEN verr := 'Voucher sudah habis dipakai';
    ELSE vdisc := least(v.discount_amount, after_flash); END IF;
  END IF;
  RETURN jsonb_build_object('package_id', p.id, 'name', p.name, 'days', p.days, 'price', p.price, 'flash_pct', pct,
    'flash_discount', p.price - after_flash, 'voucher_discount', vdisc, 'final_price', after_flash - vdisc,
    'voucher_expires_at', CASE WHEN vdisc > 0 THEN v.expires_at END, 'voucher_error', verr);
END $$;

CREATE OR REPLACE FUNCTION public.purchase_streak_plan_atomic(p_visitor_id text, p_package_id uuid, p_voucher text, p_source text, p_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q jsonb; prev record; pay jsonb; final bigint; disc bigint; trx text; before_until timestamptz; starts timestamptz; new_until timestamptz;
BEGIN
  IF coalesce(p_visitor_id,'') = '' OR coalesce(p_ref,'') = '' OR p_package_id IS NULL THEN RETURN jsonb_build_object('error','Data tidak lengkap'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('acct_purchase:' || p_visitor_id));
  SELECT * INTO prev FROM balance_transactions WHERE purchase_ref = p_ref;
  IF FOUND THEN
    IF prev.visitor_id <> p_visitor_id THEN RETURN jsonb_build_object('error','Referensi tidak valid'); END IF;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'trx_id', prev.trx_id, 'expires_at', _streak_active_until(p_visitor_id));
  END IF;
  IF EXISTS (SELECT 1 FROM balance_transactions WHERE visitor_id = p_visitor_id AND purchase_ref LIKE 'sp:%' AND created_at > now() - interval '3 seconds') THEN
    RETURN jsonb_build_object('error','Pembelian sebelumnya masih diproses. Tunggu beberapa detik.');
  END IF;
  q := streak_plan_quote(p_package_id, p_voucher);
  IF q ? 'error' THEN RETURN q; END IF;
  IF q->>'voucher_error' IS NOT NULL THEN RETURN jsonb_build_object('error', q->>'voucher_error'); END IF;
  final := (q->>'final_price')::bigint;
  disc := (q->>'flash_discount')::bigint + (q->>'voucher_discount')::bigint;
  trx := 'SP' || to_char(now(),'YYMMDD') || lpad((floor(random()*100000))::int::text, 5, '0');
  pay := _account_pay(p_visitor_id, final, p_source, 'Beli Auto-Klaim Streak ' || (q->>'name'), trx);
  IF pay ? 'error' THEN RETURN pay; END IF;
  IF (q->>'voucher_discount')::bigint > 0 THEN
    UPDATE streak_discount_vouchers SET used_count = used_count + 1 WHERE code = upper(trim(p_voucher)) AND used_count < max_uses;
    IF NOT FOUND THEN RAISE EXCEPTION 'Voucher sudah habis dipakai.'; END IF;
  END IF;
  before_until := _streak_active_until(p_visitor_id);
  starts := greatest(coalesce(before_until, now()), now());
  new_until := starts + make_interval(days => (q->>'days')::int);
  INSERT INTO streak_subscriptions (visitor_id, plan_name, plan_days, price_paid, starts_at, expires_at, is_active)
    VALUES (p_visitor_id, q->>'name', (q->>'days')::int, final, starts, new_until, true);
  PERFORM _streak_autoclaim(p_visitor_id);
  INSERT INTO balance_transactions (visitor_id, type, amount, description, trx_id, purchase_ref)
    VALUES (p_visitor_id, 'purchase', (pay->>'paid_from_main')::bigint,
      format('Beli paket Auto-Klaim Streak %s (+%s hari, sampai %s) [%s]%s', q->>'name', q->>'days', to_char(new_until AT TIME ZONE 'Asia/Jakarta','DD-MM-YYYY'), pay->>'source_label',
        CASE WHEN disc > 0 THEN format(' diskon Rp%s', replace(to_char(disc,'FM999,999,999'),',','.')) ELSE '' END), trx, p_ref);
  RETURN pay || jsonb_build_object('success', true, 'duplicate', false, 'trx_id', trx, 'plan', q->>'name', 'days', (q->>'days')::int,
    'price', (q->>'price')::bigint, 'flash_discount_amount', (q->>'flash_discount')::bigint, 'voucher_discount_amount', (q->>'voucher_discount')::bigint,
    'discount_amount', disc, 'final_price', final, 'streak_until_before', before_until, 'expires_at', new_until,
    'balance_remaining', (pay->>'balance_after')::bigint, 'game_balance_remaining', (pay->>'game_balance_after')::bigint);
END $$;

CREATE OR REPLACE FUNCTION public.purchase_bundle_atomic(p_visitor_id text, p_package_id uuid, p_source text, p_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record; prev record; pay jsonb; trx text; c_before int; c_after int; s_before timestamptz; s_after timestamptz; starts timestamptz;
  m_before bigint; m_after bigint; st_exp timestamptz; parts text[] := '{}';
BEGIN
  IF coalesce(p_visitor_id,'') = '' OR coalesce(p_ref,'') = '' OR p_package_id IS NULL THEN RETURN jsonb_build_object('error','Data tidak lengkap'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('acct_purchase:' || p_visitor_id));
  SELECT * INTO prev FROM balance_transactions WHERE purchase_ref = p_ref;
  IF FOUND THEN
    IF prev.visitor_id <> p_visitor_id THEN RETURN jsonb_build_object('error','Referensi tidak valid'); END IF;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'trx_id', prev.trx_id);
  END IF;
  IF EXISTS (SELECT 1 FROM balance_transactions WHERE visitor_id = p_visitor_id AND purchase_ref LIKE 'bd:%' AND created_at > now() - interval '3 seconds') THEN
    RETURN jsonb_build_object('error','Pembelian sebelumnya masih diproses. Tunggu beberapa detik.');
  END IF;
  SELECT * INTO b FROM bundle_packages WHERE id = p_package_id;
  IF b.id IS NULL THEN RETURN jsonb_build_object('error','Paket tidak ditemukan'); END IF;
  IF NOT b.is_active THEN RETURN jsonb_build_object('error','Paket sedang tidak aktif'); END IF;
  trx := 'BD' || to_char(now(),'YYMMDD') || lpad((floor(random()*100000))::int::text, 5, '0');
  pay := _account_pay(p_visitor_id, b.price, p_source, 'Beli Paket Bundel: ' || b.name, trx);
  IF pay ? 'error' THEN RETURN pay; END IF;

  c_before := get_account_credits(p_visitor_id);
  s_before := _streak_active_until(p_visitor_id);
  m_before := _music_storage_active_mb(p_visitor_id);
  IF coalesce(b.credits,0) > 0 THEN
    INSERT INTO user_game_credits (visitor_id, credits) VALUES (p_visitor_id, b.credits)
    ON CONFLICT (visitor_id) DO UPDATE SET credits = user_game_credits.credits + excluded.credits, updated_at = now();
    parts := parts || format('%s Kredit', b.credits);
  END IF;
  IF coalesce(b.streak_days,0) > 0 THEN
    starts := greatest(coalesce(s_before, now()), now());
    INSERT INTO streak_subscriptions (visitor_id, plan_name, plan_days, price_paid, starts_at, expires_at, is_active)
      VALUES (p_visitor_id, b.name, b.streak_days, 0, starts, starts + make_interval(days => b.streak_days), true);
    PERFORM _streak_autoclaim(p_visitor_id);
    parts := parts || format('%s Hari Streak', b.streak_days);
  END IF;
  IF coalesce(b.storage_mb,0) > 0 THEN
    st_exp := now() + interval '30 days';
    INSERT INTO user_music_storage (visitor_id, storage_mb, voucher_code, expires_at, purchase_ref)
      VALUES (p_visitor_id, b.storage_mb, 'BUNDLE-' || trx, st_exp, p_ref);
    parts := parts || format('%s MB Storage (30 hari)', b.storage_mb);
  END IF;
  c_after := get_account_credits(p_visitor_id);
  s_after := _streak_active_until(p_visitor_id);
  m_after := _music_storage_active_mb(p_visitor_id);
  INSERT INTO balance_transactions (visitor_id, type, amount, description, trx_id, purchase_ref)
    VALUES (p_visitor_id, 'purchase', (pay->>'paid_from_main')::bigint,
      format('Beli Paket Bundel: %s (%s) [%s]', b.name, array_to_string(parts, ' + '), pay->>'source_label'), trx, p_ref);
  RETURN pay || jsonb_build_object('success', true, 'duplicate', false, 'trx_id', trx, 'bundle_name', b.name,
    'price', b.price, 'discount_amount', 0, 'final_price', b.price,
    'credits_added', coalesce(b.credits,0), 'credits_before', c_before, 'credits_after', c_after,
    'streak_days', coalesce(b.streak_days,0), 'streak_until_before', s_before, 'streak_until_after', s_after,
    'storage_mb', coalesce(b.storage_mb,0), 'storage_before_mb', m_before, 'storage_after_mb', m_after, 'storage_expires_at', st_exp,
    'balance_remaining', (pay->>'balance_after')::bigint, 'game_balance_remaining', (pay->>'game_balance_after')::bigint);
END $$;

REVOKE ALL ON FUNCTION public._account_pay(text, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._streak_autoclaim(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._streak_active_until(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._music_storage_active_mb(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_streak_plan_atomic(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_bundle_atomic(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.streak_plan_quote(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._account_pay(text, bigint, text, text, text), public._streak_autoclaim(text), public._streak_active_until(text),
  public._music_storage_active_mb(text), public.purchase_streak_plan_atomic(text, uuid, text, text, text),
  public.purchase_bundle_atomic(text, uuid, text, text), public.streak_plan_quote(uuid, text) TO service_role;