ALTER TABLE public.streak_lucky_box_subs 
ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta');

UPDATE public.streak_lucky_box_subs 
SET effective_from = (created_at AT TIME ZONE 'Asia/Jakarta')::date 
WHERE effective_from IS NULL;