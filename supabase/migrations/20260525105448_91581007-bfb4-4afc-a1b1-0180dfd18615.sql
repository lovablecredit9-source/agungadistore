
CREATE TABLE IF NOT EXISTS public.user_wa_notif_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  wa_number text NOT NULL DEFAULT '',
  notify_purchase boolean NOT NULL DEFAULT true,
  notify_login boolean NOT NULL DEFAULT true,
  notify_deposit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_wa_notif_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read own pref by visitor"
  ON public.user_wa_notif_prefs FOR SELECT USING (true);

CREATE POLICY "anyone can insert own pref"
  ON public.user_wa_notif_prefs FOR INSERT WITH CHECK (true);

CREATE POLICY "anyone can update own pref"
  ON public.user_wa_notif_prefs FOR UPDATE USING (true);

CREATE TRIGGER trg_user_wa_notif_prefs_updated
  BEFORE UPDATE ON public.user_wa_notif_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
