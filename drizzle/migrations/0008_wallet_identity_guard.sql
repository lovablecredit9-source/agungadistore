-- 1 login account <-> max 1 wallet is enforced by user_balances_auth_user_id_key (unique, partial).
-- Guard: a wallet link can only be set once (null -> value), never re-pointed, and never to an admin account.
CREATE OR REPLACE FUNCTION public.guard_wallet_auth_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id) THEN
    IF TG_OP = 'UPDATE' AND OLD.auth_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'wallet already linked to another login account';
    END IF;
    IF public.has_role(NEW.auth_user_id, 'admin') OR public.has_role(NEW.auth_user_id, 'super_admin') THEN
      RAISE EXCEPTION 'admin accounts cannot be linked to a user wallet';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_wallet_auth_link ON public.user_balances;
CREATE TRIGGER trg_guard_wallet_auth_link
BEFORE INSERT OR UPDATE OF auth_user_id ON public.user_balances
FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_auth_link();

-- Identity resolution from the session only (no client-supplied ids).
CREATE OR REPLACE FUNCTION public.current_wallet_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.user_balances WHERE auth_user_id = auth.uid() AND auth.uid() IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.current_wallet_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_wallet_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_wallet_auth_link() FROM PUBLIC, anon, authenticated;