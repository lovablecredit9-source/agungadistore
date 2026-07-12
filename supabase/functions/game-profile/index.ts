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

// Achievement definitions (server-side mirror)
const ACHIEVEMENTS = [
  { key: "first_win", check: (s: any) => s.totalWins >= 1 },
  { key: "ten_wins", check: (s: any) => s.totalWins >= 10 },
  { key: "fifty_wins", check: (s: any) => s.totalWins >= 50 },
  { key: "hundred_wins", check: (s: any) => s.totalWins >= 100 },
  { key: "first_play", check: (s: any) => s.totalGames >= 1 },
  { key: "fifty_games", check: (s: any) => s.totalGames >= 50 },
  { key: "two_hundred_games", check: (s: any) => s.totalGames >= 200 },
  { key: "hundred_points", check: (s: any) => s.totalPoints >= 100 },
  { key: "thousand_points", check: (s: any) => s.totalPoints >= 1000 },
  { key: "five_thousand_points", check: (s: any) => s.totalPoints >= 5000 },
  { key: "all_games", check: (s: any) => s.uniqueGames >= 5 },
  { key: "marathon", check: (s: any) => s.uniqueGames >= 10 },
];

// Daily challenge = pick game deterministically by date
const ALL_GAMES = ["suit", "tebak", "tebak_gambar", "teka_teki", "tebak_angka", "tebak_barang", "ular_tangga", "ludo", "kuis", "teka_teki_v2", "pilihan_ganda"];
const LEVEL_THRESHOLDS = [0, 90, 250, 500, 1000, 2000, 4000, 8000];

function getLevelFromPoints(points: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  if (level === LEVEL_THRESHOLDS.length) {
    let threshold = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    while (points >= threshold * 2) {
      level++;
      threshold *= 2;
    }
  }
  return level;
}

function getDailyChallengeGame(): string {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  const dayKey = wib.toISOString().split("T")[0];
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) hash = (hash * 31 + dayKey.charCodeAt(i)) | 0;
  return ALL_GAMES[Math.abs(hash) % ALL_GAMES.length];
}

