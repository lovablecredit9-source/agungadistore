CREATE OR REPLACE FUNCTION public.streak_plan_quote(p_package_id uuid, p_voucher text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; fs_end text; pct int := 0; after_flash bigint; vdisc bigint := 0; verr text; vexp timestamptz;
  vid uuid; vact boolean; vamt bigint; vmax int; vused int; vcode text := upper(trim(coalesce(p_voucher,'')));
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
  IF vcode <> '' THEN
    SELECT d.id, d.is_active, d.discount_amount, d.max_uses, d.used_count, d.expires_at INTO vid, vact, vamt, vmax, vused, vexp
      FROM streak_discount_vouchers d WHERE d.code = vcode;
    IF vid IS NULL OR NOT vact THEN verr := 'Voucher tidak valid';
    ELSIF vexp IS NOT NULL AND vexp <= now() THEN verr := 'Voucher sudah kedaluwarsa';
    ELSIF vused >= vmax THEN verr := 'Voucher sudah habis dipakai';
    ELSE vdisc := least(vamt, after_flash); END IF;
  END IF;
  RETURN jsonb_build_object('package_id', p.id, 'name', p.name, 'days', p.days, 'price', p.price, 'flash_pct', pct,
    'flash_discount', p.price - after_flash, 'voucher_discount', vdisc, 'final_price', after_flash - vdisc,
    'voucher_expires_at', CASE WHEN vdisc > 0 THEN vexp END, 'voucher_error', verr);
END $$;
REVOKE ALL ON FUNCTION public.streak_plan_quote(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.streak_plan_quote(uuid, text) TO service_role;