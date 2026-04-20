import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function todayWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
}

function pickWeighted(pool: any[]): any {
  const total = pool.reduce((s, p) => s + (p.weight || 1), 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight || 1;
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

async function getCoins(admin: any, visitorId: string) {
  const { data } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
  return { id: data?.id || null, coins: data?.streak_coins || 0 };
}

async function getGems(admin: any, visitorId: string): Promise<number> {
  const { data } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
  return Number(data) || 0;
}

async function deductGems(admin: any, visitorId: string, amount: number) {
  const { error } = await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -amount });
  if (error) throw new Error(error.message);
}

async function addGems(admin: any, visitorId: string, amount: number) {
  const { error } = await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: amount });
  if (error) throw new Error(error.message);
}

async function applyReward(admin: any, visitorId: string, type: string, value: number) {
  if (type === "streak_coins") {
    const s = await getCoins(admin, visitorId);
    if (s.id) {
      await admin.from("daily_streaks").update({ streak_coins: s.coins + value }).eq("id", s.id);
    } else {
      await admin.from("daily_streaks").insert({ visitor_id: visitorId, streak_coins: value });
    }
  } else if (type === "gems") {
    await addGems(admin, visitorId, value);
    await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: value, type: "expansion_reward", description: `+${value} 💎 dari Streak Expansion` });
  } else if (type === "streak_freeze") {
    const s = await getCoins(admin, visitorId);
    const { data: cur } = await admin.from("daily_streaks").select("freeze_count").eq("visitor_id", visitorId).maybeSingle();
    if (s.id) {
      await admin.from("daily_streaks").update({ freeze_count: (cur?.freeze_count || 0) + value }).eq("id", s.id);
    }
  } else if (type === "auto_hint" || type === "extra_life" || type === "time_freeze") {
    const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
    const upd: any = { [type]: ((pu as any)?.[type] || 0) + value };
    if (pu) await admin.from("user_power_ups").update(upd).eq("visitor_id", visitorId);
    else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...upd });
  } else if (type === "double_xp") {
    const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
    const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now()
      ? new Date(pu.double_xp_until).getTime()
      : Date.now();
    const newUntil = new Date(baseMs + value * 3600 * 1000).toISOString();
    if (pu) await admin.from("user_power_ups").update({ double_xp_until: newUntil }).eq("visitor_id", visitorId);
    else await admin.from("user_power_ups").insert({ visitor_id: visitorId, double_xp_until: newUntil });
  }
}

