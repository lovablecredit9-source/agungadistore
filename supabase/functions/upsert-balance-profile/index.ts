import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  visitorId: z.string().trim().min(1, "Visitor ID tidak ditemukan"),
  username: z.string().trim().min(6, "Username minimal 6 karakter").max(30, "Username maksimal 30 karakter").regex(/^[A-Za-z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore"),
  phone: z.string().trim().transform((value) => value.replace(/[\s-]/g, "")).refine((value) => /^(08\d+|\+628\d+)$/.test(value), "No HP harus diawali 08 atau +628").refine((value) => value.length >= 10 && value.length <= 16, "No HP tidak valid"),
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
      .select("id")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (existing?.id) {
      const { data: updatedUser, error: updateError } = await admin
        .from("user_balances")
        .update({ username, phone })
        .eq("id", existing.id)
        .select("id, visitor_id, username, phone, balance")
        .single();

      if (updateError || !updatedUser) {
        return Response.json({ error: "Gagal memperbarui profil" }, { status: 500, headers: corsHeaders });
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