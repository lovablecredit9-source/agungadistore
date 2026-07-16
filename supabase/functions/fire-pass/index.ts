import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getActiveSeason(admin: any) {
  const { data } = await admin.from("fire_pass_seasons").select("*").eq("is_active", true).order("season_number", { ascending: false }).limit(1).maybeSingle();
  return data;
}

async function getOrCreateProgress(admin: any, visitorId: string, seasonId: string) {
  const { data: blh } = await admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
  const ub_id = blh?.user_balance_id ?? null;

  const { data: existing } = await admin.from("fire_pass_progress").select("*")
    .eq("season_id", seasonId)
    .or(ub_id ? `visitor_id.eq.${visitorId},user_balance_id.eq.${ub_id}` : `visitor_id.eq.${visitorId}`)
    .maybeSingle();
  if (existing) {
    // Auto-enable premium jika free_premium_enabled
    const { data: s } = await admin.from("fire_pass_seasons").select("free_premium_enabled").eq("id", seasonId).maybeSingle();
    if (s?.free_premium_enabled && !existing.is_premium) {
      await admin.from("fire_pass_progress").update({ is_premium: true, premium_activated_at: new Date().toISOString() }).eq("id", existing.id);
      existing.is_premium = true;
    }
    return existing;
  }
  const { data: s } = await admin.from("fire_pass_seasons").select("free_premium_enabled").eq("id", seasonId).maybeSingle();
  const { data: created } = await admin.from("fire_pass_progress").insert({
    season_id: seasonId,
    visitor_id: visitorId,
    user_balance_id: ub_id,
    badges: 0,
    is_premium: !!s?.free_premium_enabled,
    premium_activated_at: s?.free_premium_enabled ? new Date().toISOString() : null,
  }).select().single();
  return created;
}

