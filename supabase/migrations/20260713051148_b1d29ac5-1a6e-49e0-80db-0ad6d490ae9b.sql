DROP POLICY IF EXISTS "Admin can manage premium quest plans" ON public.premium_quest_plans;
CREATE POLICY "Admin can manage premium quest plans"
ON public.premium_quest_plans
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin can manage premium quest subscriptions" ON public.premium_quest_subscriptions;
CREATE POLICY "Admin can manage premium quest subscriptions"
ON public.premium_quest_subscriptions
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin can manage premium quest trials" ON public.premium_quest_trials;
CREATE POLICY "Admin can manage premium quest trials"
ON public.premium_quest_trials
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin can manage premium quests" ON public.premium_quests;
CREATE POLICY "Admin can manage premium quests"
ON public.premium_quests
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin can manage premium quest progress" ON public.premium_quest_progress;
CREATE POLICY "Admin can manage premium quest progress"
ON public.premium_quest_progress
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin can read quest song completions" ON public.quest_song_completions;
CREATE POLICY "Admin can read quest song completions"
ON public.quest_song_completions
FOR SELECT
TO authenticated
USING (public.is_admin_user());