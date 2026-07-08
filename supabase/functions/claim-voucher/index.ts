import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ClaimRequest = {
  codes?: string[];
  visitorId?: string;
  deviceInfo?: string | null;
  browser?: string | null;
};

function normalizeCodes(codes: string[] = []) {
  return [...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))].slice(0, 50);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { codes = [], visitorId, deviceInfo = null, browser = null } = (await request.json()) as ClaimRequest;

    if (!visitorId) {
      return Response.json({ error: "Visitor ID tidak ditemukan" }, { status: 400, headers: corsHeaders });
    }

    const normalizedCodes = normalizeCodes(codes);

    if (normalizedCodes.length === 0) {
      return Response.json({ error: "Kode voucher kosong" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Konfigurasi backend belum lengkap" }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Kumpulkan semua visitor_id yang tertaut ke akun saldo yang sama.
    // visitor_id bisa berganti setiap login (session isolation), sehingga
    // pembelian lama tercatat dengan visitor_id lama. Kita cocokkan via akun saldo.
    const allowedVisitorIds = new Set<string>([visitorId]);
    try {
      const balanceIds = new Set<string>();
      const { data: curBal } = await admin
        .from("user_balances")
        .select("id")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (curBal?.id) balanceIds.add(curBal.id);

      const { data: loginRows } = await admin
        .from("balance_login_history")
        .select("user_balance_id")
        .eq("visitor_id", visitorId);
      for (const r of loginRows ?? []) {
        if (r.user_balance_id) balanceIds.add(r.user_balance_id);
      }

      if (balanceIds.size > 0) {
        const ids = [...balanceIds];
        const { data: balRows } = await admin
          .from("user_balances")
          .select("visitor_id")
          .in("id", ids);
        for (const r of balRows ?? []) {
          if (r.visitor_id) allowedVisitorIds.add(r.visitor_id);
        }
        const { data: histRows } = await admin
          .from("balance_login_history")
          .select("visitor_id")
          .in("user_balance_id", ids);
        for (const r of histRows ?? []) {
          if (r.visitor_id) allowedVisitorIds.add(r.visitor_id);
        }
      }
    } catch (_e) {
      // Fallback: hanya cocokkan dengan visitor_id saat ini
    }

    const results = [];
    const errors: string[] = [];

    for (const code of normalizedCodes) {
      const { data: token, error: tokenError } = await admin
        .from("tokens")
        .select("id, product_id, token_code, is_claimed, claimed_at")
        .eq("token_code", code)
        .maybeSingle();

      if (tokenError || !token) {
        errors.push(`Kode ${code} tidak ditemukan`);
        continue;
      }

      if (token.is_claimed) {
        errors.push(`Kode ${code} sudah diklaim`);
        continue;
      }

      const { data: purchaseTx } = await admin
        .from("balance_transactions")
        .select("visitor_id")
        .eq("type", "purchase")
        .eq("token_id", token.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (purchaseTx?.visitor_id && purchaseTx.visitor_id !== visitorId) {
        errors.push(`Kode ${code} bukan milik akun ini`);
        continue;
      }

      const [{ data: product, error: productError }, { data: fields, error: fieldsError }] = await Promise.all([
        admin
          .from("products")
          .select("id, title, description, price, stock, image_url, category, has_warranty")
          .eq("id", token.product_id)
          .single(),
        admin.from("token_fields").select("field_name, field_value").eq("token_id", token.id).order("created_at", { ascending: true }),
      ]);

      if (productError || !product || fieldsError) {
        errors.push(`Detail voucher ${code} gagal dimuat`);
        continue;
      }

      const claimedAt = new Date().toISOString();

      const { error: updateError } = await admin
        .from("tokens")
        .update({ is_claimed: true, claimed_at: claimedAt })
        .eq("id", token.id)
        .eq("is_claimed", false);

      if (updateError) {
        errors.push(`Kode ${code} gagal diklaim`);
        continue;
      }

      const { error: claimError } = await admin.from("token_claims").insert({
        token_id: token.id,
        device_info: deviceInfo,
        browser,
      });

      if (claimError) {
        await admin.from("tokens").update({ is_claimed: false, claimed_at: null }).eq("id", token.id);
        errors.push(`Kode ${code} gagal dicatat`);
        continue;
      }

      results.push({
        token: {
          id: token.id,
          token_code: token.token_code,
          claimed_at: claimedAt,
        },
        product,
        fields: fields ?? [],
      });
    }

    return Response.json({ results, errors }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat klaim voucher";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});