GRANT SELECT ON public.admin_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_posts TO authenticated;
GRANT ALL ON public.admin_posts TO service_role;

GRANT SELECT, INSERT ON public.support_tickets TO anon, authenticated;
GRANT UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

GRANT SELECT, INSERT ON public.ticket_messages TO anon, authenticated;
GRANT UPDATE, DELETE ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_message_reactions TO anon, authenticated;
GRANT ALL ON public.ticket_message_reactions TO service_role;