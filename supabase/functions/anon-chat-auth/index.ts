import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + "::anon-chat-salt");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ok(body: unknown) {
  return Response.json(body, { headers: corsHeaders });
}
function bad(error: string, status = 400) {
  return Response.json({ error }, { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !key) return bad("Konfigurasi backend tidak lengkap", 500);
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const payload = await req.json();
    const action = String(payload.action || "");
    const visitorId = String(payload.visitorId || "").trim();
    if (!visitorId) return bad("Visitor ID wajib");

    // Helper: lookup current account for visitor
    const findAccountByVisitor = async () => {
      const { data } = await admin
        .from("anon_chat_account_devices")
        .select("account_id")
        .eq("visitor_id", visitorId)
        .order("last_login_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const { data: acc } = await admin
        .from("anon_chat_accounts")
        .select("id, email, primary_visitor_id, created_at, bio")
        .eq("id", data.account_id)
        .maybeSingle();
      return acc;
    };

    const SELECT_COLS = "id, email, primary_visitor_id, created_at, bio";

    if (action === "me") {
      const acc = await findAccountByVisitor();
      return ok({ success: true, account: acc });
    }

    if (action === "public_bio") {
      const targetVisitorId = String(payload.targetVisitorId || "").trim();
      if (!targetVisitorId) return bad("Target visitor wajib");
      const { data: visibleSession } = await admin
        .from("anon_chat_sessions")
        .select("id")
        .or(`and(visitor_a.eq.${visitorId},visitor_b.eq.${targetVisitorId}),and(visitor_a.eq.${targetVisitorId},visitor_b.eq.${visitorId})`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!visibleSession) return ok({ success: true, bio: null });
      const { data: device } = await admin
        .from("anon_chat_account_devices")
        .select("account_id")
        .eq("visitor_id", targetVisitorId)
        .order("last_login_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!device) return ok({ success: true, bio: null });
      const { data: acc } = await admin
        .from("anon_chat_accounts")
        .select("bio")
        .eq("id", device.account_id)
        .maybeSingle();
      return ok({ success: true, bio: acc?.bio || null });
    }

    if (action === "register") {
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Format email tidak valid");
      if (password.length < 6) return bad("Sandi minimal 6 karakter");

      const { data: existing } = await admin.from("anon_chat_accounts").select("id").eq("email", email).maybeSingle();
      if (existing) return bad("Email sudah terdaftar. Silakan login.");

      const password_hash = await hashPassword(password);
      const { data: acc, error } = await admin
        .from("anon_chat_accounts")
        .insert({ email, password_hash, primary_visitor_id: visitorId })
        .select(SELECT_COLS)
        .single();
      if (error || !acc) return bad("Gagal mendaftar: " + (error?.message || ""), 500);

      await admin.from("anon_chat_account_devices").upsert({ account_id: acc.id, visitor_id: visitorId, last_login_at: new Date().toISOString() }, { onConflict: "account_id,visitor_id" });
      return ok({ success: true, account: acc });
    }

    if (action === "login") {
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      if (!email || !password) return bad("Email & sandi wajib diisi");
      const password_hash = await hashPassword(password);
      const { data: acc } = await admin
        .from("anon_chat_accounts")
        .select(SELECT_COLS)
        .eq("email", email)
        .eq("password_hash", password_hash)
        .maybeSingle();
      if (!acc) return bad("Email atau sandi salah", 401);

      await admin.from("anon_chat_account_devices").upsert({ account_id: acc.id, visitor_id: visitorId, last_login_at: new Date().toISOString() }, { onConflict: "account_id,visitor_id" });
      return ok({ success: true, account: acc });
    }

    if (action === "logout") {
      await admin.from("anon_chat_account_devices").delete().eq("visitor_id", visitorId);
      return ok({ success: true });
    }

    if (action === "change_email") {
      const newEmail = String(payload.newEmail || "").trim().toLowerCase();
      const password = String(payload.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return bad("Format email baru tidak valid");
      if (!password) return bad("Sandi lama wajib diisi");

      const acc = await findAccountByVisitor();
      if (!acc) return bad("Belum login akun Anon", 401);

      const password_hash = await hashPassword(password);
      const { data: verify } = await admin
        .from("anon_chat_accounts")
        .select("id")
        .eq("id", acc.id)
        .eq("password_hash", password_hash)
        .maybeSingle();
      if (!verify) return bad("Sandi lama salah", 401);

      const { data: dup } = await admin.from("anon_chat_accounts").select("id").eq("email", newEmail).neq("id", acc.id).maybeSingle();
      if (dup) return bad("Email sudah dipakai akun lain");

      const { data: updated, error } = await admin
        .from("anon_chat_accounts")
        .update({ email: newEmail })
        .eq("id", acc.id)
        .select(SELECT_COLS)
        .single();
      if (error || !updated) return bad("Gagal mengubah email", 500);
      return ok({ success: true, account: updated });
    }

    if (action === "change_password") {
      const oldPw = String(payload.oldPassword || "");
      const newPw = String(payload.newPassword || "");
      if (newPw.length < 6) return bad("Sandi baru minimal 6 karakter");

      const acc = await findAccountByVisitor();
      if (!acc) return bad("Belum login akun Anon", 401);

      const oldHash = await hashPassword(oldPw);
      const { data: verify } = await admin.from("anon_chat_accounts").select("id").eq("id", acc.id).eq("password_hash", oldHash).maybeSingle();
      if (!verify) return bad("Sandi lama salah", 401);

      const newHash = await hashPassword(newPw);
      await admin.from("anon_chat_accounts").update({ password_hash: newHash }).eq("id", acc.id);
      return ok({ success: true });
    }

    if (action === "update_bio") {
      const bio = String(payload.bio || "").slice(0, 200);
      const acc = await findAccountByVisitor();
      if (!acc) return bad("Belum login akun Anon", 401);
      const { data: updated, error } = await admin
        .from("anon_chat_accounts")
        .update({ bio })
        .eq("id", acc.id)
        .select(SELECT_COLS)
        .single();
      if (error || !updated) return bad("Gagal menyimpan deskripsi", 500);
      return ok({ success: true, account: updated });
    }

    return bad("Action tidak valid");
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Kesalahan tak terduga", 500);
  }
});
