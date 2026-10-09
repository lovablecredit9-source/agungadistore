import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyAccountPin } from "../_shared/pin.ts";
import { resolveWalletIdentity } from "../_shared/wallet-identity.ts";

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
    const { visitorId: claimedVisitorId, productId, quantity: rawQty, discountCode, pin, quoteOnly } = (await request.json()) as PurchaseRequest & { quoteOnly?: boolean };
    const quantity = Math.max(1, Math.min(rawQty || 1, 50));

    if (!productId) {
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

    // Identity: signed-in login account first; visitor_id only for not-yet-linked wallets.
    const ident = await resolveWalletIdentity(request, admin, claimedVisitorId);
    if (!ident.ok) {
      return Response.json({ error: ident.error, code: ident.code, needLogin: true }, { status: ident.status, headers: corsHeaders });
    }
    const visitorId = ident.visitorId;

    // Ban guard
    const { data: banned } = await admin.rpc("is_account_banned", { p_visitor_id: visitorId });
    if (banned) {
      return Response.json({ error: "Akun Anda dibanned. Tidak bisa melakukan pembelian." }, { status: 403, headers: corsHeaders });
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
    // Premium Toko: status & konfigurasi benefit dibaca di server (tidak percaya client).
    const { data: isPremiumRaw } = await admin.rpc("is_store_premium", { p_visitor_id: visitorId });
    const isPremium = isPremiumRaw === true;
    const { data: premiumCfgRaw } = await admin.rpc("get_store_premium_benefits");
    const premiumCfg: any = premiumCfgRaw || {};
    const earlyMs = premiumCfg.flash_early_enabled ? Math.max(0, Number(premiumCfg.flash_early_minutes) || 0) * 60_000 : 0;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const { data: flashCandidates } = await admin
      .from("store_flash_sales")
      .select("*")
      .eq("product_id", productId)
      .eq("is_active", true)
      .lte("starts_at", new Date(now + earlyMs).toISOString())
      .gt("ends_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(5);
    // Aturan akses: all = semua user; premium_only = hanya Premium; premium_early = Premium buka lebih awal.
    const activeFlash = (flashCandidates || []).find((f: any) => {
      const started = new Date(f.starts_at).getTime() <= now;
      const mode = f.access_mode || "all";
      if (mode === "premium_only") return isPremium && started;
      if (mode === "premium_early") return started || isPremium;
      return started;
    }) || null;

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

    // Member discount Premium: berlaku bila admin mengaktifkan & tidak sedang memakai harga flash sale.
    let memberDiscountPerItem = 0;
    if (isPremium && !activeFlashRow && premiumCfg.member_discount_enabled) {
      const pct = Math.max(0, Math.min(90, Number(premiumCfg.member_discount_pct) || 0));
      memberDiscountPerItem = Math.floor((unitPrice * pct) / 100);
      unitPrice = unitPrice - memberDiscountPerItem;
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

      // Voucher milik akun tertentu (mis. voucher Premium harian) hanya bisa dipakai pemiliknya.
      if (voucher.visitor_id || voucher.user_balance_id) {
        const { data: ownBlh } = await admin.from("balance_login_history").select("user_balance_id")
          .eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
        const ownUb = ownBlh?.user_balance_id || balanceRow.id;
        const owns = voucher.visitor_id === visitorId || (voucher.user_balance_id && voucher.user_balance_id === ownUb);
        if (!owns) return Response.json({ error: "Voucher ini bukan milik akun kamu" }, { status: 400, headers: corsHeaders });
      }

      discountAmount = Math.min(voucher.discount_amount, totalPrice);
      totalPrice -= discountAmount;
      discountVoucherId = voucher.id;
    }

    // Quote-only: hitung harga + validasi voucher di server tanpa PIN/potong saldo.
    if (quoteOnly) {
      return Response.json({
        quote: true,
        unit_price: unitPrice,
        quantity,
        subtotal: unitPrice * quantity,
        discount_amount: discountAmount,
        voucher_code: discountVoucherId ? String(discountCode).toUpperCase() : null,
        total_price: totalPrice,
        is_flash: !!activeFlashRow,
      }, { headers: corsHeaders });
    }

    // Verify PIN (per akun saldo, termasuk perangkat yang pernah login ke akun ini)
    if (!pin) {
      return Response.json({ error: "PIN diperlukan untuk pembelian", needPin: true }, { status: 403, headers: corsHeaders });
    }
    const pinErr = await verifyAccountPin(admin, visitorId, pin);
    if (pinErr) {
      const notSet = pinErr.startsWith("PIN belum");
      return Response.json({ error: pinErr, needPin: true }, { status: notSet ? 200 : 403, headers: corsHeaders });
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

    const { error: balanceUpdateError, data: balanceUpdateData } = payFromMain > 0
      ? await admin.from("user_balances").update({ balance: nextBalance }).eq("id", balanceRow.id).eq("balance", balanceRow.balance).select("id")
      : { error: null, data: [{}] } as any;

    // Update bersyarat: bila saldo berubah (klik ganda / tab lain), batalkan tanpa memotong.
    if (!balanceUpdateError && payFromMain > 0 && !(balanceUpdateData as any[])?.length) {
      return Response.json({ error: "Transaksi lain sedang diproses. Coba lagi." }, { status: 409, headers: corsHeaders });
    }
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
      description: `Beli ${product.title}${memberDiscountPerItem > 0 ? ` (👑 harga Premium Rp${unitPrice.toLocaleString()}/pcs)` : unitPrice < product.price ? ` (grosir Rp${unitPrice.toLocaleString()}/pcs)` : ""}${discountAmount > 0 ? ` (diskon Rp${discountAmount.toLocaleString()})` : ""}`,
      product_id: product.id,
      token_id: token.id,
    }));

    const { data: insertedTx, error: transactionError } = await admin.from("balance_transactions").insert(transactionRows).select("id, trx_id");

    if (transactionError) {
      // Rollback balance
      await admin.from("user_balances").update({ balance: balanceRow.balance }).eq("id", balanceRow.id);
      if (payFromGame > 0 && gameBal) await admin.from("game_balance").update({ amount: gameAmount, total_spent: Number(gameBal.total_spent || 0) }).eq("id", gameBal.id);
      if ((transactionError as any).code === "23505") {
        return Response.json({ error: "Stok voucher baru saja terjual ke pembeli lain. Saldo tidak terpotong, silakan coba lagi." }, { status: 409, headers: corsHeaders });
      }
      return Response.json({ error: "Gagal mencatat pembelian" }, { status: 500, headers: corsHeaders });
    }

    // Quest Mission purchase progress — dikirim SEKALI per pembelian (sebelumnya terkirim dua kali → progres ganda).
    try {
      await Promise.allSettled([
        admin.functions.invoke("check-daily-challenge", { body: { visitorId, eventType: "purchase", increment: quantity, purchaseAmount: totalPrice } }),
        admin.functions.invoke("weekly-quest", { body: { action: "track", visitorId, eventType: "purchase", increment: quantity, purchaseAmount: totalPrice } }),
        admin.functions.invoke("premium-quest", { body: { action: "track", visitorId, eventType: "purchase", increment: 1, purchaseAmount: totalPrice } }),
      ]);
    } catch { /* best-effort */ }

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
      const firstTrx = (insertedTx as any)?.[0]?.trx_id || `BUY-${Date.now()}`;
      const voucherCodes = tokenResults.map((t: any) => t.token_code).filter(Boolean).join(", ");
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
        trx_id: (insertedTx as any)?.[0]?.trx_id ?? null,
        total_price: totalPrice,
        discount_amount: discountAmount,
        member_discount_per_item: memberDiscountPerItem,
        is_premium_price: memberDiscountPerItem > 0,
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
