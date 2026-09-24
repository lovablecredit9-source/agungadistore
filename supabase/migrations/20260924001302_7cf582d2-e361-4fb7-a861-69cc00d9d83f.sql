CREATE TABLE public.seller_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.seller_products(id) ON DELETE SET NULL,
  buyer_visitor_id text NOT NULL,
  seller_visitor_id text NOT NULL,
  product_title text NOT NULL,
  buyer_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id, buyer_visitor_id)
);
GRANT SELECT, INSERT, UPDATE ON public.seller_chat_threads TO anon, authenticated;
GRANT ALL ON public.seller_chat_threads TO service_role;
ALTER TABLE public.seller_chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read seller enquiry threads" ON public.seller_chat_threads FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Start seller enquiry threads" ON public.seller_chat_threads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Update seller enquiry threads" ON public.seller_chat_threads FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.seller_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.seller_chat_threads(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('buyer', 'seller')),
  visitor_id text NOT NULL,
  message text NOT NULL DEFAULT '',
  image_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_chat_content CHECK (length(trim(message)) > 0 OR image_url IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE ON public.seller_chat_messages TO anon, authenticated;
GRANT ALL ON public.seller_chat_messages TO service_role;
ALTER TABLE public.seller_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read seller enquiry messages" ON public.seller_chat_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Send seller enquiry messages" ON public.seller_chat_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mark seller enquiry messages read" ON public.seller_chat_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX seller_chat_threads_buyer_idx ON public.seller_chat_threads(buyer_visitor_id, updated_at DESC);
CREATE INDEX seller_chat_threads_seller_idx ON public.seller_chat_threads(seller_visitor_id, updated_at DESC);
CREATE INDEX seller_chat_messages_thread_idx ON public.seller_chat_messages(thread_id, created_at);
CREATE TRIGGER seller_chat_threads_updated BEFORE UPDATE ON public.seller_chat_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();