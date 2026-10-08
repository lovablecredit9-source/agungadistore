# Confess rules

- Confess instant checkout (price tiers, free 24h window, trial, voucher claim, free-send rewards, balance deduction, threads/messages) runs only inside DB RPC `confess_checkout` (dry_run = quote, idempotent per `trx_id`); `send-confession` verifies PIN and calls it, UI in `components/confess/ConfessCheckout.tsx` only displays the quote. Loyalty milestones live in `admin_settings` (`confess_promo_*`) with ledger `confess_free_sends`. Why: the old edge flow did read-modify-write balance updates and refunds that could double-charge or overwrite balances.
