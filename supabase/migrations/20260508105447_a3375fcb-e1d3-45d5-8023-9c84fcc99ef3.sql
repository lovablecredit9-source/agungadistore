
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

CREATE OR REPLACE FUNCTION public.auto_cancel_expired_deposits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT id, visitor_id, amount, trx_id
    FROM public.deposits
    WHERE status = 'pending'
      AND created_at < (now() - interval '24 hours')
  LOOP
    UPDATE public.deposits
    SET status = 'cancelled',
        cancel_reason = 'Otomatis dibatalkan: tidak dikonfirmasi dalam 24 jam',
        updated_at = now()
    WHERE id = rec.id AND status = 'pending';

    INSERT INTO public.notifications (visitor_id, title, message, type, related_id)
    VALUES (
      rec.visitor_id,
      '⏰ Deposit Otomatis Dibatalkan',
      'Deposit Rp ' || to_char(rec.amount, 'FM999G999G999') || ' (TRX: ' || rec.trx_id || ') dibatalkan otomatis karena tidak dikonfirmasi admin dalam 24 jam. Silakan ajukan ulang.',
      'deposit_cancelled',
      rec.trx_id
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
