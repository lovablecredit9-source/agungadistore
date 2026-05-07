import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function todayWIB(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") ?? "list";
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
      if (body?.action) action = body.action;
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const visitorId: string | undefined = body?.visitorId || url.searchParams.get("visitorId") || undefined;

    if (action === "list") {
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      const today = todayWIB();
      const nowIso = new Date().toISOString();

      const [{ data: deals }, { data: purchases }, { data: streak }, { data: gemTotal }] = await Promise.all([
        admin.from("streak_flash_sales").select("*")
          .eq("is_active", true)
          .lte("starts_at", nowIso)
          .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
          .order("is_featured", { ascending: false })
          .order("sort_order", { ascending: true }),
        admin.from("streak_flash_sale_purchases").select("deal_id")
          .eq("visitor_id", visitorId)
          .eq("purchase_date", today),
        admin.from("daily_streaks").select("streak_coins").eq("visitor_id", visitorId).maybeSingle(),
        admin.rpc("get_account_gems", { p_visitor_id: visitorId }),
      ]);

      const usedMap: Record<string, number> = {};
      for (const p of (purchases ?? [])) {
        usedMap[p.deal_id] = (usedMap[p.deal_id] || 0) + 1;
      }

      return Response.json({
        deals: (deals ?? []).map((d: any) => {
          const used = usedMap[d.id] || 0;
          const remainingDaily = Math.max(0, (d.per_user_daily_limit || 1) - used);
          const stockOk = d.remaining_stock === null || d.remaining_stock > 0;
          return {
            ...d,
            used_today: used,
            remaining_daily: remainingDaily,
            can_purchase: stockOk && remainingDaily > 0,
            stock_pct: d.total_stock ? Math.round(((d.remaining_stock || 0) / d.total_stock) * 100) : 100,
          };
        }),
        user_coins: streak?.streak_coins || 0,
        user_gems: Number(gemTotal) || 0,
        today,
      }, { headers: corsHeaders });
    }

    if (action === "purchase") {
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      const { dealId, currency } = body;
      if (!dealId || !["coins","gems","balance"].includes(currency)) {
        return Response.json({ error: "dealId & currency wajib (coins/gems/balance)" }, { status: 400, headers: corsHeaders });
      }

      const { data: deal } = await admin.from("streak_flash_sales").select("*").eq("id", dealId).eq("is_active", true).maybeSingle();
      if (!deal) return Response.json({ error: "Flash sale tidak ditemukan / expired" }, { status: 404, headers: corsHeaders });

      // Schedule check
      const now = Date.now();
      if (new Date(deal.starts_at).getTime() > now) return Response.json({ error: "Flash sale belum dimulai" }, { status: 400, headers: corsHeaders });
      if (deal.ends_at && new Date(deal.ends_at).getTime() < now) return Response.json({ error: "Flash sale sudah berakhir" }, { status: 400, headers: corsHeaders });

      // Stock check
      if (deal.remaining_stock !== null && deal.remaining_stock <= 0) {
        return Response.json({ error: "Stok habis!" }, { status: 400, headers: corsHeaders });
      }

      // Daily limit check
      const today = todayWIB();
      const { count: usedToday } = await admin.from("streak_flash_sale_purchases")
        .select("id", { count: "exact", head: true })
        .eq("visitor_id", visitorId).eq("deal_id", dealId).eq("purchase_date", today);
      if ((usedToday ?? 0) >= (deal.per_user_daily_limit || 1)) {
        return Response.json({ error: `Maks ${deal.per_user_daily_limit}x per hari untuk deal ini` }, { status: 400, headers: corsHeaders });
      }

      // Pricing
      const price = currency === "coins" ? (deal.price_coins || 0)
                  : currency === "gems" ? (deal.price_gems || 0)
                  : (deal.price_balance || 0);
      if (price <= 0) return Response.json({ error: `Mata uang ${currency} tidak tersedia untuk deal ini` }, { status: 400, headers: corsHeaders });

      // Get streak
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak && (currency === "coins" || deal.item_type === "freeze")) {
        return Response.json({ error: "Mulai streak harian dulu sebelum belanja!" }, { status: 400, headers: corsHeaders });
      }

      // Deduct payment
      if (currency === "coins") {
        const have = streak?.streak_coins || 0;
        if (have < price) return Response.json({ error: `Coin kurang. Butuh ${price} 🪙, kamu punya ${have} 🪙` }, { status: 400, headers: corsHeaders });
        await admin.from("daily_streaks").update({ streak_coins: have - price }).eq("id", streak!.id);
      } else if (currency === "gems") {
        const haveGems = Number(await admin.rpc("get_account_gems", { p_visitor_id: visitorId }).then(r => r.data)) || 0;
        if (haveGems < price) return Response.json({ error: `Gem kurang. Butuh ${price} 💎, kamu punya ${haveGems} 💎` }, { status: 400, headers: corsHeaders });
        const { error: gemErr } = await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -price });
        if (gemErr) return Response.json({ error: `Gagal potong gem: ${gemErr.message}` }, { status: 400, headers: corsHeaders });
        await admin.from("gem_transactions").insert({
          visitor_id: visitorId, amount: -price, type: "flash_sale",
          description: `Flash Sale: ${deal.name} (-${price} 💎)`, reference_id: dealId,
        });
      } else if (currency === "balance") {
        // Saldo IN — wajib login akun balance
        const { data: ub } = await admin.from("balance_login_history").select("user_balance_id")
          .eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
        if (!ub?.user_balance_id) return Response.json({ error: "Login akun saldo dulu untuk bayar dengan Saldo IN" }, { status: 400, headers: corsHeaders });
        const { data: bal } = await admin.from("user_balances").select("id, balance, bonus_balance").eq("id", ub.user_balance_id).maybeSingle();
        if (!bal || ((bal.balance || 0) + (bal.bonus_balance || 0)) < price) {
          return Response.json({ error: `Saldo IN kurang. Butuh Rp${price.toLocaleString("id-ID")}, kamu punya Rp${((bal?.balance || 0) + (bal?.bonus_balance || 0)).toLocaleString("id-ID")}` }, { status: 400, headers: corsHeaders });
        }
        await admin.from("user_balances").update({ balance: bal.balance - price }).eq("id", bal.id);
        await admin.from("balance_transactions").insert({
          user_balance_id: bal.id, amount: -price, type: "flash_sale",
          description: `Flash Sale: ${deal.name}`,
        });
      }

      // Apply reward
      let rewardSummary = "";
      const payload = deal.reward_payload || {};

      if (deal.item_type === "coins") {
        const add = payload.coins || 0;
        if (streak) await admin.from("daily_streaks").update({ streak_coins: ((streak.streak_coins || 0) - (currency === "coins" ? price : 0)) + add }).eq("id", streak.id);
        else await admin.from("daily_streaks").insert({ visitor_id: visitorId, streak_coins: add, current_streak: 0 });
        rewardSummary = `+${add} 🪙 Streak Coins`;
      } else if (deal.item_type === "freeze") {
        const add = payload.freeze || 1;
        await admin.from("daily_streaks").update({ freeze_count: (streak!.freeze_count || 0) + add }).eq("id", streak!.id);
        rewardSummary = `+${add} ❄️ Streak Freeze`;
      } else if (deal.item_type === "booster") {
        const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
        const updates: any = {};
        const parts: string[] = [];
        if (payload.double_xp_hours) {
          const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now()
            ? new Date(pu.double_xp_until).getTime() : Date.now();
          updates.double_xp_until = new Date(baseMs + payload.double_xp_hours * 3600 * 1000).toISOString();
          parts.push(`Double XP ${payload.double_xp_hours}j`);
        }
        if (payload.auto_hint) { updates.auto_hint = (pu?.auto_hint || 0) + payload.auto_hint; parts.push(`+${payload.auto_hint} Hint`); }
        if (payload.extra_life) { updates.extra_life = (pu?.extra_life || 0) + payload.extra_life; parts.push(`+${payload.extra_life} Nyawa`); }
        if (payload.time_freeze) { updates.time_freeze = (pu?.time_freeze || 0) + payload.time_freeze; parts.push(`+${payload.time_freeze} Time Freeze`); }
        if (pu) await admin.from("user_power_ups").update(updates).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...updates });
        rewardSummary = parts.join(", ");
      } else if (deal.item_type === "scratch_card") {
        const tier = payload.card_tier || "bronze";
        const count = payload.count || 1;
        const inserts = Array.from({ length: count }, () => ({
          visitor_id: visitorId, tier, source: "flash_sale", is_scratched: false,
        }));
        await admin.from("scratch_off_cards").insert(inserts);
        rewardSummary = `+${count} Scratch Card ${tier.toUpperCase()}`;
      } else if (deal.item_type === "mystery_box") {
        const tier = payload.box_tier || "silver";
        await admin.from("mystery_boxes").insert({
          visitor_id: visitorId, tier, source: "flash_sale", min_reward: payload.min || 100, max_reward: payload.max || 1000,
        });
        rewardSummary = `+1 Mystery Box ${tier.toUpperCase()}`;
      } else if (deal.item_type === "cosmetic") {
        await admin.from("user_cosmetics").insert({
          visitor_id: visitorId,
          cosmetic_type: payload.cosmetic_type || "avatar",
          cosmetic_id: payload.cosmetic_id || "unknown",
          cosmetic_name: payload.name || deal.name,
          source: "flash_sale",
        });
        rewardSummary = `Cosmetic: ${payload.name || deal.name}`;
      }

      // Log purchase
      await admin.from("streak_flash_sale_purchases").insert({
        deal_id: dealId, visitor_id: visitorId, currency, amount_paid: price, reward_payload: payload,
      });

      // Decrement stock
      if (deal.remaining_stock !== null) {
        await admin.from("streak_flash_sales").update({ remaining_stock: Math.max(0, (deal.remaining_stock || 1) - 1) }).eq("id", dealId);
      }

      // Notification
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `⚡ Flash Sale: ${deal.name}`,
        message: `${rewardSummary} — bayar ${price} ${currency === "coins" ? "🪙" : currency === "gems" ? "💎" : "Saldo"}`,
        type: "flash_sale",
      });

      return Response.json({ success: true, rewardSummary, deal, currency, price }, { headers: corsHeaders });
    }

    // ===== ADMIN ACTIONS =====
    if (action === "admin_list") {
      const { data } = await admin.from("streak_flash_sales").select("*").order("sort_order", { ascending: true });
      return Response.json({ deals: data ?? [] }, { headers: corsHeaders });
    }

    if (action === "admin_upsert") {
      const { deal } = body;
      if (!deal?.name) return Response.json({ error: "Nama deal wajib" }, { status: 400, headers: corsHeaders });
      const payload: any = {
        name: deal.name,
        description: deal.description || null,
        item_type: deal.item_type,
        reward_payload: deal.reward_payload || {},
        price_coins: Number(deal.price_coins) || 0,
        price_gems: Number(deal.price_gems) || 0,
        price_balance: Number(deal.price_balance) || 0,
        original_price: Number(deal.original_price) || 0,
        discount_pct: Number(deal.discount_pct) || 0,
        total_stock: deal.total_stock != null ? Number(deal.total_stock) : null,
        remaining_stock: deal.remaining_stock != null ? Number(deal.remaining_stock) : (deal.total_stock != null ? Number(deal.total_stock) : null),
        per_user_daily_limit: Number(deal.per_user_daily_limit) || 1,
        starts_at: deal.starts_at || new Date().toISOString(),
        ends_at: deal.ends_at || null,
        is_active: deal.is_active !== false,
        is_featured: !!deal.is_featured,
        rarity: deal.rarity || "common",
        icon: deal.icon || "⚡",
        gradient: deal.gradient || "from-orange-500 to-red-500",
        sort_order: Number(deal.sort_order) || 0,
      };
      if (deal.id) {
        const { error } = await admin.from("streak_flash_sales").update(payload).eq("id", deal.id);
        if (error) return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
        return Response.json({ success: true, id: deal.id }, { headers: corsHeaders });
      } else {
        const { data, error } = await admin.from("streak_flash_sales").insert(payload).select("id").single();
        if (error) return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
        return Response.json({ success: true, id: data.id }, { headers: corsHeaders });
      }
    }

    if (action === "admin_delete") {
      const { id } = body;
      if (!id) return Response.json({ error: "id wajib" }, { status: 400, headers: corsHeaders });
      await admin.from("streak_flash_sales").delete().eq("id", id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "admin_reset_stock") {
      const { id } = body;
      const { data: d } = await admin.from("streak_flash_sales").select("total_stock").eq("id", id).maybeSingle();
      if (d?.total_stock != null) {
        await admin.from("streak_flash_sales").update({ remaining_stock: d.total_stock }).eq("id", id);
      }
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
