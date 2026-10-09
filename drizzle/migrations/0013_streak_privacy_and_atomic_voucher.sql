DROP POLICY IF EXISTS "Users can view own claims" ON public.streak_voucher_claims;
DROP POLICY IF EXISTS "Lucky bonuses readable" ON public.streak_lucky_bonuses;
DROP POLICY IF EXISTS "Membership discounts readable" ON public.streak_membership_discounts;
DROP POLICY IF EXISTS "Achievement log readable" ON public.streak_achievement_log;
REVOKE SELECT ON public.streak_lucky_bonuses, public.streak_membership_discounts, public.streak_achievement_log FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_streak_autoclaim_status(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_streak_autoclaim_status(text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_streak_voucher_atomic(p_visitor_id text, p_code text, p_ub_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; amt int; lbl text; pct int; days int; cur int;
BEGIN
  IF coalesce(p_visitor_id,'') = '' OR coalesce(p_code,'') = '' THEN RETURN jsonb_build_object('error','Kode voucher wajib diisi'); END IF;
  SELECT * INTO v FROM streak_vouchers WHERE code = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Kode voucher tidak ditemukan'); END IF;
  IF NOT v.is_active THEN RETURN jsonb_build_object('error','Voucher tidak aktif'); END IF;
  IF v.starts_at > now() THEN RETURN jsonb_build_object('error','Voucher belum mulai berlaku'); END IF;
  IF v.expires_at < now() THEN RETURN jsonb_build_object('error','Voucher sudah kedaluwarsa'); END IF;
  IF v.current_claims >= v.max_claims THEN RETURN jsonb_build_object('error','Kuota voucher sudah habis'); END IF;
  IF (coalesce(array_length(v.target_visitor_ids,1),0) > 0 OR coalesce(array_length(v.target_user_balance_ids,1),0) > 0)
     AND NOT (p_visitor_id = ANY(coalesce(v.target_visitor_ids,'{}')) OR (p_ub_id IS NOT NULL AND p_ub_id::text = ANY(coalesce(v.target_user_balance_ids::text[],'{}')))) THEN
    RETURN jsonb_build_object('error','Voucher ini khusus untuk akun tertentu, kamu tidak dalam daftar penerima');
  END IF;
  IF v.reward_type = 'saldo' AND p_ub_id IS NULL THEN RETURN jsonb_build_object('error','Voucher Saldo IN memerlukan login akun saldo terlebih dahulu'); END IF;
  IF EXISTS (SELECT 1 FROM streak_voucher_claims WHERE voucher_id = v.id AND (visitor_id = p_visitor_id OR (p_ub_id IS NOT NULL AND user_balance_id = p_ub_id))) THEN
    RETURN jsonb_build_object('error','Akun ini sudah pernah klaim voucher tersebut (1 akun = 1 kali klaim)');
  END IF;
  amt := v.reward_amount;
  CASE v.reward_type
    WHEN 'gems' THEN PERFORM add_account_gems(p_visitor_id, amt);
      INSERT INTO gem_transactions (visitor_id, amount, type, description, reference_id) VALUES (p_visitor_id, amt, 'voucher', format('Klaim voucher %s: +%s 💎', v.code, amt), v.id::text);
      lbl := format('+%s 💎 Gem', amt);
    WHEN 'credits' THEN PERFORM add_account_credits(p_visitor_id, amt); lbl := format('+%s Kredit Game', amt);
    WHEN 'streak_coins' THEN
      INSERT INTO daily_streaks (visitor_id, current_streak, longest_streak, total_claims, streak_coins) VALUES (p_visitor_id, 0, 0, 0, amt)
      ON CONFLICT (visitor_id) DO UPDATE SET streak_coins = coalesce(daily_streaks.streak_coins,0) + amt;
      lbl := format('+%s 🪙 Koin Streak', amt);
    WHEN 'streak_freeze' THEN
      INSERT INTO daily_streaks (visitor_id, current_streak, longest_streak, total_claims, freeze_count) VALUES (p_visitor_id, 0, 0, 0, amt)
      ON CONFLICT (visitor_id) DO UPDATE SET freeze_count = coalesce(daily_streaks.freeze_count,0) + amt;
      lbl := format('+%s 🧊 Streak Freeze', amt);
    WHEN 'hints' THEN
      INSERT INTO user_power_ups (visitor_id, auto_hint) VALUES (p_visitor_id, amt)
      ON CONFLICT (visitor_id) DO UPDATE SET auto_hint = coalesce(user_power_ups.auto_hint,0) + amt;
      lbl := format('+%s 💡 Hint', amt);
    WHEN 'time_freeze' THEN
      INSERT INTO user_power_ups (visitor_id, time_freeze) VALUES (p_visitor_id, amt)
      ON CONFLICT (visitor_id) DO UPDATE SET time_freeze = coalesce(user_power_ups.time_freeze,0) + amt;
      lbl := format('+%s ⏱️ Time Freeze', amt);
    WHEN 'extra_life' THEN
      INSERT INTO user_power_ups (visitor_id, extra_life) VALUES (p_visitor_id, amt)
      ON CONFLICT (visitor_id) DO UPDATE SET extra_life = coalesce(user_power_ups.extra_life,0) + amt;
      lbl := format('+%s ❤️ Extra Life', amt);
    WHEN 'saldo' THEN
      INSERT INTO game_balance (visitor_id, amount) VALUES (p_visitor_id, amt)
      ON CONFLICT (visitor_id) DO UPDATE SET amount = coalesce(game_balance.amount,0) + amt;
      INSERT INTO game_balance_transactions (visitor_id, type, amount, description, reference_id) VALUES (p_visitor_id, 'voucher_claim', amt, format('Klaim voucher %s: +Rp %s Saldo IN', v.code, amt), v.id::text);
      lbl := format('+Rp %s 💰 Saldo IN', amt);
    WHEN 'storage' THEN
      INSERT INTO user_music_storage (visitor_id, storage_mb, voucher_code, purchase_ref) VALUES (p_visitor_id, amt, v.code, format('voucher:%s:%s', v.id, p_visitor_id));
      lbl := format('+%s MB 💾 Storage Musik', amt);
    WHEN 'streak_days' THEN
      UPDATE daily_streaks SET current_streak = coalesce(current_streak,0) + amt, longest_streak = greatest(coalesce(longest_streak,0), coalesce(current_streak,0) + amt) WHERE visitor_id = p_visitor_id;
      IF NOT FOUND THEN RETURN jsonb_build_object('error','Mulai streak harian dulu sebelum klaim voucher ini'); END IF;
      lbl := format('🔥 +%s Hari Streak', amt);
    WHEN 'membership_discount' THEN
      pct := least(90, greatest(1, coalesce(nullif((v.reward_payload->>'discount_percent'),'')::int, amt)));
      days := least(365, greatest(1, coalesce(nullif((v.reward_payload->>'duration_days'),'')::int, 7)));
      INSERT INTO streak_membership_discounts (visitor_id, discount_percent, expires_at, source, source_ref) VALUES (p_visitor_id, pct, now() + make_interval(days => days), 'voucher', v.code);
      lbl := format('👑 Diskon membership %s%% selama %s hari', pct, days);
    ELSE RETURN jsonb_build_object('error','Tipe hadiah voucher tidak dikenal');
  END CASE;
  INSERT INTO streak_voucher_claims (voucher_id, voucher_code, visitor_id, user_balance_id, reward_type, reward_amount, reward_label)
  VALUES (v.id, v.code, p_visitor_id, p_ub_id, v.reward_type, amt, lbl);
  UPDATE streak_vouchers SET current_claims = current_claims + 1 WHERE id = v.id RETURNING current_claims INTO cur;
  RETURN jsonb_build_object('success', true, 'voucher_name', v.name, 'voucher_code', v.code, 'reward_type', v.reward_type, 'reward_amount', amt, 'reward_label', lbl, 'remaining_quota', v.max_claims - cur);
END $$;
REVOKE ALL ON FUNCTION public.claim_streak_voucher_atomic(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_streak_voucher_atomic(text, text, uuid) TO service_role;