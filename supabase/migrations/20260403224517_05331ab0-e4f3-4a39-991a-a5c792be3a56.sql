
-- Support Tickets table
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number serial,
  name text NOT NULL,
  phone text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tickets viewable by everyone" ON public.support_tickets FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create tickets" ON public.support_tickets FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admin can update tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete tickets" ON public.support_tickets FOR DELETE TO authenticated USING (true);

-- Ticket Messages table
CREATE TABLE public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL DEFAULT 'user',
  message text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages viewable by everyone" ON public.ticket_messages FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can send messages" ON public.ticket_messages FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admin can delete messages" ON public.ticket_messages FOR DELETE TO authenticated USING (true);

-- Product Chat Conversations
CREATE TABLE public.product_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  visitor_name text NOT NULL DEFAULT 'Pengunjung',
  visitor_id text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chats viewable by everyone" ON public.product_chats FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create chats" ON public.product_chats FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admin can update chats" ON public.product_chats FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete chats" ON public.product_chats FOR DELETE TO authenticated USING (true);

-- Product Chat Messages
CREATE TABLE public.product_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.product_chats(id) ON DELETE CASCADE,
  sender_type text NOT NULL DEFAULT 'user',
  message text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat messages viewable by everyone" ON public.product_chat_messages FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can send chat messages" ON public.product_chat_messages FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admin can delete chat messages" ON public.product_chat_messages FOR DELETE TO authenticated USING (true);

-- Liked Products (stored per visitor)
CREATE TABLE public.liked_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, visitor_id)
);

ALTER TABLE public.liked_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by everyone" ON public.liked_products FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can like" ON public.liked_products FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can unlike" ON public.liked_products FOR DELETE TO public USING (true);

-- Add warranty field to products
ALTER TABLE public.products ADD COLUMN has_warranty boolean NOT NULL DEFAULT false;

-- Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;

-- Storage bucket for chat images
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true);

CREATE POLICY "Anyone can upload chat images" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'chat-images');
CREATE POLICY "Chat images are public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'chat-images');
