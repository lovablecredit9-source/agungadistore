
- Files imported from TanStack-based uploads use `@/lib/router-compat` (re-exports react-router-dom) and `@/lib/server-fn-compat`; server functions become edge functions (e.g. account-slots). Why: project stays on React Router + Vite.
- PIN checks go through `verify_account_pin` (DB) / `_shared/pin.ts` (edge) and `src/lib/pin.ts` (client); never compare `user_pins.pin_hash` inline. Why: PINs belong to the balance account, while visitor_ids differ per device, and inline checks rejected correct PINs.
