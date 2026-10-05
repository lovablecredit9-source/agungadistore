
- Files imported from TanStack-based uploads use `@/lib/router-compat` (re-exports react-router-dom) and `@/lib/server-fn-compat`; server functions become edge functions (e.g. account-slots). Why: project stays on React Router + Vite.
