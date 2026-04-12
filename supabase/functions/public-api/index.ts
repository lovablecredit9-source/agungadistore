import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: keyData, error: keyErr } = await supabase
    .from("api_keys")
    .select("*")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .maybeSingle();

  if (keyErr || !keyData) {
    return new Response(JSON.stringify({ error: "Invalid or inactive API key" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id);

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") || "";

  try {
    let result: any = null;

    switch (endpoint) {
      case "products": {
        const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "sponsors": {
        const { data } = await supabase.from("sponsors").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "balances": {
        const { data } = await supabase.from("user_balances").select("id, visitor_id, username, phone, email, balance, created_at");
        result = data;
        break;
      }
      case "songs": {
        const { data } = await supabase.from("playlist_songs").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "deposits": {
        const { data } = await supabase.from("deposits").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "notifications": {
        if (req.method === "POST") {
          const body = await req.json();
          const { visitor_id, title, message, type } = body;
          if (!visitor_id || !title) {
            return new Response(JSON.stringify({ error: "visitor_id and title required" }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const { data, error } = await supabase.from("notifications").insert({
            visitor_id, title, message: message || "", type: type || "info",
          }).select().single();
          if (error) throw error;
          result = data;
        } else {
          const vid = url.searchParams.get("visitor_id");
          let q = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
          if (vid) q = q.eq("visitor_id", vid);
          const { data } = await q;
          result = data;
        }
        break;
      }
      case "tokens": {
        const { data } = await supabase.from("tokens").select("*, products(title)").order("created_at", { ascending: false });
        result = data;
        break;
      }
      // === NEW ENDPOINTS ===
      case "transactions": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("balance_transactions").select("*").order("created_at", { ascending: false }).limit(50);
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "streaks": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("daily_streaks").select("*");
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "game_credits": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("user_game_credits").select("*");
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "game_stats": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("game_stats").select("*");
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "game_profiles": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("game_profiles").select("id, visitor_id, display_name, description, avatar_url, is_guest, created_at");
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "tickets": {
        const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(50);
        result = data;
        break;
      }
      case "playlists": {
        const { data } = await supabase.from("playlists").select("*, playlist_items(song_id)").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "artists": {
        const { data } = await supabase.from("artists").select("*").order("name");
        result = data;
        break;
      }
      case "public_songs": {
        const { data } = await supabase.from("public_songs").select("*").order("created_at", { ascending: false }).limit(50);
        result = data;
        break;
      }
      case "storage": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("user_music_storage").select("*");
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "add_balance": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const body = await req.json();
        const { visitor_id, amount, description } = body;
        if (!visitor_id || !amount) {
          return new Response(JSON.stringify({ error: "visitor_id and amount required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Update balance
        const { data: user } = await supabase.from("user_balances").select("id, balance").eq("visitor_id", visitor_id).maybeSingle();
        if (!user) {
          return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const newBalance = user.balance + Number(amount);
        await supabase.from("user_balances").update({ balance: newBalance }).eq("id", user.id);
        await supabase.from("balance_transactions").insert({
          visitor_id, type: Number(amount) >= 0 ? "topup" : "debit", amount: Math.abs(Number(amount)),
          description: description || (Number(amount) >= 0 ? "Top up via API" : "Debit via API"),
        });
        result = { visitor_id, new_balance: newBalance };
        break;
      }
      case "broadcast": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const body = await req.json();
        const { title, message, type } = body;
        if (!title) {
          return new Response(JSON.stringify({ error: "title required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: users } = await supabase.from("user_balances").select("visitor_id");
        if (users && users.length > 0) {
          const notifs = users.map((u: any) => ({
            visitor_id: u.visitor_id, title, message: message || "", type: type || "info",
          }));
          await supabase.from("notifications").insert(notifs);
        }
        result = { sent_to: users?.length || 0 };
        break;
      }
      default:
        return new Response(JSON.stringify({
          error: "Unknown endpoint",
          available: [
            "products", "sponsors", "balances", "songs", "deposits",
            "notifications", "tokens", "transactions", "streaks",
            "game_credits", "game_stats", "game_profiles", "tickets",
            "playlists", "artists", "public_songs", "storage",
            "add_balance (POST)", "broadcast (POST)",
          ],
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
