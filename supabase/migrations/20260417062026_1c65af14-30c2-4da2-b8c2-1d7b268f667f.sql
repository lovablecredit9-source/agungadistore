-- Restrict user_game_credits writes: only service role (edge functions) and admin can modify.
-- Public read remains open since stats/credits already exposed via public-api.

DROP POLICY IF EXISTS "Anyone can create game credits" ON public.user_game_credits;
DROP POLICY IF EXISTS "Anyone can update game credits" ON public.user_game_credits;
DROP POLICY IF EXISTS "Anyone can insert game credits" ON public.user_game_credits;
DROP POLICY IF EXISTS "Users can create their own game credits" ON public.user_game_credits;
DROP POLICY IF EXISTS "Users can update their own game credits" ON public.user_game_credits;

-- Admin-only direct INSERT/UPDATE/DELETE from authenticated client.
-- All other writes must go through edge functions using SERVICE_ROLE_KEY (which bypasses RLS).
CREATE POLICY "Admin can insert game credits"
ON public.user_game_credits
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user());

CREATE POLICY "Admin can update game credits"
ON public.user_game_credits
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "Admin can delete game credits"
ON public.user_game_credits
FOR DELETE
TO authenticated
USING (public.is_admin_user());