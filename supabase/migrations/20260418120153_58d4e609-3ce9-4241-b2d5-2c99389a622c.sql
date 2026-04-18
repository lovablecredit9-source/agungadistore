
-- ============== PVP BATTLE ROOMS ==============
CREATE TABLE IF NOT EXISTS public.game_pvp_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text UNIQUE,
  visibility text NOT NULL DEFAULT 'public', -- public | private
  status text NOT NULL DEFAULT 'waiting', -- waiting | playing | finished
  player1_visitor_id text NOT NULL,
  player1_name text NOT NULL DEFAULT 'Player 1',
  player2_visitor_id text,
  player2_name text,
  current_round int NOT NULL DEFAULT 1,
  best_of int NOT NULL DEFAULT 5,
  player1_score int NOT NULL DEFAULT 0,
  player2_score int NOT NULL DEFAULT 0,
  player1_choice text,
  player2_choice text,
  round_started_at timestamptz,
  round_deadline_at timestamptz,
  winner_visitor_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pvp_rooms_status_vis ON public.game_pvp_rooms(status, visibility);
CREATE INDEX IF NOT EXISTS idx_pvp_rooms_code ON public.game_pvp_rooms(room_code);

ALTER TABLE public.game_pvp_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PvP rooms viewable" ON public.game_pvp_rooms FOR SELECT USING (true);
CREATE POLICY "PvP rooms insert anyone" ON public.game_pvp_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "PvP rooms update anyone" ON public.game_pvp_rooms FOR UPDATE USING (true);

CREATE TRIGGER pvp_rooms_updated BEFORE UPDATE ON public.game_pvp_rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_pvp_rooms;

-- ============== CLAN SYSTEM ==============
CREATE TABLE IF NOT EXISTS public.game_clans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text NOT NULL,
  motto text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'public', -- public | private
  join_code text UNIQUE,
  leader_visitor_id text NOT NULL,
  leader_name text NOT NULL DEFAULT 'Leader',
  member_count int NOT NULL DEFAULT 1,
  max_members int NOT NULL DEFAULT 20,
  total_xp bigint NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clans_tag ON public.game_clans(lower(tag));
CREATE INDEX IF NOT EXISTS idx_clans_name ON public.game_clans(lower(name));

CREATE TABLE IF NOT EXISTS public.game_clan_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.game_clans(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  display_name text NOT NULL DEFAULT 'Member',
  role text NOT NULL DEFAULT 'member', -- leader | officer | member
  contributed_xp int NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clan_id, visitor_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clan_members_visitor ON public.game_clan_members(visitor_id);

ALTER TABLE public.game_clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_clan_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clans viewable" ON public.game_clans FOR SELECT USING (true);
CREATE POLICY "Clans insert anyone" ON public.game_clans FOR INSERT WITH CHECK (true);
CREATE POLICY "Clans update anyone" ON public.game_clans FOR UPDATE USING (true);
CREATE POLICY "Clans delete anyone" ON public.game_clans FOR DELETE USING (true);

CREATE POLICY "Clan members viewable" ON public.game_clan_members FOR SELECT USING (true);
CREATE POLICY "Clan members insert anyone" ON public.game_clan_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Clan members update anyone" ON public.game_clan_members FOR UPDATE USING (true);
CREATE POLICY "Clan members delete anyone" ON public.game_clan_members FOR DELETE USING (true);

CREATE TRIGGER game_clans_updated BEFORE UPDATE ON public.game_clans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_clans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_clan_members;

-- ============== SEASON PASS REAL ==============
CREATE TABLE IF NOT EXISTS public.game_season_pass (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  season_key text NOT NULL DEFAULT 'season_2026Q2',
  is_premium boolean NOT NULL DEFAULT false,
  premium_source text, -- balance | gems | coins
  premium_purchased_at timestamptz,
  claimed_tiers int[] NOT NULL DEFAULT '{}',
  total_xp int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_season_pass ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Season pass viewable" ON public.game_season_pass FOR SELECT USING (true);
CREATE POLICY "Season pass insert" ON public.game_season_pass FOR INSERT WITH CHECK (true);
CREATE POLICY "Season pass update" ON public.game_season_pass FOR UPDATE USING (true);

CREATE TRIGGER season_pass_updated BEFORE UPDATE ON public.game_season_pass
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