async function applyReward(admin: any, visitorId: string, ubId: string | null, type: string | null, value: number, durationHours: number, label: string | null) {
  if (!type || !value) return;
  if (type === "saldo_in") {
    await admin.rpc("add_topup_bonus_to_saldo_in", { p_visitor_id: visitorId, p_amount: value });
  } else if (type === "coins") {
    await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: value });
  } else if (type === "gems") {
    // add ke game_profiles gems (fallback: skip jika gagal)
    const { data: gp } = await admin.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
    if (gp) await admin.from("game_profiles").update({ gems: (gp.gems || 0) + value }).eq("id", gp.id);
  } else if (type === "premium_quest_days") {
    const expiresAt = new Date(Date.now() + value * 86400000).toISOString();
    await admin.from("premium_quest_subscriptions").insert({
      visitor_id: visitorId, user_balance_id: ubId,
      plan_name: `Fire Pass ${value} Hari`, plan_code: "FIRE_PASS_REWARD",
      expires_at: expiresAt, is_active: true, is_permanent: false, purchase_source: "fire_pass",
    });
  }
  // type lain (lucky_ticket, server_luck_hours, storage_mb, xp_multiplier) bisa ditambahkan nanti
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = body.action;

    if (action === "status") {
      const { visitorId } = body;
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ season: null, tiers: [], progress: null }, { headers: corsHeaders });
      const { data: tiers } = await admin.from("fire_pass_tiers").select("*").eq("season_id", season.id).order("tier_level");
      const progress = visitorId ? await getOrCreateProgress(admin, visitorId, season.id) : null;
      return Response.json({ season, tiers: tiers ?? [], progress }, { headers: corsHeaders });
    }

    if (action === "add_badges") {
      const { visitorId, amount, source } = body;
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ error: "no active season" }, { status: 400, headers: corsHeaders });
      const progress = await getOrCreateProgress(admin, visitorId, season.id);
      const newBadges = (progress.badges || 0) + (amount || 1);
      await admin.from("fire_pass_progress").update({ badges: newBadges }).eq("id", progress.id);
      await admin.from("fire_pass_badge_log").insert({ season_id: season.id, visitor_id: visitorId, source: source || "manual", amount: amount || 1 });
      return Response.json({ success: true, badges: newBadges }, { headers: corsHeaders });
    }

    if (action === "claim_tier") {
      const { visitorId, tierLevel, track } = body;
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ error: "no active season" }, { status: 400, headers: corsHeaders });
      const { data: tier } = await admin.from("fire_pass_tiers").select("*").eq("season_id", season.id).eq("tier_level", tierLevel).maybeSingle();
      if (!tier) return Response.json({ error: "Tier tidak ditemukan" }, { status: 404, headers: corsHeaders });
      const progress = await getOrCreateProgress(admin, visitorId, season.id);
      if ((progress.badges || 0) < tier.badge_required) return Response.json({ error: "Badge belum cukup" }, { status: 400, headers: corsHeaders });

      const isPremium = track === "premium";
      if (isPremium && !progress.is_premium) return Response.json({ error: "Butuh Fire Pass Premium" }, { status: 403, headers: corsHeaders });

      const field = isPremium ? "claimed_premium_tiers" : "claimed_free_tiers";
      const claimed: number[] = progress[field] ?? [];
      if (claimed.includes(tierLevel)) return Response.json({ error: "Tier sudah diklaim" }, { status: 400, headers: corsHeaders });

      const rType = isPremium ? tier.premium_reward_type : tier.free_reward_type;
      const rValue = isPremium ? tier.premium_reward_value : tier.free_reward_value;
      const rDuration = isPremium ? tier.premium_reward_duration_hours : tier.free_reward_duration_hours;
      const rLabel = isPremium ? tier.premium_reward_label : tier.free_reward_label;

      await applyReward(admin, visitorId, progress.user_balance_id, rType, rValue || 0, rDuration || 0, rLabel);

      await admin.from("fire_pass_progress").update({ [field]: [...claimed, tierLevel] }).eq("id", progress.id);
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🔥 Fire Pass Tier ${tierLevel} Diklaim`,
        message: `${isPremium ? "💎 Premium: " : ""}${rLabel || "Reward diterima"}`,
        type: "success",
      });
      return Response.json({ success: true, reward_label: rLabel }, { headers: corsHeaders });
    }

    if (action === "buy_premium") {
      const { visitorId, method } = body; // method = 'saldo' | 'gems'
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ error: "no active season" }, { status: 400, headers: corsHeaders });
      const progress = await getOrCreateProgress(admin, visitorId, season.id);
      if (progress.is_premium) return Response.json({ error: "Sudah Premium" }, { status: 400, headers: corsHeaders });

      if (method === "gems") {
        const { data: gp } = await admin.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
        if (!gp || (gp.gems || 0) < season.price_gems) return Response.json({ error: `Butuh ${season.price_gems} 💎` }, { status: 400, headers: corsHeaders });
        await admin.from("game_profiles").update({ gems: gp.gems - season.price_gems }).eq("id", gp.id);
      } else {
        const { data: bal } = await admin.from("user_balances").select("id, balance").eq("id", progress.user_balance_id).maybeSingle();
        if (!bal || (bal.balance || 0) < season.price_saldo_in) return Response.json({ error: `Saldo IN tidak cukup (butuh Rp ${season.price_saldo_in.toLocaleString("id-ID")})` }, { status: 400, headers: corsHeaders });
        await admin.rpc("consume_main_balance_only", { p_balance_id: bal.id, p_amount: season.price_saldo_in });
        await admin.from("balance_transactions").insert({ visitor_id: visitorId, amount: -season.price_saldo_in, type: "fire_pass_premium", description: `Fire Pass Premium ${season.name}` });
      }

      await admin.from("fire_pass_progress").update({ is_premium: true, premium_activated_at: new Date().toISOString() }).eq("id", progress.id);
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: "🔥 Fire Pass Premium Aktif!",
        message: `Selamat! Kamu bisa klaim reward Premium di ${season.name}.`,
        type: "success",
      });
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // ===== MISSIONS =====
    if (action === "list_missions") {
      const { visitorId } = body;
      const season = await getActiveSeason(admin);
      const now = new Date();
      const jakOffsetMs = 7 * 3600 * 1000;
      const jak = new Date(now.getTime() + jakOffsetMs);
      const dayKey = jak.toISOString().slice(0, 10);
      // ISO week key
      const d = new Date(Date.UTC(jak.getUTCFullYear(), jak.getUTCMonth(), jak.getUTCDate()));
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      const weekKey = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
      const dayStartIso = new Date(dayKey + "T00:00:00+07:00").toISOString();
      // week start Monday 00:00 WIB
      const weekMonday = new Date(jak); weekMonday.setUTCDate(jak.getUTCDate() - (day - 1));
      const weekStartIso = new Date(weekMonday.toISOString().slice(0, 10) + "T00:00:00+07:00").toISOString();

      const { data: missions } = await admin.from("fire_pass_missions").select("*").eq("is_active", true).order("sort_order");
      const { data: claims } = await admin.from("fire_pass_mission_progress").select("*").eq("visitor_id", visitorId);

      // preload signals
      const [{ data: streak }, { data: songLogsDay }, { data: songLogsWeek }, { data: txDay }, { data: txWeek }, { data: loginDay }, { data: qcDay }, { data: qcWeek }] = await Promise.all([
        admin.from("daily_streaks").select("last_claim_date").eq("visitor_id", visitorId).maybeSingle(),
        admin.from("song_listening_log").select("id, song_id").eq("visitor_id", visitorId).gte("created_at", dayStartIso),
        admin.from("song_listening_log").select("id").eq("visitor_id", visitorId).gte("created_at", weekStartIso),
        admin.from("balance_transactions").select("amount, type, created_at").eq("visitor_id", visitorId).gte("created_at", dayStartIso),
        admin.from("balance_transactions").select("amount, type, created_at").eq("visitor_id", visitorId).gte("created_at", weekStartIso),
        admin.from("balance_login_history").select("id").eq("visitor_id", visitorId).gte("logged_in_at", dayStartIso).limit(1),
        admin.from("premium_quest_progress").select("id, claimed_at").eq("visitor_id", visitorId).gte("claimed_at", dayStartIso),
        admin.from("premium_quest_progress").select("id, claimed_at").eq("visitor_id", visitorId).gte("claimed_at", weekStartIso),
      ]);
      const purchaseTypesDay = (txDay || []).filter((t: any) => (t.type || "").includes("purchase") || t.amount < 0);
      const purchaseTypesWeek = (txWeek || []).filter((t: any) => (t.type || "").includes("purchase") || t.amount < 0);
      const topupDay = (txDay || []).filter((t: any) => (t.type || "").includes("topup") || (t.type || "").includes("deposit"));
      const topupWeek = (txWeek || []).filter((t: any) => (t.type || "").includes("topup") || (t.type || "").includes("deposit"));

      const enriched = (missions || []).map((m: any) => {
        const isWeekly = m.mission_type === "weekly";
        const periodKey = isWeekly ? weekKey : dayKey;
        const claim = (claims || []).find((c: any) => c.mission_id === m.id && c.period_key === periodKey);
        let current = 0;
        switch (m.requirement_type) {
          case "daily_login": current = (loginDay?.length || 0) > 0 ? 1 : 0; break;
          case "streak_claim": current = streak?.last_claim_date === dayKey ? 1 : 0; break;
          case "streak_claim_week": current = 0; break; // aproks: track via claims table jika ada
          case "listen_song": current = new Set((songLogsDay || []).map((r: any) => r.song_id)).size; break;
          case "listen_song_week": current = (songLogsWeek || []).length; break;
          case "purchase_count": current = purchaseTypesDay.length; break;
          case "purchase_count_week": current = purchaseTypesWeek.length; break;
          case "topup_amount": current = topupDay.reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0); break;
          case "topup_amount_week": current = topupWeek.reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0); break;
          case "quest_claim_week": current = (qcWeek || []).length; break;
          default: current = 0;
        }
        return {
          ...m,
          period_key: periodKey,
          current_value: current,
          is_completed: current >= m.target_value,
          is_claimed: !!claim?.is_claimed,
        };
      });
      return Response.json({ missions: enriched, season }, { headers: corsHeaders });
    }

    if (action === "claim_mission") {
      const { visitorId, missionId } = body;
      const { data: mission } = await admin.from("fire_pass_missions").select("*").eq("id", missionId).maybeSingle();
      if (!mission) return Response.json({ error: "Misi tidak ditemukan" }, { status: 404, headers: corsHeaders });
      // Recompute via list_missions logic — simplified: trust client cannot bypass because we recheck below via new invoke
      const check = await fetch(new URL(req.url).origin + new URL(req.url).pathname, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") || "" },
        body: JSON.stringify({ action: "list_missions", visitorId }),
      }).then(r => r.json()).catch(() => null);
      const m = check?.missions?.find((x: any) => x.id === missionId);
      if (!m) return Response.json({ error: "Misi tidak valid" }, { status: 400, headers: corsHeaders });
      if (!m.is_completed) return Response.json({ error: "Misi belum selesai" }, { status: 400, headers: corsHeaders });
      if (m.is_claimed) return Response.json({ error: "Sudah diklaim" }, { status: 400, headers: corsHeaders });

      // Upsert claim record
      await admin.from("fire_pass_mission_progress").upsert({
        visitor_id: visitorId, mission_id: missionId, period_key: m.period_key,
        current_value: m.current_value, is_completed: true, is_claimed: true, claimed_at: new Date().toISOString(),
      }, { onConflict: "visitor_id,mission_id,period_key" });

      // Award badges
      const season = await getActiveSeason(admin);
      if (season) {
        const progress = await getOrCreateProgress(admin, visitorId, season.id);
        const newBadges = (progress.badges || 0) + (mission.badge_reward || 1);
        await admin.from("fire_pass_progress").update({ badges: newBadges }).eq("id", progress.id);
        await admin.from("fire_pass_badge_log").insert({ season_id: season.id, visitor_id: visitorId, source: `mission:${mission.code}`, amount: mission.badge_reward || 1 });
      }
      return Response.json({ success: true, badges_awarded: mission.badge_reward }, { headers: corsHeaders });
    }

    if (action === "admin_upsert_mission") {
      const { id, ...rest } = body.mission;
      if (id) await admin.from("fire_pass_missions").update(rest).eq("id", id);
      else await admin.from("fire_pass_missions").insert(rest);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "admin_delete_mission") {
      await admin.from("fire_pass_missions").delete().eq("id", body.id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // === ADMIN ===
    if (action === "admin_upsert_season") {
      const { id, season_number, name, description, starts_at, ends_at, is_active, free_premium_enabled, price_saldo_in, price_gems } = body;
      const payload: any = { season_number, name, description, starts_at, ends_at, is_active, free_premium_enabled, price_saldo_in, price_gems };
      if (id) await admin.from("fire_pass_seasons").update(payload).eq("id", id);
      else await admin.from("fire_pass_seasons").insert(payload);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "admin_upsert_tier") {
      const { id, ...rest } = body.tier;
      if (id) await admin.from("fire_pass_tiers").update(rest).eq("id", id);
      else await admin.from("fire_pass_tiers").insert(rest);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "admin_delete_tier") {
      await admin.from("fire_pass_tiers").delete().eq("id", body.id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "admin_grant_premium") {
      const { visitorId } = body;
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ error: "no active season" }, { status: 400, headers: corsHeaders });
      const progress = await getOrCreateProgress(admin, visitorId, season.id);
      await admin.from("fire_pass_progress").update({ is_premium: true, premium_activated_at: new Date().toISOString() }).eq("id", progress.id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
