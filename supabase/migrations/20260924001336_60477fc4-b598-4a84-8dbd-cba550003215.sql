ALTER TABLE public.seller_order_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.seller_chat_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;