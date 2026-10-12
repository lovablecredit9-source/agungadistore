CREATE TABLE public.game_point_booster_tiers (
  multiplier int PRIMARY KEY CHECK (multiplier BETWEEN 2 AND 10),
  min_level int NOT NULL DEFAULT 1,
  requires_membership boolean NOT NULL DEFAULT false,
  base_gems int NOT NULL CHECK (base_gems > 0),
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.game_point_booster_tiers TO anon, authenticated;
GRANT ALL ON public.game_point_booster_tiers TO service_role;
ALTER TABLE public.game_point_booster_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booster tiers public read" ON public.game_point_booster_tiers FOR SELECT USING (true);
CREATE POLICY "booster tiers admin write" ON public.game_point_booster_tiers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.game_point_booster_durations (
  key text PRIMARY KEY,
  label text NOT NULL,
  minutes int NOT NULL CHECK (minutes > 0),
  price_factor numeric NOT NULL CHECK (price_factor > 0),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.game_point_booster_durations TO anon, authenticated;
GRANT ALL ON public.game_point_booster_durations TO service_role;
ALTER TABLE public.game_point_booster_durations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booster durations public read" ON public.game_point_booster_durations FOR SELECT USING (true);
CREATE POLICY "booster durations admin write" ON public.game_point_booster_durations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.game_point_booster_tiers (multiplier,min_level,requires_membership,base_gems) VALUES
 (2,1,false,20),(3,2,false,32),(4,3,false,48),(5,4,false,68),(6,5,false,92),(7,6,false,120),(8,7,true,155),(9,8,true,195),(10,8,true,250);
INSERT INTO public.game_point_booster_durations (key,label,minutes,price_factor,sort_order) VALUES
 ('10m','10 menit',10,1,1),('30m','30 menit',30,2.6,2),('1h','1 jam',60,4.8,3),('2h','2 jam',120,9,4),('3h','3 jam',180,12.5,5),
 ('1d','1 hari',1440,60,6),('2d','2 hari',2880,110,7),('10d','10 hari',14400,450,8),('30d','30 hari',43200,1100,9),
 ('2mo','2 bulan',86400,2000,10),('6mo','6 bulan',259200,5200,11),('1y','1 tahun',525600,9000,12);

-- Rekam immutable pembelian booster; hanya ditulis lewat RPC service-role.
CREATE TABLE public.game_point_boosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL,
  visitor_id text NOT NULL,
  multiplier int NOT NULL,
  duration_key text NOT NULL,
  duration_minutes int NOT NULL,
  gem_cost int NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  purchase_ref text NOT NULL UNIQUE,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_point_boosters_wallet_exp ON public.game_point_boosters (wallet_id, expires_at DESC);
GRANT ALL ON public.game_point_boosters TO service_role;
ALTER TABLE public.game_point_boosters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.point_booster_price(p_multiplier int, p_duration text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CEIL(t.base_gems * d.price_factor)::int
  FROM game_point_booster_tiers t, game_point_booster_durations d
  WHERE t.multiplier=p_multiplier AND d.key=p_duration AND t.is_active AND d.is_active
$$;

CREATE OR REPLACE FUNCTION public.buy_point_booster(p_wallet_id uuid, p_visitor_id text, p_multiplier int, p_duration text, p_purchase_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  t game_point_booster_tiers; d game_point_booster_durations;
  v_existing game_point_boosters; v_row game_point_boosters;
  v_price int; v_level int; v_member boolean; v_left int;
BEGIN
  IF p_purchase_ref IS NULL OR length(p_purchase_ref) < 8 OR length(p_purchase_ref) > 80 THEN RAISE EXCEPTION 'INVALID_REF'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('pb:'||p_wallet_id::text));
  SELECT * INTO v_existing FROM game_point_boosters WHERE purchase_ref=p_purchase_ref;
  IF FOUND THEN
    IF v_existing.wallet_id <> p_wallet_id THEN RAISE EXCEPTION 'INVALID_REF'; END IF;
    RETURN jsonb_build_object('ok',true,'replayed',true,'booster',to_jsonb(v_existing),'gems',get_account_gems(p_visitor_id));
  END IF;
  SELECT * INTO t FROM game_point_booster_tiers WHERE multiplier=p_multiplier AND is_active;
  SELECT * INTO d FROM game_point_booster_durations WHERE key=p_duration AND is_active;
  IF t.multiplier IS NULL OR d.key IS NULL THEN RAISE EXCEPTION 'PACKAGE_NOT_FOUND'; END IF;
  SELECT COALESCE(MAX(level),1) INTO v_level FROM game_levels WHERE visitor_id=p_visitor_id;
  IF v_level < t.min_level THEN RAISE EXCEPTION 'LEVEL_REQUIRED:%', t.min_level; END IF;
  IF t.requires_membership THEN
    SELECT EXISTS(SELECT 1 FROM streak_user_memberships WHERE visitor_id=p_visitor_id AND is_active AND expires_at>now()) INTO v_member;
    IF NOT v_member THEN RAISE EXCEPTION 'MEMBERSHIP_REQUIRED'; END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM game_point_boosters WHERE wallet_id=p_wallet_id AND multiplier=p_multiplier AND expires_at>now()) THEN
    RAISE EXCEPTION 'ALREADY_ACTIVE';
  END IF;
  v_price := CEIL(t.base_gems * d.price_factor)::int;
  v_left := add_account_gems(p_visitor_id, -v_price); -- RAISE INSUFFICIENT_GEMS bila kurang
  INSERT INTO game_point_boosters (wallet_id,visitor_id,multiplier,duration_key,duration_minutes,gem_cost,expires_at,purchase_ref)
  VALUES (p_wallet_id,p_visitor_id,p_multiplier,d.key,d.minutes,v_price,now()+make_interval(mins=>d.minutes),p_purchase_ref)
  RETURNING * INTO v_row;
  INSERT INTO gem_transactions (visitor_id,amount,type,description,reference_id)
  VALUES (p_visitor_id,-v_price,'point_booster','Booster Poin x'||p_multiplier||' · '||d.label,v_row.id::text);
  RETURN jsonb_build_object('ok',true,'replayed',false,'booster',to_jsonb(v_row),'gems',v_left);
END $$;
REVOKE ALL ON FUNCTION public.buy_point_booster(uuid,text,int,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_point_booster(uuid,text,int,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.point_booster_price(int,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.point_booster_price(int,text) TO service_role;