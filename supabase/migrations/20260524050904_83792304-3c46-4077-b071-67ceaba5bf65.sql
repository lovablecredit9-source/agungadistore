
-- =============== Wall Publik ===============
CREATE TABLE IF NOT EXISTS public.confess_public_wall (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confession_id uuid REFERENCES public.confessions(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  sender_name text,
  masked_phone text NOT NULL,
  message text NOT NULL,
  mood_tag text,
  reaction_counts jsonb NOT NULL DEFAULT '{"heart":0,"fire":0,"laugh":0,"cry":0}'::jsonb,
  total_reactions int NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wall_created ON public.confess_public_wall(created_at DESC) WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_wall_hot ON public.confess_public_wall(total_reactions DESC, created_at DESC) WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_wall_visitor ON public.confess_public_wall(visitor_id);

ALTER TABLE public.confess_public_wall ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wall_public_read" ON public.confess_public_wall FOR SELECT USING (is_hidden = false);
CREATE POLICY "wall_service_all" ON public.confess_public_wall FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.confess_wall_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id uuid NOT NULL REFERENCES public.confess_public_wall(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  emoji text NOT NULL CHECK (emoji IN ('heart','fire','laugh','cry')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wall_id, visitor_id)
);
CREATE INDEX IF NOT EXISTS idx_wall_react_wall ON public.confess_wall_reactions(wall_id);

ALTER TABLE public.confess_wall_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wall_react_read" ON public.confess_wall_reactions FOR SELECT USING (true);
CREATE POLICY "wall_react_service" ON public.confess_wall_reactions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =============== Confess Berjadwal ===============
CREATE TABLE IF NOT EXISTS public.confess_scheduled (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_balance_id uuid NOT NULL,
  sender_name text,
  target_phones text[] NOT NULL,
  message text NOT NULL,
  mood_tag text,
  share_to_wall boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled','failed')),
  price_charged int NOT NULL DEFAULT 0,
  trx_id text,
  result_confession_id uuid,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sched_visitor ON public.confess_scheduled(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sched_pending ON public.confess_scheduled(scheduled_at) WHERE status = 'pending';

ALTER TABLE public.confess_scheduled ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sched_read_own" ON public.confess_scheduled FOR SELECT USING (true);
CREATE POLICY "sched_service" ON public.confess_scheduled FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =============== Reveal Identitas ===============
CREATE TABLE IF NOT EXISTS public.confess_reveal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.confess_threads(id) ON DELETE CASCADE,
  requester_phone text NOT NULL,
  requester_visitor_id text,
  requester_user_balance_id uuid,
  sender_visitor_id text NOT NULL,
  sender_user_balance_id uuid,
  amount int NOT NULL DEFAULT 5000,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','refunded')),
  revealed_name text,
  revealed_visitor_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_reveal_thread ON public.confess_reveal_requests(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reveal_sender ON public.confess_reveal_requests(sender_visitor_id, status);
CREATE INDEX IF NOT EXISTS idx_reveal_requester ON public.confess_reveal_requests(requester_visitor_id, status);

ALTER TABLE public.confess_reveal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reveal_read_all" ON public.confess_reveal_requests FOR SELECT USING (true);
CREATE POLICY "reveal_service" ON public.confess_reveal_requests FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =============== Voice/media flag ===============
ALTER TABLE public.confess_thread_messages
  ADD COLUMN IF NOT EXISTS is_voice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mood_tag text;

-- =============== Realtime publications ===============
ALTER PUBLICATION supabase_realtime ADD TABLE public.confess_public_wall;
ALTER PUBLICATION supabase_realtime ADD TABLE public.confess_wall_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.confess_scheduled;
ALTER PUBLICATION supabase_realtime ADD TABLE public.confess_reveal_requests;
