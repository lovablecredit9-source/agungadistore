import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  visitorId: z.string().trim().min(1, "Visitor ID tidak ditemukan"),
  username: z.string().trim().min(3, "Username minimal 3 karakter").max(30, "Username maksimal 30 karakter").regex(/^[A-Za-z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore"),
  phone: z.string().trim().transform((value) => value.replace(/[\s-]/g, "")).refine((value) => /^(\+?\d{1,4}\s?\d+|08\d+)$/.test(value), "Format nomor HP tidak valid").refine((value) => value.replace(/\D/g, "").length >= 7 && value.replace(/\D/g, "").length <= 16, "No HP tidak valid (7-16 digit)"),
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await request.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Data profil tidak valid" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Konfigurasi backend belum lengkap" }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { visitorId, username, phone } = parsed.data;

    const { data: existing } = await admin
      .from("user_balances")
      .select("id, username")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (existing?.id) {
      const nameChanged = (existing.username ?? "") !== username;

      // Batasi ganti nama maksimal 3x per bulan (30 hari terakhir)
      if (nameChanged) {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await admin
          .from("balance_name_changes")
          .select("id", { count: "exact", head: true })
          .eq("visitor_id", visitorId)
          .gte("changed_at", since);

        if ((count ?? 0) >= 3) {
          return Response.json(
            { error: "Batas ganti nama tercapai (maksimal 3x dalam sebulan). Coba lagi nanti." },
            { status: 429, headers: corsHeaders },
          );
        }
      }

      const { data: updatedUser, error: updateError } = await admin
        .from("user_balances")
        .update({ username, phone })
        .eq("id", existing.id)
        .select("id, visitor_id, username, phone, balance")
        .single();

      if (updateError || !updatedUser) {
        return Response.json({ error: "Gagal memperbarui profil" }, { status: 500, headers: corsHeaders });
      }

      if (nameChanged) {
        await admin.from("balance_name_changes").insert({
          visitor_id: visitorId,
          old_username: existing.username,
          new_username: username,
        });
      }

      return Response.json({ success: true, user: updatedUser, action: "updated" }, { headers: corsHeaders });
    }

    const { data: newUser, error: insertError } = await admin
      .from("user_balances")
      .insert({ visitor_id: visitorId, username, phone })
      .select("id, visitor_id, username, phone, balance")
      .single();

    if (insertError || !newUser) {
      return Response.json({ error: "Gagal membuat akun saldo" }, { status: 500, headers: corsHeaders });
    }

    return Response.json({ success: true, user: newUser, action: "created" }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat menyimpan profil";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});