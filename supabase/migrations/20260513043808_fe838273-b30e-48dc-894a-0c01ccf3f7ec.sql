
ALTER TABLE public.product_chat_messages ADD COLUMN IF NOT EXISTS deleted_for text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.ticket_messages ADD COLUMN IF NOT EXISTS deleted_for text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.user_chat_settings (
  visitor_id text PRIMARY KEY,
  show_last_seen boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_chat_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read chat settings" ON public.user_chat_settings;
DROP POLICY IF EXISTS "anyone upsert chat settings" ON public.user_chat_settings;
DROP POLICY IF EXISTS "anyone update chat settings" ON public.user_chat_settings;
CREATE POLICY "anyone read chat settings" ON public.user_chat_settings FOR SELECT USING (true);
CREATE POLICY "anyone upsert chat settings" ON public.user_chat_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone update chat settings" ON public.user_chat_settings FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.chat_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  kind text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_violations_visitor ON public.chat_violations(visitor_id, created_at DESC);
ALTER TABLE public.chat_violations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone insert violation" ON public.chat_violations;
DROP POLICY IF EXISTS "anyone read own violation" ON public.chat_violations;
CREATE POLICY "anyone insert violation" ON public.chat_violations FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone read own violation" ON public.chat_violations FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.report_chat_violation(p_visitor_id text, p_kind text, p_detail text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_visitor_id IS NULL OR trim(p_visitor_id) = '' THEN RETURN 0; END IF;
  INSERT INTO public.chat_violations(visitor_id, kind, detail) VALUES (p_visitor_id, p_kind, LEFT(COALESCE(p_detail,''),300));
  SELECT COUNT(*) INTO v_count FROM public.chat_violations
   WHERE visitor_id = p_visitor_id AND created_at > now() - interval '24 hours';
  IF v_count >= 3 THEN
    INSERT INTO public.account_bans(visitor_id, reason, is_permanent, banned_until, banned_by, is_active)
    VALUES (p_visitor_id,
            'Auto-blokir: melanggar aturan chat (spam/penipuan/membagikan kontak) ' || v_count || 'x dalam 24 jam',
            false, now() + interval '7 days', 'system', true);
  END IF;
  RETURN v_count;
END;
$$;
