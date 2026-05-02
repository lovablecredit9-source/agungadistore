-- 1. Hapus duplikat klaim per (voucher_id, user_balance_id) - sisakan yang paling awal
DELETE FROM public.streak_voucher_claims a
USING public.streak_voucher_claims b
WHERE a.user_balance_id IS NOT NULL
  AND a.user_balance_id = b.user_balance_id
  AND a.voucher_id = b.voucher_id
  AND a.claimed_at > b.claimed_at;

-- 2. Buat unique index agar 1 akun saldo hanya bisa klaim sekali per voucher
CREATE UNIQUE INDEX IF NOT EXISTS streak_voucher_claims_voucher_account_unique
ON public.streak_voucher_claims (voucher_id, user_balance_id)
WHERE user_balance_id IS NOT NULL;