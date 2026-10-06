-- Admin membatalkan token reset password lama saat membuat yang baru (sebelumnya diam-diam gagal karena tidak ada izin UPDATE).
DROP POLICY IF EXISTS "Admin can update password reset tokens" ON public.password_reset_tokens;
CREATE POLICY "Admin can update password reset tokens" ON public.password_reset_tokens
  FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Admin can read password reset tokens" ON public.password_reset_tokens;
CREATE POLICY "Admin can read password reset tokens" ON public.password_reset_tokens
  FOR SELECT TO authenticated USING (public.is_admin_user());