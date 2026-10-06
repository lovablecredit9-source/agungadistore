-- Columns on existing tables
ALTER TABLE public.store_premium_voucher_claims ADD COLUMN IF NOT EXISTS claim_type text NOT NULL DEFAULT 'daily_voucher';
ALTER TABLE public.store_premium_voucher_claims ADD COLUMN IF NOT EXISTS reward_summary text;
CREATE UNIQUE INDEX IF NOT EXISTS store_premium_claims_once
  ON public.store_premium_voucher_claims ((COALESCE(user_balance_id::text, visitor_id)), claim_type, claim_date);

ALTER TABLE public.store_flash_sales ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'all';
ALTER TABLE public.store_flash_sales DROP CONSTRAINT IF EXISTS store_flash_sales_access_mode_chk;
ALTER TABLE public.store_flash_sales ADD CONSTRAINT store_flash_sales_access_mode_chk CHECK (access_mode IN ('all','premium_only','premium_early'));

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS is_premium_member boolean NOT NULL DEFAULT false;

-- Benefit config (admin_settings key 'store_premium_benefits'), merged with defaults
CREATE OR REPLACE FUNCTION public.get_store_premium_benefits()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'voucher_enabled', true, 'voucher_amount', 2000,
    'chat_priority', true,
    'member_discount_enabled', false, 'member_discount_pct', 5,
    'flash_early_enabled', true, 'flash_early_minutes', 30,
    'game_credit_discount_enabled', false, 'game_credit_discount_pct', 10,
    'weekly_game_enabled', false, 'weekly_game_credits', 5,
    'monthly_reward_enabled', false, 'monthly_reward_credits', 20, 'monthly_reward_gems', 50,
    'priority_notif_enabled', true
  ) || COALESCE((SELECT setting_value::jsonb FROM public.admin_settings WHERE setting_key = 'store_premium_benefits' LIMIT 1), '{}'::jsonb);
