import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  label: string;
  is_unlimited: boolean;
  unlimited_days: number;
  is_active: boolean;
  sort_order: number;
}

async function getActiveFlashDiscountPercent(admin: any, discountKey: string): Promise<number> {
  const { data } = await admin
    .from("admin_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["flash_sale_end", discountKey]);

  const settings = Object.fromEntries((data || []).map((row: any) => [row.setting_key, row.setting_value || ""]));
  const flashSaleEnd = settings.flash_sale_end;
  const isFlashActive = !!flashSaleEnd && new Date(flashSaleEnd) > new Date();

  if (!isFlashActive) return 0;

  const rawDiscount = Number.parseInt(settings[discountKey] || "0", 10);
  if (!Number.isFinite(rawDiscount)) return 0;

  return Math.min(100, Math.max(0, rawDiscount));
}

async function getPackages(admin: any): Promise<CreditPackage[]> {
  const { data } = await admin
    .from("credit_packages")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return data || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, visitorId, packageId, pin, voucherCode, paymentSource = "auto" } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "get_packages") {
      const packages = await getPackages(admin);
      return Response.json({ packages }, { headers: corsHeaders });
    }

    if (action === "get_credits") {
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      // Account-aware: aggregate credits from all visitor IDs linked to the same balance account
      const { data: totalCredits } = await admin.rpc("get_account_credits", { p_visitor_id: visitorId });
      const credits = Number(totalCredits) || 0;
      // Get unlimited status from any row in the account
      const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
      let unlimitedUntil: string | null = null;
      if (ubId) {
        const { data: visitors } = await admin.from("balance_login_history").select("visitor_id").eq("user_balance_id", ubId);
        const vids = Array.from(new Set((visitors || []).map((v: { visitor_id: string }) => v.visitor_id)));
        if (vids.length) {
          const { data: rows } = await admin.from("user_game_credits").select("unlimited_until").in("visitor_id", vids).not("unlimited_until", "is", null);
          const maxTs = (rows || []).map((r: { unlimited_until: string }) => new Date(r.unlimited_until).getTime()).filter((t) => !isNaN(t)).sort((a, b) => b - a)[0];
          if (maxTs) unlimitedUntil = new Date(maxTs).toISOString();
        }
      } else {
        const { data: own } = await admin.from("user_game_credits").select("unlimited_until").eq("visitor_id", visitorId).maybeSingle();
        unlimitedUntil = own?.unlimited_until || null;
      }
      const isUnlimited = unlimitedUntil && new Date(unlimitedUntil) > new Date();
      return Response.json({ credits, unlimited_until: unlimitedUntil, is_unlimited: !!isUnlimited }, { headers: corsHeaders });
    }

    if (action === "use_credit") {
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      // Check unlimited first (account-wide)
      const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
      let unlimitedUntil: string | null = null;
      if (ubId) {
        const { data: visitors } = await admin.from("balance_login_history").select("visitor_id").eq("user_balance_id", ubId);
        const vids = Array.from(new Set((visitors || []).map((v: { visitor_id: string }) => v.visitor_id)));
        if (vids.length) {
          const { data: rows } = await admin.from("user_game_credits").select("unlimited_until").in("visitor_id", vids).not("unlimited_until", "is", null);
          const maxTs = (rows || []).map((r: { unlimited_until: string }) => new Date(r.unlimited_until).getTime()).filter((t) => !isNaN(t)).sort((a, b) => b - a)[0];
          if (maxTs) unlimitedUntil = new Date(maxTs).toISOString();
        }
      } else {
        const { data: own } = await admin.from("user_game_credits").select("unlimited_until").eq("visitor_id", visitorId).maybeSingle();
        unlimitedUntil = own?.unlimited_until || null;
      }
      const isUnlimited = unlimitedUntil && new Date(unlimitedUntil) > new Date();
      if (isUnlimited) {
        const { data: total } = await admin.rpc("get_account_credits", { p_visitor_id: visitorId });
        return Response.json({ success: true, credits: Number(total) || 0, is_unlimited: true }, { headers: corsHeaders });
      }
      // Deduct 1 credit account-wide
      const { data: newTotal, error: deductErr } = await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: -1 });
      if (deductErr) {
        return Response.json({ error: "Kredit jawaban habis" }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ success: true, credits: Number(newTotal) || 0, is_unlimited: false }, { headers: corsHeaders });
    }

    if (action === "check_voucher") {
      if (!voucherCode) return Response.json({ error: "Kode voucher diperlukan" }, { status: 400, headers: corsHeaders });
      const { data: voucher } = await admin.from("game_discount_vouchers").select("*").eq("code", voucherCode.trim().toUpperCase()).eq("is_active", true).maybeSingle();
      if (!voucher) return Response.json({ error: "Voucher tidak ditemukan atau tidak aktif" }, { status: 404, headers: corsHeaders });
      if (voucher.used_count >= voucher.max_uses) return Response.json({ error: "Voucher sudah habis" }, { status: 400, headers: corsHeaders });
      if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) return Response.json({ error: "Voucher sudah kedaluwarsa" }, { status: 400, headers: corsHeaders });
      return Response.json({ valid: true, discount_amount: voucher.discount_amount, voucher_id: voucher.id }, { headers: corsHeaders });
    }

    if (action === "purchase") {
      if (!visitorId || !packageId) return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });

      // Fetch package from DB
      const { data: pkg } = await admin.from("credit_packages").select("*").eq("id", packageId).eq("is_active", true).maybeSingle();
      if (!pkg) return Response.json({ error: "Paket tidak ditemukan" }, { status: 400, headers: corsHeaders });

      // Verify PIN — cari di visitor request ATAU visitor akun saldo (browser vs akun bisa beda)
      const { data: balRowForPin } = await admin.from("user_balances").select("visitor_id").eq("visitor_id", visitorId).maybeSingle();
      const pinVisitorIds = [visitorId, balRowForPin?.visitor_id].filter(Boolean) as string[];
      const { data: pinRows } = await admin.from("user_pins").select("pin_hash, visitor_id").in("visitor_id", pinVisitorIds);
      const pinRow = pinRows && pinRows.length > 0 ? pinRows[0] : null;
      if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 200, headers: corsHeaders });
      if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 200, headers: corsHeaders });
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pin));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 403, headers: corsHeaders });

      // Calculate price with voucher discount
      const flashDiscountPercent = await getActiveFlashDiscountPercent(admin, "promo_credit_discount");
      const priceAfterFlashSale = flashDiscountPercent > 0
        ? Math.max(0, Math.round(pkg.price * (1 - flashDiscountPercent / 100)))
        : pkg.price;
      const flashDiscountAmount = Math.max(0, pkg.price - priceAfterFlashSale);

      let finalPrice = priceAfterFlashSale;
      let voucherDiscountAmount = 0;
      let voucherId: string | null = null;

      if (voucherCode) {
        const { data: voucher } = await admin.from("game_discount_vouchers").select("*").eq("code", voucherCode.trim().toUpperCase()).eq("is_active", true).maybeSingle();
        if (voucher && voucher.used_count < voucher.max_uses && (!voucher.expires_at || new Date(voucher.expires_at) > new Date())) {
          voucherDiscountAmount = Math.min(voucher.discount_amount, priceAfterFlashSale);
          finalPrice = Math.max(0, priceAfterFlashSale - voucherDiscountAmount);
          voucherId = voucher.id;
        }
      }

      const totalDiscountAmount = flashDiscountAmount + voucherDiscountAmount;

      // Check balances - support split payment between Saldo IN (game_balance) and Saldo Utama (user_balances)
      const { data: gameBal } = await admin.from("game_balance").select("id, amount, total_spent").eq("visitor_id", visitorId).maybeSingle();
      const { data: balance } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
      const gameAmount = gameBal?.amount || 0;
      const mainAmount = balance?.balance || 0;

      // Saldo IN (game_balance) hanya untuk produk toko. Kredit game wajib Saldo Utama.
      let payFromGame = 0;
      let payFromMain = 0;
      let sourceLabel = "";
      if (mainAmount < finalPrice) {
        return Response.json({ error: "Saldo Utama tidak cukup. Saldo IN tidak bisa dipakai untuk Kredit Game." }, { status: 400, headers: corsHeaders });
      }
      payFromMain = finalPrice;
      sourceLabel = "Saldo Utama";

      // Deduct Saldo IN — pakai akumulasi total_spent yang benar (bukan overwrite)
      if (payFromGame > 0) {
        if (!gameBal) {
          return Response.json({ error: "Saldo IN tidak ditemukan" }, { status: 400, headers: corsHeaders });
        }
        await admin.from("game_balance").update({
          amount: gameAmount - payFromGame,
          total_spent: (gameBal.total_spent || 0) + payFromGame,
        }).eq("id", gameBal.id);
        await admin.from("game_balance_transactions").insert({
          visitor_id: visitorId, type: "spend", amount: -payFromGame, description: `Beli ${pkg.label}`,
        });
      }
      if (payFromMain > 0 && balance) {
        await admin.from("user_balances").update({ balance: mainAmount - payFromMain }).eq("id", balance.id);
      }

      // Update voucher used count
      if (voucherId) {
        const { data: v } = await admin.from("game_discount_vouchers").select("used_count").eq("id", voucherId).maybeSingle();
        if (v) {
          await admin.from("game_discount_vouchers").update({ used_count: v.used_count + 1 }).eq("id", voucherId);
        }
      }

      // Record transaction
      const discountParts = [
        flashDiscountAmount > 0 ? `Flash Sale ${flashDiscountPercent}%` : null,
        voucherDiscountAmount > 0 ? `Voucher Rp${voucherDiscountAmount.toLocaleString("id-ID")}` : null,
      ].filter(Boolean);
      const desc = totalDiscountAmount > 0
        ? `Beli ${pkg.label} (Kredit Game) [${sourceLabel}] - ${discountParts.join(" + ")}`
        : `Beli ${pkg.label} (Kredit Jawaban Game) [${sourceLabel}]`;
      if (payFromMain > 0) {
        await admin.from("balance_transactions").insert({
          visitor_id: visitorId,
          type: "purchase",
          amount: payFromMain,
          description: desc,
        });
      }

      // Upsert credits
      const { data: existing } = await admin.from("user_game_credits").select("*").eq("visitor_id", visitorId).maybeSingle();
      
      if (pkg.is_unlimited) {
        const unlimitilDate = new Date();
        unlimitilDate.setDate(unlimitilDate.getDate() + (pkg.unlimited_days || 30));
        
        if (existing) {
          const baseDate = existing.unlimited_until && new Date(existing.unlimited_until) > new Date()
            ? new Date(existing.unlimited_until)
            : new Date();
          baseDate.setDate(baseDate.getDate() + (pkg.unlimited_days || 30));
          await admin.from("user_game_credits").update({
            unlimited_until: baseDate.toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await admin.from("user_game_credits").insert({
            visitor_id: visitorId,
            credits: 0,
            unlimited_until: unlimitilDate.toISOString(),
          });
        }
      } else {
        if (existing) {
          await admin.from("user_game_credits").update({
            credits: existing.credits + pkg.credits,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await admin.from("user_game_credits").insert({
            visitor_id: visitorId,
            credits: pkg.credits,
          });
        }
      }

      const finalCredits = existing ? (pkg.is_unlimited ? existing.credits : existing.credits + pkg.credits) : (pkg.is_unlimited ? 0 : pkg.credits);
      
      return Response.json({
        success: true,
        package: pkg,
        credits: finalCredits,
        balance_remaining: mainAmount - payFromMain,
        game_balance_remaining: gameAmount - payFromGame,
        paid_from_game: payFromGame,
        paid_from_main: payFromMain,
        source_label: sourceLabel,
        discount_amount: totalDiscountAmount,
        flash_discount_amount: flashDiscountAmount,
        voucher_discount_amount: voucherDiscountAmount,
        final_price: finalPrice,
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
