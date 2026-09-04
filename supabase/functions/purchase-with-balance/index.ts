import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PurchaseRequest = {
  visitorId?: string;
  productId?: string;
  quantity?: number;
  discountCode?: string;
  pin?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { visitorId, productId, quantity: rawQty, discountCode, pin } = (await request.json()) as PurchaseRequest;
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

    // Ban guard
    const { data: banned } = await admin.rpc("is_account_banned", { p_visitor_id: visitorId });
    if (banned) {
      return Response.json({ error: "Akun Anda dibanned. Tidak bisa melakukan pembelian." }, { status: 403, headers: corsHeaders });
    }

    // Verify PIN
    const { data: pinRow } = await admin
      .from("user_pins")
      .select("pin_hash")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (!pinRow) {
      return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 200, headers: corsHeaders });
    }
    if (!pin) {
      return Response.json({ error: "PIN diperlukan untuk pembelian", needPin: true }, { status: 403, headers: corsHeaders });
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    
    if (hashHex !== pinRow.pin_hash) {
      return Response.json({ error: "PIN salah", needPin: true }, { status: 403, headers: corsHeaders });
    }

    const { data: balanceRow, error: balanceError } = await admin
      .from("user_balances")
      .select("id, visitor_id, username, phone, balance")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    const { data: gameBal } = await admin
      .from("game_balance")
      .select("id, amount, total_spent")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (balanceError || !balanceRow) {
      return Response.json({ error: "Akun saldo tidak ditemukan. Silakan login ulang di menu Saldo terlebih dahulu.", needLogin: true }, { status: 404, headers: corsHeaders });
    }

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, title, description, price, stock, image_url, category, has_warranty")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return Response.json({ error: "Produk tidak ditemukan" }, { status: 404, headers: corsHeaders });
    }

    // Check wholesale pricing
    const { data: wholesaleTiers } = await admin
      .from("wholesale_prices")
      .select("min_quantity, price_per_item")
      .eq("entity_type", "product")
      .eq("entity_id", productId)
      .order("min_quantity", { ascending: false });

    let unitPrice = product.price;
    if (wholesaleTiers && wholesaleTiers.length > 0) {
      for (const tier of wholesaleTiers) {
        if (quantity >= tier.min_quantity) {
          unitPrice = tier.price_per_item;
          break;
        }
      }
    }

    // Check active flash sale (overrides wholesale & normal price if active + quota available)
    const nowIso = new Date().toISOString();
    const { data: activeFlash } = await admin
      .from("store_flash_sales")
      .select("*")
      .eq("product_id", productId)
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let activeFlashRow: any = null;
    let flashUnitsUsed = 0;
    if (activeFlash) {
      const remaining = (activeFlash.quota || 0) === 0
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, (activeFlash.quota || 0) - (activeFlash.sold || 0));
      if (remaining > 0) {
        const flashPrice = activeFlash.mode === "discount_percent"
          ? Math.max(0, Math.round(product.price * (1 - (activeFlash.discount_percent || 0) / 100)))
          : (activeFlash.flash_price ?? product.price);
        flashUnitsUsed = Math.min(remaining, quantity);
        // Use flash price for the flash-eligible portion; remainder uses unitPrice
        // For simplicity: only allow purchase qty <= remaining flash quota at flash price.
        // If user wants more than remaining, fail with informative error.
        if (quantity > remaining) {
          return Response.json({ error: `Kuota Flash Sale tinggal ${remaining}. Kurangi jumlah pembelian.` }, { status: 400, headers: corsHeaders });
        }
        unitPrice = flashPrice;
        activeFlashRow = activeFlash;
      }
    }

    let totalPrice = unitPrice * quantity;
    let discountAmount = 0;
    let discountVoucherId: string | null = null;

    // Apply discount code if provided (try product vouchers, then game-reward vouchers)
    let voucherSource: "discount_vouchers" | "game_discount_vouchers" | null = null;
    if (discountCode) {
      const code = discountCode.toUpperCase();
      let voucher: any = null;
      const { data: v1 } = await admin
        .from("discount_vouchers")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (v1) {
        voucher = v1;
        voucherSource = "discount_vouchers";
      } else {
        const { data: v2 } = await admin
          .from("game_discount_vouchers")
          .select("*")
          .eq("code", code)
          .eq("is_active", true)
          .maybeSingle();
        if (v2) {
          voucher = v2;
          voucherSource = "game_discount_vouchers";
        }
      }

      if (!voucher) {
        return Response.json({ error: "Kode voucher diskon tidak valid" }, { status: 400, headers: corsHeaders });
      }

      if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
        return Response.json({ error: "Voucher diskon sudah expired" }, { status: 400, headers: corsHeaders });
      }

      if (voucher.used_count >= voucher.max_uses) {
        return Response.json({ error: "Voucher diskon sudah habis dipakai" }, { status: 400, headers: corsHeaders });
      }

      discountAmount = Math.min(voucher.discount_amount, totalPrice);
      totalPrice -= discountAmount;
      discountVoucherId = voucher.id;
    }

    const mainAmount = Number(balanceRow.balance || 0);
    const gameAmount = Number(gameBal?.amount || 0);
    // Produk admin HANYA boleh dibayar pakai saldo biasa. Saldo IN (game_balance)
    // tidak berlaku untuk produk toko admin.
    const availableBalance = mainAmount;
    if (availableBalance < totalPrice) {
      const shortage = totalPrice - availableBalance;
      return Response.json({
        error: `Saldo tidak cukup. Kurang Rp ${shortage.toLocaleString("id-ID")}. Produk admin hanya bisa dibayar dengan saldo biasa (Saldo IN tidak berlaku). Silakan top up dulu.`,
        insufficientBalance: true,
        shortage,
        available_balance: availableBalance,
        main_balance: mainAmount,
        saldo_in: gameAmount,
        saldo_in_blocked: true,
      }, { status: 200, headers: corsHeaders });
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
    const payFromGame = 0; // Saldo IN tidak berlaku untuk produk admin
    const payFromMain = totalPrice - payFromGame;
    const nextGameBalance = gameAmount - payFromGame;
    const nextBalance = mainAmount - payFromMain;

    // Update balances (Saldo IN first, then saldo utama)
    if (payFromGame > 0 && gameBal) {
      const { error: gameBalanceUpdateError } = await admin
        .from("game_balance")
        .update({ amount: nextGameBalance, total_spent: Number(gameBal.total_spent || 0) + payFromGame })
        .eq("id", gameBal.id);
      if (gameBalanceUpdateError) {
        return Response.json({ error: "Gagal memotong Saldo IN" }, { status: 500, headers: corsHeaders });
      }
      await admin.from("game_balance_transactions").insert({ visitor_id: visitorId, type: "spend", amount: -payFromGame, description: `Beli ${product.title}` });
    }

    const { error: balanceUpdateError } = payFromMain > 0
      ? await admin.from("user_balances").update({ balance: nextBalance }).eq("id", balanceRow.id)
      : { error: null };

    if (balanceUpdateError) {
      if (payFromGame > 0 && gameBal) await admin.from("game_balance").update({ amount: gameAmount, total_spent: Number(gameBal.total_spent || 0) }).eq("id", gameBal.id);
      return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
    }

    // Insert all transactions
    const pricePerItem = Math.floor(totalPrice / quantity);
    const transactionRows = selectedTokens.map((token, idx) => ({
      visitor_id: visitorId,
      type: "purchase",
      amount: idx === 0 ? totalPrice - pricePerItem * (quantity - 1) : pricePerItem,
      description: `Beli ${product.title}${unitPrice < product.price ? ` (grosir Rp${unitPrice.toLocaleString()}/pcs)` : ""}${discountAmount > 0 ? ` (diskon Rp${discountAmount.toLocaleString()})` : ""}`,
      product_id: product.id,
      token_id: token.id,
    }));

    const { error: transactionError } = await admin.from("balance_transactions").insert(transactionRows);

    if (transactionError) {
      // Rollback balance
      await admin.from("user_balances").update({ balance: balanceRow.balance }).eq("id", balanceRow.id);
      if (payFromGame > 0 && gameBal) await admin.from("game_balance").update({ amount: gameAmount, total_spent: Number(gameBal.total_spent || 0) }).eq("id", gameBal.id);
      return Response.json({ error: "Gagal mencatat pembelian" }, { status: 500, headers: corsHeaders });
    }

    // Quest Mission purchase progress (normal/premium). Best-effort so purchase flow stays safe.
    try {
      await admin.functions.invoke("check-daily-challenge", {
        body: { visitorId, eventType: "purchase", increment: 1, purchaseAmount: totalPrice },
      });
      await admin.functions.invoke("weekly-quest", {
        body: { action: "track", visitorId, eventType: "purchase", increment: 1, purchaseAmount: totalPrice },
      });
      await admin.functions.invoke("premium-quest", {
        body: { action: "track", visitorId, eventType: "purchase", increment: 1, purchaseAmount: totalPrice },
      });
    } catch { /* noop */ }

    // Update product sold_count (total terjual)
    {
      const { data: prodRow } = await admin
        .from("products")
        .select("sold_count")
        .eq("id", product.id)
        .maybeSingle();
      const currentSold = (prodRow as any)?.sold_count ?? 0;
      await admin
        .from("products")
        .update({ sold_count: currentSold + quantity })
        .eq("id", product.id);
    }

    // Increment flash sale sold counter (so quota decrements live)
    if (activeFlashRow && flashUnitsUsed > 0) {
      await admin
        .from("store_flash_sales")
        .update({ sold: (activeFlashRow.sold || 0) + flashUnitsUsed })
        .eq("id", activeFlashRow.id);
    }

    // Update voucher used_count (in correct table)
    if (discountVoucherId && voucherSource) {
      const { data: vData } = await admin.from(voucherSource).select("used_count").eq("id", discountVoucherId).single();
      if (vData) {
        await admin.from(voucherSource).update({ used_count: (vData.used_count || 0) + 1 }).eq("id", discountVoucherId);
      }
    }

    try {
      await Promise.allSettled([
        fetch(`${supabaseUrl}/functions/v1/check-daily-challenge`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ visitorId, eventType: "purchase", increment: quantity }),
        }),
        fetch(`${supabaseUrl}/functions/v1/weekly-quest`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ action: "track", visitorId, eventType: "purchase", increment: quantity }),
        }),
      ]);
    } catch (e) {
      console.error("purchase mission track failed:", e);
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

    // WA notif pembelian ke admin + user (pakai waitUntil agar tidak di-kill)
    try {
      const url = Deno.env.get("SUPABASE_URL") ?? "";
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const firstTrx = (transactionRows[0] as any)?.trx_id || `BUY-${Date.now()}`;
      const voucherCodes = tokenResults.map((t: any) => t.code).filter(Boolean).join(", ");
      const p = fetch(`${url}/functions/v1/send-wa-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          event_type: "purchase",
          notify_visitor_id: visitorId,
          vars: {
            trx_id: firstTrx,
            user: balanceRow.username || visitorId.slice(0, 8),
            produk: product.title,
            qty: quantity,
            harga: totalPrice.toLocaleString("id-ID"),
            voucher: voucherCodes || "-",
          },
        }),
      }).catch((e) => { console.error("send-wa-notification failed:", e); });
      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) { /* @ts-ignore */ EdgeRuntime.waitUntil(p); } else { await p; }
    } catch (e) { console.error("notif dispatch error:", e); }

    return Response.json(
      {
        success: true,
        tokens: tokenResults,
        product,
        quantity,
        total_price: totalPrice,
        discount_amount: discountAmount,
        balance_remaining: nextBalance,
        saldo_in_remaining: nextGameBalance,
        paid_from_saldo_in: payFromGame,
        paid_from_main_balance: payFromMain,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat memproses pembelian";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
