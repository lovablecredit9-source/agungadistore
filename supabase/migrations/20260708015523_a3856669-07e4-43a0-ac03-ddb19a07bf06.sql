CREATE TABLE IF NOT EXISTS public.wa_peer_phone_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_jid text NOT NULL UNIQUE,
  phone text NOT NULL CHECK (phone ~ '^[0-9]{9,16}$'),
  source text NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.wa_peer_phone_mappings TO service_role;

ALTER TABLE public.wa_peer_phone_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_peer_phone_mappings_service_all"
ON public.wa_peer_phone_mappings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wa_peer_phone_mappings_phone
ON public.wa_peer_phone_mappings(phone, last_seen_at DESC);