
CREATE TABLE public.profile_social (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  interests text[] NOT NULL DEFAULT '{}',
  note text,
  note_expires_at timestamptz,
  activity_status text NOT NULL DEFAULT 'online',
  dnd boolean NOT NULL DEFAULT false,
  privacy_discover text NOT NULL DEFAULT 'everyone',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_social TO authenticated, anon;
GRANT ALL ON public.profile_social TO service_role;
ALTER TABLE public.profile_social ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social viewable" ON public.profile_social FOR SELECT USING (true);
CREATE POLICY "social insert" ON public.profile_social FOR INSERT WITH CHECK (true);
CREATE POLICY "social update" ON public.profile_social FOR UPDATE USING (true);
CREATE POLICY "social delete admin" ON public.profile_social FOR DELETE USING (is_admin_user());

CREATE TABLE public.profile_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  target_visitor_id text NOT NULL,
  display_name text,
  note text,
  is_favorite boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, target_visitor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_favorites TO authenticated, anon;
GRANT ALL ON public.profile_favorites TO service_role;
ALTER TABLE public.profile_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fav viewable" ON public.profile_favorites FOR SELECT USING (true);
CREATE POLICY "fav insert" ON public.profile_favorites FOR INSERT WITH CHECK (true);
CREATE POLICY "fav update" ON public.profile_favorites FOR UPDATE USING (true);
CREATE POLICY "fav delete" ON public.profile_favorites FOR DELETE USING (true);

CREATE TABLE public.profile_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  notif_friend_online boolean NOT NULL DEFAULT true,
  notif_daily_reward boolean NOT NULL DEFAULT true,
  notif_level_up boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT true,
  animation_enabled boolean NOT NULL DEFAULT true,
  accent_color text NOT NULL DEFAULT 'violet',
  theme_mode text NOT NULL DEFAULT 'dark',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_settings TO authenticated, anon;
GRANT ALL ON public.profile_settings TO service_role;
ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings viewable" ON public.profile_settings FOR SELECT USING (true);
CREATE POLICY "settings insert" ON public.profile_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "settings update" ON public.profile_settings FOR UPDATE USING (true);
CREATE POLICY "settings delete admin" ON public.profile_settings FOR DELETE USING (is_admin_user());

CREATE TABLE public.profile_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  device_key text NOT NULL,
  label text,
  platform text,
  user_agent text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, device_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_devices TO authenticated, anon;
GRANT ALL ON public.profile_devices TO service_role;
ALTER TABLE public.profile_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "devices viewable" ON public.profile_devices FOR SELECT USING (true);
CREATE POLICY "devices insert" ON public.profile_devices FOR INSERT WITH CHECK (true);
CREATE POLICY "devices update" ON public.profile_devices FOR UPDATE USING (true);
CREATE POLICY "devices delete" ON public.profile_devices FOR DELETE USING (true);

CREATE TABLE public.profile_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  action text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_log_visitor ON public.profile_activity_log (visitor_id, created_at DESC);
GRANT SELECT, INSERT ON public.profile_activity_log TO authenticated, anon;
GRANT ALL ON public.profile_activity_log TO service_role;
ALTER TABLE public.profile_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity viewable" ON public.profile_activity_log FOR SELECT USING (true);
CREATE POLICY "activity insert" ON public.profile_activity_log FOR INSERT WITH CHECK (true);
CREATE POLICY "activity delete admin" ON public.profile_activity_log FOR DELETE USING (is_admin_user());

CREATE TRIGGER trg_profile_social_updated BEFORE UPDATE ON public.profile_social FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profile_settings_updated BEFORE UPDATE ON public.profile_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
