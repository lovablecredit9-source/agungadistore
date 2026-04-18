
CREATE TABLE IF NOT EXISTS public.mine_sweeper_sessions (
  visitor_id text PRIMARY KEY,
  bet integer NOT NULL,
  mines integer NOT NULL,
  mine_positions integer[] NOT NULL,
  revealed integer[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mine_sweeper_sessions ENABLE ROW LEVEL SECURITY;

-- Only service role uses this table; no public policies needed.
CREATE POLICY "deny_all_mine_sweeper_sessions" ON public.mine_sweeper_sessions
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
