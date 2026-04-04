import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PurchaseRequest = {
  visitorId?: string;
  productId?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { visitorId, productId } = (await request.json()) as PurchaseRequest;

    if (!visitorId || !productId) {
      return Response.json({ error: "Data pembelian tidak lengkap" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Konfigurasi backend belum lengkap" }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: balanceRow, error: balanceError } = await admin
      .from("user_balances")
      .select("id, visitor_id, username, phone, balance")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (balanceError || !balanceRow) {
      return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, title, description, price, stock, image_url, category, has_warranty")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return Response.json({ error: "Produk tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }

    if (balanceRow.balance < product.price) {
      return Response.json({ error: "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });
    }

    const { data: soldTransactions, error: soldTransactionsError } = await admin
      .from("balance_transactions")
      .select("token_id")
      .eq("type", "purchase")
      .eq("product_id", productId)
      .not("token_id", "is", null);

    if (soldTransactionsError) {
      return Response.json({ error: "Gagal memeriksa stok voucher" }, { status: 500, headers: corsHeaders });
    }

    const soldTokenIds = new Set((soldTransactions ?? []).map((item) => item.token_id).filter(Boolean));

    const { data: tokens, error: tokenError } = await admin
      .from("tokens")
      .select("id, product_id, token_code, is_claimed, claimed_at, created_at")
      .eq("product_id", productId)
      .eq("is_claimed", false)
      .order("created_at", { ascending: true });

    if (tokenError) {
      return Response.json({ error: "Gagal mengambil voucher" }, { status: 500, headers: corsHeaders });
    }

    const availableToken = (tokens ?? []).find((token) => !soldTokenIds.has(token.id));

    if (!availableToken) {
      return Response.json({ error: "Stok voucher habis untuk produk ini" }, { status: 400, headers: corsHeaders });
    }

    const nextBalance = balanceRow.balance - product.price;

    const { error: balanceUpdateError } = await admin
      .from("user_balances")
      .update({ balance: nextBalance })
      .eq("id", balanceRow.id);

    if (balanceUpdateError) {
      return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }

    const { error: transactionError } = await admin.from("balance_transactions").insert({
      visitor_id: visitorId,
      type: "purchase",
      amount: product.price,
      description: `Beli ${product.title}`,
      product_id: product.id,
      token_id: availableToken.id,
    });

    if (transactionError) {
      await admin.from("user_balances").update({ balance: balanceRow.balance }).eq("id", balanceRow.id);

      return Response.json({ error: "Gagal mencatat pembelian" }, { status: 500, headers: corsHeaders });
    }

    const { data: fields, error: fieldsError } = await admin
      .from("token_fields")
      .select("field_name, field_value")
      .eq("token_id", availableToken.id)
      .order("created_at", { ascending: true });

    if (fieldsError) {
      return Response.json({ error: "Pembelian berhasil, tetapi detail voucher gagal dimuat" }, { status: 500, headers: corsHeaders });
    }

    return Response.json(
      {
        success: true,
        token: {
          id: availableToken.id,
          token_code: availableToken.token_code,
        },
        product,
        fields: fields ?? [],
        balance_remaining: nextBalance,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat memproses pembelian";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});