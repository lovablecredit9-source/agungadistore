ALTER TABLE public.weekly_spin_event_settings
  ADD COLUMN IF NOT EXISTS event_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS admin_note text NOT NULL DEFAULT '';