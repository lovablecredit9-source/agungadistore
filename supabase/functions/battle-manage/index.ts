import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, visitorId, battleId, betGems = 0, score = 0, opponentId } = body;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (!visitorId) return Response.json({ error: "visitorId wajib" }, { status: 400, headers: corsHeaders });

    // GET LIST
    if (action === "list") {
      const { data: open } = await admin
        .from("streak_battles")
        .select("*")
        .eq("status", "open")
        .gte("expires_at", new Date().toISOString())
        .neq("challenger_id", visitorId)
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: mine } = await admin
        .from("streak_battles")
        .select("*")
        .or(`challenger_id.eq.${visitorId},opponent_id.eq.${visitorId}`)
        .order("created_at", { ascending: false })
        .limit(20);

      const ids = new Set<string>();
      [...(open || []), ...(mine || [])].forEach((b: any) => {
        ids.add(b.challenger_id);
        if (b.opponent_id) ids.add(b.opponent_id);
      });

      const { data: profs } = await admin
        .from("game_profiles")
        .select("visitor_id, display_name, avatar_url")
        .in("visitor_id", Array.from(ids).length ? Array.from(ids) : ["__none__"]);
      const profMap = Object.fromEntries((profs || []).map((p: any) => [p.visitor_id, p]));

      const enrich = (b: any) => ({
        ...b,
        challenger_name: profMap[b.challenger_id]?.display_name || "Pemain",
        challenger_avatar: profMap[b.challenger_id]?.avatar_url || null,
        opponent_name: b.opponent_id ? (profMap[b.opponent_id]?.display_name || "Pemain") : null,
        opponent_avatar: b.opponent_id ? (profMap[b.opponent_id]?.avatar_url || null) : null,
      });

      return Response.json({
        open: (open || []).map(enrich),
        mine: (mine || []).map(enrich),
      }, { headers: corsHeaders });
    }

    // CREATE BATTLE
    if (action === "create") {
      if (betGems < 10 || betGems > 1000) {
        return Response.json({ error: "Taruhan Gem 10–1000" }, { status: 400, headers: corsHeaders });
      }
      const { data: prof } = await admin.from("game_profiles").select("gems").eq("visitor_id", visitorId).maybeSingle();
      if (!prof || (prof.gems || 0) < betGems) {
        return Response.json({ error: "Gem tidak cukup" }, { status: 400, headers: corsHeaders });
      }
      // Deduct gems
      await admin.from("game_profiles").update({ gems: (prof.gems || 0) - betGems }).eq("visitor_id", visitorId);
      await admin.from("gem_transactions").insert({
        visitor_id: visitorId,
        amount: -betGems,
        type: "battle_bet",
        description: `Taruhan battle ${betGems} 💎`,
      });
      const { data: battle, error } = await admin.from("streak_battles").insert({
        challenger_id: visitorId,
        bet_gems: betGems,
        status: "open",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }).select().single();
      if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
      return Response.json({ battle }, { headers: corsHeaders });
    }

    // ACCEPT BATTLE
    if (action === "accept") {
      const { data: battle } = await admin.from("streak_battles").select("*").eq("id", battleId).maybeSingle();
      if (!battle || battle.status !== "open") {
        return Response.json({ error: "Battle tidak tersedia" }, { status: 400, headers: corsHeaders });
      }
      if (battle.challenger_id === visitorId) {
        return Response.json({ error: "Tidak bisa terima battle sendiri" }, { status: 400, headers: corsHeaders });
      }
      const { data: prof } = await admin.from("game_profiles").select("gems").eq("visitor_id", visitorId).maybeSingle();
      if (!prof || (prof.gems || 0) < battle.bet_gems) {
        return Response.json({ error: "Gem tidak cukup" }, { status: 400, headers: corsHeaders });
      }
      await admin.from("game_profiles").update({ gems: (prof.gems || 0) - battle.bet_gems }).eq("visitor_id", visitorId);
      await admin.from("gem_transactions").insert({
        visitor_id: visitorId,
        amount: -battle.bet_gems,
        type: "battle_bet",
        description: `Terima battle ${battle.bet_gems} 💎`,
      });
      await admin.from("streak_battles").update({
        opponent_id: visitorId,
        status: "active",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }).eq("id", battleId);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // SUBMIT SCORE
    if (action === "submit_score") {
      const { data: battle } = await admin.from("streak_battles").select("*").eq("id", battleId).maybeSingle();
      if (!battle || battle.status !== "active") {
        return Response.json({ error: "Battle tidak aktif" }, { status: 400, headers: corsHeaders });
      }
      const isChallenger = battle.challenger_id === visitorId;
      const isOpponent = battle.opponent_id === visitorId;
      if (!isChallenger && !isOpponent) {
        return Response.json({ error: "Bukan peserta" }, { status: 403, headers: corsHeaders });
      }
      const updates: any = {};
      if (isChallenger) updates.challenger_score = score;
      else updates.opponent_score = score;

      const newCs = isChallenger ? score : battle.challenger_score;
      const newOs = isOpponent ? score : battle.opponent_score;

      // Both submitted? Resolve
      const bothDone = (isChallenger && battle.opponent_score > 0) || (isOpponent && battle.challenger_score > 0);
      if (bothDone) {
        const winnerId = newCs > newOs ? battle.challenger_id : (newOs > newCs ? battle.opponent_id : null);
        const prize = battle.bet_gems * 2;
        updates.status = "settled";
        updates.winner_id = winnerId;
        updates.prize_gems = winnerId ? prize : 0;
        updates.resolved_at = new Date().toISOString();

        if (winnerId) {
          const { data: wp } = await admin.from("game_profiles").select("gems").eq("visitor_id", winnerId).maybeSingle();
          await admin.from("game_profiles").update({ gems: (wp?.gems || 0) + prize }).eq("visitor_id", winnerId);
          await admin.from("gem_transactions").insert({
            visitor_id: winnerId,
            amount: prize,
            type: "battle_win",
            description: `🏆 Menang battle +${prize} 💎`,
          });
          await admin.from("notifications").insert({
            visitor_id: winnerId,
            title: "🏆 Menang Battle!",
            message: `Kamu menang battle dan dapat ${prize} 💎 Gem!`,
            type: "battle",
          });
          const loserId = winnerId === battle.challenger_id ? battle.opponent_id : battle.challenger_id;
          if (loserId) {
            await admin.from("notifications").insert({
              visitor_id: loserId,
              title: "💔 Kalah Battle",
              message: `Battle selesai. Coba lagi!`,
              type: "battle",
            });
          }
        } else {
          // Draw — refund
          await admin.from("game_profiles").update({ gems: battle.bet_gems }).eq("visitor_id", battle.challenger_id);
          await admin.from("game_profiles").update({ gems: battle.bet_gems }).eq("visitor_id", battle.opponent_id);
        }
      }

      await admin.from("streak_battles").update(updates).eq("id", battleId);
      return Response.json({ success: true, resolved: bothDone }, { headers: corsHeaders });
    }

    // CANCEL OPEN BATTLE (refund)
    if (action === "cancel") {
      const { data: battle } = await admin.from("streak_battles").select("*").eq("id", battleId).maybeSingle();
      if (!battle || battle.challenger_id !== visitorId || battle.status !== "open") {
        return Response.json({ error: "Tidak bisa dibatalkan" }, { status: 400, headers: corsHeaders });
      }
      const { data: prof } = await admin.from("game_profiles").select("gems").eq("visitor_id", visitorId).maybeSingle();
      await admin.from("game_profiles").update({ gems: (prof?.gems || 0) + battle.bet_gems }).eq("visitor_id", visitorId);
      await admin.from("gem_transactions").insert({
        visitor_id: visitorId,
        amount: battle.bet_gems,
        type: "battle_refund",
        description: `Refund battle ${battle.bet_gems} 💎`,
      });
      await admin.from("streak_battles").update({ status: "cancelled" }).eq("id", battleId);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
