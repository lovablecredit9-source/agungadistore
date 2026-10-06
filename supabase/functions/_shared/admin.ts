// Pengecekan admin bersama untuk Edge Function.
// Memakai token login (Authorization: Bearer <jwt>) lalu mengecek role admin/super_admin di user_roles.
// Kunci publik (anon) tidak punya user, jadi selalu ditolak.
// deno-lint-ignore no-explicit-any
export async function isAdminRequest(req: Request, db: any): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  try {
    const { data } = await db.auth.getUser(token);
    const uid = data?.user?.id;
    if (!uid) return false;
    const [a, s] = await Promise.all([
      db.rpc("has_role", { _user_id: uid, _role: "admin" }),
      db.rpc("has_role", { _user_id: uid, _role: "super_admin" }),
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
