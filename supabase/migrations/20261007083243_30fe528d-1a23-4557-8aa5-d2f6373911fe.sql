CREATE TABLE IF NOT EXISTS public.royale_spin_locks (
  account_key text PRIMARY KEY,
  locked_until timestamptz NOT NULL
);
GRANT ALL ON public.royale_spin_locks TO service_role;
ALTER TABLE public.royale_spin_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.royale_try_lock(p_key text, p_seconds integer DEFAULT 30)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean := false;
BEGIN
  INSERT INTO royale_spin_locks(account_key, locked_until) VALUES (p_key, now() + make_interval(secs => p_seconds))
  ON CONFLICT (account_key) DO UPDATE SET locked_until = EXCLUDED.locked_until
    WHERE royale_spin_locks.locked_until < now()
  RETURNING true INTO ok;
  RETURN coalesce(ok, false);
END $$;

CREATE OR REPLACE FUNCTION public.royale_unlock(p_key text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM royale_spin_locks WHERE account_key = p_key;
$$;

-- Mega jackpot pool lives in admin_settings; these update it atomically.
CREATE OR REPLACE FUNCTION public.royale_pool_add(p_amount bigint, p_seed bigint DEFAULT 5000)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v bigint;
BEGIN
  INSERT INTO admin_settings(setting_key, setting_value) VALUES ('luck_royale_mega_jackpot_pool', (p_seed + greatest(p_amount,0))::text)
  ON CONFLICT DO NOTHING;
  UPDATE admin_settings SET setting_value = (greatest(coalesce(nullif(setting_value,'')::bigint, p_seed), p_seed) + greatest(p_amount,0))::text
   WHERE setting_key = 'luck_royale_mega_jackpot_pool' RETURNING setting_value::bigint INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.royale_pool_take(p_min bigint, p_pct numeric, p_seed bigint DEFAULT 5000)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur bigint; won bigint := 0;
BEGIN
  SELECT setting_value::bigint INTO cur FROM admin_settings WHERE setting_key = 'luck_royale_mega_jackpot_pool' FOR UPDATE;
  IF cur IS NULL OR cur < p_min THEN RETURN 0; END IF;
  won := floor(cur * p_pct);
  UPDATE admin_settings SET setting_value = greatest(cur - won, p_seed)::text WHERE setting_key = 'luck_royale_mega_jackpot_pool';
  RETURN won;
END $$;

REVOKE ALL ON FUNCTION public.royale_try_lock(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.royale_unlock(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.royale_pool_add(bigint, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.royale_pool_take(bigint, numeric, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.royale_try_lock(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.royale_unlock(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.royale_pool_add(bigint, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.royale_pool_take(bigint, numeric, bigint) TO service_role;