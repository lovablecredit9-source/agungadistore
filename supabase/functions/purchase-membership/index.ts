import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  visitorId: z.string().trim().min(1),
  action: z.enum(["list", "purchase", "daily-claim", "daily-gem-claim"]).default("list"),
  planId: z.string().uuid().optional(),
  paymentSource: z.enum(["auto", "game", "main"]).default("auto"),
  category: z.enum(["coin", "gem", "all"]).default("all"),
  pin: z.string().trim().min(1).optional(),
});

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Tanggal "hari ini" dalam zona WIB (UTC+7) sebagai YYYY-MM-DD
function todayWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
}
// Waktu unlock berikutnya = 00:00 WIB hari berikutnya, dalam ISO UTC
function nextUnlockISO(): string {
  const wibNow = new Date(Date.now() + 7 * 3600 * 1000);
  const y = wibNow.getUTCFullYear();
  const m = wibNow.getUTCMonth();
  const d = wibNow.getUTCDate();
  // 00:00 WIB hari berikutnya = 17:00 UTC hari ini (saat sebelum jam 17 UTC)
  const nextWibMidnightUTC = Date.UTC(y, m, d + 1, 0, 0, 0) - 7 * 3600 * 1000;
  return new Date(nextWibMidnightUTC).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Permintaan tidak valid" }, { status: 400, headers: corsHeaders });
    }

    const { visitorId, action, planId, paymentSource, pin, category } = parsed.data;
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---------- LIST ----------
    if (action === "list") {
      let plansQuery = admin
        .from("streak_membership_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (category !== "all") plansQuery = plansQuery.eq("category", category);
      const { data: plans } = await plansQuery;

      const { data: streak } = await admin
        .from("daily_streaks")
        .select("streak_coins")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      const { data: activeMemberships } = await admin
        .from("streak_user_memberships")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false });

      const { data: gameBal } = await admin.from("game_balance").select("amount").eq("visitor_id", visitorId).maybeSingle();
      const { data: balanceRow } = await admin.from("user_balances").select("balance").eq("visitor_id", visitorId).maybeSingle();
      const { data: gemsResult } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });

      // Cek klaim harian KOIN
      const today = todayWIB();
      const { data: todayClaims } = await admin
        .from("streak_membership_daily_claims")
        .select("id, coins_awarded, plan_name")
        .eq("visitor_id", visitorId)
        .eq("claim_date", today)
        .order("created_at", { ascending: true });

      const claimedToday = (todayClaims?.length || 0) > 0;
      const claimedCoins = (todayClaims || []).reduce((sum, claim) => sum + (claim.coins_awarded || 0), 0);
      const claimedPlanNames = Array.from(new Set((todayClaims || []).map((claim) => claim.plan_name).filter(Boolean)));

      // Cek klaim harian GEM
      const { data: todayGemClaims } = await admin
        .from("streak_membership_daily_gem_claims")
        .select("id, gems_awarded, plan_name")
        .eq("visitor_id", visitorId)
        .eq("claim_date", today)
        .order("created_at", { ascending: true });
      const claimedGemToday = (todayGemClaims?.length || 0) > 0;
      const claimedGems = (todayGemClaims || []).reduce((sum, c) => sum + (c.gems_awarded || 0), 0);
      const claimedGemPlanNames = Array.from(new Set((todayGemClaims || []).map((c) => c.plan_name).filter(Boolean)));

      // Hitung hadiah harian dari membership AKTIF (per kategori)
      let dailyReward = 0;
      let dailyGemReward = 0;
      const dailyPlanNames: string[] = [];
      const dailyGemPlanNames: string[] = [];
      if (activeMemberships && activeMemberships.length > 0) {
        const planIds = activeMemberships.map((m: any) => m.plan_id).filter(Boolean);
        if (planIds.length > 0) {
          const { data: planRows } = await admin
            .from("streak_membership_plans")
            .select("id, name, daily_reward_coins, bonus_daily_gems, category")
            .in("id", planIds);
          for (const m of activeMemberships as any[]) {
            const pr = planRows?.find((p: any) => p.id === m.plan_id);
            if (!pr) continue;
            const coinR = pr?.daily_reward_coins || 0;
            const gemR = pr?.bonus_daily_gems || 0;
            const planName = pr?.name || m.plan_name;
            if (coinR > 0) {
              dailyReward += coinR;
              if (planName) dailyPlanNames.push(planName);
            }
            if (gemR > 0) {
              dailyGemReward += gemR;
              if (planName) dailyGemPlanNames.push(planName);
            }
          }
        }
      }

      const currentPlanLabel = Array.from(new Set(dailyPlanNames)).join(" + ") || null;
      const claimedPlanLabel = claimedPlanNames.join(" + ") || null;
      const currentGemPlanLabel = Array.from(new Set(dailyGemPlanNames)).join(" + ") || null;
      const claimedGemPlanLabel = claimedGemPlanNames.join(" + ") || null;

      return Response.json({
        plans: plans || [],
        active_memberships: activeMemberships || [],
        user_coins: streak?.streak_coins || 0,
        user_gems: gemsResult || 0,
        game_balance: gameBal?.amount || 0,
        main_balance: balanceRow?.balance || 0,
        daily_claim: {
          available: !claimedToday && dailyReward > 0,
          claimed_today: claimedToday,
          coins_today: claimedToday ? claimedCoins : dailyReward,
          plan_name: claimedToday ? claimedPlanLabel : currentPlanLabel,
          next_unlock: nextUnlockISO(),
        },
        daily_gem_claim: {
          available: !claimedGemToday && dailyGemReward > 0,
          claimed_today: claimedGemToday,
          gems_today: claimedGemToday ? claimedGems : dailyGemReward,
          plan_name: claimedGemToday ? claimedGemPlanLabel : currentGemPlanLabel,
          next_unlock: nextUnlockISO(),
        },
      }, { headers: corsHeaders });
    }

    // ---------- DAILY CLAIM ----------
    if (action === "daily-claim") {
      const today = todayWIB();
      const { data: existingClaims } = await admin
        .from("streak_membership_daily_claims")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("claim_date", today)
        .limit(1);
      if ((existingClaims?.length || 0) > 0) {
        return Response.json({ error: "Sudah klaim hari ini", next_unlock: nextUnlockISO() }, { status: 400, headers: corsHeaders });
      }

      const { data: activeMemberships } = await admin
        .from("streak_user_memberships")
        .select("id, plan_id, plan_name")
        .eq("visitor_id", visitorId)
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString());

      if (!activeMemberships || activeMemberships.length === 0) {
        return Response.json({ error: "Tidak ada membership aktif" }, { status: 400, headers: corsHeaders });
      }

      const planIds = activeMemberships.map((m: any) => m.plan_id).filter(Boolean);
      const { data: planRows } = await admin
        .from("streak_membership_plans")
        .select("id, name, daily_reward_coins")
        .in("id", planIds);

      let totalReward = 0;
      let primaryPlanId: string | null = null;
      let primaryMembershipId: string | null = null;
      const activePlanNames: string[] = [];
      for (const m of activeMemberships as any[]) {
        const pr = planRows?.find((p: any) => p.id === m.plan_id);
        const reward = pr?.daily_reward_coins || 0;
        if (reward > 0) {
          totalReward += reward;
          if (!primaryPlanId) primaryPlanId = pr?.id || m.plan_id || null;
          if (!primaryMembershipId) primaryMembershipId = m.id;
          const planName = pr?.name || m.plan_name;
          if (planName) activePlanNames.push(planName);
        }
      }

      if (totalReward <= 0) {
        return Response.json({ error: "Paket ini tidak punya hadiah harian" }, { status: 400, headers: corsHeaders });
      }

      const uniquePlanNames = Array.from(new Set(activePlanNames));
      const combinedPlanName = uniquePlanNames.join(" + ") || null;

      // Tambah koin ke daily_streaks
      const { data: s } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
      if (s) {
        await admin.from("daily_streaks").update({ streak_coins: (s.streak_coins || 0) + totalReward }).eq("id", s.id);
      } else {
        await admin.from("daily_streaks").insert({
          visitor_id: visitorId, last_claim_date: today,
          current_streak: 0, longest_streak: 0, total_claims: 0, streak_coins: totalReward,
        });
      }

      const { error: insErr } = await admin.from("streak_membership_daily_claims").insert({
        visitor_id: visitorId,
        membership_id: uniquePlanNames.length === 1 ? primaryMembershipId : null,
        plan_id: uniquePlanNames.length === 1 ? primaryPlanId : null,
        plan_name: combinedPlanName,
        claim_date: today,
        coins_awarded: totalReward,
      });
      if (insErr) return Response.json({ error: "Gagal menyimpan klaim: " + insErr.message }, { status: 500, headers: corsHeaders });

      return Response.json({
        success: true,
        coins_awarded: totalReward,
        plan_name: combinedPlanName,
        next_unlock: nextUnlockISO(),
      }, { headers: corsHeaders });
    }

    // ---------- DAILY GEM CLAIM ----------
    if (action === "daily-gem-claim") {
      const today = todayWIB();
      const { data: existingClaims } = await admin
        .from("streak_membership_daily_gem_claims")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("claim_date", today)
        .limit(1);
      if ((existingClaims?.length || 0) > 0) {
        return Response.json({ error: "Sudah klaim gem hari ini", next_unlock: nextUnlockISO() }, { status: 400, headers: corsHeaders });
      }

      const { data: activeMemberships } = await admin
        .from("streak_user_memberships")
        .select("id, plan_id, plan_name")
        .eq("visitor_id", visitorId)
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString());

      if (!activeMemberships || activeMemberships.length === 0) {
        return Response.json({ error: "Tidak ada membership aktif" }, { status: 400, headers: corsHeaders });
      }

      const planIds = activeMemberships.map((m: any) => m.plan_id).filter(Boolean);
      const { data: planRows } = await admin
        .from("streak_membership_plans")
        .select("id, name, bonus_daily_gems")
        .in("id", planIds);

      let totalGems = 0;
      let primaryPlanId: string | null = null;
      let primaryMembershipId: string | null = null;
      const activePlanNames: string[] = [];
      for (const m of activeMemberships as any[]) {
        const pr = planRows?.find((p: any) => p.id === m.plan_id);
        const reward = pr?.bonus_daily_gems || 0;
        if (reward > 0) {
          totalGems += reward;
          if (!primaryPlanId) primaryPlanId = pr?.id || m.plan_id || null;
          if (!primaryMembershipId) primaryMembershipId = m.id;
          const planName = pr?.name || m.plan_name;
          if (planName) activePlanNames.push(planName);
        }
      }

      if (totalGems <= 0) {
        return Response.json({ error: "Membership aktif tidak punya hadiah gem harian" }, { status: 400, headers: corsHeaders });
      }

      const uniquePlanNames = Array.from(new Set(activePlanNames));
      const combinedPlanName = uniquePlanNames.join(" + ") || null;

      try {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: totalGems });
      } catch (e) {
        return Response.json({ error: "Gagal menambah gem: " + (e instanceof Error ? e.message : String(e)) }, { status: 500, headers: corsHeaders });
      }

      const { error: insErr } = await admin.from("streak_membership_daily_gem_claims").insert({
        visitor_id: visitorId,
        membership_id: uniquePlanNames.length === 1 ? primaryMembershipId : null,
        plan_id: uniquePlanNames.length === 1 ? primaryPlanId : null,
        plan_name: combinedPlanName,
        claim_date: today,
        gems_awarded: totalGems,
      });
      if (insErr) return Response.json({ error: "Gagal menyimpan klaim gem: " + insErr.message }, { status: 500, headers: corsHeaders });

      return Response.json({
        success: true,
        gems_awarded: totalGems,
        plan_name: combinedPlanName,
        next_unlock: nextUnlockISO(),
      }, { headers: corsHeaders });
    }


    if (!planId) {
      return Response.json({ error: "Paket tidak dipilih" }, { status: 400, headers: corsHeaders });
    }

    const { data: plan } = await admin
      .from("streak_membership_plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .maybeSingle();
    if (!plan) return Response.json({ error: "Paket tidak ditemukan" }, { status: 404, headers: corsHeaders });

    let methodLabel = "";
    let amountPaid = 0;
    let payFromGame = 0, payFromMain = 0;

    // ---------- Pembayaran via SALDO (auto/game/main) ----------
    // Verify PIN
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
    if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 200, headers: corsHeaders });
    if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 200, headers: corsHeaders });
    const hashHex = await sha256Hex(pin);
    if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 200, headers: corsHeaders });

    const price = plan.price_idr || 0;
    if (price <= 0) return Response.json({ error: "Paket ini tidak menerima pembayaran saldo" }, { status: 400, headers: corsHeaders });

    const { data: gameBal } = await admin.from("game_balance").select("id, amount, total_spent").eq("visitor_id", visitorId).maybeSingle();
    const { data: balanceRow } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
    if (!balanceRow && !gameBal) return Response.json({ error: "Akun saldo tidak ditemukan" }, { status: 404, headers: corsHeaders });
    const gameAmount = gameBal?.amount || 0;
    const mainAmount = balanceRow?.balance || 0;

    if (paymentSource === "main") {
      if (mainAmount < price) return Response.json({ error: "Saldo Utama tidak cukup" }, { status: 400, headers: corsHeaders });
      payFromMain = price; methodLabel = "Saldo Utama";
    } else if (paymentSource === "game") {
      if (gameAmount < price) return Response.json({ error: "Saldo IN tidak cukup" }, { status: 400, headers: corsHeaders });
      payFromGame = price; methodLabel = "Saldo IN";
    } else {
      if (gameAmount + mainAmount < price) return Response.json({ error: "Saldo gabungan tidak cukup" }, { status: 400, headers: corsHeaders });
      payFromGame = Math.min(gameAmount, price);
      payFromMain = price - payFromGame;
      methodLabel = payFromGame > 0 && payFromMain > 0 ? "Saldo IN + Utama" : payFromGame > 0 ? "Saldo IN" : "Saldo Utama";
    }

    if (payFromGame > 0 && gameBal) {
      await admin.from("game_balance").update({ amount: gameAmount - payFromGame, total_spent: (gameBal.total_spent || 0) + payFromGame }).eq("id", gameBal.id);
      await admin.from("game_balance_transactions").insert({ visitor_id: visitorId, type: "spend", amount: -payFromGame, description: `Beli Membership ${plan.name}` });
    }
    if (payFromMain > 0 && balanceRow) {
      const { error: balErr } = await admin.from("user_balances").update({ balance: mainAmount - payFromMain }).eq("id", balanceRow.id);
      if (balErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });
      await admin.from("balance_transactions").insert({ visitor_id: visitorId, type: "purchase", amount: payFromMain, description: `Beli Membership ${plan.name} [${methodLabel}]` });
    }
    amountPaid = price;

    // Stack expiry hanya untuk paket yang sama; paket beda jenis aktif paralel
    const { data: existingActive } = await admin
      .from("streak_user_memberships")
      .select("expires_at")
      .eq("visitor_id", visitorId)
      .eq("plan_id", plan.id)
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1);

    const startsAt = existingActive && existingActive.length > 0 ? new Date(existingActive[0].expires_at) : new Date();
    const expiresAt = new Date(startsAt.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

    const { error: insErr } = await admin.from("streak_user_memberships").insert({
      visitor_id: visitorId,
      plan_id: plan.id,
      plan_name: plan.name,
      duration_days: plan.duration_days,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      payment_method: methodLabel,
      amount_paid: amountPaid,
      bonus_multiplier: plan.bonus_multiplier,
      is_active: true,
    });
    if (insErr) return Response.json({ error: "Gagal menyimpan membership: " + insErr.message }, { status: 500, headers: corsHeaders });

    // Jika user sudah klaim hadiah harian hari ini, top-up instan sebesar daily_reward paket baru
    let instantDailyTopUp = 0;
    const todayStr = todayWIB();
    const { data: claimsToday } = await admin
      .from("streak_membership_daily_claims")
      .select("id")
      .eq("visitor_id", visitorId)
      .eq("claim_date", todayStr)
      .limit(1);
    const alreadyClaimedToday = (claimsToday?.length || 0) > 0;
    if (alreadyClaimedToday && (plan.daily_reward_coins || 0) > 0) {
      instantDailyTopUp = plan.daily_reward_coins;
      await admin.from("streak_membership_daily_claims").insert({
        visitor_id: visitorId,
        membership_id: null,
        plan_id: plan.id,
        plan_name: plan.name,
        claim_date: todayStr,
        coins_awarded: instantDailyTopUp,
      });
    }

    // Bonus instant (termasuk top-up daily jika berlaku)
    const totalInstantCoins = (plan.bonus_streak_coins || 0) + instantDailyTopUp;
    if (totalInstantCoins > 0) {
      const { data: s } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
      if (s) {
        await admin.from("daily_streaks").update({ streak_coins: (s.streak_coins || 0) + totalInstantCoins }).eq("id", s.id);
      } else {
        await admin.from("daily_streaks").insert({ visitor_id: visitorId, last_claim_date: todayStr, current_streak: 0, longest_streak: 0, total_claims: 0, streak_coins: totalInstantCoins });
      }
    }
    if (plan.bonus_gems > 0) {
      try { await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: plan.bonus_gems }); } catch (_) { /* ignore */ }
    }
    if (plan.bonus_freeze_count > 0) {
      const { data: fr } = await admin.from("streak_freezes").select("id, freeze_count").eq("visitor_id", visitorId).maybeSingle();
      if (fr) {
        await admin.from("streak_freezes").update({ freeze_count: (fr.freeze_count || 0) + plan.bonus_freeze_count }).eq("id", fr.id);
      } else {
        await admin.from("streak_freezes").insert({ visitor_id: visitorId, freeze_count: plan.bonus_freeze_count });
      }
    }

    return Response.json({
      success: true,
      plan_name: plan.name,
      expires_at: expiresAt.toISOString(),
      method: methodLabel,
      bonus: {
        streak_coins: plan.bonus_streak_coins,
        gems: plan.bonus_gems,
        freeze: plan.bonus_freeze_count,
        multiplier: plan.bonus_multiplier,
        instant_daily: instantDailyTopUp,
      },
    }, { headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
