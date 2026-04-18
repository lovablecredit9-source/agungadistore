import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Choice = "rock" | "paper" | "scissors";
const ROUND_SECONDS = 60;

function randomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function judge(a: Choice | null, b: Choice | null): "p1" | "p2" | "draw" {
  if (!a && !b) return "draw";
  if (!a) return "p2";
  if (!b) return "p1";
  if (a === b) return "draw";
  if ((a === "rock" && b === "scissors") || (a === "scissors" && b === "paper") || (a === "paper" && b === "rock")) return "p1";
  return "p2";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, visitorId, displayName } = body;
    if (!visitorId) throw new Error("visitorId required");

    if (action === "create") {
      const visibility = body.visibility === "private" ? "private" : "public";
      const code = visibility === "private" ? randomCode() : null;
      const { data, error } = await supa.from("game_pvp_rooms").insert({
        visibility, room_code: code, status: "waiting",
        player1_visitor_id: visitorId,
        player1_name: displayName || "Player 1",
        best_of: 5,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ room: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "quick_match") {
      // find a public room waiting that isn't ours
      const { data: rooms } = await supa.from("game_pvp_rooms")
        .select("*").eq("status", "waiting").eq("visibility", "public")
        .neq("player1_visitor_id", visitorId).is("player2_visitor_id", null)
        .order("created_at", { ascending: true }).limit(1);
      if (rooms && rooms[0]) {
        const room = rooms[0];
        const now = new Date();
        const deadline = new Date(now.getTime() + ROUND_SECONDS * 1000);
        const { data: updated, error } = await supa.from("game_pvp_rooms").update({
          player2_visitor_id: visitorId,
          player2_name: displayName || "Player 2",
          status: "playing",
          round_started_at: now.toISOString(),
          round_deadline_at: deadline.toISOString(),
        }).eq("id", room.id).eq("status", "waiting").select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ room: updated, joined: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // none found, create one
      const { data, error } = await supa.from("game_pvp_rooms").insert({
        visibility: "public", status: "waiting",
        player1_visitor_id: visitorId,
        player1_name: displayName || "Player 1",
        best_of: 5,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ room: data, created: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "join_code") {
      const code = String(body.code || "").trim();
      if (!code) throw new Error("code required");
      const { data: room, error: e1 } = await supa.from("game_pvp_rooms")
        .select("*").eq("room_code", code).eq("status", "waiting").maybeSingle();
      if (e1) throw e1;
      if (!room) throw new Error("Room tidak ditemukan / sudah penuh");
      if (room.player1_visitor_id === visitorId) {
        return new Response(JSON.stringify({ room }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const now = new Date();
      const deadline = new Date(now.getTime() + ROUND_SECONDS * 1000);
      const { data: updated, error } = await supa.from("game_pvp_rooms").update({
        player2_visitor_id: visitorId,
        player2_name: displayName || "Player 2",
        status: "playing",
        round_started_at: now.toISOString(),
        round_deadline_at: deadline.toISOString(),
      }).eq("id", room.id).eq("status", "waiting").select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ room: updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "play") {
      const { roomId, choice } = body as { roomId: string; choice: Choice };
      if (!["rock", "paper", "scissors"].includes(choice)) throw new Error("invalid choice");
      const { data: room, error: er } = await supa.from("game_pvp_rooms").select("*").eq("id", roomId).maybeSingle();
      if (er) throw er;
      if (!room) throw new Error("Room not found");
      if (room.status !== "playing") throw new Error("Room sudah selesai");
      const isP1 = room.player1_visitor_id === visitorId;
      const isP2 = room.player2_visitor_id === visitorId;
      if (!isP1 && !isP2) throw new Error("Bukan pemain di room ini");

      const update: any = {};
      if (isP1 && !room.player1_choice) update.player1_choice = choice;
      if (isP2 && !room.player2_choice) update.player2_choice = choice;

      const p1c = isP1 ? choice : room.player1_choice;
      const p2c = isP2 ? choice : room.player2_choice;

      // if both chose -> resolve round
      if (p1c && p2c) {
        const w = judge(p1c as Choice, p2c as Choice);
        let p1s = room.player1_score, p2s = room.player2_score;
        if (w === "p1") p1s++; else if (w === "p2") p2s++;
        const finished = p1s >= 3 || p2s >= 3 || room.current_round >= room.best_of;
        if (finished) {
          update.status = "finished";
          update.winner_visitor_id = p1s > p2s ? room.player1_visitor_id : p2s > p1s ? room.player2_visitor_id : null;
          update.player1_score = p1s; update.player2_score = p2s;
        } else {
          // next round, reset choices
          const now = new Date();
          update.player1_score = p1s; update.player2_score = p2s;
          update.current_round = room.current_round + 1;
          update.player1_choice = null;
          update.player2_choice = null;
          update.round_started_at = now.toISOString();
          update.round_deadline_at = new Date(now.getTime() + ROUND_SECONDS * 1000).toISOString();
        }
      }

      const { data: updated, error: eu } = await supa.from("game_pvp_rooms").update(update).eq("id", roomId).select().single();
      if (eu) throw eu;
      return new Response(JSON.stringify({ room: updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "timeout_check") {
      const { roomId } = body;
      const { data: room } = await supa.from("game_pvp_rooms").select("*").eq("id", roomId).maybeSingle();
      if (!room || room.status !== "playing" || !room.round_deadline_at) {
        return new Response(JSON.stringify({ room }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (new Date(room.round_deadline_at).getTime() > Date.now()) {
        return new Response(JSON.stringify({ room }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // timeout: missing players auto-lose this round
      const w = judge(room.player1_choice as any, room.player2_choice as any);
      let p1s = room.player1_score, p2s = room.player2_score;
      if (w === "p1") p1s++; else if (w === "p2") p2s++;
      const update: any = { player1_score: p1s, player2_score: p2s };
      const finished = p1s >= 3 || p2s >= 3 || room.current_round >= room.best_of;
      if (finished) {
        update.status = "finished";
        update.winner_visitor_id = p1s > p2s ? room.player1_visitor_id : p2s > p1s ? room.player2_visitor_id : null;
      } else {
        const now = new Date();
        update.current_round = room.current_round + 1;
        update.player1_choice = null;
        update.player2_choice = null;
        update.round_started_at = now.toISOString();
        update.round_deadline_at = new Date(now.getTime() + ROUND_SECONDS * 1000).toISOString();
      }
      const { data: updated } = await supa.from("game_pvp_rooms").update(update).eq("id", roomId).select().single();
      return new Response(JSON.stringify({ room: updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "leave") {
      const { roomId } = body;
      await supa.from("game_pvp_rooms").update({ status: "finished" }).eq("id", roomId).eq("status", "waiting");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list_public") {
      const { data } = await supa.from("game_pvp_rooms")
        .select("id, player1_name, created_at, room_code")
        .eq("status", "waiting").eq("visibility", "public").is("player2_visitor_id", null)
        .order("created_at", { ascending: false }).limit(20);
      return new Response(JSON.stringify({ rooms: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
