import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROULETTE_FREE_PER_DAY = 1;
const ROULETTE_GEM_COST = 30;

// Hadiah Confess Berhadiah: confess Wall yang mencapai jumlah reaksi tertentu
const REWARD_MILESTONES: { reactions: number; gems: number }[] = [
  { reactions: 10, gems: 20 },
  { reactions: 25, gems: 50 },
  { reactions: 50, gems: 100 },
  { reactions: 100, gems: 250 },
];

function todayWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  return wib.toISOString().slice(0, 10);
}

type DB = ReturnType<typeof createClient>;

async function getGems(db: DB, visitorId: string): Promise<number> {
  const { data } = await db.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
  return data?.gems ?? 0;
}

async function changeGems(db: DB, visitorId: string, delta: number, type: string, description: string) {
  const { data: prof } = await db.from("game_profiles").select("id, gems").eq("visitor_id", visitorId).maybeSingle();
  if (prof) {
    await db.from("game_profiles").update({ gems: Math.max(0, (prof.gems || 0) + delta) }).eq("id", prof.id);
  } else if (delta > 0) {
    await db.from("game_profiles").insert({ visitor_id: visitorId, gems: delta });
  }
  await db.from("gem_transactions").insert({ visitor_id: visitorId, amount: delta, type, description });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const visitorId = String(body.visitor_id || "").trim();
    if (!visitorId) return Response.json({ error: "visitor_id wajib" }, { status: 400, headers: corsHeaders });

    /* ============ ROULETTE: POST confess acak ============ */
    if (action === "roulette_post") {
      const message = String(body.message || "").trim().slice(0, 500);
      const senderName = body.sender_name ? String(body.sender_name).slice(0, 40) : null;
      const moodTag = body.mood_tag ? String(body.mood_tag).slice(0, 24) : null;
      if (message.length < 3) return Response.json({ error: "Pesan terlalu pendek" }, { status: 400, headers: corsHeaders });

      const today = todayWIB();
      const { data: daily } = await db.from("confess_roulette_daily").select("id, posts_count").eq("visitor_id", visitorId).eq("post_date", today).maybeSingle();
      const used = daily?.posts_count ?? 0;
      let chargedGems = 0;

      if (used >= ROULETTE_FREE_PER_DAY) {
        const gems = await getGems(db, visitorId);
        if (gems < ROULETTE_GEM_COST) {
          return Response.json({ error: `Jatah gratis habis. Butuh ${ROULETTE_GEM_COST} gem (punya ${gems}).`, need_gems: ROULETTE_GEM_COST, have_gems: gems }, { status: 402, headers: corsHeaders });
        }
        await changeGems(db, visitorId, -ROULETTE_GEM_COST, "confess_roulette", "Posting Confess Roulette");
        chargedGems = ROULETTE_GEM_COST;
      }

      await db.from("confess_roulette_posts").insert({ visitor_id: visitorId, sender_name: senderName, message, mood_tag: moodTag });

      if (daily) {
        await db.from("confess_roulette_daily").update({ posts_count: used + 1 }).eq("id", daily.id);
      } else {
        await db.from("confess_roulette_daily").insert({ visitor_id: visitorId, post_date: today, posts_count: 1 });
      }

      return Response.json({ ok: true, charged_gems: chargedGems, free_left: Math.max(0, ROULETTE_FREE_PER_DAY - (used + 1)) }, { headers: corsHeaders });
    }

    /* ============ ROULETTE: DRAW confess acak ============ */
    if (action === "roulette_draw") {
      const { data: seen } = await db.from("confess_roulette_seen").select("post_id").eq("viewer_visitor_id", visitorId);
      const seenIds = (seen || []).map((s: any) => s.post_id);

      let q = db.from("confess_roulette_posts").select("id, sender_name, message, mood_tag, like_count, created_at").eq("is_hidden", false).neq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(60);
      const { data: pool } = await q;
      const candidates = (pool || []).filter((p: any) => !seenIds.includes(p.id));

      const today = todayWIB();
      const { data: daily } = await db.from("confess_roulette_daily").select("posts_count").eq("visitor_id", visitorId).eq("post_date", today).maybeSingle();
      const freeLeft = Math.max(0, ROULETTE_FREE_PER_DAY - (daily?.posts_count ?? 0));

      if (candidates.length === 0) {
        return Response.json({ post: null, free_left: freeLeft, gem_cost: ROULETTE_GEM_COST }, { headers: corsHeaders });
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      return Response.json({ post: pick, remaining: candidates.length, free_left: freeLeft, gem_cost: ROULETTE_GEM_COST }, { headers: corsHeaders });
    }

    /* ============ ROULETTE: REACT (like/pass) ============ */
    if (action === "roulette_react") {
      const postId = String(body.post_id || "");
      const reaction = body.reaction === "like" ? "like" : "pass";
      if (!postId) return Response.json({ error: "post_id wajib" }, { status: 400, headers: corsHeaders });

      const { data: post } = await db.from("confess_roulette_posts").select("id, visitor_id, like_count, pass_count, message").eq("id", postId).maybeSingle();
      if (!post) return Response.json({ error: "Confess tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const { error: seenErr } = await db.from("confess_roulette_seen").insert({ viewer_visitor_id: visitorId, post_id: postId, reaction });
      if (seenErr) {
        // sudah pernah react
        return Response.json({ ok: true, already: true }, { headers: corsHeaders });
      }

      if (reaction === "like") {
        await db.from("confess_roulette_posts").update({ like_count: (post.like_count || 0) + 1 }).eq("id", postId);
        await db.rpc("create_notification", {
          p_visitor_id: post.visitor_id,
          p_title: "💘 Confess kamu disukai!",
          p_message: `Seseorang menyukai confess roulette kamu: "${String(post.message).slice(0, 40)}..."`,
          p_type: "confess",
        }).then(() => {}, () => {});
      } else {
        await db.from("confess_roulette_posts").update({ pass_count: (post.pass_count || 0) + 1 }).eq("id", postId);
      }

      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    /* ============ BERHADIAH: status klaim hadiah ============ */
    if (action === "reward_status") {
      const { data: walls } = await db.from("confess_public_wall").select("id, message, total_reactions, created_at").eq("visitor_id", visitorId).order("total_reactions", { ascending: false }).limit(50);
      const wallIds = (walls || []).map((w: any) => w.id);
      let claimed: any[] = [];
      if (wallIds.length) {
        const { data: c } = await db.from("confess_reward_claims").select("wall_id, milestone").in("wall_id", wallIds);
        claimed = c || [];
      }
      const result = (walls || []).map((w: any) => {
        const reached = REWARD_MILESTONES.filter((m) => (w.total_reactions || 0) >= m.reactions);
        const claimable = reached.filter((m) => !claimed.some((cc: any) => cc.wall_id === w.id && cc.milestone === m.reactions));
        return {
          wall_id: w.id,
          message: w.message,
          total_reactions: w.total_reactions || 0,
          claimable: claimable.map((m) => ({ milestone: m.reactions, gems: m.gems })),
          next: REWARD_MILESTONES.find((m) => (w.total_reactions || 0) < m.reactions) || null,
        };
      }).filter((w: any) => w.total_reactions > 0);

      return Response.json({ items: result, milestones: REWARD_MILESTONES, gems: await getGems(db, visitorId) }, { headers: corsHeaders });
    }

    /* ============ BERHADIAH: klaim hadiah gem ============ */
    if (action === "reward_claim") {
      const wallId = String(body.wall_id || "");
      const milestone = Number(body.milestone || 0);
      const m = REWARD_MILESTONES.find((x) => x.reactions === milestone);
      if (!wallId || !m) return Response.json({ error: "Parameter tidak valid" }, { status: 400, headers: corsHeaders });

      const { data: wall } = await db.from("confess_public_wall").select("id, visitor_id, total_reactions").eq("id", wallId).maybeSingle();
      if (!wall || wall.visitor_id !== visitorId) return Response.json({ error: "Bukan confess kamu" }, { status: 403, headers: corsHeaders });
      if ((wall.total_reactions || 0) < m.reactions) return Response.json({ error: "Reaksi belum mencukupi" }, { status: 400, headers: corsHeaders });

      const { error: claimErr } = await db.from("confess_reward_claims").insert({ visitor_id: visitorId, wall_id: wallId, milestone, gems: m.gems });
      if (claimErr) return Response.json({ error: "Hadiah ini sudah diklaim" }, { status: 409, headers: corsHeaders });

      await changeGems(db, visitorId, m.gems, "confess_reward", `Hadiah Confess Berhadiah (${m.reactions} reaksi)`);
      await db.rpc("create_notification", {
        p_visitor_id: visitorId,
        p_title: "🏆 Hadiah Confess!",
        p_message: `Kamu dapat ${m.gems} gem karena confess-mu mencapai ${m.reactions} reaksi!`,
        p_type: "reward",
      }).then(() => {}, () => {});

      return Response.json({ ok: true, gems_awarded: m.gems, gems: await getGems(db, visitorId) }, { headers: corsHeaders });
    }

    return Response.json({ error: "Aksi tidak dikenal" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
