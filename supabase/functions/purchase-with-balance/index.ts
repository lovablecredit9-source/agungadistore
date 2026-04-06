import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PurchaseRequest = {
  visitorId?: string;
  productId?: string;
  quantity?: number;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { visitorId, productId, quantity: rawQty } = (await request.json()) as PurchaseRequest;
    const quantity = Math.max(1, Math.min(rawQty || 1, 50));

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

    const totalPrice = product.price * quantity;

    if (balanceRow.balance < totalPrice) {
      return Response.json({ error: "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });
    }

    // Get sold token IDs
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

    const availableTokens = (tokens ?? []).filter((token) => !soldTokenIds.has(token.id));

    if (availableTokens.length < quantity) {
      return Response.json({ error: `Stok voucher tidak cukup. Tersedia: ${availableTokens.length}` }, { status: 400, headers: corsHeaders });
    }

    const selectedTokens = availableTokens.slice(0, quantity);
    const nextBalance = balanceRow.balance - totalPrice;

    // Update balance
    const { error: balanceUpdateError } = await admin
      .from("user_balances")
      .update({ balance: nextBalance })
      .eq("id", balanceRow.id);

    if (balanceUpdateError) {
      return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }

    // Insert all transactions
    const transactionRows = selectedTokens.map((token) => ({
      visitor_id: visitorId,
      type: "purchase",
      amount: product.price,
      description: `Beli ${product.title}`,
      product_id: product.id,
      token_id: token.id,
    }));

    const { error: transactionError } = await admin.from("balance_transactions").insert(transactionRows);

    if (transactionError) {
      // Rollback balance
      await admin.from("user_balances").update({ balance: balanceRow.balance }).eq("id", balanceRow.id);
      return Response.json({ error: "Gagal mencatat pembelian" }, { status: 500, headers: corsHeaders });
    }

    // Fetch fields for all tokens
    const tokenIds = selectedTokens.map((t) => t.id);
    const { data: allFields } = await admin
      .from("token_fields")
      .select("token_id, field_name, field_value")
      .in("token_id", tokenIds)
      .order("created_at", { ascending: true });

    const tokenResults = selectedTokens.map((token) => ({
      id: token.id,
      token_code: token.token_code,
      fields: (allFields ?? []).filter((f) => f.token_id === token.id).map((f) => ({ field_name: f.field_name, field_value: f.field_value })),
    }));

    return Response.json(
      {
        success: true,
        tokens: tokenResults,
        product,
        quantity,
        total_price: totalPrice,
        balance_remaining: nextBalance,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat memproses pembelian";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
