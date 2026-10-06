-- 1) Akun saldo hanya dibuat lewat fungsi server (service role). Klien tidak boleh insert langsung.
DROP POLICY IF EXISTS "Anyone can create balance" ON public.user_balances;

-- Foto profil: klien hanya boleh mengganti avatar_url akun miliknya (berbasis visitor_id seperti sistem saldo).
CREATE OR REPLACE FUNCTION public.set_account_avatar(p_visitor_id text, p_avatar_url text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF p_visitor_id IS NULL OR length(p_visitor_id) < 4 THEN RAISE EXCEPTION 'Akun tidak valid'; END IF;
  IF p_avatar_url IS NOT NULL AND (p_avatar_url NOT LIKE 'data:image/%' OR length(p_avatar_url) > 400000) THEN
    RAISE EXCEPTION 'Foto tidak valid atau terlalu besar';
  END IF;
  UPDATE user_balances SET avatar_url = p_avatar_url, updated_at = now() WHERE visitor_id = p_visitor_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'Akun saldo tidak ditemukan'; END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.set_account_avatar(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_account_avatar(text, text) TO anon, authenticated;

-- 2) Langganan Streak: dibuat/diubah hanya oleh server; admin boleh menonaktifkan.
DROP POLICY IF EXISTS "Anyone can create streak subscription" ON public.streak_subscriptions;
DROP POLICY IF EXISTS "Anyone can update streak subscription" ON public.streak_subscriptions;
CREATE POLICY "Admin can update streak subscription" ON public.streak_subscriptions
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 3) Saldo game (Saldo IN): hanya server.
DROP POLICY IF EXISTS "Public insert game_balance" ON public.game_balance;
DROP POLICY IF EXISTS "Public update game_balance" ON public.game_balance;

-- 4) Tiket undian: hanya server.
DROP POLICY IF EXISTS "Anyone insert lucky tickets" ON public.lucky_draw_tickets;
DROP POLICY IF EXISTS "Anyone update lucky tickets" ON public.lucky_draw_tickets;

-- 5) Booster aktif: hanya server (activate-booster).
DROP POLICY IF EXISTS "Anyone can insert boosters" ON public.streak_active_boosters;
DROP POLICY IF EXISTS "Anyone can update boosters" ON public.streak_active_boosters;
DROP POLICY IF EXISTS "Anyone can delete boosters" ON public.streak_active_boosters;

-- 6) Voucher Confess: tulis hanya admin.
DROP POLICY IF EXISTS "confess_vouchers_admin_write" ON public.confess_vouchers;
CREATE POLICY "confess_vouchers_admin_write" ON public.confess_vouchers
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 7) Klaim Power Hour: hanya server (service role melewati RLS).
DROP POLICY IF EXISTS "Service role can manage power hour claims" ON public.streak_power_hour_claims;

-- 8) Pesanan seller tidak boleh dihapus dari browser.
DROP POLICY IF EXISTS "Anyone can delete seller order" ON public.seller_orders;
CREATE POLICY "Admin can delete seller order" ON public.seller_orders
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- 9) Penarikan seller: status hanya diubah admin; pengajuan divalidasi server.
DROP POLICY IF EXISTS "Anyone can update withdrawal" ON public.seller_withdrawals;
CREATE POLICY "Admin can update withdrawal" ON public.seller_withdrawals
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.seller_withdrawal_insert_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st record; pending numeric;
BEGIN
  IF current_user IN ('anon','authenticated') AND NOT public.is_admin_user() THEN
    SELECT * INTO st FROM seller_stores WHERE id = NEW.store_id FOR UPDATE;
    IF st.id IS NULL OR st.visitor_id IS DISTINCT FROM NEW.visitor_id THEN RAISE EXCEPTION 'Toko tidak valid'; END IF;
    IF NEW.amount IS NULL OR NEW.amount < 10000 THEN RAISE EXCEPTION 'Minimal penarikan Rp 10.000'; END IF;
    SELECT coalesce(sum(amount),0) INTO pending FROM seller_withdrawals WHERE store_id = NEW.store_id AND status = 'pending';
    IF NEW.amount + pending > coalesce(st.balance,0) THEN RAISE EXCEPTION 'Saldo toko tidak cukup'; END IF;
    NEW.status := 'pending'; NEW.admin_note := NULL; NEW.processed_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_seller_withdrawal_insert_guard ON public.seller_withdrawals;
CREATE TRIGGER trg_seller_withdrawal_insert_guard BEFORE INSERT ON public.seller_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.seller_withdrawal_insert_guard();

-- 10) Pendapatan seller hanya ditulis server.
DROP POLICY IF EXISTS "Anyone can create seller earning" ON public.seller_earnings;