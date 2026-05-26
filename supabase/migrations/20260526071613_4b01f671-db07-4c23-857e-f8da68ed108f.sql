
CREATE TABLE public.user_wa_notif_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  wa_number text NOT NULL,
  label text,
  notify_purchase boolean NOT NULL DEFAULT true,
  notify_login boolean NOT NULL DEFAULT true,
  notify_deposit boolean NOT NULL DEFAULT true,
  is_paid boolean NOT NULL DEFAULT false,
  paid_until timestamp with time zone,
  slot_index integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, wa_number)
);

CREATE TABLE public.wa_slot_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  wa_number text NOT NULL,
  slot_index integer NOT NULL,
  amount integer NOT NULL DEFAULT 5000,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  method text NOT NULL DEFAULT 'balance',
  trx_id text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.user_wa_notif_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_slot_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own WA numbers" ON public.user_wa_notif_numbers
  FOR SELECT TO authenticated, anon
  USING (visitor_id = coalesce(current_setting('request.headers', true)::json->>'x-visitor-id', ''));

CREATE POLICY "Users can insert their own WA numbers" ON public.user_wa_notif_numbers
  FOR INSERT TO authenticated, anon
  WITH CHECK (visitor_id = coalesce(current_setting('request.headers', true)::json->>'x-visitor-id', ''));

CREATE POLICY "Users can update their own WA numbers" ON public.user_wa_notif_numbers
  FOR UPDATE TO authenticated, anon
  USING (visitor_id = coalesce(current_setting('request.headers', true)::json->>'x-visitor-id', ''));

CREATE POLICY "Users can delete their own WA numbers" ON public.user_wa_notif_numbers
  FOR DELETE TO authenticated, anon
  USING (visitor_id = coalesce(current_setting('request.headers', true)::json->>'x-visitor-id', ''));

CREATE POLICY "Users can view their own slot payments" ON public.wa_slot_payments
  FOR SELECT TO authenticated, anon
  USING (visitor_id = coalesce(current_setting('request.headers', true)::json->>'x-visitor-id', ''));

CREATE POLICY "Users can insert their own slot payments" ON public.wa_slot_payments
  FOR INSERT TO authenticated, anon
  WITH CHECK (visitor_id = coalesce(current_setting('request.headers', true)::json->>'x-visitor-id', ''));

-- Index for performance
CREATE INDEX idx_user_wa_notif_numbers_visitor ON public.user_wa_notif_numbers(visitor_id);
CREATE INDEX idx_wa_slot_payments_visitor ON public.wa_slot_payments(visitor_id);
CREATE INDEX idx_wa_slot_payments_expires ON public.wa_slot_payments(expires_at);
