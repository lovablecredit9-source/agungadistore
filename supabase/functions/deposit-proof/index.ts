// Bukti pembayaran deposit: upload (pemilik deposit), lihat (pemilik / admin).
// Upload bukti TIDAK mengubah status atau saldo — verifikasi tetap lewat admin_approve_deposit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { isAdminRequest } from "../_shared/admin.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "deposit-proofs";
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });

/** Deteksi tipe dari isi file (magic bytes), bukan dari nama/ekstensi. */
function sniff(b: Uint8Array): { mime: string; ext: string } | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const depositId = String(form.get("depositId") || "");
      const visitorId = String(form.get("visitorId") || "");
      const file = form.get("file");
      if (!depositId || !visitorId || !(file instanceof File)) return json({ error: "Data upload tidak lengkap" }, 400);
      if (file.size > MAX_BYTES) return json({ error: "Ukuran file terlalu besar. Maksimal 5 MB." }, 413);
      if (file.size === 0) return json({ error: "File kosong" }, 400);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = sniff(bytes);
      if (!kind) return json({ error: "Format file tidak didukung. Gunakan JPG, PNG, atau WEBP." }, 415);

      const { data: dep } = await db.from("deposits").select("id, visitor_id, status, proof_path").eq("id", depositId).maybeSingle();
      if (!dep || dep.visitor_id !== visitorId) return json({ error: "Deposit tidak ditemukan" }, 404);
      if (dep.status !== "pending") return json({ error: "Deposit sudah diproses, bukti tidak bisa diganti" }, 409);

      const path = `${dep.id}/${crypto.randomUUID()}.${kind.ext}`;
      const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: kind.mime, upsert: false });
      if (up.error) return json({ error: "Penyimpanan gagal: " + up.error.message }, 500);
      const now = new Date().toISOString();
      const { data: upd, error: updErr } = await db.from("deposits")
        .update({ proof_path: path, proof_uploaded_at: now }).eq("id", dep.id).eq("status", "pending").select("id");
      if (updErr || !upd?.length) {
        await db.storage.from(BUCKET).remove([path]);
        return json({ error: "Deposit sudah diproses, bukti tidak disimpan" }, 409);
      }
      if (dep.proof_path) await db.storage.from(BUCKET).remove([dep.proof_path]);
      const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(path, 600);
      return json({ ok: true, proof_uploaded_at: now, url: signed?.signedUrl ?? null });
    }

    const body = await req.json().catch(() => ({}));
    const { action, depositId, visitorId } = body as Record<string, string>;
    if (!depositId) return json({ error: "Deposit tidak ditemukan" }, 400);
    const { data: dep } = await db.from("deposits").select("id, visitor_id, proof_path, proof_uploaded_at").eq("id", depositId).maybeSingle();
    if (!dep) return json({ error: "Deposit tidak ditemukan" }, 404);
    if (action === "admin_url") {
      if (!(await isAdminRequest(req, db))) return json({ error: "Forbidden — admin only" }, 403);
    } else if (action === "my_url") {
      if (!visitorId || dep.visitor_id !== visitorId) return json({ error: "Deposit tidak ditemukan" }, 404);
    } else return json({ error: "Aksi tidak dikenal" }, 400);
    if (!dep.proof_path) return json({ ok: true, url: null, proof_uploaded_at: null });
    const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(dep.proof_path, 600);
    return json({ ok: true, url: signed?.signedUrl ?? null, proof_uploaded_at: dep.proof_uploaded_at });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Terjadi kesalahan server" }, 500);
  }
});
