-- 1) game_profiles: lock down direct reads (edge function uses service role)
DROP POLICY IF EXISTS "Game profiles viewable by everyone" ON public.game_profiles;

CREATE POLICY "Game profiles direct read denied"
  ON public.game_profiles FOR SELECT
  USING (false);

-- Safe public view exposing only non-sensitive columns (for leaderboards/search if used directly)
CREATE OR REPLACE VIEW public.game_profiles_public
WITH (security_invoker=on) AS
  SELECT id, visitor_id, display_name, description, avatar_url, is_guest, created_at, updated_at
  FROM public.game_profiles;

GRANT SELECT ON public.game_profiles_public TO anon, authenticated;

-- 2) token_fields: restrict SELECT to authenticated (admin) only; service role still works in edge functions
DROP POLICY IF EXISTS "Token fields viewable by everyone" ON public.token_fields;

CREATE POLICY "Token fields readable by authenticated only"
  ON public.token_fields FOR SELECT
  TO authenticated
  USING (true);

-- 3) admin_settings: prevent anonymous writes
DROP POLICY IF EXISTS "Anyone can insert settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON public.admin_settings;

CREATE POLICY "Authenticated can insert settings"
  ON public.admin_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update settings"
  ON public.admin_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4) PIN attempt rate limiting table
CREATE TABLE IF NOT EXISTS public.pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  action text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  ip_address text,
  attempted_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pin_attempts_visitor_time
  ON public.pin_attempts (visitor_id, attempted_at DESC);

ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pin attempts service only - select"
  ON public.pin_attempts FOR SELECT
  USING (false);

CREATE POLICY "Pin attempts service only - insert"
  ON public.pin_attempts FOR INSERT
  WITH CHECK (false);