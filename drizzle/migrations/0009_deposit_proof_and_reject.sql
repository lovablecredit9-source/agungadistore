ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS proof_path text, ADD COLUMN IF NOT EXISTS proof_uploaded_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_reject_deposit(p_deposit_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d record; v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Alasan penolakan wajib diisi'; END IF;
  SELECT * INTO d FROM deposits WHERE id = p_deposit_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deposit tidak ditemukan'; END IF;
  IF d.status <> 'pending' THEN RAISE EXCEPTION 'Deposit sudah diproses (%)', d.status; END IF;
  UPDATE deposits SET status = 'rejected', cancel_reason = left(v_reason, 300), updated_at = now() WHERE id = d.id;
  INSERT INTO notifications(visitor_id, title, message, type, related_id)
  VALUES (d.visitor_id, 'Deposit Ditolak', 'Deposit Rp ' || to_char(d.amount, 'FM999G999G999') || ' (TRX: ' || coalesce(d.trx_id,'') || ') ditolak. Alasan: ' || left(v_reason,300) || '. Saldo tidak bertambah.', 'deposit_rejected', d.trx_id);
  RETURN jsonb_build_object('ok', true, 'status', 'rejected', 'reason', left(v_reason,300));
END $$;
REVOKE ALL ON FUNCTION public.admin_reject_deposit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit(uuid, text) TO authenticated;