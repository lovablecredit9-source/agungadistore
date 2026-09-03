ALTER TABLE public.product_chat_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.ticket_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;