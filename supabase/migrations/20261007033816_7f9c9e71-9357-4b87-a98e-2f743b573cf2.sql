CREATE OR REPLACE FUNCTION public.game_credit_quote(p_visitor_id text, p_package_id uuid, p_voucher text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pkg record; fs_end text; fs_pct int := 0; after_flash bigint; member_amt bigint := 0; member_pct int := 0;
  cfg jsonb; after_member bigint; v record; v_amt bigint := 0; v_err text; v_code text := upper(trim(coalesce(p_voucher,'')));
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
  IF v_code <> '' THEN
    SELECT * INTO v FROM game_discount_vouchers g WHERE g.code = v_code AND g.is_active;
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
REVOKE ALL ON FUNCTION public.game_credit_quote(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.game_credit_quote(text, uuid, text) TO service_role;