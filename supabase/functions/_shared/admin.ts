// Pengecekan admin bersama untuk Edge Function.
// Memakai token login (Authorization: Bearer <jwt>) lalu mengecek role admin/super_admin di user_roles.
// Kunci publik (anon) tidak punya user, jadi selalu ditolak.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

// deno-lint-ignore no-explicit-any
export async function isAdminRequest(req: Request, db?: any): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  try {
    const client = db ?? createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await client.auth.getUser(token);
    const uid = data?.user?.id;
    if (!uid) return false;
    const [a, s] = await Promise.all([
      client.rpc("has_role", { _user_id: uid, _role: "admin" }),
      client.rpc("has_role", { _user_id: uid, _role: "super_admin" }),
    ]);
    return !!(a?.data || s?.data);
  } catch {
    return false;
  }
}

export function forbidden(headers: HeadersInit) {
  return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
    status: 403, headers: { ...headers, "Content-Type": "application/json" },
  });
}