$$;
GRANT EXECUTE ON FUNCTION public.get_store_premium_benefits() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_store_premium_benefits(p_config jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  v := jsonb_build_object(
    'voucher_enabled', COALESCE((p_config->>'voucher_enabled')::boolean, true),
    'voucher_amount', LEAST(GREATEST(COALESCE((p_config->>'voucher_amount')::int, 2000), 0), 1000000),
    'chat_priority', COALESCE((p_config->>'chat_priority')::boolean, true),
    'member_discount_enabled', COALESCE((p_config->>'member_discount_enabled')::boolean, false),
    'member_discount_pct', LEAST(GREATEST(COALESCE((p_config->>'member_discount_pct')::int, 0), 0), 90),
    'flash_early_enabled', COALESCE((p_config->>'flash_early_enabled')::boolean, true),
    'flash_early_minutes', LEAST(GREATEST(COALESCE((p_config->>'flash_early_minutes')::int, 30), 0), 1440),
    'game_credit_discount_enabled', COALESCE((p_config->>'game_credit_discount_enabled')::boolean, false),
    'game_credit_discount_pct', LEAST(GREATEST(COALESCE((p_config->>'game_credit_discount_pct')::int, 0), 0), 90),
    'weekly_game_enabled', COALESCE((p_config->>'weekly_game_enabled')::boolean, false),
    'weekly_game_credits', LEAST(GREATEST(COALESCE((p_config->>'weekly_game_credits')::int, 0), 0), 1000),
    'monthly_reward_enabled', COALESCE((p_config->>'monthly_reward_enabled')::boolean, false),
    'monthly_reward_credits', LEAST(GREATEST(COALESCE((p_config->>'monthly_reward_credits')::int, 0), 0), 5000),
    'monthly_reward_gems', LEAST(GREATEST(COALESCE((p_config->>'monthly_reward_gems')::int, 0), 0), 5000),
    'priority_notif_enabled', COALESCE((p_config->>'priority_notif_enabled')::boolean, true)
  );
  INSERT INTO public.admin_settings (setting_key, setting_value) VALUES ('store_premium_benefits', v::text)
  ON CONFLICT DO NOTHING;
  UPDATE public.admin_settings SET setting_value = v::text, updated_at = now() WHERE setting_key = 'store_premium_benefits';
  RETURN v;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_store_premium_benefits(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_store_premium_benefits(jsonb) TO authenticated, service_role;

-- Daily voucher: same mechanism, nominal/toggle from config, only counts daily claims
CREATE OR REPLACE FUNCTION public.claim_daily_premium_voucher(p_visitor_id text)
RETURNS TABLE(success boolean, message text, voucher_code text, expires_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_ub_id UUID; v_today DATE; v_existing UUID; v_code TEXT; v_expires TIMESTAMPTZ; v_cfg jsonb; v_amount int;
BEGIN
  IF NOT public.is_store_premium(p_visitor_id) THEN
    RETURN QUERY SELECT false, 'Anda bukan member premium toko'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ; RETURN;
  END IF;
  v_cfg := public.get_store_premium_benefits();
  IF NOT COALESCE((v_cfg->>'voucher_enabled')::boolean, true) THEN
    RETURN QUERY SELECT false, 'Voucher harian sedang dinonaktifkan admin'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ; RETURN;
  END IF;
  v_amount := COALESCE((v_cfg->>'voucher_amount')::int, 2000);

  SELECT user_balance_id INTO v_ub_id FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id ORDER BY logged_in_at DESC LIMIT 1;
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;

  SELECT id INTO v_existing FROM public.store_premium_voucher_claims
  WHERE claim_date = v_today AND claim_type = 'daily_voucher'
    AND (visitor_id = p_visitor_id OR (v_ub_id IS NOT NULL AND user_balance_id = v_ub_id)) LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT false, 'Voucher hari ini sudah diklaim. Coba lagi besok!'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ; RETURN;
  END IF;

  LOOP
    v_code := 'PREMIUM-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.discount_vouchers WHERE code = v_code);
  END LOOP;
  v_expires := now() + interval '24 hours';

  BEGIN
    INSERT INTO public.store_premium_voucher_claims (visitor_id, user_balance_id, voucher_code, claim_date, claim_type, reward_summary)
    VALUES (p_visitor_id, v_ub_id, v_code, v_today, 'daily_voucher', 'Voucher Rp ' || v_amount);
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'Voucher hari ini sudah diklaim. Coba lagi besok!'::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ; RETURN;
  END;

  INSERT INTO public.discount_vouchers (code, discount_amount, max_uses, used_count, is_active, expires_at, visitor_id, user_balance_id, source)
  VALUES (v_code, v_amount, 1, 0, true, v_expires, p_visitor_id, v_ub_id, 'premium_daily');

  PERFORM public.create_notification(p_visitor_id, '👑 Voucher Premium Harian',
    'Voucher Rp ' || to_char(v_amount, 'FM999G999G999') || ' berhasil diklaim! Kode: ' || v_code || ' (berlaku 24 jam, sekali pakai).', 'success', v_code);
  RETURN QUERY SELECT true, 'Voucher berhasil diklaim!'::TEXT, v_code, v_expires;
END;
$function$;

-- Weekly game bonus / monthly reward (1x per period, server-granted)
CREATE OR REPLACE FUNCTION public.claim_store_premium_reward(p_visitor_id text, p_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_cfg jsonb; v_ub_id uuid; v_period date; v_credits int := 0; v_gems int := 0; v_today date; v_summary text;
BEGIN
  IF p_kind NOT IN ('weekly_game', 'monthly_reward') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Jenis hadiah tidak valid');
  END IF;
  IF NOT public.is_store_premium(p_visitor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Khusus member Premium aktif');
  END IF;
  v_cfg := public.get_store_premium_benefits();
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  IF p_kind = 'weekly_game' THEN
    IF NOT COALESCE((v_cfg->>'weekly_game_enabled')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Bonus game mingguan sedang nonaktif');
    END IF;
    v_period := date_trunc('week', v_today)::date;
    v_credits := COALESCE((v_cfg->>'weekly_game_credits')::int, 0);
  ELSE
    IF NOT COALESCE((v_cfg->>'monthly_reward_enabled')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Hadiah bulanan sedang nonaktif');
    END IF;
    v_period := date_trunc('month', v_today)::date;
    v_credits := COALESCE((v_cfg->>'monthly_reward_credits')::int, 0);
    v_gems := COALESCE((v_cfg->>'monthly_reward_gems')::int, 0);
  END IF;
  IF v_credits <= 0 AND v_gems <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hadiah belum diatur admin');
  END IF;
  v_summary := concat_ws(' + ', CASE WHEN v_credits > 0 THEN v_credits || ' Kredit Game' END, CASE WHEN v_gems > 0 THEN v_gems || ' Gems' END);

  SELECT user_balance_id INTO v_ub_id FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id ORDER BY logged_in_at DESC LIMIT 1;

  BEGIN
    INSERT INTO public.store_premium_voucher_claims (visitor_id, user_balance_id, voucher_code, claim_date, claim_type, reward_summary)
    VALUES (p_visitor_id, v_ub_id, upper(p_kind) || '-' || to_char(v_period, 'YYYYMMDD'), v_period, p_kind, v_summary);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', CASE WHEN p_kind = 'weekly_game' THEN 'Bonus minggu ini sudah diklaim' ELSE 'Hadiah bulan ini sudah diklaim' END);
  END;

  IF v_credits > 0 THEN PERFORM public.add_account_credits(p_visitor_id, v_credits); END IF;
  IF v_gems > 0 THEN PERFORM public.add_account_gems(p_visitor_id, v_gems); END IF;
  PERFORM public.create_notification(p_visitor_id,
    CASE WHEN p_kind = 'weekly_game' THEN '🎮 Bonus Game Premium' ELSE '🎁 Hadiah Bulanan Premium' END,
    v_summary || ' berhasil masuk ke akun kamu.', 'success', NULL);
  RETURN jsonb_build_object('ok', true, 'summary', v_summary, 'credits', v_credits, 'gems', v_gems);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_store_premium_reward(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_store_premium_reward(text, text) TO anon, authenticated, service_role;

-- Status of periodic claims for UI
CREATE OR REPLACE FUNCTION public.get_store_premium_claims(p_visitor_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ub_id uuid; v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  SELECT user_balance_id INTO v_ub_id FROM public.balance_login_history
  WHERE visitor_id = p_visitor_id ORDER BY logged_in_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'daily_voucher', EXISTS (SELECT 1 FROM public.store_premium_voucher_claims WHERE claim_type='daily_voucher' AND claim_date = v_today AND (visitor_id = p_visitor_id OR (v_ub_id IS NOT NULL AND user_balance_id = v_ub_id))),
    'weekly_game', EXISTS (SELECT 1 FROM public.store_premium_voucher_claims WHERE claim_type='weekly_game' AND claim_date = date_trunc('week', v_today)::date AND (visitor_id = p_visitor_id OR (v_ub_id IS NOT NULL AND user_balance_id = v_ub_id))),
    'monthly_reward', EXISTS (SELECT 1 FROM public.store_premium_voucher_claims WHERE claim_type='monthly_reward' AND claim_date = date_trunc('month', v_today)::date AND (visitor_id = p_visitor_id OR (v_ub_id IS NOT NULL AND user_balance_id = v_ub_id)))
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_store_premium_claims(text) TO anon, authenticated, service_role;

-- Priority tickets for premium members
CREATE OR REPLACE FUNCTION public.trg_ticket_premium_priority()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.visitor_id IS NOT NULL AND public.is_store_premium(NEW.visitor_id)
     AND COALESCE((public.get_store_premium_benefits()->>'chat_priority')::boolean, true) THEN
    NEW.is_premium_member := true;
    IF COALESCE(NEW.priority, 'normal') IN ('low', 'normal') THEN NEW.priority := 'high'; END IF;
  ELSE
    NEW.is_premium_member := false;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_ticket_premium_priority ON public.support_tickets;
CREATE TRIGGER trg_ticket_premium_priority BEFORE INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_premium_priority();

-- Priority notification when admin publishes a premium flash sale
CREATE OR REPLACE FUNCTION public.trg_flash_premium_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_title text; v_cfg jsonb; r record;
BEGIN
  IF NEW.access_mode = 'all' OR NOT NEW.is_active THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.access_mode = NEW.access_mode AND OLD.is_active = NEW.is_active THEN RETURN NEW; END IF;
  v_cfg := public.get_store_premium_benefits();
  IF NOT COALESCE((v_cfg->>'priority_notif_enabled')::boolean, true) THEN RETURN NEW; END IF;
  SELECT title INTO v_title FROM public.products WHERE id = NEW.product_id;
  FOR r IN SELECT DISTINCT ON (COALESCE(user_balance_id::text, visitor_id)) visitor_id
           FROM public.store_premium_subscriptions
           WHERE is_active AND expires_at > now() AND (locked_until IS NULL OR locked_until <= now()) LOOP
    PERFORM public.create_notification(r.visitor_id,
      CASE WHEN NEW.access_mode = 'premium_only' THEN '👑 Flash Sale Khusus Premium' ELSE '⚡ Premium Early Access' END,
      COALESCE(v_title, 'Produk') || CASE WHEN NEW.access_mode = 'premium_only'
        THEN ' — promo khusus member Premium sudah tersedia.'
        ELSE ' — kamu bisa beli ' || COALESCE((v_cfg->>'flash_early_minutes')::int, 30) || ' menit lebih awal dari user biasa.' END,
      'promo', NEW.id::text);
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_flash_premium_notify ON public.store_flash_sales;
CREATE TRIGGER trg_flash_premium_notify AFTER INSERT OR UPDATE ON public.store_flash_sales
FOR EACH ROW EXECUTE FUNCTION public.trg_flash_premium_notify();

REVOKE EXECUTE ON FUNCTION public.trg_ticket_premium_priority() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_flash_premium_notify() FROM PUBLIC, anon, authenticated;