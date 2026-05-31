CREATE TABLE public.discount_spin_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  spin_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  current_discount integer NOT NULL DEFAULT 0,
  spins_used integer NOT NULL DEFAULT 0,
  bought_since_spin boolean NOT NULL DEFAULT false,
  purchased_items text[] NOT NULL DEFAULT '{}',
  refresh_count integer NOT NULL DEFAULT 0,
  side_seed bigint NOT NULL DEFAULT floor(random()*1000000000)::bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, spin_date)
);

GRANT SELECT ON public.discount_spin_state TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_spin_state TO authenticated;
GRANT ALL ON public.discount_spin_state TO service_role;

ALTER TABLE public.discount_spin_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view discount spin state"
ON public.discount_spin_state FOR SELECT USING (true);

CREATE POLICY "Anyone can create discount spin state"
ON public.discount_spin_state FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update discount spin state"
ON public.discount_spin_state FOR UPDATE USING (true);

CREATE TRIGGER trg_discount_spin_state_updated
BEFORE UPDATE ON public.discount_spin_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();