async function checkAndUnlockAchievements(visitorId: string): Promise<string[]> {
  const { data: stats } = await supabase.from("game_stats").select("*").eq("visitor_id", visitorId);
  if (!stats) return [];
  const totalWins = stats.reduce((s, x) => s + (x.wins || 0), 0);
  const totalGames = stats.reduce((s, x) => s + (x.wins || 0) + (x.losses || 0), 0);
  const totalPoints = stats.reduce((s, x) => s + (x.points || 0), 0);
  const uniqueGames = new Set(stats.map(s => s.game_type)).size;
  const ctx = { totalWins, totalGames, totalPoints, uniqueGames };

  const { data: existing } = await supabase.from("game_achievements").select("achievement_key").eq("visitor_id", visitorId);
  const existingKeys = new Set((existing || []).map((a: any) => a.achievement_key));

  const newlyUnlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!existingKeys.has(a.key) && a.check(ctx)) {
      newlyUnlocked.push(a.key);
    }
  }
  if (newlyUnlocked.length) {
    await supabase.from("game_achievements").insert(newlyUnlocked.map(key => ({
      visitor_id: visitorId,
      achievement_key: key,
    })));
    // Notify
    for (const key of newlyUnlocked) {
      await supabase.from("notifications").insert({
        visitor_id: visitorId,
        title: "🎖️ Achievement Unlocked!",
        message: `Kamu membuka badge: ${key.replace(/_/g, " ").toUpperCase()}`,
        type: "achievement",
      });
    }
  }
  return newlyUnlocked;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "get_daily_challenge") {
      return json({ game_type: getDailyChallengeGame() });
    }

    if (action === "get_or_create") {
      const { visitorId } = body;
      if (!visitorId) return json({ error: "visitorId required" }, 400);

      const { data: balanceUser } = await supabase
        .from("user_balances")
        .select("id, username, phone, email")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      const { data: existing } = await supabase
        .from("game_profiles")
        .select("*")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      if (existing) {
        if (balanceUser) {
          const { data: synced } = await supabase
            .from("game_profiles")
            .update({
              display_name: existing.is_guest ? balanceUser.username : existing.display_name,
              email: balanceUser.email || existing.email || null,
              phone: balanceUser.phone || existing.phone || null,
              is_guest: false,
              user_balance_id: balanceUser.id,
            })
            .eq("visitor_id", visitorId)
            .select()
            .single();
          return json(synced || existing);
        }
        return json(existing);
      }

      const { data: created, error } = await supabase
        .from("game_profiles")
        .insert({
          visitor_id: visitorId,
          display_name: balanceUser?.username || generateGuestName(),
          email: balanceUser?.email || null,
          phone: balanceUser?.phone || null,
          user_balance_id: balanceUser?.id || null,
          is_guest: !balanceUser,
        })
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json(created);
    }

    if (action === "register") {
      const { visitorId, email, phone, password, displayName } = body;
      if (!visitorId || !password) return json({ error: "Missing fields" }, 400);
      if (!email && !phone) return json({ error: "Email atau No HP wajib diisi" }, 400);
      if (password.length < 6) return json({ error: "Password minimal 6 karakter" }, 400);

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

    if (action === "login") {
      const { identifier, password } = body;
      if (!identifier || !password) return json({ error: "Missing fields" }, 400);

      const pwHash = await hashPassword(password);
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

    if (action === "update_profile") {
      const { visitorId, displayName, description } = body;
      if (!visitorId) return json({ error: "visitorId required" }, 400);

      const updates: Record<string, unknown> = {};
      if (displayName !== undefined) {
        if (displayName.length < 3) return json({ error: "Nama minimal 3 karakter" }, 400);
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

    if (action === "get_profile") {
      const { visitorId, targetVisitorId } = body;
      const tid = targetVisitorId || visitorId;
      if (!tid) return json({ error: "visitorId required" }, 400);

      const { data: profile } = await supabase.from("game_profiles").select("*").eq("visitor_id", tid).maybeSingle();
      if (!profile) return json({ error: "Profile not found" }, 404);

      const { data: stats } = await supabase.from("game_stats").select("*").eq("visitor_id", tid);
      const { count: followers } = await supabase.from("game_follows").select("*", { count: "exact", head: true }).eq("following_visitor_id", tid);
      const { count: following } = await supabase.from("game_follows").select("*", { count: "exact", head: true }).eq("follower_visitor_id", tid);

      let isFollowing = false;
      if (visitorId && visitorId !== tid) {
        const { data: fw } = await supabase.from("game_follows").select("id").eq("follower_visitor_id", visitorId).eq("following_visitor_id", tid).maybeSingle();
        isFollowing = !!fw;
      }

      const { data: achievements } = await supabase.from("game_achievements").select("achievement_key, unlocked_at").eq("visitor_id", tid);

      return json({ ...profile, stats: stats || [], followers: followers || 0, following: following || 0, isFollowing, achievements: achievements || [] });
    }

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

    if (action === "leaderboard") {
      const { gameType, scope = "all" } = body;
      let query = supabase.from("game_stats").select("*").order("points", { ascending: false }).limit(50);
      if (gameType) query = query.eq("game_type", gameType);

      const { data: stats } = await query;
      if (!stats?.length) return json([]);

      // Aggregate by visitor for global scope
      let result: any[];
      if (scope === "global") {
        const agg: Record<string, any> = {};
        for (const s of stats) {
          if (!agg[s.visitor_id]) agg[s.visitor_id] = { visitor_id: s.visitor_id, points: 0, wins: 0, losses: 0, total_questions: 0 };
          agg[s.visitor_id].points += s.points || 0;
          agg[s.visitor_id].wins += s.wins || 0;
          agg[s.visitor_id].losses += s.losses || 0;
          agg[s.visitor_id].total_questions += s.total_questions || 0;
        }
        result = Object.values(agg).sort((a: any, b: any) => b.points - a.points).slice(0, 20);
      } else {
        result = stats;
      }

      const vids = [...new Set(result.map((s: any) => s.visitor_id))];
      const { data: profiles } = await supabase.from("game_profiles").select("visitor_id, display_name, is_guest, avatar_url").in("visitor_id", vids);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.visitor_id, p]));

      return json(result.map((s: any) => ({
        ...s,
        display_name: profileMap[s.visitor_id]?.display_name || "Pemain",
        is_guest: profileMap[s.visitor_id]?.is_guest ?? true,
        avatar_url: profileMap[s.visitor_id]?.avatar_url || null,
      })));
    }

    if (action === "update_stats") {
      const { visitorId, gameType, won, points, questionsAnswered, basePoints } = body;
      if (!visitorId || !gameType) return json({ error: "Missing fields" }, 400);

      // Daily challenge bonus 2x
      const dailyGame = getDailyChallengeGame();
      const isDailyChallenge = gameType === dailyGame;
      const rawAwardedPoints = Number(points || 0);
      const rawBasePoints = Number(basePoints);
      const hasBasePoints = Number.isFinite(rawBasePoints) && rawBasePoints >= 0;

      let boosterMultiplier = 1;
      if (hasBasePoints && rawBasePoints > 0) {
        const { data: powerUpState } = await supabase
          .from("user_power_ups")
          .select("double_xp_until")
          .eq("visitor_id", visitorId)
          .maybeSingle();

        const doubleXpUntil = powerUpState?.double_xp_until
          ? new Date(powerUpState.double_xp_until).getTime()
          : 0;

        boosterMultiplier = doubleXpUntil > Date.now() ? 2 : 1;
      }

      const dailyMultiplier = isDailyChallenge ? 2 : 1;
      const finalPoints = hasBasePoints
        ? Math.round(rawBasePoints * boosterMultiplier * dailyMultiplier)
        : Math.round(Math.max(0, rawAwardedPoints) * dailyMultiplier);

      const { data: existing } = await supabase
        .from("game_stats")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("game_type", gameType)
        .maybeSingle();

      let result;
      if (existing) {
        const { data, error } = await supabase.from("game_stats").update({
          wins: existing.wins + (won ? 1 : 0),
          losses: existing.losses + (won ? 0 : 1),
          total_questions: existing.total_questions + (questionsAnswered || 1),
          points: existing.points + finalPoints,
        }).eq("id", existing.id).select().single();
        if (error) return json({ error: error.message }, 500);
        result = data;
      } else {
        const { data, error } = await supabase.from("game_stats").insert({
          visitor_id: visitorId,
          game_type: gameType,
          wins: won ? 1 : 0,
          losses: won ? 0 : 1,
          total_questions: questionsAnswered || 1,
          points: finalPoints,
        }).select().single();
        if (error) return json({ error: error.message }, 500);
        result = data;
      }

      // Submit to active tournament
      if (won || finalPoints > 0) {
        const { data: tournament } = await supabase
          .from("tournaments")
          .select("id")
          .eq("is_active", true)
          .eq("is_settled", false)
          .lte("starts_at", new Date().toISOString())
          .gte("ends_at", new Date().toISOString())
          .maybeSingle();
        if (tournament) {
          const { data: existingEntry } = await supabase
            .from("tournament_entries")
            .select("*")
            .eq("tournament_id", tournament.id)
            .eq("visitor_id", visitorId)
            .maybeSingle();
          if (existingEntry) {
            await supabase.from("tournament_entries").update({
              total_points: existingEntry.total_points + finalPoints,
              total_wins: existingEntry.total_wins + (won ? 1 : 0),
              updated_at: new Date().toISOString(),
            }).eq("id", existingEntry.id);
          } else {
            await supabase.from("tournament_entries").insert({
              tournament_id: tournament.id,
              visitor_id: visitorId,
              total_points: finalPoints,
              total_wins: won ? 1 : 0,
            });
          }
        }
      }

      // Update weekly challenge progress for game_wins
      if (won) {
        try {
          const { data: chs } = await supabase
            .from("weekly_challenges")
            .select("*")
            .eq("is_active", true)
            .eq("challenge_type", "game_wins")
            .lte("starts_at", new Date().toISOString())
            .gte("ends_at", new Date().toISOString());
          for (const ch of (chs || [])) {
            const { data: existingProg } = await supabase
              .from("weekly_challenge_progress")
              .select("*")
              .eq("challenge_id", ch.id)
              .eq("visitor_id", visitorId)
              .maybeSingle();
            if (existingProg) {
              if (!existingProg.is_completed) {
                const newVal = existingProg.current_value + 1;
                await supabase.from("weekly_challenge_progress").update({
                  current_value: newVal,
                  is_completed: newVal >= ch.target_value,
                  updated_at: new Date().toISOString(),
                }).eq("id", existingProg.id);
              }
            } else {
              await supabase.from("weekly_challenge_progress").insert({
                challenge_id: ch.id,
                visitor_id: visitorId,
                current_value: 1,
                is_completed: 1 >= ch.target_value,
              });
            }
          }
        } catch (_) { /* ignore */ }
      }

      // Check achievements
      const newAchievements = await checkAndUnlockAchievements(visitorId);

      try {
        const { data: allStats } = await supabase
          .from("game_stats")
          .select("points")
          .eq("visitor_id", visitorId);
        const totalPoints = (allStats || []).reduce((sum: number, row: any) => sum + Math.max(0, Number(row.points) || 0), 0);
        const { data: levelRow } = await supabase
          .from("game_levels")
          .select("total_points")
          .eq("visitor_id", visitorId)
          .maybeSingle();
        const mergedPoints = Math.max(totalPoints, Number(levelRow?.total_points) || 0);
        await supabase
          .from("game_levels")
          .upsert({
            visitor_id: visitorId,
            level: getLevelFromPoints(mergedPoints),
            total_points: mergedPoints,
          }, { onConflict: "visitor_id" });
      } catch (_) { /* ignore level sync errors */ }

      return json({
        ...result,
        awardedPoints: finalPoints,
        isDailyChallenge,
        boosterMultiplier,
        multiplier: boosterMultiplier * dailyMultiplier,
        newAchievements,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
