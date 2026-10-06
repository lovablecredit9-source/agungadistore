ALTER TABLE public.telegram_user_links
  ADD COLUMN IF NOT EXISTS notif_order boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_streak boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_quest boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_reward boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_ticket boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_membership boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_flash_sale boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_announcement boolean NOT NULL DEFAULT true;

ALTER TABLE public.telegram_bot_config
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_broadcast_at timestamptz;

CREATE TABLE IF NOT EXISTS public.telegram_broadcast_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid,
  target text NOT NULL,
  message text NOT NULL,
  button_text text,
  button_url text,
  total integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  blocked integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.telegram_broadcast_log TO authenticated;
GRANT ALL ON public.telegram_broadcast_log TO service_role;
ALTER TABLE public.telegram_broadcast_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view telegram broadcast log" ON public.telegram_broadcast_log
  FOR SELECT TO authenticated USING (public.is_admin_user());