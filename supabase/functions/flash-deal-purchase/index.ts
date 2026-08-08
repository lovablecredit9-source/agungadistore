import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWIBDateStr(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split("T")[0];
}

async function addSpinTicket(admin: any, visitorId: string, type: "normal" | "premium", amount: number) {
  const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
  const accountKey = ubId ? `ub:${ubId}` : `v:${visitorId}`;
  const { data: row } = await admin.from("luck_spin_tickets").select("*").eq("account_key", accountKey).eq("ticket_type", type).maybeSingle();
  if (row) await admin.from("luck_spin_tickets").update({ balance: Number(row.balance || 0) + amount, total_purchased: Number(row.total_purchased || 0) + amount, updated_at: new Date().toISOString() }).eq("id", row.id);
  else await admin.from("luck_spin_tickets").insert({ account_key: accountKey, visitor_id: visitorId, user_balance_id: ubId || null, ticket_type: type, balance: amount, total_purchased: amount });
}

function voucherCode(prefix: string) {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

// User dianggap Premium kalau punya Streak Pass Premium (season aktif) ATAU Game Season Pass Premium
async function checkPremium(admin: ReturnType<typeof createClient>, visitorId: string): Promise<boolean> {
  const { data: gamePass } = await admin
    .from("game_season_pass")
    .select("is_premium")
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (gamePass?.is_premium) return true;

  const { data: season } = await admin
    .from("streak_pass_seasons")
    .select("id")
    .eq("is_active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (season) {
    const { data: progress } = await admin
      .from("streak_pass_progress")
      .select("is_premium")
      .eq("visitor_id", visitorId)
      .eq("season_id", season.id)
      .maybeSingle();
    if (progress?.is_premium) return true;
  }

  return false;
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
    const visitorId = body?.visitorId || url.searchParams.get("visitorId");
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const today = getWIBDateStr();

    // Berapa kali user sudah reset diskon kilat hari ini → dipakai sebagai seed rotasi
    async function resetGeneration(): Promise<number> {
      const startWib = new Date(`${today}T00:00:00+07:00`).toISOString();
      const { count } = await admin
        .from("gem_transactions")
        .select("id", { count: "exact", head: true })
        .eq("visitor_id", visitorId)
        .eq("description", "Reset Diskon Kilat Harian")
        .gte("created_at", startWib);
      return count ?? 0;
    }

    function seededShuffle<T>(arr: T[], seedStr: string): T[] {
      let h = 2166136261;
      for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
      let s = (h >>> 0) || 1;
      const rand = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }

    async function firePassOwned(): Promise<boolean> {
      const { data: season } = await admin.from("fire_pass_seasons").select("id").eq("is_active", true)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!season) return false;
      const { data: p } = await admin.from("fire_pass_progress").select("is_premium")
        .eq("visitor_id", visitorId).eq("season_id", season.id).maybeSingle();
      return !!p?.is_premium;
    }

    if (action === "list") {
      const [{ data: deals }, { data: redemptions }, isPremium, { data: prof }, gen, fpOwned] = await Promise.all([
        admin.from("streak_flash_deals").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
        admin
          .from("flash_deal_redemptions")
          .select("deal_id")
          .eq("visitor_id", visitorId)
          .eq("redemption_date", today),
        checkPremium(admin, visitorId),
        admin.rpc("get_account_gems", { p_visitor_id: visitorId }),
        resetGeneration(),
        firePassOwned(),
      ]);

      const claimedToday = new Set((redemptions ?? []).map((r: any) => r.deal_id));

      const all = (deals ?? []).map((d: any) => {
        const needsPremium = !!d.requires_premium;
        const claimed = claimedToday.has(d.id);
        const owned = d.reward_type === "fire_pass_card" && fpOwned;
        const premiumOk = !needsPremium || isPremium;
        return {
          ...d,
          claimed_today: claimed,
          owned,
          can_purchase: premiumOk && !claimed && !owned,
          locked_reason: owned ? "owned" : (!premiumOk ? "premium_required" : (claimed ? "daily_limit" : null)),
        };
      });

      // Rotasi: tiap hari & tiap reset, pilihan deal berbeda-beda
      const seed = `${visitorId}|${today}|${gen}`;
      const pool = seededShuffle(all.filter((d: any) => !d.claimed_today), seed);
      const picked = [
        ...pool.filter((d: any) => !d.requires_premium).slice(0, 9),
        ...pool.filter((d: any) => d.requires_premium).slice(0, 9),
        ...all.filter((d: any) => d.claimed_today),
      ];
      const uniq = Array.from(new Map(picked.map((d: any) => [d.id, d])).values());

      return Response.json({
        deals: uniq,
        is_premium: isPremium,
        user_gems: Number(prof) || 0,
        reset_generation: gen,
        date: today,
      }, { headers: corsHeaders });
    }


    if (action === "purchase") {
      const { dealId, paymentMethod } = body;
      const payMethod = paymentMethod === "gem" ? "gem" : "coin";
      if (!dealId) return Response.json({ error: "dealId required" }, { status: 400, headers: corsHeaders });

      const { data: deal } = await admin.from("streak_flash_deals").select("*").eq("id", dealId).eq("is_active", true).maybeSingle();
      if (!deal) return Response.json({ error: "Flash deal tidak ditemukan" }, { status: 404, headers: corsHeaders });

      // Premium check
      if (deal.requires_premium) {
        const isPremium = await checkPremium(admin, visitorId);
        if (!isPremium) {
          return Response.json({ error: "Aktifkan Premium dulu (Streak Pass Premium atau Season Pass Premium) untuk beli flash deal ini!" }, { status: 403, headers: corsHeaders });
        }
      }

      // Daily limit check (combined for both payment methods)
      const { count: usedToday } = await admin
        .from("flash_deal_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("visitor_id", visitorId)
        .eq("deal_id", dealId)
        .eq("redemption_date", today);

      if ((usedToday ?? 0) >= (deal.daily_limit || 1)) {
        return Response.json({ error: `Hanya bisa beli ${deal.daily_limit}x per hari. Coba lagi besok!` }, { status: 400, headers: corsHeaders });
      }

      const coinCost = Math.floor(deal.original_cost * (1 - deal.discount_pct / 100));
      const gemCost = deal.cost_gems || 0;

      // Get streak (still needed for rewards)
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });

      let costPaid = 0;
      let costLabel = "";

      if (payMethod === "gem") {
        if (gemCost <= 0) {
          return Response.json({ error: "Deal ini belum tersedia untuk pembayaran Gem" }, { status: 400, headers: corsHeaders });
        }
        const { data: gemTotal } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
        const userGems = Number(gemTotal) || 0;
        if (userGems < gemCost) {
          return Response.json({ error: `Gem kurang. Butuh ${gemCost} 💎, kamu punya ${userGems} 💎` }, { status: 400, headers: corsHeaders });
        }
        costPaid = gemCost;
        costLabel = `${gemCost} 💎`;
      } else {
        if ((streak.streak_coins || 0) < coinCost) {
          return Response.json({ error: `Coins kurang. Butuh ${coinCost} 🪙, kamu punya ${streak.streak_coins || 0} 🪙` }, { status: 400, headers: corsHeaders });
        }
        costPaid = coinCost;
        costLabel = `${coinCost} 🪙`;
      }

      // Apply reward
      let rewardSummary = "";
      if (deal.reward_type === "streak_freeze") {
        await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + deal.reward_value }).eq("id", streak.id);
        rewardSummary = `+${deal.reward_value} Streak Freeze`;
      } else if (deal.reward_type === "double_xp") {
        const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
        const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now()
          ? new Date(pu.double_xp_until).getTime()
          : Date.now();
        const newUntil = new Date(baseMs + deal.reward_value * 3600 * 1000).toISOString();
        if (pu) await admin.from("user_power_ups").update({ double_xp_until: newUntil }).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, double_xp_until: newUntil });
        rewardSummary = `Double XP aktif ${deal.reward_value} jam`;
      } else if (deal.reward_type === "mystery_bundle") {
        const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
        const updates = {
          auto_hint: (pu?.auto_hint || 0) + 5,
          extra_life: (pu?.extra_life || 0) + 3,
        };
        if (pu) await admin.from("user_power_ups").update(updates).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...updates });
        rewardSummary = "+5 Hint Otomatis, +3 Nyawa Ekstra";
      } else if (deal.reward_type === "vip_pack") {
        const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
        const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now()
          ? new Date(pu.double_xp_until).getTime()
          : Date.now();
        const updates = {
          auto_hint: (pu?.auto_hint || 0) + 10,
          extra_life: (pu?.extra_life || 0) + 5,
          time_freeze: (pu?.time_freeze || 0) + 5,
          double_xp_until: new Date(baseMs + 12 * 3600 * 1000).toISOString(),
        };
        if (pu) await admin.from("user_power_ups").update(updates).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...updates });
        await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + 2 }).eq("id", streak.id);
        rewardSummary = "+10 Hint, +5 Nyawa, +5 Time Freeze, +2 Freeze, Double XP 12j";
      } else if (deal.reward_type === "server_luck") {
        const hours = Math.max(1, Number(deal.reward_value || 1));
        const { data: row } = await admin.from("server_luck_boosters").select("*").eq("visitor_id", visitorId).maybeSingle();
        const base = row?.active_until && new Date(row.active_until).getTime() > Date.now() ? new Date(row.active_until).getTime() : Date.now();
        const activeUntil = new Date(base + hours * 3600_000).toISOString();
        if (row) await admin.from("server_luck_boosters").update({ active_tier: Math.max(2, row.active_tier || 1), active_until: activeUntil, highest_tier_owned: Math.max(2, row.highest_tier_owned || 1), updated_at: new Date().toISOString() }).eq("id", row.id);
        else await admin.from("server_luck_boosters").insert({ visitor_id: visitorId, active_tier: 2, active_until: activeUntil, highest_tier_owned: 2 });
        rewardSummary = `Jam Hoki aktif ${hours} jam`;
      } else if (deal.reward_type === "ticket_normal" || deal.reward_type === "ticket_premium") {
        const amount = Math.max(1, Number(deal.reward_value || 1));
        await addSpinTicket(admin, visitorId, deal.reward_type === "ticket_premium" ? "premium" : "normal", amount);
        rewardSummary = `+${amount} Tiket Spin ${deal.reward_type === "ticket_premium" ? "Premium" : "Normal"}`;
      } else if (deal.reward_type === "lucky_draw_ticket") {
        const amount = Math.max(1, Number(deal.reward_value || 1));
        const { data: row } = await admin.from("lucky_draw_tickets").select("*").eq("visitor_id", visitorId).maybeSingle();
        if (row) await admin.from("lucky_draw_tickets").update({ ticket_count: Number(row.ticket_count || 0) + amount, total_purchased: Number(row.total_purchased || 0) + amount, updated_at: new Date().toISOString() }).eq("id", row.id);
        else await admin.from("lucky_draw_tickets").insert({ visitor_id: visitorId, ticket_count: amount, total_purchased: amount });
        rewardSummary = `+${amount} Tiket Lucky Draw`;
      } else if (deal.reward_type === "fire_pass_card") {
        const { data: season } = await admin.from("fire_pass_seasons").select("id").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!season) return Response.json({ error: "Season Fire Pass belum aktif" }, { status: 400, headers: corsHeaders });
        const { data: progress } = await admin.from("fire_pass_progress").select("id, is_premium").eq("visitor_id", visitorId).eq("season_id", season.id).maybeSingle();
        if (progress?.is_premium) return Response.json({ error: "Kartu Fire Pass sudah dibeli untuk season ini" }, { status: 400, headers: corsHeaders });
        if (progress) await admin.from("fire_pass_progress").update({ is_premium: true, premium_activated_at: new Date().toISOString() }).eq("id", progress.id);
        else await admin.from("fire_pass_progress").insert({ visitor_id: visitorId, season_id: season.id, is_premium: true, premium_activated_at: new Date().toISOString() });
        rewardSummary = "Kartu Fire Pass Premium aktif";
      } else if (deal.reward_type === "anon_voucher") {
        const days = Math.max(1, Number(deal.reward_value || 1));
        const code = voucherCode("ANON");
        await admin.from("anon_premium_vouchers").insert({ code, days, max_uses: 1, note: "Flash Deal Harian" });
        rewardSummary = `Voucher Anon Chat ${days} hari: ${code}`;
      } else if (deal.reward_type === "luck_discount_voucher") {
        const discount = Math.min(90, Math.max(5, Number(deal.reward_value || 10)));
        const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
        await admin.from("luck_discount_vouchers").insert({ visitor_id: visitorId, user_balance_id: ubId || null, name: `Voucher Flash ${discount}%`, discount_percent: discount, expires_at: new Date(Date.now() + 6 * 3600_000).toISOString(), source: "flash_deal" });
        rewardSummary = `Voucher Lucky Royale ${discount}% aktif 6 jam`;
      } else if (["extra_life", "auto_hint", "time_freeze"].includes(deal.reward_type)) {
        const amount = Math.max(1, Number(deal.reward_value || 1));
        await addPowerUps(admin, visitorId, { [deal.reward_type]: amount } as any);
        const lbl = deal.reward_type === "extra_life" ? "❤️ Nyawa Ekstra" : deal.reward_type === "auto_hint" ? "💡 Hint Otomatis" : "⏸️ Time Freeze";
        rewardSummary = `+${amount} ${lbl}`;
      } else if (deal.reward_type === "game_credits") {
        const amount = Math.max(1, Number(deal.reward_value || 1));
        await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: amount });
        rewardSummary = `+${amount} 🎮 Kredit Game`;
      } else if (deal.reward_type === "streak_coins") {
        const amount = Math.max(1, Number(deal.reward_value || 1));
        await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + amount }).eq("id", streak.id);
        rewardSummary = `+${amount} 🪙 Streak Coins`;
      } else if (deal.reward_type.startsWith("combo_")) {
        const mult = Math.max(1, Number(deal.reward_value || 1));
        const parts: string[] = [];
        const combos: Record<string, () => Promise<void>> = {
          combo_starter: async () => {
            await addPowerUps(admin, visitorId, { auto_hint: 5 * mult, extra_life: 3 * mult });
            await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + 200 * mult }).eq("id", streak.id);
            parts.push(`+${5 * mult} Hint`, `+${3 * mult} Nyawa`, `+${200 * mult} Koin`);
          },
          combo_streak_ticket: async () => {
            await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + 3 * mult }).eq("id", streak.id);
            await addSpinTicket(admin, visitorId, "normal", 10 * mult);
            await addLuckyDrawTicket(admin, visitorId, 5 * mult);
            parts.push(`+${3 * mult} Freeze`, `+${10 * mult} Tiket Normal`, `+${5 * mult} Tiket Lucky Draw`);
          },
          combo_luck: async () => {
            await addServerLuck(admin, visitorId, 6 * mult);
            await addSpinTicket(admin, visitorId, "premium", 3 * mult);
            await addLuckyDrawTicket(admin, visitorId, 10 * mult);
            parts.push(`Jam Hoki ${6 * mult}j`, `+${3 * mult} Tiket Premium`, `+${10 * mult} Tiket Lucky Draw`);
          },
          combo_mantap: async () => {
            await addPowerUps(admin, visitorId, { auto_hint: 15 * mult, extra_life: 10 * mult, time_freeze: 8 * mult });
            await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: 25 * mult });
            await addSpinTicket(admin, visitorId, "normal", 15 * mult);
            parts.push(`+${15 * mult} Hint`, `+${10 * mult} Nyawa`, `+${8 * mult} Time Freeze`, `+${25 * mult} Kredit`, `+${15 * mult} Tiket Normal`);
          },
          combo_ultimate: async () => {
            await addPowerUps(admin, visitorId, { auto_hint: 25 * mult, extra_life: 20 * mult, time_freeze: 15 * mult, double_xp_hours: 24 * mult });
            await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: 50 * mult });
            await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + 5 * mult, streak_coins: (streak.streak_coins || 0) + 1000 * mult }).eq("id", streak.id);
            await addSpinTicket(admin, visitorId, "normal", 25 * mult);
            await addSpinTicket(admin, visitorId, "premium", 5 * mult);
            await addLuckyDrawTicket(admin, visitorId, 15 * mult);
            await addServerLuck(admin, visitorId, 12 * mult);
            parts.push("Paket Lengkap: Hint, Nyawa, Time Freeze, Double XP 24j, Kredit, Freeze, Koin, Tiket Spin & Lucky Draw, Jam Hoki");
          },
        };
        const fn = combos[deal.reward_type] || combos.combo_starter;
        await fn();
        rewardSummary = parts.join(", ");
      } else {
        return Response.json({ error: "Tipe hadiah tidak dikenal" }, { status: 400, headers: corsHeaders });
      }


      // Deduct payment
      if (payMethod === "gem") {
        // Potong gem lewat RPC akun-aware (multi-profile per akun balance)
        const { error: gemErr } = await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -costPaid });
        if (gemErr) {
          return Response.json({ error: `Gagal potong Gem: ${gemErr.message}` }, { status: 400, headers: corsHeaders });
        }
        await admin.from("gem_transactions").insert({
          visitor_id: visitorId,
          amount: -costPaid,
          type: "flash_deal",
          description: `Flash Deal: ${deal.name} (-${costPaid} 💎)`,
          reference_id: dealId,
        });
      } else {
        await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) - costPaid }).eq("id", streak.id);
      }

      // Log redemption
      await admin.from("flash_deal_redemptions").insert({
        visitor_id: visitorId,
        deal_id: dealId,
        redemption_date: today,
        cost_paid: costPaid,
        reward_type: deal.reward_type,
        reward_value: deal.reward_value,
        payment_method: payMethod,
      });

      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `⚡ Flash Deal: ${deal.name}`,
        message: `${rewardSummary} — bayar ${costLabel}`,
        type: "flash_deal",
      });

      return Response.json({ success: true, cost: costPaid, payment_method: payMethod, costLabel, rewardSummary, deal }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
