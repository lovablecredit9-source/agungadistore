ALTER TABLE public.bot_instances ADD COLUMN IF NOT EXISTS webhook_set boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.bot_versions ADD COLUMN IF NOT EXISTS config jsonb,
  ADD COLUMN IF NOT EXISTS compatible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compat_report jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE public.bot_users (
  bot_id uuid NOT NULL REFERENCES public.bot_instances(id),
  tg_user_id bigint NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, tg_user_id)
);
REVOKE ALL ON public.bot_users FROM anon, authenticated;
GRANT ALL ON public.bot_users TO service_role;
ALTER TABLE public.bot_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bot_updates_seen (
  bot_id uuid NOT NULL REFERENCES public.bot_instances(id),
  update_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, update_id)
);
REVOKE ALL ON public.bot_updates_seen FROM anon, authenticated;
GRANT ALL ON public.bot_updates_seen TO service_role;
ALTER TABLE public.bot_updates_seen ENABLE ROW LEVEL SECURITY;

-- Real stats from real Telegram updates (called by bot-hook only).
CREATE OR REPLACE FUNCTION public.bot_record_update(p_bot uuid, p_update bigint, p_user bigint, p_is_command boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO bot_updates_seen (bot_id, update_id) VALUES (p_bot, p_update) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF; -- Telegram retry: already counted
  IF p_user IS NOT NULL THEN
    INSERT INTO bot_users (bot_id, tg_user_id) VALUES (p_bot, p_user)
    ON CONFLICT (bot_id, tg_user_id) DO UPDATE SET last_seen = now();
  END IF;
  UPDATE bot_instances SET
    total_messages = coalesce(total_messages,0) + 1,
    total_commands = coalesce(total_commands,0) + CASE WHEN p_is_command THEN 1 ELSE 0 END,
    total_users = (SELECT count(*) FROM bot_users WHERE bot_id = p_bot),
    last_activity_at = now()
  WHERE id = p_bot;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.bot_record_update(uuid,bigint,bigint,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_record_update(uuid,bigint,bigint,boolean) TO service_role;

-- Renewal: bots whose webhook is still set resume ACTIVE on the selected version.
DO $$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public.bot_rental_purchase'::regproc);
  d := replace(d, 'UPDATE bot_instances SET status = ''STOPPED'', updated_at = now() WHERE rental_id = r.id AND status IN (''EXPIRED'',''FROZEN'')',
                  'UPDATE bot_instances SET status = CASE WHEN webhook_set THEN ''ACTIVE'' ELSE ''STOPPED'' END, updated_at = now() WHERE rental_id = r.id AND status IN (''EXPIRED'',''FROZEN'')');
  EXECUTE d;
  d := pg_get_functiondef('public.bot_rental_admin_extend'::regproc);
  d := replace(d, 'UPDATE bot_instances SET status = ''STOPPED'', updated_at = now() WHERE rental_id = r.id AND status IN (''EXPIRED'',''FROZEN'')',
                  'UPDATE bot_instances SET status = CASE WHEN webhook_set THEN ''ACTIVE'' ELSE ''STOPPED'' END, updated_at = now() WHERE rental_id = r.id AND status IN (''EXPIRED'',''FROZEN'')');
  EXECUTE d;
END $$;
REVOKE ALL ON FUNCTION public.bot_rental_purchase(uuid,text,text,int,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_rental_admin_extend(uuid,uuid,bigint,text) FROM PUBLIC, anon, authenticated;

-- Tick: tokens are encrypted now, so owner expiry messages are queued and sent by bot-hook (flush).
CREATE OR REPLACE FUNCTION public.bot_rental_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; b record; n_exp int := 0; n_rem int := 0; v_key text; v_hours int; v_lbl text; v_tok text; v_queued int := 0;
BEGIN
  FOR r IN SELECT * FROM bot_rentals WHERE status = 'ACTIVE' AND expires_at <= now() FOR UPDATE SKIP LOCKED LOOP
    UPDATE bot_rentals SET status = 'EXPIRED', updated_at = now() WHERE id = r.id;
    UPDATE bot_instances SET status = 'FROZEN', updated_at = now() WHERE rental_id = r.id AND deleted_at IS NULL AND status <> 'DELETED';
    INSERT INTO bot_runtime_logs (bot_id, level, message)
      SELECT id, 'warn', 'Masa sewa habis: bot dibekukan (FROZEN). ID ' || coalesce(r.last_transaction_id,'-') FROM bot_instances WHERE rental_id = r.id AND deleted_at IS NULL;
    v_key := 'expired:' || r.id || ':' || r.expiry_period;
    INSERT INTO bot_notifications (rental_id, event_key, kind, channel, status) VALUES (r.id, v_key, 'expired', 'app', 'sent') ON CONFLICT (event_key) DO NOTHING;
    IF FOUND THEN
      INSERT INTO notifications (visitor_id, title, message, type, related_id)
      VALUES (r.visitor_id, '🔴 Masa sewa Bot Telegram berakhir', 'Bot dibekukan. Perpanjang sewa untuk mengaktifkan kembali. ID ' || coalesce(r.last_transaction_id,'-'), 'system', r.last_transaction_id);
      FOR b IN SELECT id FROM bot_instances WHERE rental_id = r.id AND deleted_at IS NULL AND bot_token IS NOT NULL AND owner_telegram_id ~ '^-?[0-9]{3,20}$' LOOP
        INSERT INTO bot_notifications (rental_id, bot_id, event_key, kind, channel, status)
        VALUES (r.id, b.id, v_key || ':tg:' || b.id, 'expired', 'owner_telegram', 'queued') ON CONFLICT DO NOTHING;
        v_queued := v_queued + 1;
      END LOOP;
    END IF;
    n_exp := n_exp + 1;
  END LOOP;

  FOR r IN SELECT * FROM bot_rentals WHERE status = 'ACTIVE' AND expires_at > now() AND expires_at <= now() + interval '3 days' LOOP
    v_hours := ceil(extract(epoch FROM (r.expires_at - now())) / 3600);
    v_lbl := CASE WHEN v_hours <= 1 THEN '1h' WHEN v_hours <= 24 THEN '1d' ELSE '3d' END;
    IF v_lbl = '3d' AND r.expires_at - r.started_at <= interval '3 days' THEN CONTINUE; END IF;
    IF v_lbl = '1d' AND r.expires_at - r.started_at <= interval '1 day' THEN CONTINUE; END IF;
    v_key := 'remind:' || v_lbl || ':' || r.id || ':' || r.expiry_period || ':' || extract(epoch FROM r.expires_at)::bigint;
    INSERT INTO bot_notifications (rental_id, event_key, kind, channel, status) VALUES (r.id, v_key, 'reminder_' || v_lbl, 'app', 'sent') ON CONFLICT (event_key) DO NOTHING;
    IF FOUND THEN
      INSERT INTO notifications (visitor_id, title, message, type, related_id)
      VALUES (r.visitor_id, '⏰ Sewa Bot Telegram hampir habis',
        'Masa sewa bot Anda akan berakhir dalam ' || CASE v_lbl WHEN '1h' THEN '1 jam' WHEN '1d' THEN '1 hari' ELSE '3 hari' END || '. Perpanjang di menu Sewa Bot.', 'system', r.last_transaction_id);
      n_rem := n_rem + 1;
    END IF;
  END LOOP;

  IF v_queued > 0 THEN
    SELECT token INTO v_tok FROM telegram_internal_secret LIMIT 1;
    BEGIN
      PERFORM net.http_post(
        url := 'https://qhkcohwrforhqjylaapo.supabase.co/functions/v1/bot-hook?flush=1',
        headers := jsonb_build_object('Content-Type','application/json','x-tg-internal', v_tok),
        body := '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN jsonb_build_object('expired', n_exp, 'reminders', n_rem, 'owner_queued', v_queued);
END $$;
REVOKE ALL ON FUNCTION public.bot_rental_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_rental_tick() TO service_role;