import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims } = await supaUser.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims?.sub || claims.claims.sub !== "7729a4c3-fcf6-4ae1-8424-9e6cc950d0fd") {
      return Response.json({ error: "Forbidden — admin only" }, { status: 403, headers: corsHeaders });
    }

    const { action, query, visitorId, values } = await req.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // search_users: cari user by visitor_id / username / phone / email
    if (action === "search_users") {
      const q = String(query || "").trim();
      if (!q) return Response.json({ users: [] }, { headers: corsHeaders });

      // Cari di user_balances
      const { data: balanceUsers } = await admin
        .from("user_balances")
        .select("id, visitor_id, username, phone, email, balance")
        .or(`username.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,visitor_id.ilike.%${q}%`)
        .limit(20);

      // Tambahkan ringkasan game data
      const users = await Promise.all((balanceUsers || []).map(async (u) => {
        const [{ data: gp }, { data: ds }, { data: pu }, { data: ugc }, { data: gb }] = await Promise.all([
          admin.from("game_profiles").select("gems").eq("visitor_id", u.visitor_id).maybeSingle(),
          admin.from("daily_streaks").select("streak_coins, freeze_count, current_streak").eq("visitor_id", u.visitor_id).maybeSingle(),
          admin.from("user_power_ups").select("auto_hint, time_freeze, extra_life").eq("visitor_id", u.visitor_id).maybeSingle(),
          admin.from("user_game_credits").select("credits").eq("visitor_id", u.visitor_id).maybeSingle(),
          admin.from("game_balance").select("amount").eq("visitor_id", u.visitor_id).maybeSingle(),
        ]);
        return {
          ...u,
          game_balance: gb?.amount ?? 0,
          gems: gp?.gems ?? 0,
          credits: ugc?.credits ?? 0,
          streak_coins: ds?.streak_coins ?? 0,
          streak_freeze: ds?.freeze_count ?? 0,
          current_streak: ds?.current_streak ?? 0,
          hints: pu?.auto_hint ?? 0,
          time_freeze: pu?.time_freeze ?? 0,
          extra_life: pu?.extra_life ?? 0,
        };
      }));

      return Response.json({ users }, { headers: corsHeaders });
    }

    // set_values: atur ulang nilai untuk visitor_id
    if (action === "set_values") {
      if (!visitorId || !values) {
        return Response.json({ error: "visitorId & values wajib" }, { status: 400, headers: corsHeaders });
      }
      const v = values as Record<string, number>;
      const updates: string[] = [];

      // Saldo (user_balances)
      if (typeof v.balance === "number") {
        await admin.from("user_balances").update({ balance: Math.max(0, v.balance) }).eq("visitor_id", visitorId);
        updates.push(`Saldo=Rp${v.balance.toLocaleString("id-ID")}`);
      }

      // Saldo IN (game_balance)
      if (typeof v.game_balance === "number") {
        const newAmt = Math.max(0, v.game_balance);
        const { data: gb } = await admin.from("game_balance").select("id").eq("visitor_id", visitorId).maybeSingle();
        if (gb) {
          await admin.from("game_balance").update({ amount: newAmt }).eq("id", gb.id);
        } else {
          await admin.from("game_balance").insert({ visitor_id: visitorId, amount: newAmt, total_earned: newAmt });
        }
        updates.push(`SaldoIN=Rp${newAmt.toLocaleString("id-ID")}`);
      }

      // Gems
      if (typeof v.gems === "number") {
        const { data: gp } = await admin.from("game_profiles").select("id").eq("visitor_id", visitorId).maybeSingle();
        if (gp) {
          await admin.from("game_profiles").update({ gems: Math.max(0, v.gems) }).eq("id", gp.id);
        } else {
          await admin.from("game_profiles").insert({ visitor_id: visitorId, gems: Math.max(0, v.gems) });
        }
        updates.push(`Gem=${v.gems}`);
      }

      // Credits
      if (typeof v.credits === "number") {
        const { data: ugc } = await admin.from("user_game_credits").select("visitor_id").eq("visitor_id", visitorId).maybeSingle();
        if (ugc) {
          await admin.from("user_game_credits").update({ credits: Math.max(0, v.credits), updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
        } else {
          await admin.from("user_game_credits").insert({ visitor_id: visitorId, credits: Math.max(0, v.credits) });
        }
        updates.push(`Kredit=${v.credits}`);
      }

      // Streak coins / freeze / current_streak
      if (typeof v.streak_coins === "number" || typeof v.streak_freeze === "number" || typeof v.current_streak === "number") {
        const patch: any = {};
        if (typeof v.streak_coins === "number") { patch.streak_coins = Math.max(0, v.streak_coins); updates.push(`KoinStreak=${v.streak_coins}`); }
        if (typeof v.streak_freeze === "number") { patch.freeze_count = Math.max(0, v.streak_freeze); updates.push(`Freeze=${v.streak_freeze}`); }
        if (typeof v.current_streak === "number") { patch.current_streak = Math.max(0, v.current_streak); updates.push(`Streak=${v.current_streak}`); }
        const { data: ds } = await admin.from("daily_streaks").select("id").eq("visitor_id", visitorId).maybeSingle();
        if (ds) {
          await admin.from("daily_streaks").update(patch).eq("id", ds.id);
        } else {
          const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
          await admin.from("daily_streaks").insert({ visitor_id: visitorId, last_claim_date: today, current_streak: 0, longest_streak: 0, total_claims: 0, ...patch });
        }
      }

      // Power ups: hints / time_freeze / extra_life
      if (typeof v.hints === "number" || typeof v.time_freeze === "number" || typeof v.extra_life === "number") {
        const patch: any = {};
        if (typeof v.hints === "number") { patch.auto_hint = Math.max(0, v.hints); updates.push(`Hint=${v.hints}`); }
        if (typeof v.time_freeze === "number") { patch.time_freeze = Math.max(0, v.time_freeze); updates.push(`TimeFreeze=${v.time_freeze}`); }
        if (typeof v.extra_life === "number") { patch.extra_life = Math.max(0, v.extra_life); updates.push(`ExtraLife=${v.extra_life}`); }
        const { data: pu } = await admin.from("user_power_ups").select("id").eq("visitor_id", visitorId).maybeSingle();
        if (pu) {
          await admin.from("user_power_ups").update(patch).eq("id", pu.id);
        } else {
          await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...patch });
        }
      }

      // Notif ke user
      if (updates.length > 0) {
        await admin.rpc("create_notification", {
          p_visitor_id: visitorId,
          p_title: "⚙️ Data akun diperbarui admin",
          p_message: `Admin memperbarui: ${updates.join(", ")}`,
          p_type: "info",
          p_related_id: null,
        });
      }

      return Response.json({ success: true, updated: updates }, { headers: corsHeaders });
    }

    return Response.json({ error: "action tidak dikenal" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
