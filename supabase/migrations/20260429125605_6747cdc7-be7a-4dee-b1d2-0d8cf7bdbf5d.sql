CREATE OR REPLACE FUNCTION public.bump_music_like_quest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NEW.visitor_id IS NULL OR trim(NEW.visitor_id) = '' THEN
    RETURN NEW;
  END IF;

  PERFORM public.ensure_music_daily_quests(NEW.visitor_id);

  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + 1),
      is_completed = (current_value + 1 >= target_value)
  WHERE visitor_id = NEW.visitor_id
    AND quest_date = v_today
    AND quest_type = 'like_songs'
    AND is_completed = false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_music_like_quest ON public.liked_songs;
CREATE TRIGGER trg_bump_music_like_quest
AFTER INSERT ON public.liked_songs
FOR EACH ROW
EXECUTE FUNCTION public.bump_music_like_quest();

CREATE OR REPLACE FUNCTION public.bump_music_comment_quest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NEW.visitor_id IS NULL OR trim(NEW.visitor_id) = '' THEN
    RETURN NEW;
  END IF;

  PERFORM public.ensure_music_daily_quests(NEW.visitor_id);

  UPDATE public.music_daily_quests
  SET current_value = LEAST(target_value, current_value + 1),
      is_completed = (current_value + 1 >= target_value)
  WHERE visitor_id = NEW.visitor_id
    AND quest_date = v_today
    AND quest_type = 'comment_song'
    AND is_completed = false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_music_comment_quest ON public.song_comments;
CREATE TRIGGER trg_bump_music_comment_quest
AFTER INSERT ON public.song_comments
FOR EACH ROW
EXECUTE FUNCTION public.bump_music_comment_quest();