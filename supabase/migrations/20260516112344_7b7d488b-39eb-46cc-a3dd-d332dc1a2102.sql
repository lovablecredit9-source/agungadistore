
CREATE TABLE public.confessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trx_id text NOT NULL UNIQUE,
  sender_visitor_id text NOT NULL,
  sender_name text,
  message text NOT NULL,
  num_targets int NOT NULL,
  total_price int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_confessions_visitor ON public.confessions(sender_visitor_id, created_at DESC);

CREATE TABLE public.confession_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confession_id uuid NOT NULL REFERENCES public.confessions(id) ON DELETE CASCADE,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_confession_targets_status ON public.confession_targets(status, created_at);
CREATE INDEX idx_confession_targets_phone ON public.confession_targets(phone, created_at DESC);

CREATE TABLE public.confession_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confession_id uuid NOT NULL REFERENCES public.confessions(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.confession_targets(id) ON DELETE SET NULL,
  from_phone text NOT NULL,
  reply_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_confession_replies_conf ON public.confession_replies(confession_id, created_at DESC);

ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confession_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confession_replies ENABLE ROW LEVEL SECURITY;

-- No public policies: only service role (edge functions / bot via public-api) can access.

ALTER PUBLICATION supabase_realtime ADD TABLE public.confession_targets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.confession_replies;
