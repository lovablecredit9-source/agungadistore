ALTER TABLE public.seller_stores ADD COLUMN IF NOT EXISTS free_rename_used boolean NOT NULL DEFAULT false;
ALTER TABLE public.seller_orders ADD COLUMN IF NOT EXISTS order_code text GENERATED ALWAYS AS (order_number::text) STORED;
ALTER TABLE public.confess_public_wall
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.account_slot_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visitor_id text NOT NULL, plan text NOT NULL, price integer NOT NULL,
  max_accounts integer NOT NULL DEFAULT 10, trx_id text NOT NULL, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_slot_sub_visitor ON public.account_slot_subscriptions(visitor_id);

CREATE TABLE IF NOT EXISTS public.ai_message_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visitor_id text NOT NULL, message_id text NOT NULL, conversation_id text,
  feedback text NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, message_id));

CREATE TABLE IF NOT EXISTS public.confess_crush_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), picker_visitor_id text NOT NULL, target_visitor_id text NOT NULL,
  matched_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (picker_visitor_id, target_visitor_id));
CREATE TABLE IF NOT EXISTS public.confess_mission_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visitor_id text NOT NULL, mission_key text NOT NULL, period_key text NOT NULL,
  gems integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (visitor_id, mission_key, period_key));
CREATE TABLE IF NOT EXISTS public.confess_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wall_id uuid NOT NULL, options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_hidden boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.confess_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), poll_id uuid NOT NULL REFERENCES public.confess_polls(id) ON DELETE CASCADE,
  visitor_id text NOT NULL, option_index integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (poll_id, visitor_id));
CREATE TABLE IF NOT EXISTS public.confess_wall_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wall_id uuid NOT NULL, visitor_id text NOT NULL, anon_no integer NOT NULL,
  message text NOT NULL, is_hidden boolean NOT NULL DEFAULT false, reaction_count integer NOT NULL DEFAULT 0,
  report_count integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_cwr_wall ON public.confess_wall_replies(wall_id, created_at);
CREATE TABLE IF NOT EXISTS public.confess_reply_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reply_id uuid NOT NULL REFERENCES public.confess_wall_replies(id) ON DELETE CASCADE,
  visitor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (reply_id, visitor_id));
CREATE TABLE IF NOT EXISTS public.confess_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_visitor_id text NOT NULL, target_type text NOT NULL, target_id text NOT NULL,
  reason text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_visitor_id, target_type, target_id));
CREATE TABLE IF NOT EXISTS public.confess_special_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wall_id uuid NOT NULL, visitor_id text NOT NULL, kind text NOT NULL DEFAULT 'support',
  gems integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (wall_id, visitor_id, kind));
CREATE TABLE IF NOT EXISTS public.confess_wall_views (
  wall_id uuid NOT NULL, viewer_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (wall_id, viewer_hash));

