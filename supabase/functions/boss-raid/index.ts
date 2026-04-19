import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") ?? "status";
    let body: any = {};
    if (req.method === "POST") { try { body = await req.json(); } catch { body = {}; } if (body?.action) action = body.action; }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const visitorId = body?.visitorId || url.searchParams.get("visitorId");
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    // ============ STATUS ============
    if (action === "status") {
      const { data: raid } = await admin.from("streak_boss_raids").select("*").eq("is_active", true).gt("ends_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!raid) {
        // Check calendar still
        const { data: cal } = await admin.from("streak_event_calendar").select("*").eq("is_active", true).order("sort_order");
        return Response.json({ raid: null, leaderboard: [], my_attack: null, calendar: cal || [], today_event: getTodayEvent(cal || []) }, { headers: corsHeaders });
      }

      const [{ data: leaderboard }, { data: myAttack }, { data: cal }] = await Promise.all([
        admin.from("streak_boss_raid_attacks").select("visitor_id, display_name, total_damage, attack_count").eq("raid_id", raid.id).order("total_damage", { ascending: false }).limit(20),
        admin.from("streak_boss_raid_attacks").select("*").eq("raid_id", raid.id).eq("visitor_id", visitorId).maybeSingle(),
        admin.from("streak_event_calendar").select("*").eq("is_active", true).order("sort_order"),
      ]);

      // total participants
      const { count: participants } = await admin.from("streak_boss_raid_attacks").select("id", { count: "exact", head: true }).eq("raid_id", raid.id);

      return Response.json({
        raid,
        leaderboard: leaderboard || [],
        my_attack: myAttack || null,
        participants: participants || 0,
        calendar: cal || [],
        today_event: getTodayEvent(cal || []),
      }, { headers: corsHeaders });
    }

    // ============ ATTACK ============
    if (action === "attack") {
      const { raidId, attacks = 1, displayName = "Pemain" } = body;
      const { data: raid } = await admin.from("streak_boss_raids").select("*").eq("id", raidId).eq("is_active", true).maybeSingle();
      if (!raid) return Response.json({ error: "Raid tidak ditemukan" }, { status: 404, headers: corsHeaders });
      if (new Date(raid.ends_at).getTime() < Date.now()) return Response.json({ error: "Raid sudah berakhir" }, { status: 400, headers: corsHeaders });
      if (raid.current_hp <= 0) return Response.json({ error: "Boss sudah dikalahkan!" }, { status: 400, headers: corsHeaders });

      const numAttacks = Math.max(1, Math.min(10, Number(attacks) || 1));
      const totalCost = raid.attack_cost_coins * numAttacks;

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak dulu" }, { status: 400, headers: corsHeaders });
      if ((streak.streak_coins || 0) < totalCost) return Response.json({ error: `Butuh ${totalCost} coins` }, { status: 400, headers: corsHeaders });

      // Apply Saturday boss boost from calendar
      const { data: cal } = await admin.from("streak_event_calendar").select("*").eq("is_active", true);
      const todayEvt = getTodayEvent(cal || []);
      const dmgMult = todayEvt?.event_type === "boss_boost" ? Number(todayEvt.multiplier || 1) : 1;
      const dmgPerAttack = Math.floor(raid.damage_per_attack * dmgMult);
      const totalDamage = Math.min(Number(raid.current_hp), dmgPerAttack * numAttacks);
      const newHp = Math.max(0, Number(raid.current_hp) - totalDamage);

      // Deduct & update raid HP
      await admin.from("daily_streaks").update({ streak_coins: streak.streak_coins - totalCost }).eq("visitor_id", visitorId);
      await admin.from("streak_boss_raids").update({ current_hp: newHp, status: newHp <= 0 ? "defeated" : "active" }).eq("id", raidId);

      // Upsert attack record
      const { data: existing } = await admin.from("streak_boss_raid_attacks").select("*").eq("raid_id", raidId).eq("visitor_id", visitorId).maybeSingle();
      if (existing) {
        await admin.from("streak_boss_raid_attacks").update({
          total_damage: existing.total_damage + totalDamage,
          attack_count: existing.attack_count + numAttacks,
          coins_spent: existing.coins_spent + totalCost,
          damage_dealt: totalDamage,
          display_name: displayName || existing.display_name,
        }).eq("id", existing.id);
      } else {
        await admin.from("streak_boss_raid_attacks").insert({
          raid_id: raidId, visitor_id: visitorId, display_name: displayName,
          damage_dealt: totalDamage, total_damage: totalDamage, attack_count: numAttacks, coins_spent: totalCost,
        });
      }

      // If boss defeated, distribute rewards
      let victoryMessage: string | null = null;
      if (newHp <= 0) {
        await distributeRewards(admin, raidId);
        victoryMessage = `🎉 BOSS KALAH! Reward sudah dibagi ke semua peserta!`;
      }

      return Response.json({
        success: true,
        damage: totalDamage,
        new_hp: newHp,
        boost_active: dmgMult > 1,
        boost_multiplier: dmgMult,
        victory: newHp <= 0,
        victoryMessage,
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});

function getTodayEvent(cal: any[]): any | null {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay();
  return cal.find((c) => c.day_of_week === day) || null;
}

async function distributeRewards(admin: any, raidId: string) {
  const { data: raid } = await admin.from("streak_boss_raids").select("*").eq("id", raidId).maybeSingle();
  if (!raid) return;
  const { data: attacks } = await admin.from("streak_boss_raid_attacks").select("*").eq("raid_id", raidId).order("total_damage", { ascending: false });
  if (!attacks || attacks.length === 0) return;
  const totalDmg = attacks.reduce((s: number, a: any) => s + a.total_damage, 0);
  if (totalDmg === 0) return;

  for (let i = 0; i < attacks.length; i++) {
    const a = attacks[i];
    const pct = (a.total_damage / totalDmg) * 100;
    const share = Math.floor((a.total_damage / totalDmg) * raid.victory_reward_pool);
    const reward = share + raid.participation_reward;

    // Add coins
    const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", a.visitor_id).maybeSingle();
    if (streak) {
      await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + reward }).eq("id", streak.id);
    }

    await admin.from("streak_boss_raid_rewards").insert({
      raid_id: raidId, visitor_id: a.visitor_id, reward_coins: reward, rank_position: i + 1, contribution_pct: pct,
    }).select().maybeSingle();

    await admin.from("notifications").insert({
      visitor_id: a.visitor_id,
      title: `🐲 Boss Raid Selesai! Rank #${i + 1}`,
      message: `Kontribusi ${pct.toFixed(1)}% — dapat ${reward} coins!`,
      type: "boss_raid",
    });
  }
}
