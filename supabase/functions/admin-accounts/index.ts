// Tambah akun admin (khusus super_admin). Password langsung ke Auth, tidak disimpan/di-log di tempat lain.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const { data: caller } = token ? await db.auth.getUser(token) : { data: { user: null } };
    const callerId = caller?.user?.id;
    if (!callerId) return json({ error: "Forbidden" }, 403);
    const { data: isSuper } = await db.rpc("has_role", { _user_id: callerId, _role: "super_admin" });
    if (!isSuper) return json({ error: "Hanya super admin yang dapat menambah admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "list") {
      const { data: roles } = await db.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin"]);
      const out = [];
      for (const r of roles ?? []) {
        const { data } = await db.auth.admin.getUserById(r.user_id);
        out.push({ email: data?.user?.email ?? "-", role: r.role, last_sign_in_at: data?.user?.last_sign_in_at ?? null });
      }
      return json({ ok: true, admins: out });
    }

    if (action !== "create") return json({ error: "Aksi tidak dikenal" }, 400);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "Format email tidak valid" }, 400);
    if (password.length < 8 || password.length > 72) return json({ error: "Password minimal 8 karakter" }, 400);

    // Cegah duplikat: pakai user Auth yang sudah ada jika email sama.
    let userId: string | null = null;
    let created = false;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return json({ error: "Gagal membaca akun Auth" }, 500);
      userId = data.users.find((u) => (u.email || "").toLowerCase() === email)?.id ?? null;
      if (data.users.length < 200) break;
    }
    if (!userId) {
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) return json({ error: error?.message || "Gagal membuat akun" }, 400);
      userId = data.user.id; created = true;
    } else {
      // Akun yang sudah terhubung ke dompet tidak boleh dijadikan admin (admin ≠ wallet).
      const { count } = await db.from("user_balances").select("id", { count: "exact", head: true }).eq("auth_user_id", userId);
      if ((count ?? 0) > 0) return json({ error: "Email ini terhubung ke akun saldo pengguna, tidak bisa dijadikan admin" }, 409);
    }

    const { data: existing } = await db.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]);
    if (existing?.length) return json({ ok: true, created, already_admin: true });
    const { error: roleErr } = await db.from("user_roles").insert({ user_id: userId, role: "admin" });
    if (roleErr) return json({ error: "Akun dibuat, tetapi role admin gagal diberikan" }, 500);
    return json({ ok: true, created, already_admin: false });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Terjadi kesalahan server" }, 500);
  }
});
