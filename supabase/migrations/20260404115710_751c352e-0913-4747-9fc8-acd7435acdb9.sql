
ALTER TABLE public.ticket_messages ADD COLUMN is_read boolean NOT NULL DEFAULT false;
ALTER TABLE public.product_chat_messages ADD COLUMN is_read boolean NOT NULL DEFAULT false;

CREATE POLICY "Anyone can update message read status" ON public.ticket_messages FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can update chat message read status" ON public.product_chat_messages FOR UPDATE TO public USING (true) WITH CHECK (true);
