CREATE POLICY "Admin can delete streaks"
ON public.daily_streaks
FOR DELETE
TO authenticated
USING (true);