-- Confess Roulette: kumpulan confess acak anonim
CREATE TABLE public.confess_roulette_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  sender_name text,
  message text NOT NULL,
  mood_tag text,
  like_count integer NOT NULL DEFAULT 0,
  pass_count integer NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.confess_roulette_posts TO service_role;
ALTER TABLE public.confess_roulette_posts ENABLE ROW LEVEL SECURITY;

-- Catatan confess yang sudah dilihat / direaksi tiap viewer
CREATE TABLE public.confess_roulette_seen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  viewer_visitor_id text NOT NULL,
  post_id uuid NOT NULL REFERENCES public.confess_roulette_posts(id) ON DELETE CASCADE,
  reaction text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (viewer_visitor_id, post_id)
);
GRANT ALL ON public.confess_roulette_seen TO service_role;
ALTER TABLE public.confess_roulette_seen ENABLE ROW LEVEL SECURITY;

-- Jatah posting gratis harian roulette
CREATE TABLE public.confess_roulette_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  post_date date NOT NULL,
  posts_count integer NOT NULL DEFAULT 0,
  UNIQUE (visitor_id, post_date)
);
GRANT ALL ON public.confess_roulette_daily TO service_role;
ALTER TABLE public.confess_roulette_daily ENABLE ROW LEVEL SECURITY;

-- Confess Berhadiah: klaim hadiah gem dari confess Wall populer
CREATE TABLE public.confess_reward_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL,
  wall_id uuid NOT NULL,
  milestone integer NOT NULL,
  gems integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wall_id, milestone)
);
GRANT ALL ON public.confess_reward_claims TO service_role;
ALTER TABLE public.confess_reward_claims ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_roulette_posts_active ON public.confess_roulette_posts (created_at DESC) WHERE is_hidden = false;
CREATE INDEX idx_roulette_seen_viewer ON public.confess_roulette_seen (viewer_visitor_id);
CREATE INDEX idx_reward_claims_visitor ON public.confess_reward_claims (visitor_id);