async function ensureRotation(admin: any, today: string) {
  const { data: existing } = await admin
    .from("streak_rotating_shop_active")
    .select("id")
    .eq("rotation_date", today);
  if ((existing?.length || 0) > 0) return;

  const { data: items } = await admin
    .from("streak_rotating_shop_items")
    .select("id")
    .eq("is_active", true);
  if (!items || items.length === 0) return;

  const shuffled = [...items].sort(() => Math.random() - 0.5);
  const slots = shuffled.slice(0, Math.min(6, shuffled.length));
  const discounts = [0, 10, 15, 20, 25, 30];
  const rows = slots.map((s, i) => ({
    item_id: s.id,
    rotation_date: today,
    slot_order: i,
    discount_pct: discounts[i] || 0,
    daily_limit: i < 3 ? 3 : 1,
  }));
  await admin.from("streak_rotating_shop_active").insert(rows);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const action = body?.action;
    const visitorId = body?.visitorId;
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = todayWIB();

    // ==================== OVERVIEW ====================
    if (action === "overview") {
      await ensureRotation(admin, today);

      const [boxesRes, claimsRes, eventsRes, progRes, rotRes, rotPurchRes, bossRes, attacksRes, gems, coins] = await Promise.all([
        admin.from("streak_daily_mystery_boxes").select("*").eq("is_active", true).order("sort_order"),
        admin.from("streak_daily_mystery_claims").select("box_id").eq("visitor_id", visitorId).eq("claim_date", today),
        admin.from("streak_mini_events").select("*").eq("is_active", true).gte("ends_at", new Date().toISOString()).order("sort_order"),
        admin.from("streak_mini_event_progress").select("*").eq("visitor_id", visitorId),
        admin.from("streak_rotating_shop_active").select("*, item:streak_rotating_shop_items(*)").eq("rotation_date", today).order("slot_order"),
        admin.from("streak_rotating_shop_purchases").select("active_id").eq("visitor_id", visitorId).eq("purchase_date", today),
        admin.from("streak_community_bosses").select("*").eq("is_active", true).gte("ends_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("streak_community_boss_attacks").select("visitor_id, damage_dealt").order("created_at", { ascending: false }).limit(50),
        getGems(admin, visitorId),
        getCoins(admin, visitorId),
      ]);

      const claimedBoxIds = new Set((claimsRes.data || []).map((c: any) => c.box_id));
      const progMap = Object.fromEntries((progRes.data || []).map((p: any) => [p.event_id, p]));
      const rotPurchCounts: Record<string, number> = {};
      (rotPurchRes.data || []).forEach((p: any) => { rotPurchCounts[p.active_id] = (rotPurchCounts[p.active_id] || 0) + 1; });

      // Boss top contributors
      let topContributors: any[] = [];
      let myContribution = 0;
      if (bossRes?.data) {
        const { data: contrib } = await admin
          .from("streak_community_boss_attacks")
          .select("visitor_id, damage_dealt")
          .eq("boss_id", bossRes.data.id);
        const map: Record<string, number> = {};
        (contrib || []).forEach((a: any) => { map[a.visitor_id] = (map[a.visitor_id] || 0) + a.damage_dealt; });
        topContributors = Object.entries(map)
          .map(([vid, dmg]) => ({ visitor_id: vid, damage: dmg, is_me: vid === visitorId }))
          .sort((a, b) => b.damage - a.damage)
          .slice(0, 10);
        myContribution = map[visitorId] || 0;
      }

      return Response.json({
        boxes: (boxesRes.data || []).map((b: any) => ({ ...b, claimed_today: claimedBoxIds.has(b.id) })),
        events: (eventsRes.data || []).map((e: any) => {
          const p = progMap[e.id];
          return {
            ...e,
            current_value: p?.current_value || 0,
            is_claimed: !!p?.is_claimed,
            is_complete: (p?.current_value || 0) >= e.target_value,
          };
        }),
        rotating: (rotRes.data || []).map((r: any) => {
          const used = rotPurchCounts[r.id] || 0;
          const left = r.daily_limit - used;
          const item = r.item;
          const finalCoins = item ? Math.floor(item.base_cost_coins * (1 - r.discount_pct / 100)) : 0;
          const finalGems = item ? Math.floor(item.base_cost_gems * (1 - r.discount_pct / 100)) : 0;
          return { ...r, item, used_today: used, left_today: left, final_cost_coins: finalCoins, final_cost_gems: finalGems };
        }),
        boss: bossRes?.data ? {
          ...bossRes.data,
          hp_pct: Math.max(0, Math.min(100, (bossRes.data.current_hp / bossRes.data.max_hp) * 100)),
          top_contributors: topContributors,
          my_contribution: myContribution,
        } : null,
        recent_attacks: (attacksRes.data || []).slice(0, 10),
        user_gems: gems,
        user_coins: coins.coins,
        date: today,
      }, { headers: corsHeaders });
    }

    // ==================== OPEN BOX ====================
    if (action === "open_box") {
      const { boxId, paymentMethod } = body;
      const { data: box } = await admin.from("streak_daily_mystery_boxes").select("*").eq("id", boxId).eq("is_active", true).maybeSingle();
      if (!box) return Response.json({ error: "Box tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const { count: usedToday } = await admin
        .from("streak_daily_mystery_claims")
        .select("id", { count: "exact", head: true })
        .eq("visitor_id", visitorId)
        .eq("box_id", boxId)
        .eq("claim_date", today);
      if ((usedToday || 0) >= box.daily_limit) {
        return Response.json({ error: `Box ini limit ${box.daily_limit}x per hari` }, { status: 400, headers: corsHeaders });
      }

      let costPaid = 0;
      let payMethod = "free";
      if (!box.is_free) {
        if (paymentMethod === "gem" && box.cost_gems > 0) {
          const userGems = await getGems(admin, visitorId);
          if (userGems < box.cost_gems) return Response.json({ error: `Gem kurang (${userGems}/${box.cost_gems})` }, { status: 400, headers: corsHeaders });
          await deductGems(admin, visitorId, box.cost_gems);
          await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: -box.cost_gems, type: "mystery_box", description: `Buka ${box.name}` });
          costPaid = box.cost_gems;
          payMethod = "gem";
        } else if (box.cost_coins > 0) {
          const s = await getCoins(admin, visitorId);
          if (s.coins < box.cost_coins) return Response.json({ error: `Coin kurang (${s.coins}/${box.cost_coins})` }, { status: 400, headers: corsHeaders });
          await admin.from("daily_streaks").update({ streak_coins: s.coins - box.cost_coins }).eq("id", s.id);
          costPaid = box.cost_coins;
          payMethod = "coin";
        }
      }

      const reward = pickWeighted(box.reward_pool || []);
      if (!reward) return Response.json({ error: "Box kosong" }, { status: 500, headers: corsHeaders });

      await applyReward(admin, visitorId, reward.type, reward.value);
      await admin.from("streak_daily_mystery_claims").insert({
        visitor_id: visitorId, box_id: boxId, claim_date: today, payment_method: payMethod, cost_paid: costPaid,
        rarity: reward.rarity || "common", reward_type: reward.type, reward_value: reward.value, reward_label: reward.label,
      });
      await admin.from("notifications").insert({
        visitor_id: visitorId, title: `${box.icon} ${box.name}`, message: `Dapat: ${reward.label}`, type: "mystery_box",
      });

      return Response.json({ success: true, reward, cost: costPaid, payment_method: payMethod }, { headers: corsHeaders });
    }

    // ==================== BUY ROTATING ====================
    if (action === "buy_rotating") {
      const { activeId, paymentMethod } = body;
      const { data: active } = await admin.from("streak_rotating_shop_active")
        .select("*, item:streak_rotating_shop_items(*)")
        .eq("id", activeId).eq("rotation_date", today).maybeSingle();
      if (!active || !active.item) return Response.json({ error: "Item tidak tersedia hari ini" }, { status: 404, headers: corsHeaders });

      const { count: usedToday } = await admin
        .from("streak_rotating_shop_purchases")
        .select("id", { count: "exact", head: true })
        .eq("visitor_id", visitorId)
        .eq("active_id", activeId)
        .eq("purchase_date", today);
      if ((usedToday || 0) >= active.daily_limit) {
        return Response.json({ error: `Item ini limit ${active.daily_limit}x per hari` }, { status: 400, headers: corsHeaders });
      }

      const item = active.item;
      const finalCoins = Math.floor(item.base_cost_coins * (1 - active.discount_pct / 100));
      const finalGems = Math.floor(item.base_cost_gems * (1 - active.discount_pct / 100));

      let costPaid = 0;
      let payMethod = "coin";
      if (paymentMethod === "gem" && finalGems > 0) {
        const userGems = await getGems(admin, visitorId);
        if (userGems < finalGems) return Response.json({ error: `Gem kurang (${userGems}/${finalGems})` }, { status: 400, headers: corsHeaders });
        await deductGems(admin, visitorId, finalGems);
        await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: -finalGems, type: "rotating_shop", description: `Beli ${item.name}` });
        costPaid = finalGems;
        payMethod = "gem";
      } else {
        const s = await getCoins(admin, visitorId);
        if (s.coins < finalCoins) return Response.json({ error: `Coin kurang (${s.coins}/${finalCoins})` }, { status: 400, headers: corsHeaders });
        await admin.from("daily_streaks").update({ streak_coins: s.coins - finalCoins }).eq("id", s.id);
        costPaid = finalCoins;
        payMethod = "coin";
      }

      await applyReward(admin, visitorId, item.reward_type, item.reward_value);
      await admin.from("streak_rotating_shop_purchases").insert({
        visitor_id: visitorId, active_id: activeId, item_id: item.id, purchase_date: today, payment_method: payMethod,
        cost_paid: costPaid, reward_type: item.reward_type, reward_value: item.reward_value, reward_label: item.reward_label,
      });

      return Response.json({ success: true, cost: costPaid, payment_method: payMethod, reward_label: item.reward_label }, { headers: corsHeaders });
    }

    // ==================== CLAIM EVENT ====================
    if (action === "claim_event") {
      const { eventId } = body;
      const { data: ev } = await admin.from("streak_mini_events").select("*").eq("id", eventId).eq("is_active", true).maybeSingle();
      if (!ev) return Response.json({ error: "Event tidak ditemukan" }, { status: 404, headers: corsHeaders });

      // compute progress on the fly based on event_type
      let currentValue = 0;
      const sinceIso = ev.starts_at;
      if (ev.event_type === "streak_count") {
        const { data: streak } = await admin.from("daily_streaks").select("current_streak").eq("visitor_id", visitorId).maybeSingle();
        currentValue = streak?.current_streak || 0;
      } else if (ev.event_type === "claim_count") {
        const { count } = await admin.from("daily_gift_box_claims").select("id", { count: "exact", head: true }).eq("visitor_id", visitorId).gte("claimed_at", sinceIso);
        currentValue = count || 0;
      } else if (ev.event_type === "coin_earned") {
        // Heuristik: pakai total streak_coins saat ini sebagai proxy
        const { data: streak } = await admin.from("daily_streaks").select("streak_coins").eq("visitor_id", visitorId).maybeSingle();
        currentValue = streak?.streak_coins || 0;
      } else if (ev.event_type === "gem_earned") {
        const { data: gtx } = await admin.from("gem_transactions").select("amount").eq("visitor_id", visitorId).gt("amount", 0).gte("created_at", sinceIso);
        currentValue = (gtx || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
      }

      // upsert progress
      const { data: existing } = await admin.from("streak_mini_event_progress").select("*").eq("visitor_id", visitorId).eq("event_id", eventId).maybeSingle();
      if (existing?.is_claimed) return Response.json({ error: "Sudah diklaim" }, { status: 400, headers: corsHeaders });

      if (currentValue < ev.target_value) {
        if (existing) await admin.from("streak_mini_event_progress").update({ current_value: currentValue }).eq("id", existing.id);
        else await admin.from("streak_mini_event_progress").insert({ visitor_id: visitorId, event_id: eventId, current_value: currentValue });
        return Response.json({ error: `Progress belum cukup (${currentValue}/${ev.target_value})` }, { status: 400, headers: corsHeaders });
      }

      // give rewards
      if (ev.reward_coins > 0) await applyReward(admin, visitorId, "streak_coins", ev.reward_coins);
      if (ev.reward_gems > 0) await applyReward(admin, visitorId, "gems", ev.reward_gems);

      if (existing) {
        await admin.from("streak_mini_event_progress").update({ current_value: currentValue, is_claimed: true, claimed_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await admin.from("streak_mini_event_progress").insert({ visitor_id: visitorId, event_id: eventId, current_value: currentValue, is_claimed: true, claimed_at: new Date().toISOString() });
      }

      await admin.from("notifications").insert({
        visitor_id: visitorId, title: `🎯 Event: ${ev.name}`, message: ev.reward_label || "Hadiah event diberikan!", type: "mini_event",
      });

      return Response.json({ success: true, reward_coins: ev.reward_coins, reward_gems: ev.reward_gems, reward_label: ev.reward_label }, { headers: corsHeaders });
    }

    // ==================== ATTACK BOSS ====================
    if (action === "attack_boss") {
      const { bossId } = body;
      const { data: boss } = await admin.from("streak_community_bosses").select("*").eq("id", bossId).eq("is_active", true).maybeSingle();
      if (!boss) return Response.json({ error: "Boss tidak ditemukan" }, { status: 404, headers: corsHeaders });
      if (boss.is_defeated || boss.current_hp <= 0) return Response.json({ error: "Boss sudah kalah!" }, { status: 400, headers: corsHeaders });

      const s = await getCoins(admin, visitorId);
      if (s.coins < boss.attack_cost_coins) return Response.json({ error: `Coin kurang (${s.coins}/${boss.attack_cost_coins})` }, { status: 400, headers: corsHeaders });

      const damage = Math.floor(boss.attack_damage_min + Math.random() * (boss.attack_damage_max - boss.attack_damage_min + 1));
      const newHp = Math.max(0, boss.current_hp - damage);
      const isKill = newHp <= 0 && !boss.is_defeated;

      await admin.from("daily_streaks").update({ streak_coins: s.coins - boss.attack_cost_coins }).eq("id", s.id);
      await admin.from("streak_community_bosses").update({ current_hp: newHp, is_defeated: isKill }).eq("id", bossId);
      await admin.from("streak_community_boss_attacks").insert({
        visitor_id: visitorId, boss_id: bossId, damage_dealt: damage, cost_paid: boss.attack_cost_coins, is_killing_blow: isKill,
      });

      // If defeated, distribute rewards to top 50% contributors
      let killReward = null;
      if (isKill) {
        const { data: contribs } = await admin.from("streak_community_boss_attacks").select("visitor_id, damage_dealt").eq("boss_id", bossId);
        const map: Record<string, number> = {};
        (contribs || []).forEach((a: any) => { map[a.visitor_id] = (map[a.visitor_id] || 0) + a.damage_dealt; });
        const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
        const topHalf = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
        for (const [vid] of topHalf) {
          if (boss.reward_coins > 0) await applyReward(admin, vid, "streak_coins", boss.reward_coins);
          if (boss.reward_gems > 0) await applyReward(admin, vid, "gems", boss.reward_gems);
          await admin.from("notifications").insert({
            visitor_id: vid, title: `🏆 Boss ${boss.name} Kalah!`, message: `Hadiah: ${boss.reward_label}`, type: "boss_raid",
          });
        }
        killReward = { coins: boss.reward_coins, gems: boss.reward_gems, label: boss.reward_label };
      }

      return Response.json({ success: true, damage, new_hp: newHp, is_kill: isKill, kill_reward: killReward }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});