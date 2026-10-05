DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['account_slot_subscriptions','ai_message_feedback','confess_crush_picks','confess_mission_claims','confess_polls','confess_poll_votes','confess_wall_replies','confess_reply_reactions','confess_special_reactions','confess_wall_views','streak_freezes','wa_admin_pending','wa_bot_command_stats'] LOOP
    EXECUTE format('CREATE POLICY "server only" ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', t);
  END LOOP;
END $$;