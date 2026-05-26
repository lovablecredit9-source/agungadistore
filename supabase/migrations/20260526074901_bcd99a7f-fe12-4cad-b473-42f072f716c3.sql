DROP POLICY IF EXISTS "Users can insert their own WA numbers" ON public.user_wa_notif_numbers;
DROP POLICY IF EXISTS "Users can update their own WA numbers" ON public.user_wa_notif_numbers;
DROP POLICY IF EXISTS "Users can delete their own WA numbers" ON public.user_wa_notif_numbers;
DROP POLICY IF EXISTS "Users can view their own WA numbers" ON public.user_wa_notif_numbers;

CREATE POLICY "wa_numbers_select_all" ON public.user_wa_notif_numbers FOR SELECT USING (true);
CREATE POLICY "wa_numbers_insert_all" ON public.user_wa_notif_numbers FOR INSERT WITH CHECK (true);
CREATE POLICY "wa_numbers_update_all" ON public.user_wa_notif_numbers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "wa_numbers_delete_all" ON public.user_wa_notif_numbers FOR DELETE USING (true);