CREATE TABLE IF NOT EXISTS public.seller_store_rename_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  visitor_id text NOT NULL, old_name text NOT NULL, new_name text NOT NULL, reason text, status text NOT NULL DEFAULT 'pending',
  admin_note text, decided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.streak_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visitor_id text NOT NULL UNIQUE, freeze_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.wa_bot_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), phone text NOT NULL UNIQUE, label text, role text NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.wa_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_phone text NOT NULL, actor_role text, action text NOT NULL, target text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb, result text NOT NULL DEFAULT 'ok', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.wa_admin_pending (
  token text PRIMARY KEY, actor_phone text NOT NULL, action text NOT NULL, params jsonb NOT NULL DEFAULT '{}'::jsonb, summary text,
  expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.wa_bot_command_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), command text NOT NULL, category text NOT NULL DEFAULT 'user', actor_hash text,
  ok boolean NOT NULL DEFAULT true, latency_ms integer, error text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.wa_bot_health (
  id text PRIMARY KEY DEFAULT 'main', status text, version text, started_at timestamptz, cpu_load numeric, memory_mb numeric,
  reconnect_count integer NOT NULL DEFAULT 0, message_errors integer NOT NULL DEFAULT 0, command_errors integer NOT NULL DEFAULT 0,
  last_error text, control_request text, updated_at timestamptz NOT NULL DEFAULT now());

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['account_slot_subscriptions','ai_message_feedback','confess_crush_picks','confess_mission_claims','confess_polls','confess_poll_votes','confess_wall_replies','confess_reply_reactions','confess_reports','confess_special_reactions','confess_wall_views','seller_store_rename_requests','streak_freezes','wa_bot_admins','wa_admin_audit_log','wa_admin_pending','wa_bot_command_stats','wa_bot_health'] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
GRANT SELECT ON public.wa_bot_admins, public.wa_admin_audit_log, public.wa_bot_health, public.seller_store_rename_requests, public.confess_reports TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.wa_bot_admins TO authenticated;
GRANT UPDATE ON public.wa_bot_health TO authenticated;
CREATE POLICY "admin manage wa bot admins" ON public.wa_bot_admins FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin read wa audit" ON public.wa_admin_audit_log FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin read wa health" ON public.wa_bot_health FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin update wa health" ON public.wa_bot_health FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin read rename requests" ON public.seller_store_rename_requests FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "admin read confess reports" ON public.confess_reports FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.confess_react_special(p_visitor text, p_wall uuid, p_cost integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner text; bal integer;
BEGIN
  SELECT visitor_id INTO owner FROM confess_public_wall WHERE id=p_wall;
  IF owner IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF owner = p_visitor THEN RAISE EXCEPTION 'own_post'; END IF;
  IF EXISTS (SELECT 1 FROM confess_special_reactions WHERE wall_id=p_wall AND visitor_id=p_visitor AND kind='support') THEN RAISE EXCEPTION 'duplicate'; END IF;
  bal := public.get_account_gems(p_visitor);
  IF coalesce(bal,0) < p_cost THEN RAISE EXCEPTION 'insufficient_gems'; END IF;
  PERFORM public.add_account_gems(p_visitor, -p_cost);
  INSERT INTO confess_special_reactions(wall_id, visitor_id, kind, gems) VALUES (p_wall, p_visitor, 'support', p_cost);
  RETURN public.get_account_gems(p_visitor);
END $$;

CREATE OR REPLACE FUNCTION public.confess_claim_mission(p_visitor text, p_key text, p_period text, p_gems integer, p_label text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_gems < 0 OR p_gems > 10000 THEN RAISE EXCEPTION 'invalid'; END IF;
  INSERT INTO confess_mission_claims(visitor_id, mission_key, period_key, gems) VALUES (p_visitor, p_key, p_period, p_gems);
  PERFORM public.add_account_gems(p_visitor, p_gems);
  RETURN public.get_account_gems(p_visitor);
END $$;

CREATE OR REPLACE FUNCTION public.buyer_cancel_order(p_visitor_id text, p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o record;
BEGIN
  SELECT * INTO o FROM seller_orders WHERE id=p_order_id FOR UPDATE;
  IF o.id IS NULL OR o.buyer_visitor_id <> p_visitor_id THEN RAISE EXCEPTION 'ACCESS DENIED'; END IF;
  IF o.status NOT IN ('dibayar','pending','paid') OR o.escrow_status <> 'held' THEN RAISE EXCEPTION 'Pesanan hanya bisa dibatalkan sebelum dikirim'; END IF;
  RETURN public.seller_refund_order(o.id);
END $$;

CREATE OR REPLACE FUNCTION public.seller_dispute_sweep()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  UPDATE seller_disputes d SET status='closed', resolved_at=now(), admin_note=coalesce(admin_note,'Ditutup otomatis: pesanan sudah selesai/dibatalkan')
  WHERE d.status IN ('open','pending') AND EXISTS (SELECT 1 FROM seller_orders o WHERE o.id=d.order_id AND o.escrow_status IN ('released','refunded'));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.confess_react_special(text,uuid,integer), public.confess_claim_mission(text,text,text,integer,text), public.buyer_cancel_order(text,uuid), public.seller_dispute_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confess_react_special(text,uuid,integer), public.confess_claim_mission(text,text,text,integer,text), public.buyer_cancel_order(text,uuid), public.seller_dispute_sweep() TO service_role;