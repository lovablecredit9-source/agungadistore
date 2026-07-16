import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Awal minggu (Senin) di WIB
function weekStartWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600000);
  const dow = wib.getUTCDay() || 7; // Sun=7
  wib.setUTCDate(wib.getUTCDate() - (dow - 1));
  return wib.toISOString().slice(0, 10);
}

const LAGA_TEMPLATES = [
  { title: "🔥 Marathon Musik Sultan", description: "Dengar musik total 3 jam non-stop di aplikasi", icon: "🎧", requirement_type: "music_seconds", target_value: 10800, reward_saldo_in: 3000, reward_gems: 25, reward_coins: 1500, difficulty: "ekstrem" },
  { title: "💎 Belanja Sultan", description: "Belanja produk total Rp 25.000 dalam 24 jam", icon: "🛒", requirement_type: "purchase_amount", target_value: 1, min_amount: 25000, reward_saldo_in: 5000, reward_gems: 50, reward_coins: 3000, difficulty: "ekstrem" },
  { title: "⚡ Streak Combo 7 Hari", description: "Claim daily streak 7 hari berturut-turut", icon: "🔥", requirement_type: "streak_days", target_value: 7, reward_saldo_in: 4000, reward_gems: 40, reward_coins: 2000, difficulty: "susah" },
  { title: "🎯 Quest Marathon", description: "Selesaikan 15 quest premium reguler dalam 24 jam", icon: "🎯", requirement_type: "quest_claim", target_value: 15, reward_saldo_in: 3500, reward_gems: 30, reward_coins: 2500, difficulty: "susah" },
  { title: "🎮 Game Warrior", description: "Menang 20 game AI dalam 24 jam", icon: "🎮", requirement_type: "game_win", target_value: 20, reward_saldo_in: 2500, reward_gems: 20, reward_coins: 1800, difficulty: "susah" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

    if (action === "status") {
      const { visitorId } = body;
      const today = new Date().toISOString().slice(0, 10);
      const ws = weekStartWIB();
      const { data: quests } = await admin.from("laga_quests").select("*")
        .eq("week_start", ws).eq("is_active", true)
        .lte("active_date", today).order("active_date", { ascending: false });
      const activeQuests = (quests ?? []).filter(q => {
        const activeUntil = new Date(new Date(q.active_date).getTime() + q.duration_hours * 3600000);
        return activeUntil > new Date();
      });
      let progress: any[] = [];
      if (visitorId && activeQuests.length) {
        const { data: pr } = await admin.from("laga_quest_progress").select("*")
          .eq("visitor_id", visitorId).in("quest_id", activeQuests.map(q => q.id));
        progress = pr ?? [];
      }
      return Response.json({ quests: activeQuests, progress, week_start: ws }, { headers: corsHeaders });
    }

    if (action === "schedule_week") {
      // Generate quest laga minggu ini jika belum ada
      const ws = weekStartWIB();
      const { data: existing } = await admin.from("laga_quests").select("id").eq("week_start", ws).limit(1);
      if (existing && existing.length) return Response.json({ success: true, message: "Sudah ada" }, { headers: corsHeaders });

      // Pilih 1-2 template random dan tanggal aktif random dalam minggu itu
      const chosen = [...LAGA_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, 2);
      const wsDate = new Date(ws);
      for (const t of chosen) {
        const dayOffset = Math.floor(Math.random() * 7);
        const activeDate = new Date(wsDate.getTime() + dayOffset * 86400000).toISOString().slice(0, 10);
        await admin.from("laga_quests").insert({ ...t, week_start: ws, active_date: activeDate, duration_hours: 24 });
      }
      return Response.json({ success: true, generated: chosen.length }, { headers: corsHeaders });
    }

    if (action === "claim") {
      const { visitorId, questId } = body;
      const { data: p } = await admin.from("laga_quest_progress").select("*").eq("visitor_id", visitorId).eq("quest_id", questId).maybeSingle();
      if (!p || !p.is_completed) return Response.json({ error: "Quest belum selesai" }, { status: 400, headers: corsHeaders });
      if (p.is_claimed) return Response.json({ error: "Sudah diklaim" }, { status: 400, headers: corsHeaders });
      const { data: q } = await admin.from("laga_quests").select("*").eq("id", questId).maybeSingle();
      if (!q) return Response.json({ error: "Quest tidak ditemukan" }, { status: 404, headers: corsHeaders });

      if (q.reward_saldo_in > 0) await admin.rpc("add_topup_bonus_to_saldo_in", { p_visitor_id: visitorId, p_amount: q.reward_saldo_in });
      if (q.reward_coins > 0) await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: q.reward_coins });
      if (q.reward_gems > 0) {
        const { data: gp } = await admin.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
        if (gp) await admin.from("game_profiles").update({ gems: (gp.gems || 0) + q.reward_gems }).eq("id", gp.id);
      }
      await admin.from("laga_quest_progress").update({ is_claimed: true, claimed_at: new Date().toISOString() }).eq("id", p.id);
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: "⚡ Quest Laga Selesai!",
        message: `${q.title}: +Rp${q.reward_saldo_in} saldo IN, +${q.reward_gems}💎, +${q.reward_coins}🪙`,
        type: "success",
      });
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "admin_create") {
      const { quest } = body;
      await admin.from("laga_quests").insert(quest);
      return Response.json({ success: true }, { headers: corsHeaders });
    }
    if (action === "admin_list") {
      const { data } = await admin.from("laga_quests").select("*").order("week_start", { ascending: false }).order("active_date", { ascending: false });
      return Response.json({ quests: data ?? [] }, { headers: corsHeaders });
    }
    if (action === "admin_delete") {
      await admin.from("laga_quests").delete().eq("id", body.id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
