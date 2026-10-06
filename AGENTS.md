
- Files imported from TanStack-based uploads use `@/lib/router-compat` (re-exports react-router-dom) and `@/lib/server-fn-compat`; server functions become edge functions (e.g. account-slots). Why: project stays on React Router + Vite.
- PIN checks go through `verify_account_pin` (DB) / `_shared/pin.ts` (edge) and `src/lib/pin.ts` (client); never compare `user_pins.pin_hash` inline. Why: PINs belong to the balance account, while visitor_ids differ per device, and inline checks rejected correct PINs.

- Lucky Royale leaderboard/history/badges read the `royale_all_spins` view via `royale_leaderboard` / `royale_my_summary`; never add a second spin backend. Why: each Royale game already records its own history server-side.
- Support ticket user actions (close/reopen/rate) go through `ticket_user_action`; admin online status comes from `admin_heartbeat` / `support_admin_online`, not fixed hours. Why: tickets are visitor-based (no auth) and status must reflect real admin activity.
