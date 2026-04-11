import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function hashPassword(pw: string): Promise<string> {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateGuestName(): string {
  const adj = ["Hebat", "Keren", "Jagoan", "Super", "Tangguh", "Cerdas", "Gesit", "Sakti", "Gagah", "Berani"];
  const noun = ["Naga", "Elang", "Harimau", "Rajawali", "Singa", "Garuda", "Serigala", "Banteng", "Panda", "Phoenix"];
  const num = Math.floor(Math.random() * 9999) + 1;
  return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}${num}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    // Auto-create guest profile
    if (action === "get_or_create") {
      const { visitorId } = body;
      if (!visitorId) return json({ error: "visitorId required" }, 400);

      const { data: existing } = await supabase
        .from("game_profiles")
        .select("*")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      if (existing) return json(existing);

      const { data: created, error } = await supabase
        .from("game_profiles")
        .insert({ visitor_id: visitorId, display_name: generateGuestName(), is_guest: true })
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json(created);
    }

    // Register (bind guest → full account)
    if (action === "register") {
      const { visitorId, email, phone, password, displayName } = body;
      if (!visitorId || !password) return json({ error: "Missing fields" }, 400);
      if (!email && !phone) return json({ error: "Email atau No HP wajib diisi" }, 400);
      if (password.length < 6) return json({ error: "Password minimal 6 karakter" }, 400);

      // Check uniqueness
      if (email) {
        const { data: dup } = await supabase.from("game_profiles").select("id").eq("email", email).neq("visitor_id", visitorId).maybeSingle();
        if (dup) return json({ error: "Email sudah digunakan" }, 400);
      }
      if (phone) {
        const { data: dup } = await supabase.from("game_profiles").select("id").eq("phone", phone).neq("visitor_id", visitorId).maybeSingle();
        if (dup) return json({ error: "No HP sudah digunakan" }, 400);
      }

      const pwHash = await hashPassword(password);
      const { data, error } = await supabase
        .from("game_profiles")
        .update({
          email: email || null,
          phone: phone || null,
          password_hash: pwHash,
          display_name: displayName || undefined,
          is_guest: false,
        })
        .eq("visitor_id", visitorId)
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    // Login
    if (action === "login") {
      const { identifier, password } = body;
      if (!identifier || !password) return json({ error: "Missing fields" }, 400);

      const pwHash = await hashPassword(password);
      
      // Try email, phone, or display_name
      const { data: profiles } = await supabase
        .from("game_profiles")
        .select("*")
        .eq("password_hash", pwHash)
        .eq("is_guest", false);

      const match = profiles?.find(p => 
        p.email === identifier || p.phone === identifier || p.display_name === identifier
      );

      if (!match) return json({ error: "Login gagal. Cek kembali email/HP/nama dan password." }, 401);
      return json(match);
    }

    // Update profile
    if (action === "update_profile") {
      const { visitorId, displayName, description } = body;
      if (!visitorId) return json({ error: "visitorId required" }, 400);

      const updates: Record<string, unknown> = {};
      if (displayName !== undefined) {
        if (displayName.length < 3) return json({ error: "Nama minimal 3 karakter" }, 400);
        // Check uniqueness
        const { data: dup } = await supabase.from("game_profiles").select("id").eq("display_name", displayName).neq("visitor_id", visitorId).maybeSingle();
        if (dup) return json({ error: "Nama sudah digunakan" }, 400);
        updates.display_name = displayName;
      }
      if (description !== undefined) updates.description = description;

      const { data, error } = await supabase
        .from("game_profiles")
        .update(updates)
        .eq("visitor_id", visitorId)
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    // Get profile by visitor_id
    if (action === "get_profile") {
      const { visitorId, targetVisitorId } = body;
      const tid = targetVisitorId || visitorId;
      if (!tid) return json({ error: "visitorId required" }, 400);

      const { data: profile } = await supabase.from("game_profiles").select("*").eq("visitor_id", tid).maybeSingle();
      if (!profile) return json({ error: "Profile not found" }, 404);

      // Get stats
      const { data: stats } = await supabase.from("game_stats").select("*").eq("visitor_id", tid);

      // Get follow counts
      const { count: followers } = await supabase.from("game_follows").select("*", { count: "exact", head: true }).eq("following_visitor_id", tid);
      const { count: following } = await supabase.from("game_follows").select("*", { count: "exact", head: true }).eq("follower_visitor_id", tid);

      // Check if current user follows this profile
      let isFollowing = false;
      if (visitorId && visitorId !== tid) {
        const { data: fw } = await supabase.from("game_follows").select("id").eq("follower_visitor_id", visitorId).eq("following_visitor_id", tid).maybeSingle();
        isFollowing = !!fw;
      }

      return json({ ...profile, stats: stats || [], followers: followers || 0, following: following || 0, isFollowing });
    }

    // Follow / Unfollow
    if (action === "follow") {
      const { visitorId, targetVisitorId } = body;
      if (!visitorId || !targetVisitorId || visitorId === targetVisitorId) return json({ error: "Invalid" }, 400);

      const { data: existing } = await supabase.from("game_follows").select("id").eq("follower_visitor_id", visitorId).eq("following_visitor_id", targetVisitorId).maybeSingle();
      
      if (existing) {
        await supabase.from("game_follows").delete().eq("id", existing.id);
        return json({ followed: false });
      } else {
        await supabase.from("game_follows").insert({ follower_visitor_id: visitorId, following_visitor_id: targetVisitorId });
        return json({ followed: true });
      }
    }

    // Search players
    if (action === "search") {
      const { query } = body;
      if (!query || query.length < 2) return json({ error: "Min 2 karakter" }, 400);

      const { data } = await supabase
        .from("game_profiles")
        .select("visitor_id, display_name, description, is_guest")
        .ilike("display_name", `%${query}%`)
        .limit(20);

      return json(data || []);
    }

    // Leaderboard
    if (action === "leaderboard") {
      const { gameType } = body;

      let query = supabase.from("game_stats").select("*").order("points", { ascending: false }).limit(50);
      if (gameType) query = query.eq("game_type", gameType);

      const { data: stats } = await query;
      if (!stats?.length) return json([]);

      // Get profile names
      const vids = [...new Set(stats.map(s => s.visitor_id))];
      const { data: profiles } = await supabase.from("game_profiles").select("visitor_id, display_name, is_guest").in("visitor_id", vids);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.visitor_id, p]));

      const result = stats.map(s => ({
        ...s,
        display_name: profileMap[s.visitor_id]?.display_name || "Pemain",
        is_guest: profileMap[s.visitor_id]?.is_guest ?? true,
      }));

      return json(result);
    }

    // Update stats (called after game ends)
    if (action === "update_stats") {
      const { visitorId, gameType, won, points, questionsAnswered } = body;
      if (!visitorId || !gameType) return json({ error: "Missing fields" }, 400);

      const { data: existing } = await supabase
        .from("game_stats")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("game_type", gameType)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase.from("game_stats").update({
          wins: existing.wins + (won ? 1 : 0),
          losses: existing.losses + (won ? 0 : 1),
          total_questions: existing.total_questions + (questionsAnswered || 1),
          points: existing.points + (points || 0),
        }).eq("id", existing.id).select().single();
        if (error) return json({ error: error.message }, 500);
        return json(data);
      } else {
        const { data, error } = await supabase.from("game_stats").insert({
          visitor_id: visitorId,
          game_type: gameType,
          wins: won ? 1 : 0,
          losses: won ? 0 : 1,
          total_questions: questionsAnswered || 1,
          points: points || 0,
        }).select().single();
        if (error) return json({ error: error.message }, 500);
        return json(data);
      }
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
